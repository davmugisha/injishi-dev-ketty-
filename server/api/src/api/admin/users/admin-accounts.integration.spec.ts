import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { randomUUID } from 'node:crypto';

import { ConflictException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import * as schema from '../../../database/drizzle/schema';
import type { GuestNotifier } from '../../../modules/guests/infrastructure/guest-notifier';
import type { Database } from '../../../shared/database/database.module';
import { AdminAccountsService } from './admin-accounts.service';

/**
 * The admin account writes against Postgres (2026-10-29): accounts, staff
 * roles and business members, with the refusals that keep the console and a
 * business from locking themselves out, and one audit row per write.
 *
 *   ACCOUNTS_IT_DATABASE_URL=postgres://… npx vitest run src/api/admin/users/admin-accounts.integration.spec.ts
 *
 * Every row it makes carries a random tag, so it can run on a database that
 * holds other data.
 */
const url = process.env.ACCOUNTS_IT_DATABASE_URL;
const maybe = url ? describe : describe.skip;

maybe('admin accounts against Postgres (ACCOUNTS_IT_DATABASE_URL)', () => {
  let pool: Pool;
  let db: Database;
  let service: AdminAccountsService;
  const sent: { to: string; what: string }[] = [];
  const tag = randomUUID().slice(0, 8);
  let adminId: string;
  let orgId: string;
  let ownerId: string;

  const reason = 'Integration test';
  const conflictCode = async (p: Promise<unknown>) => {
    try {
      await p;
    } catch (error) {
      expect(error).toBeInstanceOf(ConflictException);
      return ((error as ConflictException).getResponse() as { code?: string }).code;
    }
    throw new Error('expected a refusal');
  };
  const membership = async (userId: string) => {
    const [row] = await db
      .select({ orgRole: schema.orgMemberships.orgRole, status: schema.orgMemberships.status })
      .from(schema.orgMemberships)
      .where(and(eq(schema.orgMemberships.orgId, orgId), eq(schema.orgMemberships.userId, userId)));
    return row;
  };

  beforeAll(async () => {
    pool = new Pool({ connectionString: url, max: 4 });
    db = drizzle(pool, { schema }) as unknown as Database;
    const notifier = {
      appUrl: 'http://localhost:3002',
      send: async (to: string, _mail: unknown, what: string) => {
        sent.push({ to, what });
        return true;
      },
    } as unknown as GuestNotifier;
    service = new AdminAccountsService(db, notifier);

    const [admin] = await db.insert(schema.users).values({ email: `it-admin-${tag}@accounts.test`, name: 'Admin' }).returning();
    adminId = admin!.id;
    const [owner] = await db.insert(schema.users).values({ email: `it-owner-${tag}@accounts.test`, name: 'Owner' }).returning();
    ownerId = owner!.id;
    const { rows: place } = await pool.query(
      `select v.id as village, c.sector_id as sector, s.district_id as district
         from villages v join cells c on c.id = v.cell_id join sectors s on s.id = c.sector_id limit 1`,
    );
    const [org] = await db
      .insert(schema.orgs)
      .values({
        legalName: `Accounts Court ${tag}`,
        domain: 'residence',
        businessKind: 'residence',
        residenceClass: 'residential_landlord',
        upi: `1/02/03/04/${Math.floor(1000 + Math.random() * 8999)}`,
        registrationStatus: 'active',
        sectorId: place[0]?.sector,
        districtId: place[0]?.district,
        villageId: place[0]?.village,
        addressText: 'KG 11 Ave',
      })
      .returning();
    orgId = org!.id;
    await db.insert(schema.workspaces).values({ kind: 'business', orgId });
    await db.insert(schema.orgMemberships).values({ orgId, userId: ownerId, orgRole: 'owner' });
  });

  afterAll(async () => {
    // Leave no live staff grant behind on a shared database.
    await pool?.query(
      `update admin_users set revoked_at = now() where revoked_at is null and user_id in (select id from users where email like $1)`,
      [`it-%-${tag}@accounts.test`],
    );
    await pool?.end();
  });

  it('creates an account once, and answers the same account for the same address', async () => {
    const email = `it-new-${tag}@accounts.test`;
    const first = await service.createUser({ email, name: 'Aline Uwase', reason }, adminId);
    expect(first.created).toBe(true);
    const again = await service.createUser({ email: email.toUpperCase().toLowerCase(), name: 'Aline Uwase', reason }, adminId);
    expect(again).toEqual({ userId: first.userId, created: false });
    expect(sent.filter((m) => m.to === email && m.what === 'account created')).toHaveLength(1);
  });

  it('sets staff roles, refuses your own, and keeps the last super admin', async () => {
    const { userId } = await service.createUser({ email: `it-staff-${tag}@accounts.test`, name: 'Staff Person', reason }, adminId);
    const set = await service.setStaffRoles(userId, { roles: ['ops', 'finance'], reason }, adminId);
    expect(set.staffRoles).toEqual(['ops', 'finance']);
    expect(await conflictCode(service.setStaffRoles(adminId, { roles: ['super_admin'], reason }, adminId))).toBe('self_grant');

    // The only super admin keeps the role until there is another one.
    const others = await pool.query(`select count(*)::int as n from admin_users where revoked_at is null and 'super_admin' = any(staff_roles)`);
    if (others.rows[0].n === 0) {
      await service.setStaffRoles(userId, { roles: ['super_admin'], reason }, adminId);
      expect(await conflictCode(service.setStaffRoles(userId, { roles: ['ops'], reason }, adminId))).toBe('last_super_admin');
      // With a second super admin, the first may step down.
      await db.insert(schema.adminUsers).values({ userId: adminId, staffRoles: ['super_admin'] });
    }

    const ended = await service.setStaffRoles(userId, { roles: [], reason }, adminId);
    expect(ended.staffRoles).toEqual([]);
    const [row] = await db.select().from(schema.adminUsers).where(eq(schema.adminUsers.userId, userId));
    expect(row?.revokedAt).not.toBeNull();
  });

  it('adds a member directly, refuses a second add, and makes a new owner by turning the old one into a manager', async () => {
    const email = `it-member-${tag}@accounts.test`;
    const added = await service.addMember(orgId, { email, name: 'Desk Clerk', orgRole: 'receptionist', reason }, adminId);
    expect(added).toMatchObject({ orgRole: 'receptionist', status: 'active', demotedOwnerIds: [] });
    expect(await membership(added.userId)).toEqual({ orgRole: 'receptionist', status: 'active' });
    expect(sent.some((m) => m.to === email && m.what === 'member added')).toBe(true);
    expect(await conflictCode(service.addMember(orgId, { email, orgRole: 'manager', reason }, adminId))).toBe('already_member');

    const promoted = await service.changeMemberRole(orgId, added.userId, { orgRole: 'owner', reason }, adminId);
    expect(promoted.demotedOwnerIds).toEqual([ownerId]);
    expect(await membership(ownerId)).toEqual({ orgRole: 'manager', status: 'active' });
    expect(await membership(added.userId)).toEqual({ orgRole: 'owner', status: 'active' });
  });

  it('never leaves a business without an owner, and removes everyone else', async () => {
    const [current] = await db
      .select({ userId: schema.orgMemberships.userId })
      .from(schema.orgMemberships)
      .where(and(eq(schema.orgMemberships.orgId, orgId), eq(schema.orgMemberships.orgRole, 'owner')));
    const soleOwner = current!.userId;
    expect(await conflictCode(service.removeMember(orgId, soleOwner, reason, adminId))).toBe('only_owner');
    expect(await conflictCode(service.changeMemberRole(orgId, soleOwner, { orgRole: 'manager', reason }, adminId))).toBe('only_owner');

    const removed = await service.removeMember(orgId, ownerId, reason, adminId);
    expect(removed.status).toBe('removed');
    expect(await membership(ownerId)).toEqual({ orgRole: 'manager', status: 'removed' });

    // A removed member is brought back by adding them again.
    const back = await service.addMember(orgId, { email: `it-owner-${tag}@accounts.test`, orgRole: 'finance', reason }, adminId);
    expect(await membership(back.userId)).toEqual({ orgRole: 'finance', status: 'active' });
  });

  it('writes one audit row per change, with the reason', async () => {
    const rows = await db
      .select({ eventType: schema.auditEvents.eventType, reason: schema.auditEvents.reason })
      .from(schema.auditEvents)
      .where(and(eq(schema.auditEvents.subjectId, orgId), eq(schema.auditEvents.actorUserId, adminId)));
    expect(rows.map((r) => r.eventType).sort()).toEqual(
      ['admin.org.member_added', 'admin.org.member_added', 'admin.org.member_removed', 'admin.org.member_role_changed'].sort(),
    );
    expect(rows.every((r) => r.reason === reason)).toBe(true);
  });
});
