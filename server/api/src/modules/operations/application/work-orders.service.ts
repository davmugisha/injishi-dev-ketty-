import type {
  AddWorkOrderNoteRequest,
  AssignWorkOrderRequest,
  ConditionSignal,
  ConditionSignalDraft,
  ConditionSignalList,
  CreateWorkOrderRequest,
  DecideRoomBlockRequest,
  DismissConditionSignalRequest,
  ReleaseRoomRequest,
  WorkOrder,
  WorkOrderList,
  WorkOrderPhoto,
} from '@injishi/contracts';
import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { sql } from 'drizzle-orm';

import { assertOwned } from '../../../shared/auth/assert-owned';
import { assertInBranchScope, type ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { type Db, memberHoldsAt, READINESS_LABEL, recordRoomEvent, setRoomReadinessTx } from '../infrastructure/room-events';
import {
  type BlockRow,
  type EventRow,
  type LocationMatch,
  type PartRow,
  type SignalRow,
  type WorkOrderRow,
  WorkOrdersRepository,
} from '../infrastructure/work-orders.repository';
import { iso } from './housekeeping-board.service';

/**
 * The hotel's maintenance board (real-data 1.2.3): work orders against a room, a space or a piece of
 * equipment, the out-of-order block that takes a room off sale while it is repaired, and condition
 * signals that recommend work.
 *
 * TWO OWNERS, deliberately. Whoever works the order (`ticket.advance`) reports, assigns, notes and
 * ASKS for a block; only a manager (`listing.manage`, the permission that decides what is on sale)
 * approves one or puts the room back on sale. Approval sets the room's inventory status to
 * `maintenance`, which is what sellable capacity counts, so a blocked room cannot be sold on any
 * night until it is released. Release needs the repair closed AND a passed housekeeping inspection
 * since the block began; the service refuses it otherwise rather than trusting a button.
 */
@Injectable()
export class WorkOrdersService {
  constructor(private readonly repo: WorkOrdersRepository) {}

  async list(ws: ScopedWorkspace): Promise<WorkOrderList> {
    const rows = await this.repo.list(ws.workspaceId, ws.branchScope);
    const orders = await this.present(this.repo.database, rows);
    const [usual, median] = await Promise.all([
      this.repo.usualAssignee(ws.workspaceId),
      this.repo.medianHoursToClose(ws.workspaceId),
    ]);
    const seen = new Map<string, { userId: string | null; name: string }>();
    for (const o of orders) {
      if (o.assignedToUserId && o.assignedToName) seen.set(`u:${o.assignedToUserId}`, { userId: o.assignedToUserId, name: o.assignedToName });
      if (o.assignedContractor) seen.set(`c:${o.assignedContractor}`, { userId: null, name: o.assignedContractor });
    }
    if (usual) seen.set(`u:${usual.userId}`, usual);
    return {
      workOrders: orders,
      assignees: [...seen.values()].sort((a, b) => a.name.localeCompare(b.name)),
      suggestedAssignee: usual,
      medianHoursToClose: median,
    };
  }

  async get(ws: ScopedWorkspace, id: string): Promise<WorkOrder> {
    const row = this.owned(await this.repo.find(this.repo.database, id), ws);
    const [order] = await this.present(this.repo.database, [row]);
    return order as WorkOrder;
  }

  async create(ws: ScopedWorkspace, body: CreateWorkOrderRequest, actorUserId: string): Promise<WorkOrder> {
    const place = await this.locate(ws, body.location, body.propertyId);
    if (body.requestBlock && !place.roomId) {
      throw new UnprocessableEntityException('Only a room can be taken off sale; this order is not about a room.');
    }
    const assignee = await this.resolveAssignee(ws, place.propertyId, body.assignee);
    const db = this.repo.database;
    const id = await db.transaction(async (tx) => {
      const reference = await this.repo.nextReference(tx, ws.workspaceId);
      const department = await this.repo.engineeringDepartment(tx, place.propertyId);
      const inserted = await tx.execute<{ id: string }>(sql`
        insert into maintenance_tickets
          (room_id, space_id, asset_id, property_id, org_id, workspace_id, department_id, raised_by_user_id,
           raised_by_role, raised_via, title, description, category, priority, status, reference,
           assigned_to_user_id, assigned_contractor)
        values (${place.roomId}, ${place.spaceId}, ${place.assetId}, ${place.propertyId}, ${ws.orgId},
                ${ws.workspaceId}, ${department}, ${actorUserId}, 'staff', 'maintenance board', ${body.title},
                ${body.description ?? null}, ${body.category ?? null}, ${body.priority},
                ${assignee ? 'assigned' : 'open'}, ${reference}, ${assignee?.userId ?? null},
                ${assignee?.contractor ?? null})
        returning id
      `);
      const ticketId = inserted.rows[0]?.id as string;
      await this.repo.addEvent(tx, { ticketId, kind: 'reported', note: null, actorUserId });
      if (assignee) {
        await this.repo.addEvent(tx, { ticketId, kind: 'assigned', note: `Assigned to ${assignee.name}`, actorUserId });
      }
      if (place.roomId) {
        await recordRoomEvent(tx, {
          workspaceId: ws.workspaceId,
          propertyId: place.propertyId,
          roomId: place.roomId,
          kind: 'fault_reported',
          summary: 'Fault reported',
          actorUserId,
          detail: body.title.toLowerCase(),
          maintenanceTicketId: ticketId,
        });
      }
      if (body.requestBlock && place.roomId) {
        await this.requestBlockTx(tx, ws, {
          ticketId,
          reference,
          roomId: place.roomId,
          propertyId: place.propertyId,
          reason: body.requestBlock.reason,
          actorUserId,
        });
      }
      return ticketId;
    });
    return this.get(ws, id);
  }

  async assign(ws: ScopedWorkspace, id: string, body: AssignWorkOrderRequest, actorUserId: string): Promise<WorkOrder> {
    const db = this.repo.database;
    await db.transaction(async (tx) => {
      const order = this.owned(await this.repo.find(tx, id, true), ws);
      this.assertOpen(order);
      const assignee = await this.resolveAssignee(ws, order.property_id, body);
      if (!assignee) throw new UnprocessableEntityException('Name who takes the work.');
      if (
        (assignee.userId && assignee.userId === order.assigned_to_user_id) ||
        (assignee.contractor && assignee.contractor === order.assigned_contractor)
      ) {
        return;
      }
      await tx.execute(sql`
        update maintenance_tickets
           set assigned_to_user_id = ${assignee.userId ?? null}, assigned_contractor = ${assignee.contractor ?? null},
               status = case when status = 'open' then 'assigned'::maintenance_status else status end,
               updated_at = now()
         where id = ${order.id}
      `);
      await this.repo.addEvent(tx, { ticketId: order.id, kind: 'assigned', note: `Assigned to ${assignee.name}`, actorUserId });
    });
    return this.get(ws, id);
  }

  async addNote(ws: ScopedWorkspace, id: string, body: AddWorkOrderNoteRequest, actorUserId: string): Promise<WorkOrder> {
    const order = this.owned(await this.repo.find(this.repo.database, id), ws);
    await this.repo.addEvent(this.repo.database, { ticketId: order.id, kind: 'note', note: body.note, actorUserId });
    return this.get(ws, id);
  }

  /** Approve or decline a requested block. Approval takes the room off sale at once. */
  async decideBlock(ws: ScopedWorkspace, id: string, body: DecideRoomBlockRequest, actorUserId: string): Promise<WorkOrder> {
    const db = this.repo.database;
    await db.transaction(async (tx) => {
      const order = this.owned(await this.repo.find(tx, id, true), ws);
      const block = await this.repo.openBlockForTicket(tx, order.id);
      if (!block || block.status !== 'requested') {
        throw new ConflictException('There is no block waiting for a decision on this work order.');
      }
      const reference = order.reference ?? 'this work order';
      if (body.decision === 'decline') {
        await tx.execute(sql`
          update room_blocks
             set status = 'declined', decided_by_user_id = ${actorUserId}, decided_at = now(),
                 decision_note = ${body.note ?? null}, updated_at = now()
           where id = ${block.id} and status = 'requested'
        `);
        await this.repo.addEvent(tx, { ticketId: order.id, kind: 'block_declined', note: body.note ?? null, actorUserId });
        await recordRoomEvent(tx, {
          workspaceId: block.workspace_id,
          propertyId: block.property_id,
          roomId: block.room_id,
          kind: 'block',
          toValue: 'declined',
          summary: `Block ${reference} declined, room stays on sale`,
          actorUserId,
          detail: body.note ?? null,
          maintenanceTicketId: order.id,
        });
        return;
      }
      // An approval starts the block now if it was asked for from an earlier moment.
      await tx.execute(sql`
        update room_blocks
           set status = 'active', decided_by_user_id = ${actorUserId}, decided_at = now(),
               decision_note = ${body.note ?? null}, starts_at = greatest(starts_at, now()), updated_at = now()
         where id = ${block.id} and status = 'requested'
      `);
      const room = await tx.execute<{ status: string }>(sql`
        select status from rooms where id = ${block.room_id} for update
      `);
      await tx.execute(sql`
        update rooms set status = 'maintenance', updated_at = now() where id = ${block.room_id}
      `);
      await this.repo.addEvent(tx, { ticketId: order.id, kind: 'block_approved', note: body.note ?? null, actorUserId });
      await recordRoomEvent(tx, {
        workspaceId: block.workspace_id,
        propertyId: block.property_id,
        roomId: block.room_id,
        kind: 'inventory',
        fromValue: room.rows[0]?.status ?? null,
        toValue: 'maintenance',
        summary: block.ends_at ? `Out of order until ${kigaliShort(block.ends_at)}` : 'Out of order until released',
        actorUserId,
        detail: `approved block ${reference}`,
        maintenanceTicketId: order.id,
      });
      await setRoomReadinessTx(tx, {
        roomId: block.room_id,
        to: 'out_of_order',
        actorUserId,
        housekeepingTaskId: null,
      });
    });
    return this.get(ws, id);
  }

  /** Put a blocked room back on sale: the repair closed, and housekeeping passed it since the block began. */
  async release(ws: ScopedWorkspace, id: string, body: ReleaseRoomRequest, actorUserId: string): Promise<WorkOrder> {
    const db = this.repo.database;
    await db.transaction(async (tx) => {
      const order = this.owned(await this.repo.find(tx, id, true), ws);
      const block = await this.repo.openBlockForTicket(tx, order.id);
      if (!block || block.status !== 'active') {
        throw new ConflictException('Release applies only to a room this work order has blocked.');
      }
      if (order.status !== 'resolved' && order.status !== 'closed') {
        throw new ConflictException('The repair is not closed yet, so the room stays off sale.');
      }
      const room = await tx.execute<{ housekeeping_status: string; housekeeping_updated_at: Date | null }>(sql`
        select housekeeping_status, housekeeping_updated_at from rooms where id = ${block.room_id} for update
      `);
      const r = room.rows[0];
      const inspectedSince =
        r?.housekeeping_status === 'inspected' &&
        r.housekeeping_updated_at !== null &&
        new Date(r.housekeeping_updated_at).getTime() >= new Date(block.starts_at).getTime();
      if (!inspectedSince) {
        throw new ConflictException('Housekeeping has to pass an inspection of the room after the repair before it goes back on sale.');
      }
      await tx.execute(sql`
        update room_blocks
           set status = 'released', released_by_user_id = ${actorUserId}, released_at = now(),
               ends_at = coalesce(least(ends_at, now()), now()), updated_at = now()
         where id = ${block.id}
      `);
      // Only the block's own status is undone: a room out of service for another reason stays so.
      await tx.execute(sql`
        update rooms set status = 'available', updated_at = now()
         where id = ${block.room_id} and status = 'maintenance'
      `);
      await this.repo.addEvent(tx, { ticketId: order.id, kind: 'block_released', note: body.note ?? null, actorUserId });
      await recordRoomEvent(tx, {
        workspaceId: block.workspace_id,
        propertyId: block.property_id,
        roomId: block.room_id,
        kind: 'inventory',
        fromValue: 'maintenance',
        toValue: 'available',
        summary: `${READINESS_LABEL.maintenance} → ${READINESS_LABEL.available}`,
        actorUserId,
        detail: `released ${order.reference ?? 'the block'}`,
        maintenanceTicketId: order.id,
      });
    });
    return this.get(ws, id);
  }

  // --- condition signals ---

  async signals(ws: ScopedWorkspace): Promise<ConditionSignalList> {
    const rows = await this.repo.signals(ws.workspaceId, ws.branchScope);
    return { signals: rows.map((r) => this.presentSignal(r)) };
  }

  /** Act on a signal: create the work order it drafts, and record the review. */
  async actOnSignal(ws: ScopedWorkspace, id: string, actorUserId: string): Promise<ConditionSignal> {
    const db = this.repo.database;
    const signal = this.ownedSignal(await this.repo.signal(db, id), ws);
    if (signal.status !== 'open') throw new ConflictException('This signal has already been reviewed.');
    const draft = this.draftOf(signal);
    if (!draft) throw new UnprocessableEntityException('This signal proposes no work order.');
    const place = await this.locate(ws, draft.location, signal.property_id);
    await db.transaction(async (tx) => {
      const locked = await this.repo.signal(tx, id, true);
      if (!locked || locked.status !== 'open') throw new ConflictException('This signal has already been reviewed.');
      const reference = await this.repo.nextReference(tx, ws.workspaceId);
      const department = await this.repo.engineeringDepartment(tx, place.propertyId);
      const inserted = await tx.execute<{ id: string }>(sql`
        insert into maintenance_tickets
          (room_id, space_id, asset_id, property_id, org_id, workspace_id, department_id, raised_by_user_id,
           raised_by_role, raised_via, title, description, priority, status, reference)
        values (${place.roomId}, ${place.spaceId}, ${place.assetId ?? signal.asset_id}, ${place.propertyId},
                ${ws.orgId}, ${ws.workspaceId}, ${department}, ${actorUserId}, 'staff',
                ${`condition signal ${signal.rule_code}`}, ${draft.title}, ${draft.description}, ${draft.priority},
                'open', ${reference})
        returning id
      `);
      const ticketId = inserted.rows[0]?.id as string;
      await this.repo.addEvent(tx, {
        ticketId,
        kind: 'from_signal',
        note: `Created from signal “${signal.headline}”, evidence attached`,
        actorUserId,
      });
      await tx.execute(sql`
        update condition_signals
           set status = 'actioned', work_order_id = ${ticketId}, reviewed_by_user_id = ${actorUserId},
               reviewed_at = now(), review_note = ${`${reference} created`}, updated_at = now()
         where id = ${signal.id}
      `);
    });
    const after = await this.repo.signal(db, id);
    return this.presentSignal(after as SignalRow);
  }

  async dismissSignal(
    ws: ScopedWorkspace,
    id: string,
    body: DismissConditionSignalRequest,
    actorUserId: string,
  ): Promise<ConditionSignal> {
    const db = this.repo.database;
    const signal = this.ownedSignal(await this.repo.signal(db, id), ws);
    if (signal.status !== 'open') throw new ConflictException('This signal has already been reviewed.');
    const updated = await db.execute(sql`
      update condition_signals
         set status = 'dismissed', reviewed_by_user_id = ${actorUserId}, reviewed_at = now(),
             review_note = ${body.reason}, updated_at = now()
       where id = ${signal.id} and status = 'open'
    `);
    if (!updated.rowCount) throw new ConflictException('This signal has already been reviewed.');
    const after = await this.repo.signal(db, id);
    return this.presentSignal(after as SignalRow);
  }

  // --- helpers ---

  private async requestBlockTx(
    tx: Db,
    ws: ScopedWorkspace,
    input: { ticketId: string; reference: string; roomId: string; propertyId: string; reason: string; actorUserId: string },
  ): Promise<void> {
    const open = await tx.execute<{ id: string }>(sql`
      select id from room_blocks where room_id = ${input.roomId} and status in ('requested', 'active') limit 1
    `);
    if (open.rows.length > 0) {
      throw new ConflictException('This room already has a block requested or in force.');
    }
    await tx.execute(sql`
      insert into room_blocks (workspace_id, property_id, room_id, maintenance_ticket_id, status, starts_at, reason,
                               requested_by_user_id)
      values (${ws.workspaceId}, ${input.propertyId}, ${input.roomId}, ${input.ticketId}, 'requested', now(),
              ${input.reason}, ${input.actorUserId})
    `);
    await this.repo.addEvent(tx, { ticketId: input.ticketId, kind: 'block_requested', note: input.reason, actorUserId: input.actorUserId });
    await recordRoomEvent(tx, {
      workspaceId: ws.workspaceId,
      propertyId: input.propertyId,
      roomId: input.roomId,
      kind: 'block',
      toValue: 'requested',
      summary: `Block ${input.reference} requested`,
      actorUserId: input.actorUserId,
      detail: input.reason,
      maintenanceTicketId: input.ticketId,
    });
  }

  private async locate(ws: ScopedWorkspace, text: string, propertyId?: string | null): Promise<LocationMatch> {
    const scope = ws.branchScope.propertyIds;
    if (propertyId && !scope.includes(propertyId)) throw new NotFoundException('That property is not available to you.');
    const candidates = propertyId ? [propertyId] : scope;
    const matches = await this.repo.locate(ws.workspaceId, candidates, text.trim());
    if (matches.length === 0) {
      throw new UnprocessableEntityException(
        `There is no room, space or equipment called “${text.trim()}” here. Use a room as “Room 302”, or a space or equipment name.`,
      );
    }
    if (matches.length > 1) {
      throw new UnprocessableEntityException(`“${text.trim()}” is at more than one of your properties; choose the property.`);
    }
    return matches[0] as LocationMatch;
  }

  private async resolveAssignee(
    ws: ScopedWorkspace,
    propertyId: string | null,
    assignee: { userId?: string; contractor?: string } | undefined,
  ): Promise<{ userId?: string; contractor?: string; name: string } | null> {
    if (!assignee) return null;
    if (assignee.contractor) return { contractor: assignee.contractor, name: assignee.contractor };
    if (!assignee.userId || !ws.orgId || !propertyId) return null;
    const holder = await memberHoldsAt(this.repo.database, {
      orgId: ws.orgId,
      userId: assignee.userId,
      propertyId,
      permission: 'ticket.advance',
    });
    if (!holder) {
      throw new UnprocessableEntityException('That person cannot work maintenance orders at this property.');
    }
    return { userId: assignee.userId, name: holder.name };
  }

  private owned(row: WorkOrderRow | null, ws: ScopedWorkspace): WorkOrderRow {
    const owned = assertOwned(row ? { ...row, workspaceId: row.workspace_id } : null, ws);
    assertInBranchScope(ws, owned.property_id);
    return owned;
  }

  private ownedSignal(row: SignalRow | null, ws: ScopedWorkspace): SignalRow {
    const owned = assertOwned(row ? { ...row, workspaceId: row.workspace_id } : null, ws);
    assertInBranchScope(ws, owned.property_id);
    return owned;
  }

  private assertOpen(order: WorkOrderRow): void {
    if (order.status === 'closed' || order.status === 'cancelled') {
      throw new ConflictException('This work order is closed.');
    }
  }

  private draftOf(signal: SignalRow): ConditionSignalDraft | null {
    const d = signal.draft as Partial<ConditionSignalDraft> | null;
    if (!d || typeof d.title !== 'string' || typeof d.location !== 'string') return null;
    return {
      title: d.title,
      description: typeof d.description === 'string' ? d.description : d.title,
      priority: d.priority ?? 'normal',
      location: d.location,
    };
  }

  private presentSignal(r: SignalRow): ConditionSignal {
    return {
      id: r.id,
      ruleCode: r.rule_code,
      ruleText: r.rule_text,
      assetId: r.asset_id,
      assetName: r.asset_label,
      headline: r.headline,
      confidence: r.confidence,
      evidence: Array.isArray(r.evidence) ? (r.evidence as unknown[]).map(String) : [],
      dataQuality: r.data_quality,
      recommendation: r.recommendation,
      status: r.status,
      draft: this.draftOf(r),
      workOrderId: r.work_order_id,
      workOrderReference: r.work_order_reference,
      raisedAt: iso(r.raised_at) as string,
      reviewedByName: r.reviewed_by_name,
      reviewedAt: iso(r.reviewed_at),
      reviewNote: r.review_note,
    };
  }

  private async present(db: Db, rows: WorkOrderRow[]): Promise<WorkOrder[]> {
    const ids = rows.map((r) => r.id);
    const [parts, events, blocks] = await Promise.all([this.repo.parts(ids), this.repo.events(ids), this.repo.blocks(db, ids)]);
    const partsOf = group(parts, (p) => p.ticket_id);
    const eventsOf = group(events, (e) => e.ticket_id);
    const blockOf = new Map(blocks.map((b) => [b.maintenance_ticket_id as string, b]));
    return rows.map((r) => ({
      id: r.id,
      reference: r.reference ?? `WO-${r.id.slice(0, 6).toUpperCase()}`,
      propertyId: r.property_id,
      roomId: r.room_id,
      roomLabel: r.room_label,
      roomTypeName: r.room_type_name,
      floor: r.floor === null ? null : Number(r.floor),
      spaceId: r.space_id,
      spaceName: r.space_name,
      assetId: r.asset_id,
      assetName: r.asset_name,
      title: r.title,
      description: r.description,
      category: r.category,
      priority: r.priority,
      status: r.status,
      assignedToUserId: r.assigned_to_user_id,
      assignedToName: r.assigned_to_name,
      assignedContractor: r.assigned_contractor,
      scheduledFor: r.scheduled_for,
      raisedByName: r.raised_by_name,
      raisedVia: r.raised_via,
      raisedAt: iso(r.created_at) as string,
      impactNote: r.impact_note,
      releaseNote: r.release_note,
      photos: photosOf(r.photo_object_keys),
      parts: (partsOf.get(r.id) ?? []).map((p: PartRow) => ({
        id: p.id,
        name: p.name,
        quantity: Number(p.quantity),
        unit: p.unit,
        source: p.source,
        state: p.state,
      })),
      events: (eventsOf.get(r.id) ?? []).map((e: EventRow) => ({
        id: e.id,
        kind: e.kind,
        note: e.note,
        actorName: e.actor_name,
        occurredAt: iso(e.created_at) as string,
      })),
      block: presentBlock(blockOf.get(r.id)),
      resolvedAt: iso(r.resolved_at),
      verifiedAt: iso(r.verified_at),
    }));
  }
}

function group<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    const list = out.get(k) ?? [];
    list.push(row);
    out.set(k, list);
  }
  return out;
}

