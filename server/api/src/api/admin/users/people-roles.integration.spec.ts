import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { randomUUID } from 'node:crypto';

import { ConflictException, ForbiddenException, UnprocessableEntityException } from '@nestjs/common';
import { staffPermissionsForRoles, type StaffAccess, type StaffPermission } from '@injishi/contracts';
import { and, eq, isNull } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import * as schema from '../../../database/drizzle/schema';
import { AccountGate } from '../../../modules/auth/infrastructure/account-gate';
import type { GuestNotifier } from '../../../modules/guests/infrastructure/guest-notifier';
import { WorkspaceService } from '../../../shared/auth/workspace.service';
import type { Database } from '../../../shared/database/database.module';
import { AccountAccessService } from './account-access.service';
import { AdminAccountsService } from './admin-accounts.service';
import { AdminUsersRepository } from './admin-users.repository';
import { AdminUsersService } from './admin-users.service';
import { RecordAccessService } from './record-access.service';
import { StaffRolesService } from './staff-roles.service';

/**
 * People against Postgres (2026-11-02): custom staff roles and the rules
 * around them, suspension, the sign in history and the directory's filters.
 *
 *   ACCOUNTS_IT_DATABASE_URL=postgres://… npx vitest run src/api/admin/users/people-roles.integration.spec.ts
 *
 * Every account it makes carries a random tag. It is meant for a throwaway
 * database; it never touches anyone else's rows, and it ends every staff grant
 * and suspension it made.
 */
const url = process.env.ACCOUNTS_IT_DATABASE_URL;
const maybe = url ? describe : describe.skip;

