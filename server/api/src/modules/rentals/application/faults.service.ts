import {
  FAULT_PAGE_SIZE,
  FAULT_PHOTOS_PER_PHASE,
  FAULT_PHOTO_MAX_BYTES,
  FAULT_PHOTO_PHASE_LABEL,
  FAULT_TAB_STATUSES,
  FaultTab,
  faultReopenUntil,
  kigaliToday,
  type AssignFaultRequest,
  type FaultCounts,
  type FaultDetail,
  type FaultListPage,
  type FaultListQuery,
  type FaultMessageRequest,
  type FaultPhotoPhase,
  type MoveFaultRequest,
  type RaiseFaultRequest,
} from '@injishi/contracts';
import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';

import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { TicketLifecycle, type TicketAssignee } from '../../operations/application/ticket-lifecycle';
import { memberHoldsAt } from '../../operations/infrastructure/room-events';
import { RentalsFilesStorage } from '../../storage/application/rentals-files-storage';
import { buildingIdsOf } from '../domain/attention';
import { assertBuildingInScope, assertResidence } from '../domain/residence';
import { FaultsRepository, type FaultRow } from '../infrastructure/faults.repository';
import { RentalsAuditWriter, type DbOrTx } from '../infrastructure/rentals-writers';
import { FaultNotices } from './fault-notices';
import { allowedMoves, assigneeOf, presentEvent, presentFaultItem, presentPhoto, reportedOn } from './faults-presenters';

/** A photo received with a form, not stored yet. */
export interface FaultUpload {
  filename: string;
  body: Buffer;
}

export const FAULT_NOT_FOUND = 'Fault not found.';

/**
 * Faults on the landlord's side (blueprint 2.3 "Faults", WP 4.1): the list by
 * tab with counts, one fault in full, a fault the landlord writes down
 * themselves, moving it along the chain, handing it to someone, photos and
 * messages. Residence businesses only; a fault outside the caller's buildings
 * is 404 like one that does not exist.
 *
 * Every move goes through the shared `TicketLifecycle` (409 on a move the
 * chain refuses), writes an audit row, and emails the tenant in plain words.
 */
