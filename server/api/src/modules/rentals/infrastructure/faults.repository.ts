import type { FaultPhotoPhase, MaintenanceCategory, MaintenancePriority, MaintenanceStatus } from '@injishi/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { sql, type SQL } from 'drizzle-orm';

import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import type { DbOrTx } from './rentals-writers';

/** One fault with everything a list row or the side panel shows. */
export interface FaultRow {
  id: string;
  workspaceId: string;
  orgId: string | null;
  propertyId: string | null;
  propertyName: string | null;
  unitId: string | null;
  unitLabel: string | null;
  leaseId: string | null;
  leaseReference: string | null;
  tenantId: string | null;
  tenantName: string | null;
  tenantUserId: string | null;
  tenantEmail: string | null;
  reference: string | null;
  title: string;
  description: string | null;
  category: MaintenanceCategory | null;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  raisedByRole: 'guest' | 'tenant' | 'staff' | 'housekeeper' | null;
  raisedByUserId: string | null;
  raisedByName: string | null;
  staffMayEnter: boolean | null;
  assigneeKind: 'member' | 'contractor' | null;
  assignedToUserId: string | null;
  assignedToName: string | null;
  assignedContractor: string | null;
  assignedContractorPhone: string | null;
  acknowledgedAt: Date | null;
  resolvedAt: Date | null;
  wontFixReason: string | null;
  reopenedCount: number;
  createdAt: Date;
  updatedAt: Date;
  photoCount: number;
}

export interface FaultPhotoRow {
  id: string;
  ticketId: string;
  storedObjectId: string;
  objectKey: string;
  phase: FaultPhotoPhase;
  position: number;
  uploadedByUserId: string | null;
  createdAt: Date;
}

export interface FaultEventRow {
  id: string;
  ticketId: string;
  kind: string;
  fromStatus: MaintenanceStatus | null;
  toStatus: MaintenanceStatus | null;
  note: string | null;
  authorUserId: string | null;
  authorRole: 'guest' | 'tenant' | 'staff' | 'housekeeper' | null;
  authorName: string | null;
  visibleToTenant: boolean;
  createdAt: Date;
}

/** The lease a tenant reports a fault on. */
export interface FaultLeaseRow {
  id: string;
  workspaceId: string;
  orgId: string;
  propertyId: string;
  unitId: string;
  status: string;
  reference: string;
}

/** A unit a landlord raises a fault on, with the lease living in it now (if any). */
export interface FaultUnitRow {
  id: string;
  workspaceId: string;
  propertyId: string;
  label: string;
  state: string;
  liveLeaseId: string | null;
}

type RawFault = {
  id: string;
  workspace_id: string;
  org_id: string | null;
  property_id: string | null;
  property_name: string | null;
  unit_id: string | null;
  unit_label: string | null;
  lease_id: string | null;
  lease_reference: string | null;
  tenant_id: string | null;
  tenant_name: string | null;
  tenant_user_id: string | null;
  tenant_email: string | null;
  reference: string | null;
  title: string;
  description: string | null;
  category: MaintenanceCategory | null;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  raised_by_role: FaultRow['raisedByRole'];
  raised_by_user_id: string | null;
  raised_by_name: string | null;
  staff_may_enter: boolean | null;
  assignee_kind: FaultRow['assigneeKind'];
  assigned_to_user_id: string | null;
  assigned_to_name: string | null;
  assigned_contractor: string | null;
  assigned_contractor_phone: string | null;
  acknowledged_at: Date | null;
  resolved_at: Date | null;
  wont_fix_reason: string | null;
  reopened_count: number;
  created_at: Date;
  updated_at: Date;
  photo_count: number;
};

const date = (v: Date | string | null): Date | null => (v === null ? null : new Date(v));

function toRow(r: RawFault): FaultRow {
  return {
    id: r.id,
    workspaceId: r.workspace_id,
    orgId: r.org_id,
    propertyId: r.property_id,
    propertyName: r.property_name,
    unitId: r.unit_id,
    unitLabel: r.unit_label,
    leaseId: r.lease_id,
    leaseReference: r.lease_reference,
    tenantId: r.tenant_id,
    tenantName: r.tenant_name,
    tenantUserId: r.tenant_user_id,
    tenantEmail: r.tenant_email,
    reference: r.reference,
    title: r.title,
    description: r.description,
    category: r.category,
    priority: r.priority,
    status: r.status,
    raisedByRole: r.raised_by_role,
    raisedByUserId: r.raised_by_user_id,
    raisedByName: r.raised_by_name,
    staffMayEnter: r.staff_may_enter,
    assigneeKind: r.assignee_kind,
    assignedToUserId: r.assigned_to_user_id,
    assignedToName: r.assigned_to_name,
    assignedContractor: r.assigned_contractor,
    assignedContractorPhone: r.assigned_contractor_phone,
    acknowledgedAt: date(r.acknowledged_at),
    resolvedAt: date(r.resolved_at),
    wontFixReason: r.wont_fix_reason,
    reopenedCount: Number(r.reopened_count ?? 0),
    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at),
    photoCount: Number(r.photo_count ?? 0),
  };
}

