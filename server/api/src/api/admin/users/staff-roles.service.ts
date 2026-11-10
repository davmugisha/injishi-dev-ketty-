import {
  AdminCustomRole,
  AdminCustomRoleAssignment,
  AdminCustomRoleChange,
  AdminRoleHolders,
  AdminStaffRoleCatalog,
  STAFF_ROLE_LABEL,
  StaffRole,
  builtInRolePermissions,
  isReservedStaffPermission,
  permissionsBeyond,
  type AdminCreateCustomRoleRequest,
  type AdminUpdateCustomRoleRequest,
  type StaffAccess,
  type StaffPermission,
} from '@injishi/contracts';
import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';

import {
  adminUsers,
  staffCustomRolePermissions,
  staffCustomRoles,
  userStaffCustomRoles,
  users,
} from '../../../database/drizzle/schema';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { AuditWriter } from '../../../shared/audit/audit-writer';

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];
type RoleRow = typeof staffCustomRoles.$inferSelect;

const BUILT_IN_NAMES = new Set(
  StaffRole.options.flatMap((r) => [r, STAFF_ROLE_LABEL[r].toLowerCase()]),
);

/** A stable key from a name: `Support desk` -> `support_desk`. */
export function roleKeyFrom(name: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
  return base.length >= 2 ? base : `role_${base}`;
}

/**
 * Custom staff roles (2026-11-02): a named bundle of the staff permissions the
 * code defines, made, changed and archived by a super admin, and given to
 * people one at a time.
 *
 * THE RULES, each checked here and not only in the console:
 *  - A custom role only bundles `StaffPermission`s, never a reserved one
 *    (`RESERVED_STAFF_PERMISSIONS`; the database refuses them too).
 *  - Nobody puts a permission in a role, or gives a role, that carries a
 *    permission they do not hold themselves.
 *  - The built-in roles are code. Their names cannot be reused.
 *  - A role somebody holds cannot be archived; take it from them first.
 *  - Nobody changes their own roles.
 *  - Every write commits one `audit_events` row with its reason, in the same
 *    transaction.
 *
 * The routes are `admin.user.role.grant`, which only super admin holds and no
 * custom role can carry, so only a super admin reaches any write here.
 */
