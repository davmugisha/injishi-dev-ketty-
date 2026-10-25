import {
  REOPENABLE_STATUSES,
  faultReopenUntil,
  isOpenTicket,
  kigaliToday,
  type ReopenFaultRequest,
  type ReportFaultRequest,
  type TenantFaultDetail,
  type TenantFaultList,
  type TenantFaultMessageRequest,
} from '@injishi/contracts';
import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';

import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { TicketLifecycle } from '../../operations/application/ticket-lifecycle';
import { RentalsFilesStorage } from '../../storage/application/rentals-files-storage';
import { FaultsRepository, type FaultRow } from '../infrastructure/faults.repository';
import { RentalsAuditWriter } from '../infrastructure/rentals-writers';
import { FaultNotices } from './fault-notices';
import { FAULT_NOT_FOUND, FaultsService, type FaultUpload } from './faults.service';
import { presentEvent, presentPhoto, presentTenantFaultItem } from './faults-presenters';
import type { TenancyRef } from './tenancies.service';

/** The lease states a tenant can report a fault in: signed (moving in), active and ending. */
const REPORTABLE = new Set(['signed', 'active', 'ending']);

/**
 * Faults on the tenant's side (blueprint 2.4, WP 4.1): their faults on this
 * lease, reporting one with photos, reopening one within 14 days of it being
 * settled, writing on it and adding photos. Scoped by the tenancy guard; a
 * fault of another lease is 404. The tenant never sees money, team notes or
 * the fixer's phone.
 */
