import { randomUUID } from 'node:crypto';

import { type OversightGrant, type TenantGuestRequest, addDays, addMonths, kigaliToday, normaliseGuestPhone } from '@injishi/contracts';
import { NotFoundException } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import { LocalLeadersRepository } from '../../api/admin/users/local-leaders.repository';
import { LocalLeadersService } from '../../api/admin/users/local-leaders.service';
import { OversightGrantsService } from '../../api/admin/users/oversight-grants.service';
import * as schema from '../../database/drizzle/schema';
import type { ScopedWorkspace } from '../../shared/auth/branch-scope';
import type { Database } from '../../shared/database/database.module';
import { GuestHousekeepingService } from './application/guest-housekeeping.service';
import { GuestRegistryService } from './application/guest-registry.service';
import { GuestReportsService } from './application/guest-reports.service';
import { GuestRoutingService } from './application/guest-routing.service';
import { LeaderConsoleService } from './application/leader-console.service';
import type { GuestMail } from './domain/guest-mail';
import type { GuestNotifier } from './infrastructure/guest-notifier';
import { GuestRegistryRepository } from './infrastructure/guest-registry.repository';

/**
 * Guests and local leaders against a real Postgres (P5): the SQL the doubles
 * cannot judge. Routing at filing (Rwandan vs abroad, waiting steps), every
 * leader's scope as SQL (404 outside, immigration abroad only), seen and flag,
 * the hand-over when a leader is appointed and when a building's village is
 * set, ending an appointment, the reports, and the 12 month purge.
 *
 * OPT IN: set `GUESTS_IT_DATABASE_URL` to a THROWAWAY database, migrated and
 * holding the reference data (geography, countries, relationships). The spec
 * writes its own people, business, homes, leases and leader posts there and
 * does not clean up; drop the database afterwards. Skipped otherwise.
 *
 *   createdb injishi_guests_it && DATABASE_URL=… node scripts/migrate.mjs && node scripts/seed-reference.mjs
 *   GUESTS_IT_DATABASE_URL=postgres://injishi:injishi@127.0.0.1:5434/injishi_guests_it \
 *     npx jest src/modules/guests/guests.integration.spec.ts
 *   dropdb injishi_guests_it
 */
const url = process.env.GUESTS_IT_DATABASE_URL;
const maybe = url ? describe : describe.skip;

