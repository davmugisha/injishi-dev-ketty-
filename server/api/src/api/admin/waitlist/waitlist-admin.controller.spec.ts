// The guards' import chain reaches Better Auth, which ships as ESM Jest does not
// transform. Only the guard CLASSES are compared below, so the auth package is
// stood in for the same way `auth.module.spec.ts` does it.
jest.mock('@injishi/auth', () => ({
  DEMO_OTP_CODE: '123456',
  DEMO_COOKIE_PREFIX: 'injishi-demo',
  createAuth: (config: unknown) => ({ config }),
}));

import type { AdminWaitlistRow } from '@injishi/contracts';
import { GUARDS_METADATA } from '@nestjs/common/constants';

import { REQUIRE_STAFF_PERMISSION } from '../../../shared/auth/require-staff-permission.decorator';
import { SessionGuard, type SessionUser } from '../../../shared/auth/session.guard';
import { StaffGuard } from '../../../shared/auth/staff.guard';
import { AdminWaitlistController } from './waitlist-admin.controller';
import type { AdminWaitlistService } from './waitlist-admin.service';

/**
 * The staff routes over the waitlist (ADR-048 AC-17, AC-22).
 *
 * The service is the boundary here: these tests pin what the controller itself
 * owns, which is who may call it, the exact CSV it writes, and the download
 * headers that make the file behave as a file.
 */

const STAFF = { id: '712dbb3c-92fe-462f-abe5-2ed507b8c3fc' } as SessionUser;

const SPEC_COLUMNS =
  'created_at,audience,email,full_name,phone,business_name,district_name,property_type,size_band,marketing_opt_in,invited_at,unsubscribed_at';

function row(overrides: Partial<AdminWaitlistRow> = {}): AdminWaitlistRow {
  return {
    id: '3e99c55b-a014-47b0-8711-1619c28ae1c6',
    audience: 'owner',
    email: 'owner@example.com',
    fullName: 'Grace Mukamana',
    phone: '0788123456',
    businessName: 'Umurage Guest House',
    districtId: 103,
    districtName: 'Kicukiro',
    propertyType: 'guest_house',
    sizeBand: '6_20',
    marketingOptIn: true,
    invitedAt: null,
    unsubscribedAt: null,
    createdAt: '2026-09-12T18:35:26.366Z',
    ...overrides,
  };
}

interface Exported {
  headers: Record<string, string>;
  body: string;
  lines: string[];
}

interface Harness {
  controller: AdminWaitlistController;
  service: { list: jest.Mock; export: jest.Mock; invite: jest.Mock };
  exportCsv: (query?: Record<string, unknown>) => Promise<Exported>;
}

function harness(rows: AdminWaitlistRow[]): Harness {
  const service = {
    list: jest.fn(async () => ({ total: rows.length, rows })),
    export: jest.fn(async () => rows),
    invite: jest.fn(async () => ({ invitedAt: '2026-09-12T18:43:32.583Z' })),
  };
  const headers: Record<string, string> = {};
  let body = '';
  interface FakeReply {
    header(key: string, value: string): FakeReply;
    send(payload: string): FakeReply;
  }
  const reply: FakeReply = {
    header(key, value) {
      headers[key.toLowerCase()] = value;
      return reply;
    },
    send(payload) {
      body = payload;
      return reply;
    },
  };
  const controller = new AdminWaitlistController(service as unknown as AdminWaitlistService);
  const exportCsv = async (query: Record<string, unknown> = {}): Promise<Exported> => {
    await controller.export(query as Parameters<AdminWaitlistController['export']>[0], STAFF, reply);
    return { headers, body, lines: body.split('\r\n') };
  };
  return { controller, service, exportCsv };
}

describe('AdminWaitlistController · who may call it', () => {
  it('runs SessionGuard before StaffGuard on every route (covers: AC-17)', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, AdminWaitlistController);

    expect(guards).toEqual([SessionGuard, StaffGuard]);
  });

  it('declares a staff permission, so the guard has something to refuse on (covers: AC-17)', () => {
    expect(Reflect.getMetadata(REQUIRE_STAFF_PERMISSION, AdminWaitlistController)).toBe(
      'admin.overview.view',
    );
  });

  it('adds no route level guard that could loosen the controller guards', () => {
    for (const method of ['list', 'export', 'invite'] as const) {
      const handler = AdminWaitlistController.prototype[method];
      expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toBeUndefined();
    }
  });
});