@Injectable()
export class TenantFaultsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly faults: FaultsRepository,
    private readonly lifecycle: TicketLifecycle,
    private readonly files: RentalsFilesStorage,
    private readonly notices: FaultNotices,
    private readonly audit: RentalsAuditWriter,
    private readonly landlord: FaultsService,
  ) {}

  /** The clock, as a method so a test can pin it. */
  protected now(): Date {
    return new Date();
  }

  async list(ref: TenancyRef): Promise<TenantFaultList> {
    const today = kigaliToday(this.now());
    const rows = await this.faults.forLease(ref.leaseId);
    return { items: rows.map((r) => presentTenantFaultItem(r, today)) };
  }

  async detail(ref: TenancyRef, id: string): Promise<TenantFaultDetail> {
    return this.present(await this.owned(ref, id));
  }

  /** Report a fault on the home, with up to four photos. The landlord is emailed. */
  async report(ref: TenancyRef, body: ReportFaultRequest, photos: FaultUpload[]): Promise<TenantFaultDetail> {
    const lease = await this.faults.lease(ref.leaseId);
    if (!lease) throw new NotFoundException(FAULT_NOT_FOUND);
    if (!REPORTABLE.has(lease.status)) {
      throw new ConflictException('This lease has ended, so a fault cannot be reported on it. Talk to your landlord.');
    }
    this.landlord.assertPhotoRoom(0, photos.length, 'report');
    const stored = await this.landlord.storePhotos(lease.workspaceId, ref.userId, photos);
    const id = await this.db.transaction(async (tx) => {
      const reference = await this.faults.nextReference(tx, lease.workspaceId);
      const ticketId = await this.faults.insert(tx, {
        workspaceId: lease.workspaceId,
        orgId: lease.orgId,
        propertyId: lease.propertyId,
        unitId: lease.unitId,
        leaseId: lease.id,
        reference,
        raisedByUserId: ref.userId,
        raisedByRole: 'tenant',
        raisedVia: 'tenant app',
        title: body.title,
        description: body.description ?? null,
        category: body.category,
        priority: body.urgency,
        staffMayEnter: body.staffMayEnter,
      });
      await this.lifecycle.event(tx, {
        ticketId,
        kind: 'reported',
        to: 'open',
        note: null,
        actorUserId: ref.userId,
        actorRole: 'tenant',
        visibleToTenant: true,
      });
      await this.landlord.attachPhotos(tx, ticketId, ref.userId, 'report', stored, 0);
      await this.audit.write(tx, {
        actorUserId: ref.userId,
        subjectType: 'maintenance_ticket',
        subjectId: ticketId,
        eventType: 'fault.reported',
        diff: { by: 'tenant', leaseId: lease.id, unitId: lease.unitId, reference, photos: stored.length },
      });
      return ticketId;
    });
    const row = await this.faults.find(id);
    if (!row) throw new NotFoundException(FAULT_NOT_FOUND);
    void this.notices.landlordReported(row);
    return this.present(row);
  }

  /** The fix did not hold, or "won't fix" is not the end of it: back to Reported, within 14 days. */
  async reopen(ref: TenancyRef, id: string, body: ReopenFaultRequest): Promise<TenantFaultDetail> {
    const row = await this.owned(ref, id);
    if (!REOPENABLE_STATUSES.includes(row.status)) {
      throw new ConflictException(isOpenTicket(row.status) ? 'This fault is still open.' : 'This fault was cancelled.');
    }
    await this.db.transaction(async (tx) => {
      const moved = await this.lifecycle.move(tx, {
        ticketId: row.id,
        to: 'open',
        actorUserId: ref.userId,
        actorRole: 'tenant',
        note: body.reason,
        visibleToTenant: true,
        tenantReopen: { today: kigaliToday(this.now()) },
      });
      if (moved.moved) {
        await this.audit.write(tx, {
          actorUserId: ref.userId,
          subjectType: 'maintenance_ticket',
          subjectId: row.id,
          eventType: 'fault.reopened',
          diff: { from: moved.from, to: 'open', by: 'tenant' },
          reason: body.reason,
        });
      }
    });
    void this.notices.landlordReopened(row, body.reason);
    return this.detail(ref, id);
  }

  async message(ref: TenancyRef, id: string, body: TenantFaultMessageRequest): Promise<TenantFaultDetail> {
    const row = await this.owned(ref, id);
    if (row.status === 'cancelled') throw new ConflictException('This fault was cancelled.');
    await this.db.transaction(async (tx) => {
      await this.lifecycle.lock(tx, row.id);
      await this.lifecycle.event(tx, {
        ticketId: row.id,
        kind: 'note',
        note: body.body,
        actorUserId: ref.userId,
        actorRole: 'tenant',
        visibleToTenant: true,
      });
      await this.faults.touch(tx, row.id);
    });
    void this.notices.landlordMessage(row, body.body);
    return this.detail(ref, id);
  }

  /** More photos of what is wrong, while it is open: at most four with the report. */
  async addPhotos(ref: TenancyRef, id: string, photos: FaultUpload[]): Promise<TenantFaultDetail> {
    const row = await this.owned(ref, id);
    if (photos.length === 0) throw new BadRequestException('Attach at least one photo.');
    if (!isOpenTicket(row.status)) throw new ConflictException('Photos can be added while the fault is open.');
    this.landlord.assertPhotoRoom(await this.faults.photoCount(this.db, row.id, 'report'), photos.length, 'report');
    const stored = await this.landlord.storePhotos(row.workspaceId, ref.userId, photos);
    await this.db.transaction(async (tx) => {
      await this.lifecycle.lock(tx, row.id);
      const have = await this.faults.photoCount(tx, row.id, 'report');
      this.landlord.assertPhotoRoom(have, stored.length, 'report');
      await this.landlord.attachPhotos(tx, row.id, ref.userId, 'report', stored, have);
      await this.faults.touch(tx, row.id);
    });
    return this.detail(ref, id);
  }

  // --- Inside -------------------------------------------------------------------

  private async owned(ref: TenancyRef, id: string): Promise<FaultRow> {
    const row = await this.faults.find(id);
    if (!row || row.leaseId !== ref.leaseId || row.status === 'cancelled') throw new NotFoundException(FAULT_NOT_FOUND);
    return row;
  }

  private async present(row: FaultRow): Promise<TenantFaultDetail> {
    const today = kigaliToday(this.now());
    const [photos, events] = await Promise.all([this.faults.photos(row.id), this.faults.events(row.id, { tenantOnly: true })]);
    const urls = await Promise.all(photos.map((p) => this.files.signedUrl(p.objectKey)));
    const until = faultReopenUntil(row.status, row.resolvedAt, today);
    return {
      ...presentTenantFaultItem(row, today),
      description: row.description,
      staffMayEnter: row.staffMayEnter,
      wontFixReason: row.wontFixReason,
      canReopen: until !== null,
      photos: photos.map((p, i) => presentPhoto(p, urls[i] as string, row.tenantUserId)),
      events: events.map((e) => presentEvent(e, 'tenant')),
    };
  }
}