@Injectable()
export class StaffRolesService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /** Every role, built in and custom (archived included), with who holds how many. The matrix reads this too. */
  async catalog(): Promise<AdminStaffRoleCatalog> {
    const builtInCounts = await this.db
      .select({ role: sql<string>`unnest(${adminUsers.staffRoles})`, n: sql<number>`count(*)::int` })
      .from(adminUsers)
      .where(isNull(adminUsers.revokedAt))
      .groupBy(sql`1`);
    const countByRole = new Map(builtInCounts.map((r) => [r.role, r.n]));
    const roles = await this.db.select().from(staffCustomRoles).orderBy(asc(staffCustomRoles.name));
    const custom = await this.hydrate(this.db, roles);
    return AdminStaffRoleCatalog.parse({
      builtIn: StaffRole.options.map((role) => ({
        role,
        name: STAFF_ROLE_LABEL[role],
        permissions: builtInRolePermissions(role),
        holderCount: countByRole.get(role) ?? 0,
      })),
      custom,
    });
  }

  async get(roleId: string): Promise<AdminCustomRole> {
    const role = await this.requireRole(this.db, roleId);
    const [hydrated] = await this.hydrate(this.db, [role]);
    return hydrated!;
  }

  /** Who holds a role: a built-in role by its key, a custom one by its id. */
  async holders(role: string): Promise<AdminRoleHolders> {
    if (StaffRole.safeParse(role).success) {
      const rows = await this.db
        .select({ userId: users.id, name: users.name, email: users.email, grantedAt: adminUsers.updatedAt })
        .from(adminUsers)
        .innerJoin(users, eq(users.id, adminUsers.userId))
        .where(and(isNull(adminUsers.revokedAt), sql`${role} = any(${adminUsers.staffRoles})`))
        .orderBy(asc(users.email));
      return AdminRoleHolders.parse({ items: rows.map((r) => ({ ...r, grantedAt: r.grantedAt?.toISOString() ?? null })) });
    }
    await this.requireRole(this.db, role);
    const rows = await this.db
      .select({ userId: users.id, name: users.name, email: users.email, grantedAt: userStaffCustomRoles.grantedAt })
      .from(userStaffCustomRoles)
      .innerJoin(users, eq(users.id, userStaffCustomRoles.userId))
      .where(and(eq(userStaffCustomRoles.roleId, role), isNull(userStaffCustomRoles.revokedAt)))
      .orderBy(asc(users.email));
    return AdminRoleHolders.parse({ items: rows.map((r) => ({ ...r, grantedAt: r.grantedAt.toISOString() })) });
  }

  async create(input: AdminCreateCustomRoleRequest, actor: { userId: string; access: StaffAccess }): Promise<AdminCustomRoleChange> {
    const permissions = this.checkPermissions(input.permissions, actor.access);
    this.checkName(input.name);
    return this.db.transaction(async (tx) => {
      await this.refuseTakenName(tx, input.name, null);
      const key = await this.freeKey(tx, roleKeyFrom(input.name));
      const [role] = await tx
        .insert(staffCustomRoles)
        .values({
          key,
          name: input.name,
          description: input.description ?? '',
          createdByUserId: actor.userId,
          updatedByUserId: actor.userId,
        })
        .returning();
      if (!role) throw new Error('Role insert returned no row.');
      await tx.insert(staffCustomRolePermissions).values(permissions.map((permission) => ({ roleId: role.id, permission })));
      const auditEventId = await audit(tx, actor.userId, 'staff_role', role.id, 'admin.staff_role.created', {
        name: input.name,
        permissions,
      }, input.reason);
      const [hydrated] = await this.hydrate(tx, [role]);
      return AdminCustomRoleChange.parse({ role: hydrated, auditEventId });
    });
  }

  /**
   * Replace a role's name, description and permissions. Adding a permission to
   * a role people hold gives it to all of them at once, which is why this is a
   * grant route (fresh step-up) like assigning one.
   */
  async update(
    roleId: string,
    input: AdminUpdateCustomRoleRequest,
    actor: { userId: string; access: StaffAccess },
  ): Promise<AdminCustomRoleChange> {
    const permissions = this.checkPermissions(input.permissions, actor.access);
    this.checkName(input.name);
    return this.db.transaction(async (tx) => {
      const role = await this.requireRole(tx, roleId, { forUpdate: true });
      if (role.archivedAt) {
        throw new ConflictException({ code: 'role_archived', message: 'This role is archived. Archived roles cannot be changed.' });
      }
      await this.refuseTakenName(tx, input.name, roleId);
      const before = (
        await tx
          .select({ permission: staffCustomRolePermissions.permission })
          .from(staffCustomRolePermissions)
          .where(eq(staffCustomRolePermissions.roleId, roleId))
      ).map((r) => r.permission);
      const added = permissions.filter((p) => !before.includes(p));
      const removed = before.filter((p) => !permissions.includes(p as StaffPermission));
      const renamed = role.name !== input.name;
      const described = role.description !== (input.description ?? '');
      if (!added.length && !removed.length && !renamed && !described) {
        throw new ConflictException({ code: 'unchanged', message: 'Nothing changed.' });
      }
      const now = new Date();
      const [updated] = await tx
        .update(staffCustomRoles)
        .set({ name: input.name, description: input.description ?? '', updatedByUserId: actor.userId, updatedAt: now })
        .where(eq(staffCustomRoles.id, roleId))
        .returning();
      if (removed.length) {
        await tx
          .delete(staffCustomRolePermissions)
          .where(and(eq(staffCustomRolePermissions.roleId, roleId), inArray(staffCustomRolePermissions.permission, removed)));
      }
      if (added.length) {
        await tx.insert(staffCustomRolePermissions).values(added.map((permission) => ({ roleId, permission })));
      }
      const auditEventId = await audit(tx, actor.userId, 'staff_role', roleId, 'admin.staff_role.updated', {
        ...(renamed ? { name: { from: role.name, to: input.name } } : {}),
        ...(described ? { description: { from: role.description, to: input.description ?? '' } } : {}),
        permissions: { added, removed },
      }, input.reason);
      const [hydrated] = await this.hydrate(tx, [updated!]);
      return AdminCustomRoleChange.parse({ role: hydrated, auditEventId });
    });
  }

  /** Archive a role nobody holds. It stays on record and can no longer be given. */
  async archive(roleId: string, reason: string, actorUserId: string): Promise<AdminCustomRoleChange> {
    return this.db.transaction(async (tx) => {
      const role = await this.requireRole(tx, roleId, { forUpdate: true });
      if (role.archivedAt) throw new ConflictException({ code: 'role_archived', message: 'This role is already archived.' });
      const held = await this.holderCount(tx, roleId);
      if (held > 0) {
        throw new ConflictException({
          code: 'role_held',
          message: `${held === 1 ? 'One person holds' : `${held} people hold`} this role. Take it from them first, then archive it.`,
        });
      }
      const now = new Date();
      const [updated] = await tx
        .update(staffCustomRoles)
        .set({ archivedAt: now, archivedByUserId: actorUserId, updatedByUserId: actorUserId, updatedAt: now })
        .where(eq(staffCustomRoles.id, roleId))
        .returning();
      const auditEventId = await audit(tx, actorUserId, 'staff_role', roleId, 'admin.staff_role.archived', { name: role.name }, reason);
      const [hydrated] = await this.hydrate(tx, [updated!]);
      return AdminCustomRoleChange.parse({ role: hydrated, auditEventId });
    });
  }

  /** Give a person a custom role. They become staff if they were not. */
  async assign(
    userId: string,
    roleId: string,
    reason: string,
    actor: { userId: string; access: StaffAccess },
    tx?: Tx,
  ): Promise<AdminCustomRoleAssignment> {
    if (userId === actor.userId) {
      throw new ConflictException({ code: 'self_grant', message: 'You cannot change your own staff roles. Ask another super admin.' });
    }
    const work = async (t: Tx): Promise<AdminCustomRoleAssignment> => {
      await requireUser(t, userId);
      const role = await this.requireRole(t, roleId);
      if (role.archivedAt) throw new ConflictException({ code: 'role_archived', message: 'This role is archived and cannot be given.' });
      const permissions = (
        await t
          .select({ permission: staffCustomRolePermissions.permission })
          .from(staffCustomRolePermissions)
          .where(eq(staffCustomRolePermissions.roleId, roleId))
      ).map((r) => r.permission as StaffPermission);
      this.refuseBeyond(permissions, actor.access, 'give this role');

      const [existing] = await t
        .select({ id: userStaffCustomRoles.id })
        .from(userStaffCustomRoles)
        .where(and(eq(userStaffCustomRoles.userId, userId), eq(userStaffCustomRoles.roleId, roleId), isNull(userStaffCustomRoles.revokedAt)))
        .limit(1);
      if (existing) throw new ConflictException({ code: 'already_held', message: 'This person already holds this role.' });

      await ensureStaffRow(t, userId, actor.userId);
      await t.insert(userStaffCustomRoles).values({ userId, roleId, grantedByUserId: actor.userId });
      const auditEventId = await audit(t, actor.userId, 'user', userId, 'admin.user.custom_role_granted', {
        roleId,
        roleName: role.name,
        permissions,
      }, reason);
      return AdminCustomRoleAssignment.parse({ userId, roleId, held: true, auditEventId });
    };
    return tx ? work(tx) : this.db.transaction(work);
  }

  /** Take a custom role from a person. With nothing left, their staff access ends. */
  async revoke(userId: string, roleId: string, reason: string, actorUserId: string): Promise<AdminCustomRoleAssignment> {
    if (userId === actorUserId) {
      throw new ConflictException({ code: 'self_grant', message: 'You cannot change your own staff roles. Ask another super admin.' });
    }
    return this.db.transaction(async (tx) => {
      const role = await this.requireRole(tx, roleId);
      const now = new Date();
      const [ended] = await tx
        .update(userStaffCustomRoles)
        .set({ revokedAt: now, revokedByUserId: actorUserId })
        .where(and(eq(userStaffCustomRoles.userId, userId), eq(userStaffCustomRoles.roleId, roleId), isNull(userStaffCustomRoles.revokedAt)))
        .returning({ id: userStaffCustomRoles.id });
      if (!ended) throw new NotFoundException('This person does not hold that role.');
      const staffEnded = await endStaffIfEmpty(tx, userId);
      const auditEventId = await audit(tx, actorUserId, 'user', userId, 'admin.user.custom_role_revoked', {
        roleId,
        roleName: role.name,
        staffAccessEnded: staffEnded,
      }, reason);
      return AdminCustomRoleAssignment.parse({ userId, roleId, held: false, auditEventId });
    });
  }

  // --- Checks ------------------------------------------------------------------------------

  /** Deduplicated, never reserved, never beyond what the actor holds. */
  private checkPermissions(wanted: readonly StaffPermission[], access: StaffAccess): StaffPermission[] {
    const permissions = [...new Set(wanted)];
    const reserved = permissions.filter(isReservedStaffPermission);
    if (reserved.length) {
      throw new UnprocessableEntityException({
        code: 'reserved_permission',
        message: `A custom role cannot include ${reserved.join(', ')}. Those stay with super admins.`,
      });
    }
    this.refuseBeyond(permissions, access, 'put these permissions in a role');
    return permissions;
  }

  private refuseBeyond(permissions: readonly StaffPermission[], access: StaffAccess, what: string): void {
    const beyond = permissionsBeyond(access.permissions, permissions);
    if (beyond.length) {
      throw new ForbiddenException({
        code: 'beyond_own',
        message: `You cannot ${what}: you do not hold ${beyond.join(', ')} yourself.`,
      });
    }
  }

  private checkName(name: string): void {
    if (BUILT_IN_NAMES.has(name.trim().toLowerCase()) || BUILT_IN_NAMES.has(roleKeyFrom(name))) {
      throw new ConflictException({ code: 'built_in_name', message: 'That is the name of a built-in role. Choose another.' });
    }
  }

  private async refuseTakenName(tx: Tx, name: string, exceptId: string | null): Promise<void> {
    const [taken] = await tx
      .select({ id: staffCustomRoles.id })
      .from(staffCustomRoles)
      .where(and(isNull(staffCustomRoles.archivedAt), sql`lower(${staffCustomRoles.name}) = lower(${name})`))
      .limit(1);
    if (taken && taken.id !== exceptId) {
      throw new ConflictException({ code: 'name_taken', message: 'A role with that name already exists.' });
    }
  }

  /** The key if free, else the key with the first free number after it. */
  private async freeKey(tx: Tx, base: string): Promise<string> {
    const rows = await tx
      .select({ key: staffCustomRoles.key })
      .from(staffCustomRoles)
      .where(sql`${staffCustomRoles.key} = ${base} or ${staffCustomRoles.key} like ${`${base}_%`}`);
    const taken = new Set(rows.map((r) => r.key));
    if (!taken.has(base)) return base;
    for (let n = 2; ; n++) if (!taken.has(`${base}_${n}`)) return `${base}_${n}`;
  }

  private async requireRole(db: Database | Tx, roleId: string, opts: { forUpdate?: boolean } = {}): Promise<RoleRow> {
    const query = db.select().from(staffCustomRoles).where(eq(staffCustomRoles.id, roleId)).limit(1);
    const [row] = opts.forUpdate ? await query.for('update') : await query;
    if (!row) throw new NotFoundException('No role has that id.');
    return row;
  }

  private async holderCount(db: Database | Tx, roleId: string): Promise<number> {
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(userStaffCustomRoles)
      .where(and(eq(userStaffCustomRoles.roleId, roleId), isNull(userStaffCustomRoles.revokedAt)));
    return row?.n ?? 0;
  }

  private async hydrate(db: Database | Tx, roles: RoleRow[]): Promise<AdminCustomRole[]> {
    if (!roles.length) return [];
    const ids = roles.map((r) => r.id);
    const [perms, counts] = await Promise.all([
      db
        .select({ roleId: staffCustomRolePermissions.roleId, permission: staffCustomRolePermissions.permission })
        .from(staffCustomRolePermissions)
        .where(inArray(staffCustomRolePermissions.roleId, ids)),
      db
        .select({ roleId: userStaffCustomRoles.roleId, n: sql<number>`count(*)::int` })
        .from(userStaffCustomRoles)
        .where(and(inArray(userStaffCustomRoles.roleId, ids), isNull(userStaffCustomRoles.revokedAt)))
        .groupBy(userStaffCustomRoles.roleId),
    ]);
    const countById = new Map(counts.map((c) => [c.roleId, c.n]));
    return roles.map((r) =>
      AdminCustomRole.parse({
        id: r.id,
        key: r.key,
        name: r.name,
        description: r.description,
        // Only what the code still defines, in canonical order.
        permissions: builtInOrder(perms.filter((p) => p.roleId === r.id).map((p) => p.permission)),
        holderCount: countById.get(r.id) ?? 0,
        archivedAt: r.archivedAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      }),
    );
  }
}