@Injectable()
export class FaultsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly faults: FaultsRepository,
    private readonly lifecycle: TicketLifecycle,
    private readonly files: RentalsFilesStorage,
    private readonly notices: FaultNotices,
    private readonly audit: RentalsAuditWriter,
  ) {}

  /** The clock, as a method so a test can pin it. */
  protected now(): Date {
    return new Date();
  }

  async list(ws: ScopedWorkspace, query: FaultListQuery): Promise<FaultListPage> {
    const r = assertResidence(ws);
    const buildings = buildingIdsOf(ws.branchScope);
    const page = query.page ?? 1;
    const filters = { workspaceId: r.workspaceId, buildings, unitId: query.unitId ?? null, q: query.q ?? null };
    const [found, statuses] = await Promise.all([
      this.faults.page({
        ...filters,
        statuses: query.tab ? FAULT_TAB_STATUSES[query.tab] : null,
        limit: FAULT_PAGE_SIZE,
        offset: (page - 1) * FAULT_PAGE_SIZE,
      }),
      this.faults.statusCounts(filters),
    ]);
    const counts = Object.fromEntries(FaultTab.options.map((tab) => [tab, 0])) as FaultCounts;
    for (const tab of FaultTab.options) {
      for (const status of FAULT_TAB_STATUSES[tab]) counts[tab] = (counts[tab] ?? 0) + (statuses.get(status) ?? 0);
    }
    return {
      items: found.rows.map(presentFaultItem),
      total: found.total,
      page,
      pageSize: FAULT_PAGE_SIZE,
      tab: query.tab ?? null,
      counts,
    };
  }

  /** One fault in full: the ticket, its photos and its whole timeline. */
  async detail(ws: ScopedWorkspace, id: string): Promise<FaultDetail> {
    const row = await this.owned(ws, id);
    return this.present(row);
  }

  /** The landlord writes down a fault on one of their units. A tenant living there sees it on their side. */
  async raise(ws: ScopedWorkspace, userId: string, body: RaiseFaultRequest, photos: FaultUpload[]): Promise<FaultDetail> {
    const r = assertResidence(ws);
    const unit = await this.faults.unit(body.unitId);
    if (!unit || unit.workspaceId !== r.workspaceId) throw new NotFoundException('Unit not found.');
    assertBuildingInScope(ws, unit.propertyId, 'Unit');
    if (unit.state === 'retired') throw new ConflictException('This unit is retired, so a fault cannot be raised on it.');
    this.assertPhotoRoom(0, photos.length, 'report');
    const stored = await this.storePhotos(r.workspaceId, userId, photos);
    const id = await this.db.transaction(async (tx) => {
      const reference = await this.faults.nextReference(tx, r.workspaceId);
      const ticketId = await this.faults.insert(tx, {
        workspaceId: r.workspaceId,
        orgId: r.orgId,
        propertyId: unit.propertyId,
        unitId: unit.id,
        leaseId: unit.liveLeaseId,
        reference,
        raisedByUserId: userId,
        raisedByRole: 'staff',
        raisedVia: 'landlord',
        title: body.title,
        description: body.description ?? null,
        category: body.category,
        priority: body.urgency,
        staffMayEnter: body.staffMayEnter ?? null,
      });
      await this.lifecycle.event(tx, {
        ticketId,
        kind: 'reported',
        to: 'open',
        note: null,
        actorUserId: userId,
        actorRole: 'staff',
        visibleToTenant: unit.liveLeaseId !== null,
      });
      await this.attachPhotos(tx, ticketId, userId, 'report', stored, 0);
      await this.audit.write(tx, {
        actorUserId: userId,
        subjectType: 'maintenance_ticket',
        subjectId: ticketId,
        eventType: 'fault.reported',
        diff: { by: 'landlord', unitId: unit.id, leaseId: unit.liveLeaseId, reference, photos: stored.length },
      });
      return ticketId;
    });
    return this.detail(ws, id);
  }

  /** Move a fault along its chain. A move to where it already is changes nothing. */
  async move(ws: ScopedWorkspace, userId: string, id: string, body: MoveFaultRequest): Promise<FaultDetail> {
    const row = await this.owned(ws, id);
    if (body.to === 'assigned' && !assigneeOf(row)) {
      throw new ConflictException('Say who fixes it with Assign. That moves it to Assigned.');
    }
    const outcome = await this.db.transaction(async (tx) => {
      const moved = await this.lifecycle.move(tx, {
        ticketId: row.id,
        to: body.to,
        actorUserId: userId,
        actorRole: 'staff',
        note: body.note ?? null,
        visibleToTenant: row.leaseId !== null,
      });
      if (moved.moved) {
        await this.audit.write(tx, {
          actorUserId: userId,
          subjectType: 'maintenance_ticket',
          subjectId: row.id,
          eventType: 'fault.moved',
          diff: { from: moved.from, to: moved.to },
          reason: body.note ?? null,
        });
      }
      return moved;
    });
    if (outcome.moved) {
      const after = await this.faults.find(row.id);
      if (after) void this.notices.tenantMoved(after, outcome.to, body.note ?? null);
    }
    return this.detail(ws, id);
  }

  /** Hand a fault to someone on the team who works faults here, or to an outside fixer with their phone. */
  async assign(ws: ScopedWorkspace, userId: string, id: string, body: AssignFaultRequest): Promise<FaultDetail> {
    const row = await this.owned(ws, id);
    let assignee: TicketAssignee;
    if (body.memberUserId) {
      const holder =
        row.orgId && row.propertyId
          ? await memberHoldsAt(this.db, { orgId: row.orgId, userId: body.memberUserId, propertyId: row.propertyId, permission: 'ticket.advance' })
          : null;
      if (!holder) {
        throw new BadRequestException({
          message: 'Pick someone on your team who works on faults here, or name a fixer.',
          issues: [{ path: ['memberUserId'], message: 'Pick someone on your team who works on faults here, or name a fixer.' }],
        });
      }
      assignee = { kind: 'member', userId: body.memberUserId, name: holder.name };
    } else {
      assignee = { kind: 'contractor', name: body.contractorName as string, phone: body.contractorPhone ?? null };
    }
    const outcome = await this.db.transaction(async (tx) => {
      const handed = await this.lifecycle.assign(tx, {
        ticketId: row.id,
        assignee,
        actorUserId: userId,
        actorRole: 'staff',
        note: body.note ?? null,
        visibleToTenant: row.leaseId !== null,
        allowedFrom: ['open', 'acknowledged', 'assigned', 'in_progress'],
      });
      if (handed.eventId) {
        await this.audit.write(tx, {
          actorUserId: userId,
          subjectType: 'maintenance_ticket',
          subjectId: row.id,
          eventType: 'fault.assigned',
          diff: { from: handed.from, to: handed.to, assigneeKind: assignee.kind, assigneeName: assignee.name },
        });
      }
      return handed;
    });
    if (outcome.eventId) {
      const after = await this.faults.find(row.id);
      if (after) void this.notices.tenantMoved(after, 'assigned', body.note ?? null);
    }
    return this.detail(ws, id);
  }

  /** Photos of the work: at most four in each phase. */
  async addPhotos(ws: ScopedWorkspace, userId: string, id: string, phase: FaultPhotoPhase, photos: FaultUpload[]): Promise<FaultDetail> {
    const row = await this.owned(ws, id);
    if (photos.length === 0) throw new BadRequestException('Attach at least one photo.');
    if (row.status === 'cancelled') throw new ConflictException('This fault was cancelled.');
    this.assertPhotoRoom(await this.faults.photoCount(this.db, row.id, phase), photos.length, phase);
    const stored = await this.storePhotos(row.workspaceId, userId, photos);
    await this.db.transaction(async (tx) => {
      await this.lifecycle.lock(tx, row.id);
      const have = await this.faults.photoCount(tx, row.id, phase);
      this.assertPhotoRoom(have, stored.length, phase);
      await this.attachPhotos(tx, row.id, userId, phase, stored, have);
      await this.faults.touch(tx, row.id);
    });
    return this.detail(ws, id);
  }

  /**
   * A message on a fault: a reply the tenant sees (which also needs
   * `message.send`, the power to write to tenants), or a note for the team.
   */
  async message(ws: ScopedWorkspace, userId: string, id: string, body: FaultMessageRequest): Promise<FaultDetail> {
    const row = await this.owned(ws, id);
    const toTenant = body.visibleToTenant && row.leaseId !== null;
    if (toTenant && !ws.permissions.includes('message.send')) {
      throw new ForbiddenException('Replying to the tenant needs the permission to send messages. Write a team note instead.');
    }
    await this.db.transaction(async (tx) => {
      await this.lifecycle.lock(tx, row.id);
      await this.lifecycle.event(tx, {
        ticketId: row.id,
        kind: 'note',
        note: body.body,
        actorUserId: userId,
        actorRole: 'staff',
        visibleToTenant: toTenant,
      });
      await this.faults.touch(tx, row.id);
    });
    if (toTenant) void this.notices.tenantReply(row, body.body);
    return this.detail(ws, id);
  }

  // --- Inside -------------------------------------------------------------------

  /** A fault of this residence business, in the caller's buildings, or 404. */
  async owned(ws: ScopedWorkspace, id: string): Promise<FaultRow> {
    const r = assertResidence(ws);
    const row = await this.faults.find(id);
    if (!row || row.workspaceId !== r.workspaceId || (!row.unitId && !row.leaseId)) throw new NotFoundException(FAULT_NOT_FOUND);
    if (row.propertyId) assertBuildingInScope(ws, row.propertyId, 'Fault');
    return row;
  }

  /** The fault as the side panel shows it. */
  async present(row: FaultRow): Promise<FaultDetail> {
    const [photos, events] = await Promise.all([this.faults.photos(row.id), this.faults.events(row.id, { tenantOnly: false })]);
    const urls = await Promise.all(photos.map((p) => this.files.signedUrl(p.objectKey)));
    return {
      ...presentFaultItem(row),
      description: row.description,
      staffMayEnter: row.staffMayEnter,
      assignee: assigneeOf(row),
      acknowledgedAt: row.acknowledgedAt?.toISOString() ?? null,
      resolvedAt: row.resolvedAt?.toISOString() ?? null,
      wontFixReason: row.wontFixReason,
      reopenedCount: row.reopenedCount,
      reopenUntil: row.leaseId ? faultReopenUntil(row.status, row.resolvedAt, kigaliToday(this.now())) : null,
      allowedMoves: allowedMoves(row),
      reportedOn: reportedOn(row),
      photos: photos.map((p, i) => presentPhoto(p, urls[i] as string, row.tenantUserId)),
      events: events.map((e) => presentEvent(e, 'landlord')),
    };
  }

  /** Refuse more photos than a phase holds. */
  assertPhotoRoom(have: number, adding: number, phase: FaultPhotoPhase): void {
    if (have + adding > FAULT_PHOTOS_PER_PHASE) {
      const left = Math.max(0, FAULT_PHOTOS_PER_PHASE - have);
      throw new BadRequestException(
        left === 0
          ? `There are already ${FAULT_PHOTOS_PER_PHASE} photos ${FAULT_PHOTO_PHASE_LABEL[phase].toLowerCase()}.`
          : `Add at most ${left} more ${left === 1 ? 'photo' : 'photos'} ${FAULT_PHOTO_PHASE_LABEL[phase].toLowerCase()}.`,
      );
    }
  }

  /** Store photos before the transaction that attaches them: the storage call is a network call. */
  async storePhotos(workspaceId: string, userId: string, photos: FaultUpload[]): Promise<{ id: string; objectKey: string }[]> {
    const stored: { id: string; objectKey: string }[] = [];
    for (const p of photos) {
      stored.push(await this.files.putFaultPhoto({ body: p.body, filename: p.filename, maxBytes: FAULT_PHOTO_MAX_BYTES, uploadedByUserId: userId, workspaceId }));
    }
    return stored;
  }

  async attachPhotos(tx: DbOrTx, ticketId: string, userId: string, phase: FaultPhotoPhase, stored: { id: string }[], from: number): Promise<void> {
    for (const [i, s] of stored.entries()) {
      await this.faults.addPhoto(tx, { ticketId, storedObjectId: s.id, phase, position: from + i, uploadedByUserId: userId });
    }
  }
}
