import {
  effectivePermissionsForRole,
  type HousekeepingStatus,
  type OrgRole,
  type Permission,
  parseRolePermissionOverride,
  type RoomEventKind,
} from '@injishi/contracts';
import { sql } from 'drizzle-orm';

import { roomStatusEvents } from '../../../database/drizzle/schema';
import type { Database } from '../../../shared/database/database.module';

/** The transaction handle Drizzle hands a `db.transaction` callback. */
export type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];
export type Db = Database | Tx;

/** Every operator screen means Kigali by "today" (the properties here have no other zone yet). */
export const PROPERTY_ZONE = 'Africa/Kigali';

/** The Kigali calendar day of an instant, `yyyy-mm-dd`. */
export function kigaliDay(at: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: PROPERTY_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
}

/** Readiness in the words the board's history uses. */
export const READINESS_LABEL: Readonly<Record<string, string>> = {
  clean: 'Clean',
  dirty: 'Dirty',
  inspected: 'Inspected',
  out_of_order: 'Out of order',
  occupied: 'Occupied',
  available: 'On sale',
  maintenance: 'Out of order',
  out_of_service: 'Out of service',
};

export interface RoomEventInput {
  workspaceId: string;
  propertyId: string;
  roomId: string;
  kind: RoomEventKind;
  fromValue?: string | null;
  toValue?: string | null;
  summary: string;
  actorUserId?: string | null;
  /** Who acted when no person did: "System", `Rule “Floor 2”`. */
  actorLabel?: string | null;
  detail?: string | null;
  housekeepingTaskId?: string | null;
  maintenanceTicketId?: string | null;
  occurredAt?: Date;
}

/** Append one line to a room's history, in the caller's transaction. Never updated afterwards. */
export async function recordRoomEvent(db: Db, e: RoomEventInput): Promise<void> {
  await db.insert(roomStatusEvents).values({
    workspaceId: e.workspaceId,
    propertyId: e.propertyId,
    roomId: e.roomId,
    kind: e.kind,
    fromValue: e.fromValue ?? null,
    toValue: e.toValue ?? null,
    summary: e.summary,
    actorUserId: e.actorUserId ?? null,
    actorLabel: e.actorLabel ?? null,
    detail: e.detail ?? null,
    housekeepingTaskId: e.housekeepingTaskId ?? null,
    maintenanceTicketId: e.maintenanceTicketId ?? null,
    ...(e.occurredAt ? { occurredAt: e.occurredAt } : {}),
  });
}

/**
 * Move a room's readiness and record why, in the caller's transaction.
 *
 * Readiness is housekeeping's and moves freely, out of order included: whether the room may be SOLD
 * is its inventory status, which only a block's approval and release change, so a room cleaned and
 * inspected after a repair is ready and still off sale until a manager releases it. No change, no
 * line. Returns whether the room moved.
 */
export async function setRoomReadinessTx(
  tx: Db,
  input: {
    roomId: string;
    to: HousekeepingStatus;
    actorUserId: string | null;
    detail?: string | null;
    housekeepingTaskId?: string | null;
    kind?: RoomEventKind;
  },
): Promise<boolean> {
  const found = await tx.execute<{
    housekeeping_status: HousekeepingStatus;
    workspace_id: string;
    property_id: string;
  }>(sql`
    select housekeeping_status, workspace_id, property_id
      from rooms where id = ${input.roomId} for update
  `);
  const room = found.rows[0];
  if (!room || room.housekeeping_status === input.to) return false;
  await tx.execute(sql`
    update rooms
       set housekeeping_status = ${input.to},
           housekeeping_updated_at = now(),
           housekeeping_updated_by_user_id = ${input.actorUserId},
           updated_at = now()
     where id = ${input.roomId}
  `);
  await recordRoomEvent(tx, {
    workspaceId: room.workspace_id,
    propertyId: room.property_id,
    roomId: input.roomId,
    kind: input.kind ?? 'housekeeping',
    fromValue: room.housekeeping_status,
    toValue: input.to,
    summary: `${READINESS_LABEL[room.housekeeping_status] ?? room.housekeeping_status} → ${READINESS_LABEL[input.to] ?? input.to}`,
    actorUserId: input.actorUserId,
    actorLabel: input.actorUserId ? null : 'System',
    detail: input.detail ?? null,
    housekeepingTaskId: input.housekeepingTaskId ?? null,
  });
  return true;
}

/**
 * Can this person take housekeeping work at this property? An ACTIVE member of the business, whose
 * branch limits (ADR-054) cover the property, and whose role, with this business's own overrides
 * (ADR-055), holds `housekeeping.set`. Resolved here because a task given to someone who can never
 * mark it done sits on the board forever.
 */
export async function memberHoldsAt(
  db: Db,
  input: { orgId: string; userId: string; propertyId: string; permission: Permission },
): Promise<{ name: string } | null> {
  const found = await db.execute<{ name: string | null; email: string; org_role: string; covered: boolean }>(sql`
    select u.name, u.email, m.org_role,
           (not exists (select 1 from org_membership_branches b where b.org_membership_id = m.id)
             or exists (select 1 from org_membership_branches b
                         where b.org_membership_id = m.id and b.property_id = ${input.propertyId})) as covered
      from org_memberships m
      join users u on u.id = m.user_id
     where m.org_id = ${input.orgId} and m.user_id = ${input.userId} and m.status = 'active'
     limit 1
  `);
  const row = found.rows[0];
  if (!row || !row.covered) return null;
  const overrides = await db.execute<{ org_role: string; permission: string; granted: boolean }>(sql`
    select org_role, permission, granted from org_role_permissions
     where org_id = ${input.orgId} and org_role = ${row.org_role}
  `);
  const parsed = overrides.rows
    .map((o) => parseRolePermissionOverride({ orgRole: o.org_role, permission: o.permission, granted: o.granted }))
    .filter((o): o is NonNullable<typeof o> => o !== null);
  const perms = effectivePermissionsForRole(row.org_role as OrgRole, parsed);
  if (!perms.includes(input.permission)) return null;
  return { name: row.name ?? row.email };
}