function builtInOrder(stored: string[]): StaffPermission[] {
  return builtInRolePermissions('super_admin').filter((p) => stored.includes(p));
}

// --- Shared with the account writes ---------------------------------------------------------

export async function requireUser(tx: Tx, userId: string): Promise<void> {
  const [row] = await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
  if (!row) throw new NotFoundException('No user has that id.');
}

/**
 * A live `admin_users` row, which is what makes a person staff. A revoked row
 * comes back with NO built-in roles: its old array is history, not a grant.
 */
export async function ensureStaffRow(tx: Tx, userId: string, actorUserId: string): Promise<void> {
  const [row] = await tx
    .select({ revokedAt: adminUsers.revokedAt })
    .from(adminUsers)
    .where(eq(adminUsers.userId, userId))
    .limit(1);
  if (!row) {
    await tx.insert(adminUsers).values({ userId, staffRoles: [], grantedByUserId: actorUserId });
  } else if (row.revokedAt) {
    await tx
      .update(adminUsers)
      .set({ staffRoles: [], revokedAt: null, grantedByUserId: actorUserId, updatedAt: new Date() })
      .where(eq(adminUsers.userId, userId));
  }
}

/** Live custom roles a person holds. */
export async function liveCustomRoleCount(tx: Tx, userId: string): Promise<number> {
  const [row] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(userStaffCustomRoles)
    .innerJoin(staffCustomRoles, eq(staffCustomRoles.id, userStaffCustomRoles.roleId))
    .where(and(eq(userStaffCustomRoles.userId, userId), isNull(userStaffCustomRoles.revokedAt), isNull(staffCustomRoles.archivedAt)));
  return row?.n ?? 0;
}

/** End a person's staff access when they hold no built-in and no custom role. True when it ended. */
export async function endStaffIfEmpty(tx: Tx, userId: string): Promise<boolean> {
  const [row] = await tx
    .select({ staffRoles: adminUsers.staffRoles })
    .from(adminUsers)
    .where(and(eq(adminUsers.userId, userId), isNull(adminUsers.revokedAt)))
    .limit(1);
  if (!row || row.staffRoles.length > 0) return false;
  if ((await liveCustomRoleCount(tx, userId)) > 0) return false;
  const now = new Date();
  await tx.update(adminUsers).set({ revokedAt: now, updatedAt: now }).where(eq(adminUsers.userId, userId));
  return true;
}

export async function audit(
  tx: Tx,
  actorUserId: string,
  subjectType: 'user' | 'org' | 'staff_role',
  subjectId: string,
  eventType: string,
  payloadDiff: Record<string, unknown>,
  reason: string,
): Promise<string> {
  return (await AuditWriter.write(tx, { actorUserId, subjectType, subjectId, eventType, payloadDiff: payloadDiff as never, reason })).id;
}