const ids = (list: readonly string[]): SQL => sql.join(list.map((id) => sql`${id}::uuid`), sql`, `);

/** The building a fault is in, for the scope filter. */
const FAULT_PROPERTY = sql`coalesce(t.property_id, u.property_id, l.property_id)`;

/**
 * The rentals faults' reads and writes (WP 4.1): `maintenance_tickets` rows
 * of a residence business, about a rented unit or a lease. Status changes go
 * through `TicketLifecycle`, never through here.
 */
@Injectable()
export class FaultsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  get database(): Database {
    return this.db;
  }

  private readonly select = sql`
      select t.id, t.workspace_id, t.org_id, ${FAULT_PROPERTY} as property_id, p.name as property_name,
             coalesce(t.unit_id, l.unit_id) as unit_id, u.label as unit_label,
             t.lease_id, l.reference as lease_reference,
             tn.id as tenant_id, tn.full_name as tenant_name, tn.user_id as tenant_user_id,
             coalesce(tu.email, tn.email) as tenant_email,
             t.reference, t.title, t.description, t.category, t.priority, t.status, t.raised_by_role,
             t.raised_by_user_id, coalesce(ru.name, ru.email) as raised_by_name, t.staff_may_enter,
             t.assignee_kind, t.assigned_to_user_id, coalesce(au.name, au.email) as assigned_to_name,
             t.assigned_contractor, t.assigned_contractor_phone, t.acknowledged_at, t.resolved_at,
             t.wont_fix_reason, t.reopened_count, t.created_at, t.updated_at,
             (select count(*)::int from maintenance_photos mp where mp.ticket_id = t.id) as photo_count
        from maintenance_tickets t
        left join leases l on l.id = t.lease_id
        left join rental_units u on u.id = coalesce(t.unit_id, l.unit_id)
        left join properties p on p.id = ${FAULT_PROPERTY}
        left join tenants tn on tn.id = l.tenant_id
        left join users tu on tu.id = tn.user_id
        left join users ru on ru.id = t.raised_by_user_id
        left join users au on au.id = t.assigned_to_user_id
  `;

  private where(input: {
    workspaceId: string;
    buildings: readonly string[] | null;
    statuses?: readonly MaintenanceStatus[] | null;
    unitId?: string | null;
    leaseId?: string | null;
    q?: string | null;
  }): SQL {
    const parts: SQL[] = [sql`t.workspace_id = ${input.workspaceId}`, sql`(t.unit_id is not null or t.lease_id is not null)`];
    if (input.buildings !== null) {
      parts.push(input.buildings.length > 0 ? sql`${FAULT_PROPERTY} in (${ids(input.buildings)})` : sql`false`);
    }
    if (input.statuses?.length) parts.push(sql`t.status::text in (${sql.join(input.statuses.map((s) => sql`${s}`), sql`, `)})`);
    if (input.unitId) parts.push(sql`coalesce(t.unit_id, l.unit_id) = ${input.unitId}`);
    if (input.leaseId) parts.push(sql`t.lease_id = ${input.leaseId}`);
    if (input.q) {
      const like = `%${input.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      parts.push(sql`(t.title ilike ${like} or t.reference ilike ${like} or u.label ilike ${like} or tn.full_name ilike ${like})`);
    }
    return sql.join(parts, sql` and `);
  }

  async page(input: {
    workspaceId: string;
    buildings: readonly string[] | null;
    statuses: readonly MaintenanceStatus[] | null;
    unitId: string | null;
    q: string | null;
    limit: number;
    offset: number;
  }): Promise<{ rows: FaultRow[]; total: number }> {
    const where = this.where(input);
    const [found, counted] = await Promise.all([
      this.db.execute<RawFault>(sql`
        ${this.select}
         where ${where}
         order by case t.priority when 'urgent' then 0 when 'high' then 1 when 'normal' then 2 else 3 end,
                  t.updated_at desc, t.id
         limit ${input.limit} offset ${input.offset}
      `),
      this.db.execute<{ n: number }>(sql`
        select count(*)::int as n
          from maintenance_tickets t
          left join leases l on l.id = t.lease_id
          left join rental_units u on u.id = coalesce(t.unit_id, l.unit_id)
          left join tenants tn on tn.id = l.tenant_id
         where ${where}
      `),
    ]);
    return { rows: found.rows.map(toRow), total: Number(counted.rows[0]?.n ?? 0) };
  }

  /** How many faults sit in each status, under the same filters but the tab. */
  async statusCounts(input: {
    workspaceId: string;
    buildings: readonly string[] | null;
    unitId: string | null;
    q: string | null;
  }): Promise<Map<MaintenanceStatus, number>> {
    const found = await this.db.execute<{ status: MaintenanceStatus; n: number }>(sql`
      select t.status, count(*)::int as n
        from maintenance_tickets t
        left join leases l on l.id = t.lease_id
        left join rental_units u on u.id = coalesce(t.unit_id, l.unit_id)
        left join tenants tn on tn.id = l.tenant_id
       where ${this.where(input)}
       group by t.status
    `);
    return new Map(found.rows.map((r) => [r.status, Number(r.n)]));
  }

  async find(id: string, db: DbOrTx = this.db): Promise<FaultRow | null> {
    const found = await db.execute<RawFault>(sql`${this.select} where t.id = ${id}`);
    const r = found.rows[0];
    return r ? toRow(r) : null;
  }

  /** The faults on one lease, newest first (the tenant's list). */
  async forLease(leaseId: string): Promise<FaultRow[]> {
    const found = await this.db.execute<RawFault>(sql`
      ${this.select} where t.lease_id = ${leaseId} and t.status <> 'cancelled' order by t.created_at desc, t.id
    `);
    return found.rows.map(toRow);
  }

  async photos(ticketId: string, db: DbOrTx = this.db): Promise<FaultPhotoRow[]> {
    const found = await db.execute<{
      id: string;
      ticket_id: string;
      stored_object_id: string;
      object_key: string;
      phase: FaultPhotoPhase;
      position: number;
      uploaded_by_user_id: string | null;
      created_at: Date;
    }>(sql`
      select p.id, p.ticket_id, p.stored_object_id, so.object_key, p.phase, p.position, p.uploaded_by_user_id, p.created_at
        from maintenance_photos p
        join stored_objects so on so.id = p.stored_object_id
       where p.ticket_id = ${ticketId}
       order by case p.phase when 'report' then 0 when 'progress' then 1 else 2 end, p.position, p.created_at
    `);
    return found.rows.map((r) => ({
      id: r.id,
      ticketId: r.ticket_id,
      storedObjectId: r.stored_object_id,
      objectKey: r.object_key,
      phase: r.phase,
      position: Number(r.position),
      uploadedByUserId: r.uploaded_by_user_id,
      createdAt: new Date(r.created_at),
    }));
  }

  async events(ticketId: string, opts: { tenantOnly: boolean }): Promise<FaultEventRow[]> {
    const found = await this.db.execute<{
      id: string;
      ticket_id: string;
      kind: string;
      from_status: MaintenanceStatus | null;
      to_status: MaintenanceStatus | null;
      note: string | null;
      author_user_id: string | null;
      author_role: FaultEventRow['authorRole'];
      author_name: string | null;
      visible_to_tenant: boolean;
      created_at: Date;
    }>(sql`
      select e.id, e.ticket_id, e.kind, e.from_status, e.to_status, e.note, e.author_user_id, e.author_role,
             coalesce(u.name, u.email) as author_name, e.visible_to_tenant, e.created_at
        from maintenance_events e
        left join users u on u.id = e.author_user_id
       where e.ticket_id = ${ticketId} ${opts.tenantOnly ? sql`and e.visible_to_tenant` : sql``}
       order by e.created_at, e.id
    `);
    return found.rows.map((r) => ({
      id: r.id,
      ticketId: r.ticket_id,
      kind: r.kind,
      fromStatus: r.from_status,
      toStatus: r.to_status,
      note: r.note,
      authorUserId: r.author_user_id,
      authorRole: r.author_role,
      authorName: r.author_name,
      visibleToTenant: Boolean(r.visible_to_tenant),
      createdAt: new Date(r.created_at),
    }));
  }

  /** A unit of this workspace, with its live lease (signed, active or ending) if someone lives there. */
  async unit(unitId: string): Promise<FaultUnitRow | null> {
    const found = await this.db.execute<{
      id: string;
      workspace_id: string;
      property_id: string;
      label: string;
      state: string;
      live_lease_id: string | null;
    }>(sql`
      select u.id, u.workspace_id, u.property_id, u.label, u.state,
             (select l.id from leases l
               where l.unit_id = u.id and l.status in ('signed', 'active', 'ending')
               order by l.start_date desc limit 1) as live_lease_id
        from rental_units u where u.id = ${unitId}
    `);
    const r = found.rows[0];
    return r
      ? { id: r.id, workspaceId: r.workspace_id, propertyId: r.property_id, label: r.label, state: r.state, liveLeaseId: r.live_lease_id }
      : null;
  }

  async lease(leaseId: string): Promise<FaultLeaseRow | null> {
    const found = await this.db.execute<{
      id: string;
      workspace_id: string;
      org_id: string;
      property_id: string;
      unit_id: string;
      status: string;
      reference: string;
    }>(sql`select id, workspace_id, org_id, property_id, unit_id, status, reference from leases where id = ${leaseId}`);
    const r = found.rows[0];
    return r
      ? { id: r.id, workspaceId: r.workspace_id, orgId: r.org_id, propertyId: r.property_id, unitId: r.unit_id, status: r.status, reference: r.reference }
      : null;
  }

  /** The next "F-n" of the workspace, under a transaction-scoped lock so two reports never share one. */
  async nextReference(tx: DbOrTx, workspaceId: string): Promise<string> {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`fault:${workspaceId}`}))`);
    const found = await tx.execute<{ next: number }>(sql`
      select coalesce(max((substring(reference from '^F-([0-9]+)$'))::int), 0) + 1 as next
        from maintenance_tickets where workspace_id = ${workspaceId} and reference ~ '^F-[0-9]+$'
    `);
    return `F-${Number(found.rows[0]?.next ?? 1)}`;
  }

  async insert(
    tx: DbOrTx,
    values: {
      workspaceId: string;
      orgId: string;
      propertyId: string;
      unitId: string;
      leaseId: string | null;
      reference: string;
      raisedByUserId: string;
      raisedByRole: 'tenant' | 'staff';
      raisedVia: string;
      title: string;
      description: string | null;
      category: MaintenanceCategory;
      priority: MaintenancePriority;
      staffMayEnter: boolean | null;
    },
  ): Promise<string> {
    const inserted = await tx.execute<{ id: string }>(sql`
      insert into maintenance_tickets
        (workspace_id, org_id, property_id, unit_id, lease_id, reference, raised_by_user_id, raised_by_role,
         raised_via, title, description, category, priority, status, staff_may_enter, department_id)
      values (${values.workspaceId}, ${values.orgId}, ${values.propertyId}, ${values.unitId}, ${values.leaseId},
              ${values.reference}, ${values.raisedByUserId}, ${values.raisedByRole}::maintenance_raised_by_role,
              ${values.raisedVia}, ${values.title}, ${values.description}, ${values.category}::maintenance_category,
              ${values.priority}::maintenance_priority, 'open', ${values.staffMayEnter},
              (select d.id from departments d
                where d.property_id = ${values.propertyId} and d.department_category = 'engineering' limit 1))
      returning id
    `);
    return inserted.rows[0]?.id as string;
  }

  /** How many photos a ticket holds in a phase, read under the ticket's lock. */
  async photoCount(tx: DbOrTx, ticketId: string, phase: FaultPhotoPhase): Promise<number> {
    const found = await tx.execute<{ n: number }>(sql`
      select count(*)::int as n from maintenance_photos where ticket_id = ${ticketId} and phase = ${phase}::maintenance_photo_phase
    `);
    return Number(found.rows[0]?.n ?? 0);
  }

  async addPhoto(
    tx: DbOrTx,
    values: { ticketId: string; storedObjectId: string; phase: FaultPhotoPhase; position: number; uploadedByUserId: string },
  ): Promise<string> {
    const inserted = await tx.execute<{ id: string }>(sql`
      insert into maintenance_photos (ticket_id, stored_object_id, phase, position, uploaded_by_user_id)
      values (${values.ticketId}, ${values.storedObjectId}, ${values.phase}::maintenance_photo_phase, ${values.position},
              ${values.uploadedByUserId})
      returning id
    `);
    return inserted.rows[0]?.id as string;
  }

  /** Touch a ticket so lists sorted by activity show it first (a message, a photo). */
  async touch(tx: DbOrTx, ticketId: string): Promise<void> {
    await tx.execute(sql`update maintenance_tickets set updated_at = now() where id = ${ticketId}`);
  }

  /** The business's name, for the tenant's mail. */
  async orgName(orgId: string): Promise<string> {
    const found = await this.db.execute<{ legal_name: string }>(sql`select legal_name from orgs where id = ${orgId}`);
    return found.rows[0]?.legal_name ?? 'Your landlord';
  }
}
