import type {
  AssignDepartmentMemberRequest,
  CreateDepartmentRequest,
  DepartmentCategory,
  DepartmentPosition,
  DepartmentStatus,
  DepartmentType,
  UpdateDepartmentRequest,
} from '@injishi/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';

import {
  departmentMembers,
  departments,
  orgMemberships,
  properties,
  users,
} from '../../../database/drizzle/schema';
import {
  DRIZZLE,
  type Database,
} from '../../../shared/database/database.module';
import { seedPropertyDepartments } from '../domain/usali-departments';

export interface DepartmentMemberRow {
  id: string;
  workspaceId: string;
  departmentId: string;
  userId: string;
  name: string | null;
  email: string | null;
  departmentPosition: DepartmentPosition;
  isPrimary: boolean;
  status: 'active' | 'removed';
}

export interface DepartmentRow {
  id: string;
  workspaceId: string;
  propertyId: string | null;
  name: string;
  departmentType: DepartmentType;
  departmentCategory: DepartmentCategory;
  isRevenueCenter: boolean;
  guestRequestable: boolean;
  sortOrder: number;
  status: DepartmentStatus;
  headName: string | null;
  headPhone: string | null;
  phone: string | null;
}

/**
 * The only place that touches Drizzle for departments (ADR-016 slice 1).
 *
 * Same split as every other operator repository: a LIST is filtered by
 * workspace in its `where`, and a SINGLE ROW is read unscoped so the service
 * can hand it to `assertOwned` and answer 404 rather than 403.
 */