maybe('guests and local leaders against Postgres (GUESTS_IT_DATABASE_URL)', () => {
  jest.setTimeout(60_000);

  let pool: Pool;
  let db: Database;
  const mails: { to: string; mail: GuestMail; what: string }[] = [];
  const today = kigaliToday();
  const tag = randomUUID().slice(0, 8);

  // The map: one district, one sector, one cell with two villages; a second sector elsewhere.
  let place: { provinceId: number; districtId: number; sectorId: number; cellId: number; villageA: number; villageB: number; otherSector: number };
  const ids = {} as Record<
    'admin' | 'landlord' | 'tenantUser' | 'leaderA' | 'leaderB' | 'dasso' | 'officer' | 'immigration' | 'org' | 'workspace' | 'propertyPlaced' | 'propertyUnplaced' | 'unit' | 'tenant' | 'lease',
    string
  >;

  const notifier = {
    appUrl: 'http://localhost:3002',
    send: async (to: string, mail: GuestMail, what: string) => {
      mails.push({ to, mail, what });
      return true;
    },
  } as unknown as GuestNotifier;

  interface Services {
    repo: GuestRegistryRepository;
    routing: GuestRoutingService;
    registry: GuestRegistryService;
    console: LeaderConsoleService;
    reports: GuestReportsService;
    housekeeping: GuestHousekeepingService;
    leaders: LocalLeadersService;
  }

  const services = (): Services => {
    const repo = new GuestRegistryRepository(db);
    const routing = new GuestRoutingService(repo, notifier);
    const console = new LeaderConsoleService(repo);
    return {
      repo,
      routing,
      registry: new GuestRegistryService(repo, routing),
      console,
      reports: new GuestReportsService(repo, console),
      housekeeping: new GuestHousekeepingService(repo),
      leaders: new LocalLeadersService(db, new LocalLeadersRepository(db), new OversightGrantsService(db), routing, notifier),
    };
  };

  /** A person's live posts, as `OversightGuard` hands them over. */
  async function grantsOf(userId: string): Promise<OversightGrant[]> {
    const { rows } = await pool.query(
      `select id as "assignmentId", oversight_role::text as "oversightRole", government_body_code as "governmentBodyCode",
              government_title as "governmentTitle", scope_level::text as "scopeLevel", province_id as "provinceId",
              district_id as "districtId", sector_id as "sectorId", cell_id as "cellId", village_id as "villageId"
         from oversight_assignments where user_id = $1 and revoked_at is null`,
      [userId],
    );
    return rows as OversightGrant[];
  }

  /** The leaders' mails go after commit, on their own: wait for them. */
  async function settle(): Promise<void> {
    await new Promise((r) => setTimeout(r, 150));
  }

  async function user(label: string, name: string): Promise<string> {
    const [row] = await db.insert(schema.users).values({ email: `${label}-${tag}@guests.test`, name }).returning({ id: schema.users.id });
    return row!.id;
  }

  async function post(userId: string, role: string, level: string, area: { districtId?: number; sectorId?: number; cellId?: number; villageId?: number }): Promise<string> {
    const { rows } = await pool.query(
      `insert into oversight_assignments (user_id, oversight_role, government_body_code, government_title, scope_level, province_id, district_id, sector_id, cell_id, village_id)
       values ($1, $2, $3, 'Test post', $4, $5, $6, $7, $8, $9) returning id`,
      [userId, role, role === 'district_immigration' ? 'DGIE' : 'MINALOC', level, level === 'district' ? place.provinceId : null, area.districtId ?? null, area.sectorId ?? null, area.cellId ?? null, area.villageId ?? null],
    );
    return rows[0].id as string;
  }

  const guest = (over: Partial<TenantGuestRequest> = {}): TenantGuestRequest => ({
    fullName: 'Grace Mutoni',
    phone: normaliseGuestPhone('+254 712 345 678') as string,
    nationality: 'KE',
    relationship: 'friend',
    origin: { kind: 'country', countryCode: 'KE' },
    arrivalOn: addDays(today, 2),
    departureOn: addDays(today, 6),
    ...over,
  });

  const ws = (): ScopedWorkspace =>
    ({
      workspaceId: ids.workspace,
      kind: 'business',
      orgId: ids.org,
      domain: 'residence',
      orgRole: 'owner',
      registrationStatus: 'active',
      permissions: ['guest.register'],
      branchScope: { coverage: 'all', selectedPropertyId: null, propertyIds: [], includesUnbranched: true },
    }) as unknown as ScopedWorkspace;

  beforeAll(async () => {
    pool = new Pool({ connectionString: url, max: 4 });
    db = drizzle(pool, { schema }) as unknown as Database;
    const { rows: map } = await pool.query(`
      select d.province_id as "provinceId", d.id as "districtId", s.id as "sectorId", c.id as "cellId",
             (array_agg(v.id order by v.id))[1] as "villageA", (array_agg(v.id order by v.id))[2] as "villageB",
             (select s2.id from sectors s2 where s2.district_id <> d.id order by s2.id limit 1) as "otherSector"
        from cells c join sectors s on s.id = c.sector_id join districts d on d.id = s.district_id join villages v on v.cell_id = c.id
       group by d.province_id, d.id, s.id, c.id having count(v.id) >= 2 order by c.id limit 1`);
    place = map[0];
    expect(place?.villageB).toBeTruthy();

    ids.admin = await user('admin', 'Staff Admin');
    ids.landlord = await user('landlord', 'Jean Mugabo');
    ids.tenantUser = await user('tenant', 'Aline Uwera');
    ids.leaderA = await user('mudugudu-a', 'Village Leader A');
    ids.leaderB = await user('mudugudu-b', 'Village Leader B');
    ids.dasso = await user('dasso', 'Sector Dasso');
    ids.officer = await user('officer', 'District Officer');
    ids.immigration = await user('dgie', 'Immigration Officer');

    const [org] = await db
      .insert(schema.orgs)
      .values({
        legalName: `Guest Court ${tag}`,
        domain: 'residence',
        businessKind: 'residence',
        residenceClass: 'residential_landlord',
        upi: `1/02/03/04/${Math.floor(1000 + Math.random() * 8999)}`,
        registrationStatus: 'active',
        districtId: place.districtId,
        sectorId: place.sectorId,
      })
      .returning();
    ids.org = org!.id;
    const [workspace] = await db.insert(schema.workspaces).values({ kind: 'business', orgId: ids.org }).returning();
    ids.workspace = workspace!.id;
    const [placed] = await db
      .insert(schema.properties)
      .values({ orgId: ids.org, workspaceId: ids.workspace, name: 'Placed Court', addressText: 'KG 7 Ave', sectorId: place.sectorId, districtId: place.districtId, villageId: place.villageA })
      .returning();
    ids.propertyPlaced = placed!.id;
    const [unplaced] = await db
      .insert(schema.properties)
      .values({ orgId: ids.org, workspaceId: ids.workspace, name: 'Unplaced House', sectorId: place.sectorId, districtId: place.districtId })
      .returning();
    ids.propertyUnplaced = unplaced!.id;
    const [unit] = await db.insert(schema.rentalUnits).values({ workspaceId: ids.workspace, propertyId: ids.propertyPlaced, label: 'A-01' }).returning();
    ids.unit = unit!.id;
    const [tenant] = await db
      .insert(schema.tenants)
      .values({ workspaceId: ids.workspace, orgId: ids.org, userId: ids.tenantUser, fullName: 'Aline Uwera', phone: '+250788123456' })
      .returning();
    ids.tenant = tenant!.id;
    const { rows: lease } = await pool.query(
      `insert into leases (org_id, workspace_id, reference, property_id, unit_id, tenant_id, status, start_date, end_date, billing_starts_on,
                           monthly_rent_rwf, deposit_rwf, rent_due_day, signed_at, activated_at)
       values ($1, $2, 'L-0001', $3, $4, $5, 'active', $6::date, $7::date, $6::date, 300000, 0, 1, now(), now()) returning id`,
      [ids.org, ids.workspace, ids.propertyPlaced, ids.unit, ids.tenant, addDays(today, -30), addDays(today, 200)],
    );
    ids.lease = lease[0].id;

    // Leader posts as fixtures, in this throwaway database only. No cell executive yet.
    await post(ids.leaderA, 'village_leader', 'village', { districtId: place.districtId, sectorId: place.sectorId, cellId: place.cellId, villageId: place.villageA });
    await post(ids.leaderB, 'village_leader', 'village', { districtId: place.districtId, sectorId: place.sectorId, cellId: place.cellId, villageId: place.villageB });
    await post(ids.dasso, 'dasso', 'sector', { districtId: place.districtId, sectorId: place.sectorId });
    await post(ids.officer, 'district_officer', 'district', { districtId: place.districtId });
    await post(ids.immigration, 'district_immigration', 'district', { districtId: place.districtId });
  });

  afterAll(async () => {
    await pool?.end();
  });

  let kenyan: string;
  let rwandan: string;

  it('routes at filing: a guest from abroad to immigration, a Rwandan to the district officer, the empty post waits', async () => {
    const s = services();
    mails.length = 0;
    const k = await s.registry.tenantRegister(ids.tenantUser, ids.lease, guest());
    kenyan = k.id;
    expect(k.chain.map((c) => [c.role, c.state])).toEqual([
      ['village_leader', 'delivered'],
      ['dasso', 'delivered'],
      ['cell_executive', 'waiting'],
      ['district_immigration', 'delivered'],
    ]);
    const r = await s.registry.tenantRegister(ids.tenantUser, ids.lease, guest({
      fullName: 'Eric Habimana',
      phone: '+250788765432',
      nationality: 'RW',
      idKind: 'national_id',
      idNumber: '1199080012345012',
      origin: { kind: 'village', villageId: place.villageB },
      arrivalOn: today,
      departureOn: addDays(today, 3),
    }));
    rwandan = r.id;
    expect(r.chain.map((c) => c.role)).toEqual(['village_leader', 'dasso', 'cell_executive', 'district_officer']);
    expect(r.idNumber).toBe('1199080012345012');
    await settle();
    // One mail per registration per leader holding a delivered post.
    expect(mails.map((m) => m.to.split('-')[0]).sort()).toEqual(['dasso', 'dasso', 'dgie', 'mudugudu', 'mudugudu', 'officer']);
    const { rows } = await pool.query(`select count(*)::int as n from audit_events where subject_type = 'guest_registration' and subject_id = any($1)`, [[kenyan, rwandan]]);
    expect(rows[0].n).toBe(2);
  });

  it('refuses dates outside the lease in the field words', async () => {
    const s = services();
    const e = await s.registry.tenantRegister(ids.tenantUser, ids.lease, guest({ arrivalOn: addDays(today, 199), departureOn: addDays(today, 205) })).catch((x: unknown) => x);
    expect((e as { getResponse(): unknown }).getResponse()).toMatchObject({ issues: [{ path: ['departureOn'], message: 'Pick a departure inside the lease.' }] });
  });

  it('scopes every leader: their area and role only, 404 outside', async () => {
    const s = services();
    const listed = async (userId: string, tab: 'arriving' | 'staying'): Promise<string[]> =>
      (await s.console.page(userId, await grantsOf(userId), { tab, when: 'soon', page: 1 })).guests.map((g) => g.id);
    expect(await listed(ids.leaderA, 'arriving')).toEqual([kenyan]);
    expect(await listed(ids.leaderA, 'staying')).toEqual([rwandan]);
    expect(await listed(ids.dasso, 'arriving')).toEqual([kenyan]);
    expect(await listed(ids.immigration, 'arriving')).toEqual([kenyan]);
    expect(await listed(ids.immigration, 'staying')).toEqual([]);
    expect(await listed(ids.officer, 'staying')).toEqual([rwandan]);
    expect(await listed(ids.officer, 'arriving')).toEqual([]);
    expect(await listed(ids.leaderB, 'arriving')).toEqual([]);
    await expect(s.console.one(await grantsOf(ids.leaderB), kenyan)).rejects.toBeInstanceOf(NotFoundException);
    await expect(s.console.one(await grantsOf(ids.officer), kenyan)).rejects.toBeInstanceOf(NotFoundException);
    await expect(s.console.one(await grantsOf(ids.immigration), rwandan)).rejects.toBeInstanceOf(NotFoundException);
    const one = await s.console.one(await grantsOf(ids.leaderA), kenyan);
    expect(one).toMatchObject({ host: { kind: 'tenant', name: 'Aline Uwera' }, home: { unitLabel: 'A-01' }, fromAbroad: true });
    expect(one.home.address).toContain('KG 7 Ave');
  });

  it('opening marks seen, a flag shows to the whole chain, the counts follow', async () => {
    const s = services();
    const before = await s.console.summary(ids.leaderA, await grantsOf(ids.leaderA));
    expect(before.counts).toMatchObject({ arriving: 1, staying: 1, unseen: 2 });
    const opened = await s.console.seen(ids.leaderA, await grantsOf(ids.leaderA), kenyan);
    expect(opened.seenByMe).toBe(true);
    expect(opened.chain.find((c) => c.role === 'village_leader')).toMatchObject({ state: 'seen', seenBy: 'Village Leader A' });
    const flagged = await s.console.flag(ids.dasso, await grantsOf(ids.dasso), kenyan, { note: 'Same guest as last month, longer stay' });
    expect(flagged.flagged).toBe(true);
    const villageFlagged = await s.console.page(ids.leaderA, await grantsOf(ids.leaderA), { tab: 'flagged', when: 'soon', page: 1 });
    expect(villageFlagged.guests.map((g) => g.id)).toEqual([kenyan]);
    expect(villageFlagged.counts).toMatchObject({ flagged: 1, unseen: 1 });
    const csv = await s.console.csv(ids.leaderA, await grantsOf(ids.leaderA), { tab: 'flagged', when: 'soon', page: 1 });
    expect(csv.split('\r\n')[1]).toContain('Grace Mutoni');
    expect(csv).toContain('Sector DASSO: Same guest as last month');
  });

  it('a tenant’s guest never reaches the landlord, who sees only their own', async () => {
    const s = services();
    const list = await s.registry.landlordList(ws(), {});
    expect(list.guests).toEqual([]);
    await expect(s.registry.landlordCancel(ws(), ids.landlord, kenyan)).rejects.toBeInstanceOf(NotFoundException);
    expect(list.buildings.map((b) => [b.name, b.located])).toEqual([
      ['Placed Court', true],
      ['Unplaced House', false],
    ]);
  });

  it('appointing a cell executive by email hands over what waited, with one summary mail', async () => {
    const s = services();
    mails.length = 0;
    const email = `cell-${tag}@guests.test`;
    const appointed = await s.leaders.appoint(ids.admin, {
      email,
      name: 'Cell Executive',
      role: 'cell_executive',
      governmentBodyCode: 'MINALOC',
      governmentTitle: 'Executive secretary',
      scopeLevel: 'cell',
      cellId: place.cellId,
      reason: 'Took office this month',
    });
    expect(appointed).toMatchObject({ role: 'cell_executive', kind: 'leader', email, cellId: place.cellId, sectorId: place.sectorId, districtId: place.districtId });
    await settle();
    expect(mails.map((m) => m.what).sort()).toEqual(['appointment', 'hand-over']);
    expect(mails.find((m) => m.what === 'hand-over')?.mail.subject).toMatch(/^2 guests waiting for you in /);
    const { rows } = await pool.query(
      `select count(*)::int as n from guest_registration_routes where assignment_id = $1`,
      [appointed.id],
    );
    expect(rows[0].n).toBe(2);
    const dup = await s.leaders.appoint(ids.admin, { email, role: 'cell_executive', governmentBodyCode: 'MINALOC', governmentTitle: 'Executive secretary', scopeLevel: 'cell', cellId: place.cellId, reason: 'Again' }).catch((x: unknown) => x);
    expect((dup as Error).message).toBe('They already hold this post.');
    const audit = await pool.query(`select reason from audit_events where event_type = 'admin.user.oversight_granted' and payload_diff->'oversight'->>'assignmentId' = $1`, [appointed.id]);
    expect(audit.rows[0]?.reason).toBe('Took office this month');
  });

  it('appoints a business reviewer by email at a province, and refuses one at a village', async () => {
    const s = services();
    const reviewer = await s.leaders.appoint(ids.admin, {
      email: `approver-${tag}@guests.test`,
      role: 'business_approver',
      governmentBodyCode: 'MINALOC',
      governmentTitle: 'Business approver',
      scopeLevel: 'province',
      provinceId: place.provinceId,
      reason: 'Covers the province',
    });
    expect(reviewer).toMatchObject({ kind: 'reviewer', scopeLevel: 'province', provinceId: place.provinceId, districtId: null });
    const list = await s.leaders.list({ kind: 'reviewer' });
    expect(list.appointments.map((a) => a.id)).toContain(reviewer.id);
    await expect(
      s.leaders.appoint(ids.admin, { email: `x-${tag}@guests.test`, role: 'business_approver', governmentBodyCode: 'MINALOC', governmentTitle: 'x', scopeLevel: 'village', villageId: place.villageA, reason: 'wrong' }),
    ).rejects.toThrow();
  });

  it('a landlord’s guest at a building with no village waits, and is delivered once the village is set', async () => {
    const s = services();
    const own = await s.registry.landlordRegister(ws(), ids.landlord, {
      ...guest({ fullName: 'Landlord Friend', nationality: 'RW', origin: { kind: 'country', countryCode: 'UG' } }),
      propertyId: ids.propertyUnplaced,
    });
    expect(own.chain.map((c) => [c.role, c.state])).toEqual([
      ['village_leader', 'waiting'],
      ['dasso', 'delivered'],
      ['cell_executive', 'waiting'],
      ['district_officer', 'delivered'],
    ]);
    const before = await s.leaders.list({ kind: 'leader' });
    expect(before.waiting.some((w) => w.role === 'village_leader' && !w.located)).toBe(true);
    await pool.query(`update properties set village_id = $1 where id = $2`, [place.villageA, ids.propertyUnplaced]);
    mails.length = 0;
    const swept = await s.routing.sweep(ids.propertyUnplaced);
    expect(swept).toEqual({ relocated: 1, delivered: 2 });
    await settle();
    const after = (await s.registry.landlordList(ws(), {})).guests.find((g) => g.id === own.id);
    expect(after?.chain.every((c) => c.state === 'delivered')).toBe(true);
    expect(mails.map((m) => m.to.split('-')[0]).sort()).toEqual(['cell', 'mudugudu']);
  });

  it('reports the leader’s area for a period, as JSON, CSV and a one-page PDF', async () => {
    const s = services();
    const q = { from: addDays(today, -1), to: addDays(today, 10) };
    const village = await s.reports.report(ids.leaderA, await grantsOf(ids.leaderA), q);
    expect(village.totals).toMatchObject({ registered: 3, stayingNow: 1, fromAbroad: 1, flagged: 1 });
    expect(village.byNationality.map((n) => [n.code, n.count])).toEqual([
      ['RW', 2],
      ['KE', 1],
    ]);
    expect(village.topHomes[0]).toMatchObject({ guests: 2, unitLabel: 'A-01' });
    expect(JSON.stringify(village.topHomes)).not.toContain('Aline');
    const immigration = await s.reports.report(ids.immigration, await grantsOf(ids.immigration), q);
    expect(immigration.totals).toMatchObject({ registered: 1, fromAbroad: 1 });
    expect(immigration.areaLevel).toBe('sector');
    const csv = await s.reports.csv(ids.officer, await grantsOf(ids.officer), q);
    expect(csv).toContain('Registered,2');
    const pdf = await s.reports.pdf(ids.dasso, await grantsOf(ids.dasso), q);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('ending an appointment sends its current guests back to waiting, and keeps the row', async () => {
    const s = services();
    const [postA] = await grantsOf(ids.leaderA);
    await s.leaders.end(ids.admin, postA!.assignmentId, 'Moved to another village');
    const { rows } = await pool.query(`select revoked_at is not null as ended from oversight_assignments where id = $1`, [postA!.assignmentId]);
    expect(rows[0].ended).toBe(true);
    const k = await s.console.one(await grantsOf(ids.dasso), kenyan);
    expect(k.chain.find((c) => c.role === 'village_leader')?.state).toBe('seen');
    const waiting = await pool.query(
      `select count(*)::int as n from guest_registration_routes r join guest_registrations g on g.id = r.registration_id
        where r.recipient_role = 'village_leader' and r.assignment_id is null and g.village_id = $1`,
      [place.villageA],
    );
    expect(waiting.rows[0].n).toBe(3);
    const coverage = await s.leaders.coverage();
    expect(coverage.uncovered.some((u) => u.role === 'village_leader' && u.villageId === place.villageA && u.waitingReports === 3)).toBe(true);
    const csv = await s.leaders.coverageCsv();
    expect(csv).toContain('Guests waiting for a leader');
  });

  it('purges guests 12 months after they left, keeping counts the old reports still add', async () => {
    const s = services();
    const arrival = addMonths(today, -14);
    const { rows } = await pool.query(
      `insert into guest_registrations (org_id, workspace_id, host_kind, property_id, registered_by_user_id, village_id, cell_id, sector_id, district_id,
                                        full_name, phone, nationality, relationship, origin_country, arrival_on, departure_on)
       values ($1, $2, 'landlord', $3, $4, $5, $6, $7, $8, 'Old Guest', '+254712000000', 'KE', 'friend', 'KE', $9::date, $9::date + 3)
       returning id`,
      [ids.org, ids.workspace, ids.propertyPlaced, ids.landlord, place.villageA, place.cellId, place.sectorId, place.districtId, arrival],
    );
    const old = rows[0].id as string;
    await pool.query(
      `insert into guest_registration_routes (registration_id, step, recipient_role, district_id, flagged_at, flagged_by_user_id, flag_note)
       values ($1, 4, 'district_immigration', $2, now(), $3, 'Old flag')`,
      [old, place.districtId, ids.immigration],
    );
    const result = await s.housekeeping.purge();
    expect(result.purged).toBeGreaterThanOrEqual(1);
    const gone = await pool.query(`select count(*)::int as n from guest_registrations where id = $1`, [old]);
    expect(gone.rows[0].n).toBe(0);
    const report = await s.reports.report(ids.immigration, await grantsOf(ids.immigration), { from: addDays(arrival, -10), to: addDays(arrival, 10) });
    expect(report.totals).toMatchObject({ registered: 1, fromAbroad: 1, flagged: 1 });
    expect(report.purged).toMatchObject({ registered: 1 });
    const officer = await s.reports.report(ids.officer, await grantsOf(ids.officer), { from: addDays(arrival, -10), to: addDays(arrival, 10) });
    expect(officer.totals.registered).toBe(0);
    // Running it again purges nothing more.
    expect((await s.housekeeping.purge()).purged).toBe(0);
  });
});