function photosOf(value: unknown): WorkOrderPhoto[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((v) => {
    if (typeof v === 'string') return [{ key: v, caption: '' }];
    if (v && typeof v === 'object' && typeof (v as { key?: unknown }).key === 'string') {
      const o = v as { key: string; caption?: unknown };
      return [{ key: o.key, caption: typeof o.caption === 'string' ? o.caption : '' }];
    }
    return [];
  });
}

function presentBlock(b: BlockRow | undefined): WorkOrder['block'] {
  if (!b) return null;
  return {
    id: b.id,
    status: b.status,
    startsAt: iso(b.starts_at) as string,
    endsAt: iso(b.ends_at),
    reason: b.reason,
    requestedByName: b.requested_by_name,
    requestedAt: iso(b.requested_at) as string,
    decidedByName: b.decided_by_name,
    decidedAt: iso(b.decided_at),
    decisionNote: b.decision_note,
    releasedByName: b.released_by_name,
    releasedAt: iso(b.released_at),
    affectedReservations: Number(b.affected ?? 0),
  };
}

/** "14 Oct, 12:00" in Kigali. */
function kigaliShort(at: Date | string): string {
  const d = new Date(at);
  const day = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Kigali', day: 'numeric', month: 'short' }).format(d);
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Kigali',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
  return `${day}, ${time}`;
}