@Injectable()
export class DepartmentsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  private readonly columns = {
    id: departments.id,
    workspaceId: departments.workspaceId,
    propertyId: departments.propertyId,
    name: departments.name,
    departmentType: departments.departmentType,
    departmentCategory: departments.departmentCategory,
    isRevenueCenter: departments.isRevenueCenter,
    guestRequestable: departments.guestRequestable,
    sortOrder: departments.sortOrder,
    status: departments.status,
    headName: departments.headName,
    headPhone: departments.headPhone,
    phone: departments.phone,
  };

  async list(workspaceId: string): Promise<DepartmentRow[]> {
    return this.db
      .select(this.columns)
      .from(departments)
      .where(eq(departments.workspaceId, workspaceId))
      .orderBy(asc(departments.sortOrder), asc(departments.name));
  }

  async find(id: string): Promise<DepartmentRow | null> {
    const [row] = await this.db
      .select(this.columns)
      .from(departments)
      .where(eq(departments.id, id))
      .limit(1);
    return row ?? null;
  }

  /** The property, read unscoped so the service can prove it belongs here. */
  async findProperty(
    propertyId: string,
  ): Promise<{ id: string; orgId: string; workspaceId: string } | null> {
    const [row] = await this.db
      .select({
        id: properties.id,
        orgId: properties.orgId,
        workspaceId: properties.workspaceId,
      })
      .from(properties)
      .where(eq(properties.id, propertyId))
      .limit(1);
    return row ?? null;
  }

  /** The revenue centre a room charge attributes to, for one property. */
  async findRoomsDepartment(propertyId: string): Promise<DepartmentRow | null> {
    const [row] = await this.db
      .select(this.columns)
      .from(departments)
      .where(
        and(
          eq(departments.propertyId, propertyId),
          eq(departments.departmentCategory, 'rooms'),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async create(input: {
    orgId: string;
    workspaceId: string;
    request: CreateDepartmentRequest;
  }): Promise<string | null> {
    const r = input.request;
    const [row] = await this.db
      .insert(departments)
      .values({
        orgId: input.orgId,
        propertyId: r.propertyId,
        workspaceId: input.workspaceId,
        name: r.name,
        departmentType: r.departmentType,
        departmentCategory: r.departmentCategory,
        // Never taken from the request. A cost centre that accepts revenue is a
        // contradiction the database refuses too, so asking would only move the
        // refusal later.
        isRevenueCenter: r.departmentType === 'operated',
        guestRequestable: r.guestRequestable ?? false,
        sortOrder: r.sortOrder ?? 500,
        headName: r.headName?.trim() || null,
        headPhone: r.headPhone ?? null,
        phone: r.phone ?? null,
      })
      // The property already has one department per category. A duplicate is a
      // conflict rather than an error, and the service turns the empty result
      // into a 409 that names what already exists.
      .onConflictDoNothing()
      .returning({ id: departments.id });
    return row?.id ?? null;
  }

  async update(id: string, request: UpdateDepartmentRequest): Promise<void> {
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (request.name !== undefined) patch.name = request.name;
    if (request.guestRequestable !== undefined) {
      patch.guestRequestable = request.guestRequestable;
    }
    if (request.sortOrder !== undefined) patch.sortOrder = request.sortOrder;
    if (request.status !== undefined) patch.status = request.status;
    // The contact card. ull clears a field; an empty name is no name.
    if (request.headName !== undefined) {
      patch.headName = request.headName?.trim() || null;
    }
    if (request.headPhone !== undefined) patch.headPhone = request.headPhone;
    if (request.phone !== undefined) patch.phone = request.phone;

    await this.db
      .update(departments)
      .set(patch)
      .where(eq(departments.id, id));
  }

  // --- Department staff (D17) ----------------------------------------------

  async listMembers(departmentId: string): Promise<DepartmentMemberRow[]> {
    return this.db
      .select({
        id: departmentMembers.id,
        workspaceId: departmentMembers.workspaceId,
        departmentId: departmentMembers.departmentId,
        userId: departmentMembers.userId,
        name: users.name,
        email: users.email,
        departmentPosition: departmentMembers.departmentPosition,
        isPrimary: departmentMembers.isPrimary,
        status: departmentMembers.status,
      })
      .from(departmentMembers)
      .innerJoin(users, eq(users.id, departmentMembers.userId))
      .where(eq(departmentMembers.departmentId, departmentId))
      .orderBy(asc(departmentMembers.departmentPosition), asc(users.name));
  }

  async findMember(id: string): Promise<DepartmentMemberRow | null> {
    const [row] = await this.db
      .select({
        id: departmentMembers.id,
        workspaceId: departmentMembers.workspaceId,
        departmentId: departmentMembers.departmentId,
        userId: departmentMembers.userId,
        name: users.name,
        email: users.email,
        departmentPosition: departmentMembers.departmentPosition,
        isPrimary: departmentMembers.isPrimary,
        status: departmentMembers.status,
      })
      .from(departmentMembers)
      .innerJoin(users, eq(users.id, departmentMembers.userId))
      .where(eq(departmentMembers.id, id))
      .limit(1);
    return row ?? null;
  }

  /**
   * This person's membership of this org, which is what a roster row hangs off.
   *
   * Resolved on the server from the user id the caller sent, rather than taken
   * from the request. A caller who could supply a membership id could supply
   * somebody else's and put a stranger on their roster.
   */
  async findOrgMembership(input: {
    orgId: string;
    userId: string;
  }): Promise<{ id: string } | null> {
    const [row] = await this.db
      .select({ id: orgMemberships.id })
      .from(orgMemberships)
      .where(
        and(
          eq(orgMemberships.orgId, input.orgId),
          eq(orgMemberships.userId, input.userId),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  /**
   * Add somebody to a department, or bring them back if they were removed.
   *
   * The partial unique index allows one ACTIVE row per person per department,
   * so a re-add after a removal reuses the row rather than accumulating a
   * history of removed duplicates that every roster query then has to filter.
   */
  async assignMember(input: {
    departmentId: string;
    orgMembershipId: string;
    userId: string;
    workspaceId: string;
    request: AssignDepartmentMemberRequest;
  }): Promise<string | null> {
    const [row] = await this.db
      .insert(departmentMembers)
      .values({
        departmentId: input.departmentId,
        orgMembershipId: input.orgMembershipId,
        userId: input.userId,
        workspaceId: input.workspaceId,
        departmentPosition: input.request.departmentPosition ?? 'staff',
        isPrimary: input.request.isPrimary ?? false,
      })
      .onConflictDoUpdate({
        target: [departmentMembers.departmentId, departmentMembers.userId],
        targetWhere: eq(departmentMembers.status, 'active'),
        set: {
          departmentPosition: input.request.departmentPosition ?? 'staff',
          isPrimary: input.request.isPrimary ?? false,
          status: 'active',
          updatedAt: new Date(),
        },
      })
      .returning({ id: departmentMembers.id });
    return row?.id ?? null;
  }

  /** Soft removal. The row stays, so who worked where survives the change. */
  async removeMember(id: string): Promise<void> {
    await this.db
      .update(departmentMembers)
      .set({ status: 'removed', updatedAt: new Date() })
      .where(eq(departmentMembers.id, id));
  }

  /** Give a property the USALI set. Idempotent, so a repair run is safe. */
  async seedForProperty(input: {
    orgId: string;
    propertyId: string;
    workspaceId: string;
  }): Promise<void> {
    await this.db.transaction(async (tx) => {
      await seedPropertyDepartments(tx, input);
    });
  }
}