maybe('people: roles, suspension and sign ins against Postgres', () => {
  let pool: Pool;
  let db: Database;
  let roles: StaffRolesService;
  let accounts: AdminAccountsService;
  let access: AccountAccessService;
  let workspaces: WorkspaceService;
  let directory: AdminUsersService;
  let gate: AccountGate;
  const tag = randomUUID().slice(0, 8);
  const reason = 'Integration test';
  let adminId: string;
  const superAccess: StaffAccess = { isStaff: true, roles: ['super_admin'], permissions: staffPermissionsForRoles(['super_admin']) };
  const opsAccess: StaffAccess = { isStaff: true, roles: ['ops'], permissions: staffPermissionsForRoles(['ops']) };
  const asSuper = (): { userId: string; access: StaffAccess } => ({ userId: adminId, access: superAccess });

  const refusal = async (p: Promise<unknown>, type: new (...args: never[]) => Error): Promise<string | undefined> => {
    try {
      await p;
    } catch (error) {
      expect(error).toBeInstanceOf(type);
      return ((error as ConflictException).getResponse() as { code?: string }).code;
    }
    throw new Error('expected a refusal');
  };
  const person = async (label: string): Promise<string> => {
    const { userId } = await accounts.createUser({ email: `it-${label}-${tag}@people.test`, name: `Person ${label}`, reason }, asSuper());
    return userId;
  };

  beforeAll(async () => {
    pool = new Pool({ connectionString: url, max: 4 });
    db = drizzle(pool, { schema }) as unknown as Database;
    const notifier = { appUrl: 'http://localhost:3002', send: async () => true } as unknown as GuestNotifier;
    roles = new StaffRolesService(db);
    accounts = new AdminAccountsService(db, notifier, roles);
    access = new AccountAccessService(db, accounts, new RecordAccessService(db));
    workspaces = new WorkspaceService(db);
    directory = new AdminUsersService(new AdminUsersRepository(db), new RecordAccessService(db));
    gate = new AccountGate(db);
    const [admin] = await db.insert(schema.users).values({ email: `it-admin-${tag}@people.test`, name: 'Admin' }).returning();
    adminId = admin!.id;
  });

  afterAll(async () => {
    const mine = `it-%-${tag}@people.test`;
    await pool?.query(`update admin_users set revoked_at = now() where revoked_at is null and user_id in (select id from users where email like $1)`, [mine]);
    await pool?.query(`update user_staff_custom_roles set revoked_at = now() where revoked_at is null and user_id in (select id from users where email like $1)`, [mine]);
    await pool?.query(`update user_suspensions set lifted_at = now(), lift_reason = 'test cleanup' where lifted_at is null and user_id in (select id from users where email like $1)`, [mine]);
    await pool?.end();
  });

  it('makes a custom role, gives it, and the holder resolves exactly its permissions', async () => {
    const made = await roles.create(
      { name: `Support desk ${tag}`, description: 'Answers people', permissions: ['admin.user.view', 'admin.audit.read'], reason },
      asSuper(),
    );
    expect(made.role.permissions).toEqual(['admin.user.view', 'admin.audit.read']);
    expect(made.role.key).toMatch(/^support_desk_/);

    const userId = await person('holder');
    expect((await workspaces.staffAccessForUser(userId)).isStaff).toBe(false);
    await roles.assign(userId, made.role.id, reason, asSuper());
    const resolved = await workspaces.staffAccessForUser(userId);
    expect(resolved).toMatchObject({ isStaff: true, roles: [], permissions: ['admin.user.view', 'admin.audit.read'] });
    expect(resolved.customRoles).toEqual([{ id: made.role.id, name: made.role.name }]);
    expect(await refusal(roles.assign(userId, made.role.id, reason, asSuper()), ConflictException)).toBe('already_held');

    // Adding a permission to a held role reaches the holder at once.
    await roles.update(made.role.id, { name: made.role.name, description: 'Answers people', permissions: ['admin.user.view', 'admin.audit.read', 'admin.broker.view'], reason }, asSuper());
    expect((await workspaces.staffAccessForUser(userId)).permissions).toContain('admin.broker.view');

    // Held roles are not archived; once taken away, the person is no longer staff and the role archives.
    expect(await refusal(roles.archive(made.role.id, reason, adminId), ConflictException)).toBe('role_held');
    await roles.revoke(userId, made.role.id, reason, adminId);
    expect((await workspaces.staffAccessForUser(userId)).isStaff).toBe(false);
    const archived = await roles.archive(made.role.id, reason, adminId);
    expect(archived.role.archivedAt).not.toBeNull();
    expect(await refusal(roles.assign(userId, made.role.id, reason, asSuper()), ConflictException)).toBe('role_archived');
  });

  it('refuses reserved permissions, built-in names, duplicates, and powers the actor lacks', async () => {
    expect(
      await refusal(roles.create({ name: `Grant ${tag}`, description: '', permissions: ['admin.user.role.grant'], reason }, asSuper()), UnprocessableEntityException),
    ).toBe('reserved_permission');
    expect(await refusal(roles.create({ name: 'Ops', description: '', permissions: ['admin.user.view'], reason }, asSuper()), ConflictException)).toBe('built_in_name');
    expect(
      await refusal(roles.create({ name: 'Super admin', description: '', permissions: ['admin.user.view'], reason }, asSuper()), ConflictException),
    ).toBe('built_in_name');
    await roles.create({ name: `Readers ${tag}`, description: '', permissions: ['admin.overview.view'], reason }, asSuper());
    expect(
      await refusal(roles.create({ name: `readers ${tag}`, description: '', permissions: ['admin.overview.view'], reason }, asSuper()), ConflictException),
    ).toBe('name_taken');
    // An ops staffer (were the route open to them) cannot bundle money powers.
    const wanted: StaffPermission[] = ['admin.user.view', 'admin.fee.edit'];
    expect(await refusal(roles.create({ name: `Money ${tag}`, description: '', permissions: wanted, reason }, { userId: adminId, access: opsAccess }), ForbiddenException)).toBe(
      'beyond_own',
    );
    // ...nor give a built-in role carrying them.
    const target = await person('beyond');
    expect(await refusal(accounts.setStaffRoles(target, { roles: ['finance'], reason }, { userId: adminId, access: opsAccess }), ForbiddenException)).toBe('beyond_own');
  });

  it('creates an account with a staff role in one step, and a phone for display only', async () => {
    const email = `it-created-${tag}@people.test`;
    const made = await accounts.createUser({ email, name: 'Created Person', phone: '+250788123456', grant: { kind: 'staff_role', role: 'compliance' }, reason }, asSuper());
    expect(made).toMatchObject({ created: true, granted: true });
    expect((await workspaces.staffAccessForUser(made.userId)).roles).toEqual(['compliance']);
    const [profile] = await db.select().from(schema.userProfiles).where(eq(schema.userProfiles.userId, made.userId));
    expect(profile?.phoneE164).toBe('+250788123456');
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, made.userId));
    expect(user?.phoneNumber).toBeNull();
    // The same address again is answered as it is, and nothing is granted.
    const again = await accounts.createUser({ email, name: 'Created Person', grant: { kind: 'staff_role', role: 'ops' }, reason }, asSuper());
    expect(again).toMatchObject({ created: false, granted: false });
    expect((await workspaces.staffAccessForUser(made.userId)).roles).toEqual(['compliance']);
  });

  it('suspends: sessions end, sign in is refused, staff are left to a super admin, and it lifts', async () => {
    const userId = await person('suspend');
    await db.insert(schema.sessions).values({ userId, token: `t-${randomUUID()}`, expiresAt: new Date(Date.now() + 3600_000) });
    const suspended = await access.suspend(userId, reason, { userId: adminId, access: opsAccess });
    expect(suspended).toMatchObject({ status: 'suspended', endedSessions: 1 });
    expect(await gate.maySignIn(userId)).toBe(false);
    expect(await refusal(access.suspend(userId, reason, asSuper()), ConflictException)).toBe('already_suspended');
    expect(await refusal(access.suspend(adminId, reason, asSuper()), ConflictException)).toBe('self_suspend');
    expect(await refusal(access.resendInvitation(userId, reason, adminId), ConflictException)).toBe('suspended');

    const [row] = await directory.listUsers({ q: `it-suspend-${tag}`, status: 'suspended' }, adminId, reason).then((r) => r.items);
    expect(row?.status).toBe('suspended');

    const lifted = await access.reactivate(userId, reason, { userId: adminId, access: opsAccess });
    expect(lifted.status).toBe('invited');
    expect(await gate.maySignIn(userId)).toBe(true);

    // A staff member: ops may not, a super admin may.
    const staffer = await person('staffer');
    await accounts.setStaffRoles(staffer, { roles: ['finance'], reason }, asSuper());
    expect(await refusal(access.suspend(staffer, reason, { userId: adminId, access: opsAccess }), ForbiddenException)).toBe('staff_target');
    await access.suspend(staffer, reason, asSuper());
    await access.reactivate(staffer, reason, asSuper());
  });

  it('records sign ins, lists devices, ends one, and shows the trail', async () => {
    const userId = await person('signin');
    const [session] = await db
      .insert(schema.sessions)
      .values({ userId, token: `t-${randomUUID()}`, expiresAt: new Date(Date.now() + 3600_000), ipAddress: '10.0.0.1', userAgent: 'Test' })
      .returning();
    await gate.onSignIn({ userId, sessionId: session!.id, path: '/sign-in/email-otp', ipAddress: '10.0.0.1', userAgent: 'Test' });
    const seen = await access.signIns(userId, adminId, reason);
    expect(seen.signIns[0]).toMatchObject({ method: 'Email code', ipAddress: '10.0.0.1' });
    expect(seen.devices.map((d) => d.sessionId)).toEqual([session!.id]);
    await access.endSession(userId, session!.id, reason, adminId);
    expect((await access.signIns(userId, adminId, reason)).devices).toEqual([]);

    const trail = await access.activity(userId);
    expect(trail.items.map((i) => i.eventType)).toEqual(expect.arrayContaining(['admin.user.created', 'admin.user.session_ended']));
    expect(trail.items.every((i) => i.direction === 'about')).toBe(true);

    const [listed] = (await directory.listUsers({ q: `it-signin-${tag}` }, adminId, reason)).items;
    expect(listed?.lastSignInAt).not.toBeNull();
  });

  it('filters the directory by kind and role, and sorts', async () => {
    const made = await roles.create({ name: `Filter ${tag}`, description: '', permissions: ['admin.overview.view'], reason }, asSuper());
    const holder = await person('filter');
    await roles.assign(holder, made.role.id, reason, asSuper());
    const byRole = await directory.listUsers({ role: made.role.id }, adminId, reason);
    expect(byRole.items.map((i) => i.id)).toEqual([holder]);
    expect(byRole.items[0]?.customRoles).toEqual([{ id: made.role.id, name: made.role.name }]);
    const staff = await directory.listUsers({ q: `-${tag}@people.test`, kind: 'staff', pageSize: 100 }, adminId, reason);
    expect(staff.items.map((i) => i.id)).toContain(holder);
    const guests = await directory.listUsers({ q: `-${tag}@people.test`, kind: 'guest', pageSize: 100 }, adminId, reason);
    expect(guests.items.map((i) => i.id)).not.toContain(holder);
    expect((await directory.listUsers({ role: 'not-a-role' }, adminId, reason)).items).toEqual([]);
    const sorted = await directory.listUsers({ q: `-${tag}@people.test`, sort: 'email', dir: 'asc', pageSize: 100 }, adminId, reason);
    const emails = sorted.items.map((i) => i.email);
    expect(emails).toEqual([...emails].sort());

    // Every write above left one audit row naming the role.
    const rows = await db
      .select({ eventType: schema.auditEvents.eventType, reason: schema.auditEvents.reason })
      .from(schema.auditEvents)
      .where(and(eq(schema.auditEvents.subjectType, 'staff_role'), eq(schema.auditEvents.subjectId, made.role.id)));
    expect(rows).toEqual([{ eventType: 'admin.staff_role.created', reason }]);
    const live = await db
      .select()
      .from(schema.userStaffCustomRoles)
      .where(and(eq(schema.userStaffCustomRoles.userId, holder), isNull(schema.userStaffCustomRoles.revokedAt)));
    expect(live).toHaveLength(1);
  });
});