describe('AdminWaitlistController · the CSV export', () => {
  it('names the download injishi-waitlist.csv (covers: AC-17)', async () => {
    const { headers } = await harness([row()]).exportCsv();

    expect(headers['content-disposition']).toBe('attachment; filename="injishi-waitlist.csv"');
  });

  it('serves it as UTF-8 CSV that no proxy may cache', async () => {
    const { headers } = await harness([row()]).exportCsv();

    expect(headers['content-type']).toBe('text/csv; charset=utf-8');
    expect(headers['cache-control']).toBe('no-store');
  });

  it('writes exactly the spec columns, in the spec order (covers: AC-17)', async () => {
    const { lines } = await harness([row()]).exportCsv();

    expect(lines[0]).toBe(SPEC_COLUMNS);
  });

  it('writes one line per row, separated by CRLF (covers: AC-17)', async () => {
    const { lines } = await harness([row(), row({ email: 'b@example.com' }), row({ email: 'c@example.com' })]).exportCsv();

    expect(lines).toHaveLength(4);
  });

  it('writes the district by name, never by id (covers: AC-17)', async () => {
    const { lines } = await harness([row()]).exportCsv();

    expect(lines[1]).toContain('"Kicukiro"');
    expect(lines[1]).not.toContain('103');
  });

  it('never puts the row id in the file', async () => {
    const { body } = await harness([row()]).exportCsv();

    expect(body).not.toContain('3e99c55b-a014-47b0-8711-1619c28ae1c6');
  });

  it('writes a full owner row cell by cell', async () => {
    const { lines } = await harness([row({ invitedAt: '2026-09-12T18:43:32.583Z' })]).exportCsv();

    expect(lines[1]).toBe(
      '"2026-09-12T18:35:26.366Z","owner","owner@example.com","Grace Mukamana","0788123456","Umurage Guest House","Kicukiro","guest_house","6_20","true","2026-09-12T18:43:32.583Z",',
    );
  });

  it('leaves null cells empty rather than writing "null"', async () => {
    const traveller = row({
      audience: 'traveller',
      phone: null,
      businessName: null,
      districtId: null,
      districtName: null,
      propertyType: null,
      sizeBand: null,
      marketingOptIn: false,
    });

    const { lines } = await harness([traveller]).exportCsv();

    expect(lines[1]).toBe(
      '"2026-09-12T18:35:26.366Z","traveller","owner@example.com","Grace Mukamana",,,,,,"false",,',
    );
    expect(lines[1]).not.toContain('null');
  });

  it('quotes a comma and doubles an inner quote, so a name cannot split a row', async () => {
    const { lines } = await harness([row({ fullName: 'Uwase, "Grace"' })]).exportCsv();

    expect(lines[1]).toContain('"Uwase, ""Grace"""');
    expect(lines).toHaveLength(2);
  });

  it('keeps a line break inside one quoted cell', async () => {
    const { body } = await harness([row({ businessName: 'Line one\r\nLine two' })]).exportCsv();

    expect(body).toContain('"Line one\r\nLine two"');
  });

  it.each(['=HYPERLINK("http://evil.example","click")', '+SUM(A1)', '-2+3', '@cmd'])(
    'defuses a cell starting %s so a spreadsheet will not run it',
    async (payload) => {
      const { lines } = await harness([row({ fullName: payload })]).exportCsv();

      expect(lines[1]).toContain(`"'${payload.replace(/"/g, '""')}"`);
    },
  );

  it('writes only the header for an empty list', async () => {
    const { body } = await harness([]).exportCsv();

    expect(body).toBe(SPEC_COLUMNS);
  });

  it('passes the filter and the calling staff member to the service, which logs it (covers: AC-22)', async () => {
    const h = harness([row()]);

    await h.exportCsv({ audience: 'owner', districtId: 103 });

    expect(h.service.export).toHaveBeenCalledWith({ audience: 'owner', districtId: 103 }, STAFF.id);
  });
});

describe('AdminWaitlistController · list and invite', () => {
  it('hands the validated query to the service unchanged (covers: AC-17)', async () => {
    const h = harness([row()]);

    const page = await h.controller.list({ audience: 'traveller', limit: 25, offset: 50 });

    expect(h.service.list).toHaveBeenCalledWith({ audience: 'traveller', limit: 25, offset: 50 });
    expect(page.total).toBe(1);
  });

  it('marks a row invited as the calling staff member (covers: AC-17, AC-22)', async () => {
    const h = harness([row()]);

    const result = await h.controller.invite('3e99c55b-a014-47b0-8711-1619c28ae1c6', STAFF);

    expect(h.service.invite).toHaveBeenCalledWith('3e99c55b-a014-47b0-8711-1619c28ae1c6', STAFF.id);
    expect(result).toEqual({ invitedAt: '2026-09-12T18:43:32.583Z' });
  });
});
