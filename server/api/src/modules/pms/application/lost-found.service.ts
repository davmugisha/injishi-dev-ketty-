import type {
  ExtendFoundItemRetentionRequest,
  FoundItem,
  FoundItemList,
  LogFoundItemRequest,
  OpenFoundItemClaimRequest,
  ProposeFoundItemDisposalRequest,
  ReleaseFoundItemRequest,
} from '@injishi/contracts';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { sql } from 'drizzle-orm';

import { assertOwned } from '../../../shared/auth/assert-owned';
import { assertInBranchScope, type ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { type FoundItemRow, LostFoundRepository } from '../infrastructure/lost-found.repository';
import { kigaliDay } from '../infrastructure/room-events';
import { iso } from './housekeeping-board.service';

/** Every found item is held this long before disposal may even be proposed. */
export const RETENTION_DAYS = 90;
export const RETENTION_RULE = `${RETENTION_DAYS}-day rule configured · unverified`;

const METHOD_PHRASE: Record<string, string> = {
  in_person: 'in person',
  authorised_person: 'via an authorised person',
  courier: 'by courier',
};

function addDays(day: string, days: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "9 Jan 2027". */
function longDay(day: string): string {
  return `${Number(day.slice(8, 10))} ${MONTHS[Number(day.slice(5, 7)) - 1]} ${day.slice(0, 4)}`;
}
/** "9 Jan". */
function shortDay(day: string): string {
  return `${Number(day.slice(8, 10))} ${MONTHS[Number(day.slice(5, 7)) - 1]}`;
}
function clock(at: Date): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Kigali', hour: '2-digit', minute: '2-digit', hour12: false }).format(at);
}

/**
 * The lost and found register (real-data 1.2.3).
 *
 * The rules a register is trusted for, enforced here rather than by a screen:
 * - an item goes back only against an open claim, with the description matched and the identity
 *   checked, both recorded against the releaser's name;
 * - disposal is proposed only after the retention period, and approved only by a SECOND person
 *   (also a database CHECK);
 * - nothing is deleted: every step is a custody event and a closed item keeps its chain.
 */
@Injectable()
export class LostFoundService {
  constructor(private readonly repo: LostFoundRepository) {}

  async list(ws: ScopedWorkspace): Promise<FoundItemList> {
    const rows = await this.repo.list(ws.workspaceId, ws.branchScope);
    const [items, people] = await Promise.all([this.present(rows), this.repo.people(ws.workspaceId)]);
    return {
      items,
      people: people.map((p) => ({ userId: p.user_id, name: p.name })),
      retentionRule: `Held ${RETENTION_DAYS} days, then disposed with two-person sign-off`,
    };
  }

  async get(ws: ScopedWorkspace, id: string): Promise<FoundItem> {
    const row = this.owned(await this.repo.find(this.repo.database, id), ws);
    const [item] = await this.present([row]);
    return item as FoundItem;
  }

  async log(ws: ScopedWorkspace, body: LogFoundItemRequest, actorUserId: string): Promise<FoundItem> {
    const scope = ws.branchScope.propertyIds;
    if (body.propertyId && !scope.includes(body.propertyId)) {
      throw new NotFoundException('That property is not available to you.');
    }
    const property = await this.repo.pickProperty(
      ws.workspaceId,
      body.propertyId ? [body.propertyId] : ws.branchScope.selectedPropertyId ? [ws.branchScope.selectedPropertyId] : scope,
    );
    if (!property) throw new NotFoundException('That property is not available to you.');
    const foundAt = new Date(body.foundAt);
    if (foundAt.getTime() > Date.now() + 5 * 60_000) {
      throw new UnprocessableEntityException('An item cannot have been found in the future.');
    }
    const roomLabel = body.foundLocation.match(/^room\s+(.+)$/i)?.[1]?.trim();
    const room = roomLabel ? await this.repo.roomByLabel(property.id, roomLabel) : null;
    if (roomLabel && !room) {
      throw new UnprocessableEntityException(`There is no room ${roomLabel} at this property.`);
    }
    // A finder or a custodian need not keep the register, but they must work here: an id from another
    // business must not appear on this one's custody chain.
    for (const userId of [body.foundByUserId, body.custodianUserId]) {
      if (!userId) continue;
      const member = await this.repo.database.execute<{ id: string }>(sql`
        select id from org_memberships where org_id = ${property.orgId} and user_id = ${userId} and status = 'active'
      `);
      if (member.rows.length === 0) throw new UnprocessableEntityException('Name someone who works at this business.');
    }
    const foundDay = kigaliDay(foundAt);
    const retentionUntil = addDays(foundDay, RETENTION_DAYS);
    const db = this.repo.database;
    const id = await db.transaction(async (tx) => {
      const reference = await this.repo.nextReference(tx, ws.workspaceId, foundDay.slice(0, 4));
      const inserted = await tx.execute<{ id: string }>(sql`
        insert into found_items
          (org_id, workspace_id, property_id, reference, description, category, valuable, found_location, found_spot,
           room_id, found_at, found_by_user_id, found_by_name, custodian_user_id, storage_location, photo_count, status,
           retention_until, retention_note)
        values (${property.orgId}, ${ws.workspaceId}, ${property.id}, ${reference}, ${body.description}, ${body.category},
                ${body.valuable}, ${body.foundLocation}, ${body.foundSpot ?? null}, ${room?.id ?? null}, ${foundAt},
                ${body.foundByUserId ?? null}, ${body.foundByName}, ${body.custodianUserId ?? null},
                ${body.storageLocation ?? null}, ${body.photoCount ?? 0}, 'stored', ${retentionUntil}::date,
                ${`Held ${RETENTION_DAYS} days from the day it was found, then handled under the disposal rule with two-person sign-off.`})
        returning id
      `);
      const itemId = inserted.rows[0]?.id as string;
      const spot = body.foundSpot ? `, ${body.foundSpot.charAt(0).toLowerCase()}${body.foundSpot.slice(1)}` : '';
      await this.repo.addEvent(tx, {
        workspaceId: ws.workspaceId,
        itemId,
        kind: 'found',
        summary: `Found in ${body.foundLocation}${spot}`,
        actorUserId: body.foundByUserId ?? null,
        actorName: body.foundByName,
        detail: body.photoCount ? `${body.photoCount} photo${body.photoCount === 1 ? '' : 's'}` : null,
        occurredAt: foundAt,
      });
      await this.repo.addEvent(tx, {
        workspaceId: ws.workspaceId,
        itemId,
        kind: 'logged',
        summary: 'Logged, tag printed',
        actorUserId,
        detail: body.custodianUserId ? 'waiting for hand-over to the custodian' : null,
      });
      return itemId;
    });
    return this.get(ws, id);
  }

  async openClaim(ws: ScopedWorkspace, id: string, body: OpenFoundItemClaimRequest, actorUserId: string): Promise<FoundItem> {
    const item = this.owned(await this.repo.find(this.repo.database, id), ws);
    if (item.status !== 'stored') {
      throw new ConflictException(
        item.status === 'claimed' ? 'A claim is already open on this item.' : 'Only an item in storage can be claimed.',
      );
    }
    const ref = body.bookingReference?.trim() || null;
    let matched = false;
    let matchNote: string;
    let bookingId: string | null = null;
    if (ref) {
      const match = await this.repo.bookingMatch(ws.workspaceId, ref, item.room_id, new Date(item.found_at));
      if (match) {
        bookingId = match.bookingId;
        matched = match.covers;
        const stay = `${match.roomLabel ? `Room ${match.roomLabel}, ` : ''}${shortDay(match.checkIn)}–${shortDay(match.checkOut)}`;
        matchNote = matched
          ? `${body.claimantName} · ${ref} · ${stay}. Room and dates match where the item was found.`
          : `${body.claimantName} · ${ref} · ${stay}. The stay does not cover where and when the item was found: check identity with care.`;
      } else {
        matchNote = `${body.claimantName} · ${ref}. No booking with that reference here: check identity with care before any release.`;
      }
    } else {
      matchNote = `${body.claimantName} · no booking reference given. Check identity with care before any release.`;
    }
    const db = this.repo.database;
    await db.transaction(async (tx) => {
      const updated = await tx.execute(sql`
        update found_items
           set status = 'claimed', claimant_name = ${body.claimantName}, claim_booking_reference = ${ref},
               claim_booking_id = ${bookingId}, claim_statement = ${body.statement}, claim_matched = ${matched},
               claim_match_note = ${matchNote}, claim_opened_at = now(), claim_opened_by_user_id = ${actorUserId},
               updated_at = now()
         where id = ${item.id} and status = 'stored'
      `);
      if (!updated.rowCount) throw new ConflictException('This item changed while you were writing. Refresh and try again.');
      await this.repo.addEvent(tx, {
        workspaceId: item.workspace_id,
        itemId: item.id,
        kind: 'claim_opened',
        summary: `Claim opened: ${body.claimantName}`,
        actorUserId,
      });
    });
    return this.get(ws, id);
  }

  async release(ws: ScopedWorkspace, id: string, body: ReleaseFoundItemRequest, actorUserId: string): Promise<FoundItem> {
    const db = this.repo.database;
    await db.transaction(async (tx) => {
      const item = this.owned(await this.repo.find(tx, id, true), ws);
      if (item.status !== 'claimed' || !item.claimant_name) {
        throw new ConflictException('An item goes back only against an open claim.');
      }
      const now = new Date();
      const actor = await tx.execute<{ name: string | null }>(sql`select name from users where id = ${actorUserId}`);
      const actorName = actor.rows[0]?.name ?? 'the desk';
      const closed = `Returned to ${item.claimant_name}${item.claim_booking_reference ? ` (${item.claim_booking_reference})` : ''} on ${shortDay(kigaliDay(now))} at ${clock(now)}. Description and ID verified by ${actorName}; custody closed.`;
      await tx.execute(sql`
        update found_items
           set status = 'returned', release_method = ${body.method}, released_at = ${now},
               released_by_user_id = ${actorUserId}, custodian_user_id = null, closed_note = ${closed},
               updated_at = now()
         where id = ${item.id}
      `);
      await this.repo.addEvent(tx, {
        workspaceId: item.workspace_id,
        itemId: item.id,
        kind: 'verified',
        summary: 'Description matched and ID checked',
        actorUserId,
        occurredAt: now,
      });
      await this.repo.addEvent(tx, {
        workspaceId: item.workspace_id,
        itemId: item.id,
        kind: 'returned',
        summary: `Returned to ${item.claimant_name} ${METHOD_PHRASE[body.method]}`,
        actorUserId,
        detail: 'signature captured',
        occurredAt: new Date(now.getTime() + 1),
      });
    });
    return this.get(ws, id);
  }

  async proposeDisposal(
    ws: ScopedWorkspace,
    id: string,
    body: ProposeFoundItemDisposalRequest,
    actorUserId: string,
  ): Promise<FoundItem> {
    const db = this.repo.database;
    await db.transaction(async (tx) => {
      const item = this.owned(await this.repo.find(tx, id, true), ws);
      if (item.status !== 'stored') throw new ConflictException('Only an unclaimed item in storage can be proposed for disposal.');
      if (item.retention_until >= kigaliDay()) {
        throw new ConflictException(`This item is held until ${longDay(item.retention_until)}; it cannot be disposed of before then.`);
      }
      await tx.execute(sql`
        update found_items
           set status = 'disposal_pending', disposal_note = ${body.note}, disposal_rule = ${RETENTION_RULE},
               disposal_proposed_by_user_id = ${actorUserId}, disposal_proposed_at = now(), updated_at = now()
         where id = ${item.id}
      `);
      await this.repo.addEvent(tx, {
        workspaceId: item.workspace_id,
        itemId: item.id,
        kind: 'disposal_proposed',
        summary: `Disposal proposed: ${body.note}`,
        actorUserId,
      });
    });
    return this.get(ws, id);
  }

  /** Disposal is final, so it needs a second person: never the one who proposed it. */
  async approveDisposal(ws: ScopedWorkspace, id: string, actorUserId: string): Promise<FoundItem> {
    const db = this.repo.database;
    await db.transaction(async (tx) => {
      const item = this.owned(await this.repo.find(tx, id, true), ws);
      if (item.status !== 'disposal_pending') throw new ConflictException('No disposal is waiting for approval on this item.');
      if (item.disposal_proposed_by_user_id === actorUserId) {
        throw new ForbiddenException('You proposed this disposal, so a second person has to approve it.');
      }
      const now = new Date();
      const actor = await tx.execute<{ name: string | null }>(sql`select name from users where id = ${actorUserId}`);
      const closed = `Disposed of on ${shortDay(kigaliDay(now))}. Proposed by ${item.disposal_proposed_by_name ?? 'the custodian'}, approved by ${actor.rows[0]?.name ?? 'a manager'}.`;
      await tx.execute(sql`
        update found_items
           set status = 'disposed', disposal_approved_by_user_id = ${actorUserId}, disposed_at = ${now},
               custodian_user_id = null, closed_note = ${closed}, updated_at = now()
         where id = ${item.id}
      `);
      await this.repo.addEvent(tx, {
        workspaceId: item.workspace_id,
        itemId: item.id,
        kind: 'disposal_approved',
        summary: 'Disposal approved by second person',
        actorUserId,
        occurredAt: now,
      });
    });
    return this.get(ws, id);
  }

  /** Keep an item longer (a guest may come back). A pending disposal is withdrawn by it. */
  async extendRetention(
    ws: ScopedWorkspace,
    id: string,
    body: ExtendFoundItemRetentionRequest,
    actorUserId: string,
  ): Promise<FoundItem> {
    const db = this.repo.database;
    await db.transaction(async (tx) => {
      const item = this.owned(await this.repo.find(tx, id, true), ws);
      if (item.status !== 'stored' && item.status !== 'disposal_pending') {
        throw new ConflictException('Only an item still held can be kept longer.');
      }
      const today = kigaliDay();
      const from = item.retention_until > today ? item.retention_until : today;
      const until = addDays(from, body.days);
      const actor = await tx.execute<{ name: string | null }>(sql`select name from users where id = ${actorUserId}`);
      await tx.execute(sql`
        update found_items
           set status = 'stored', retention_until = ${until}::date,
               retention_note = ${`Retention extended to ${longDay(until)} by ${actor.rows[0]?.name ?? 'a manager'}.`},
               disposal_note = null, disposal_rule = null, disposal_proposed_by_user_id = null,
               disposal_proposed_at = null, updated_at = now()
         where id = ${item.id}
      `);
      await this.repo.addEvent(tx, {
        workspaceId: item.workspace_id,
        itemId: item.id,
        kind: 'retention_extended',
        summary: `Kept ${body.days} more days`,
        actorUserId,
        detail: `reason: ${body.reason}`,
      });
    });
    return this.get(ws, id);
  }

  private owned(row: FoundItemRow | null, ws: ScopedWorkspace): FoundItemRow {
    const owned = assertOwned(row ? { ...row, workspaceId: row.workspace_id } : null, ws);
    assertInBranchScope(ws, owned.property_id);
    return owned;
  }

  private async present(rows: FoundItemRow[]): Promise<FoundItem[]> {
    const events = await this.repo.events(rows.map((r) => r.id));
    return rows.map((r) => ({
      id: r.id,
      reference: r.reference,
      propertyId: r.property_id,
      description: r.description,
      category: r.category,
      valuable: r.valuable,
      foundLocation: r.found_location,
      foundSpot: r.found_spot,
      roomId: r.room_id,
      foundAt: iso(r.found_at) as string,
      foundByUserId: r.found_by_user_id,
      foundByName: r.found_by_name,
      custodianUserId: r.custodian_user_id,
      custodianName: r.custodian_name,
      storageLocation: r.storage_location,
      status: r.status,
      retentionUntil: r.retention_until,
      retentionNote: r.retention_note,
      claim:
        r.claimant_name && r.claim_opened_at
          ? {
              claimantName: r.claimant_name,
              bookingReference: r.claim_booking_reference,
              statement: r.claim_statement ?? '',
              matched: Boolean(r.claim_matched),
              matchNote: r.claim_match_note ?? '',
              openedAt: iso(r.claim_opened_at) as string,
              openedByName: r.claim_opened_by_name,
            }
          : null,
      release:
        r.release_method && r.released_at
          ? { method: r.release_method, releasedAt: iso(r.released_at) as string, releasedByName: r.released_by_name }
          : null,
      disposal:
        r.disposal_note && r.disposal_proposed_at
          ? {
              note: r.disposal_note,
              rule: r.disposal_rule ?? RETENTION_RULE,
              proposedByName: r.disposal_proposed_by_name,
              proposedAt: iso(r.disposal_proposed_at) as string,
              approvedByName: r.disposal_approved_by_name,
              approvedAt: iso(r.disposed_at),
            }
          : null,
      closedNote: r.closed_note,
      events: events
        .filter((e) => e.found_item_id === r.id)
        .map((e) => ({
          id: e.id,
          kind: e.kind,
          summary: e.summary,
          actorName: e.actor_name,
          detail: e.detail,
          occurredAt: iso(e.occurred_at) as string,
        })),
    }));
  }
}
