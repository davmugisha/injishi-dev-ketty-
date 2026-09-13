import { Logger, NotFoundException } from '@nestjs/common';
import type { Query, SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';

import type { Database } from '../../../shared/database/database.module';
import { AdminWaitlistService } from './waitlist-admin.service';

type RawRow = Record<string, unknown>;

interface Calls {
  countWheres: (SQL | undefined)[];
  rowWheres: (SQL | undefined)[];
  orderBys: number;
  limits: number[];
  offsets: number[];
  updates: { set: Record<string, unknown>; where: SQL }[];
  readWheres: SQL[];
}

/**
 * The staff view of the waitlist (ADR-048 AC-17, AC-22).
 *
 * Postgres is stood in for at the Drizzle boundary. Every predicate the service
 * builds is captured and RENDERED to real SQL, so "it filtered by owner" is
 * checked against the question it put to the database, and "the count and the
 * rows agree" is checked by comparing the two questions, not two canned answers.
 *
 * What only a real database proves (the index order, the join) belongs to
 * `/check verify`; the rehearsal ledger covers it as V51 to V60.
 */

const dialect = new PgDialect();
const sqlOf = (where: SQL | undefined): Query | undefined => (where ? dialect.sqlToQuery(where) : undefined);

const STAFF = '712dbb3c-92fe-462f-abe5-2ed507b8c3fc';
const ID = '3e99c55b-a014-47b0-8711-1619c28ae1c6';
const NOW = new Date('2026-09-13T08:00:00.000Z');

function raw(overrides: RawRow = {}): RawRow {
  return {
    id: ID,
    audience: 'owner',
    email: 'owner@example.com',
    fullName: 'Grace Mukamana',
    phone: '+250788123456',
    businessName: 'Umurage Guest House',
    districtId: 103,
    districtName: 'Kicukiro',
    propertyType: 'guest_house',
    sizeBand: '6_20',
    marketingOptIn: false,
    invitedAt: null,
    unsubscribedAt: null,
    createdAt: new Date('2026-09-12T18:35:26.366Z'),
    ...overrides,
  };
}

function harness(
  opts: { rows?: RawRow[]; total?: number; invitedAt?: Date | null } = {},
): { service: AdminWaitlistService; calls: Calls } {
  const rows = opts.rows ?? [raw()];
  const calls: Calls = {
    countWheres: [],
    rowWheres: [],
    orderBys: 0,
    limits: [],
    offsets: [],
    updates: [],
    readWheres: [],
  };

  // `.where()` is awaited directly for a count, and followed by `.limit()` for a
  // single row read, so it answers both ways.
  const awaitable = <T, E extends object>(value: T, extra: E): Promise<T> & E =>
    Object.assign(Promise.resolve(value), extra);

  const db = {
    select: jest.fn((columns: Record<string, unknown>) => ({
      from: () => ({
        where: (where: SQL) => {
          if ('total' in columns) {
            calls.countWheres.push(where);
            return Promise.resolve([{ total: opts.total ?? rows.length }]);
          }
          calls.readWheres.push(where);
          return awaitable([], {
            limit: async () => (opts.invitedAt === undefined ? [] : [{ invitedAt: opts.invitedAt }]),
          });
        },
        leftJoin: () => ({
          where: (where: SQL | undefined) => {
            calls.rowWheres.push(where);
            return {
              orderBy: () => {
                calls.orderBys += 1;
                return awaitable(rows, {
                  limit: (n: number) => {
                    calls.limits.push(n);
                    return {
                      offset: async (m: number) => {
                        calls.offsets.push(m);
                        return rows;
                      },
                    };
                  },
                });
              },
            };
          },
        }),
      }),
    })),
    update: jest.fn(() => ({
      set: (set: Record<string, unknown>) => ({
        where: async (where: SQL) => {
          calls.updates.push({ set, where });
        },
      }),
    })),
  };

  return { service: new AdminWaitlistService(db as unknown as Database), calls };
}

let logSpy: jest.SpyInstance;

beforeEach(() => {
  jest.useFakeTimers({ now: NOW });
  logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.useRealTimers();
  logSpy.mockRestore();
});

describe('AdminWaitlistService · list', () => {
  it('returns the unpaged total beside the page of rows (covers: AC-17)', async () => {
    const h = harness({ rows: [raw()], total: 116 });

    const page = await h.service.list({ limit: 50, offset: 0 });

    expect(page.total).toBe(116);
    expect(page.rows).toHaveLength(1);
  });

  it('sends timestamps as ISO strings and nulls as nulls (covers: AC-17)', async () => {
    const invited = new Date('2026-09-12T18:43:32.583Z');
    const h = harness({ rows: [raw({ invitedAt: invited })] });

    const [row] = (await h.service.list({ limit: 50, offset: 0 })).rows;

    expect(row.createdAt).toBe('2026-09-12T18:35:26.366Z');
    expect(row.invitedAt).toBe('2026-09-12T18:43:32.583Z');
    expect(row.unsubscribedAt).toBeNull();
  });

  it('passes the page size and offset through to the read (covers: AC-17)', async () => {
    const h = harness();

    await h.service.list({ limit: 100, offset: 200 });

    expect(h.calls.limits).toEqual([100]);
    expect(h.calls.offsets).toEqual([200]);
  });

  it('orders the rows, newest first being the default the API promises (covers: AC-17)', async () => {
    const h = harness();

    await h.service.list({ limit: 50, offset: 0 });

    expect(h.calls.orderBys).toBe(1);
  });

  it('reads everything when no filter is given', async () => {
    const h = harness();

    await h.service.list({ limit: 50, offset: 0 });

    expect(h.calls.countWheres).toEqual([undefined]);
    expect(h.calls.rowWheres).toEqual([undefined]);
  });

  it('filters by audience (covers: AC-17)', async () => {
    const h = harness();

    await h.service.list({ audience: 'owner', limit: 50, offset: 0 });

    const query = sqlOf(h.calls.rowWheres[0]);
    expect(query?.sql).toMatch(/"waitlist_signups"\."audience" = \$1/);
    expect(query?.params).toEqual(['owner']);
  });

  it('filters by district id (covers: AC-17)', async () => {
    const h = harness();

    await h.service.list({ districtId: 103, limit: 50, offset: 0 });

    const query = sqlOf(h.calls.rowWheres[0]);
    expect(query?.sql).toMatch(/"waitlist_signups"\."district_id" = \$1/);
    expect(query?.params).toEqual([103]);
  });

  it('asks the count and the rows the same question, so the total can never describe other rows (covers: AC-17)', async () => {
    const h = harness();

    await h.service.list({ audience: 'owner', districtId: 103, limit: 50, offset: 0 });

    expect(sqlOf(h.calls.countWheres[0])).toEqual(sqlOf(h.calls.rowWheres[0]));
    expect(sqlOf(h.calls.countWheres[0])?.params).toEqual(['owner', 103]);
  });

  it('answers a total of zero rather than undefined when the count comes back empty', async () => {
    const h = harness({ rows: [], total: 0 });

    const page = await h.service.list({ limit: 50, offset: 0 });

    expect(page).toEqual({ total: 0, rows: [] });
  });
});

describe('AdminWaitlistService · export', () => {
  it('reads every matching row with no page limit, so the file is never truncated (covers: AC-17)', async () => {
    const h = harness({ rows: Array.from({ length: 150 }, (_, i) => raw({ id: `id-${i}` })) });

    const rows = await h.service.export({}, STAFF);

    expect(rows).toHaveLength(150);
    expect(h.calls.limits).toEqual([]);
    expect(h.calls.offsets).toEqual([]);
  });

  it('applies the same audience and district filter the list uses (covers: AC-17)', async () => {
    const h = harness();

    await h.service.export({ audience: 'traveller', districtId: 507 }, STAFF);

    expect(sqlOf(h.calls.rowWheres[0])?.params).toEqual(['traveller', 507]);
  });

  it('writes one log line naming the staff member, the action, the time and the scope (covers: AC-22)', async () => {
    const h = harness({ rows: [raw(), raw({ id: 'b' })] });

    await h.service.export({ audience: 'owner' }, STAFF);

    const lines = logSpy.mock.calls.map((c) => String(c[0]));
    expect(lines).toEqual([
      `Waitlist export by staff ${STAFF} at ${NOW.toISOString()}: 2 rows, audience=owner, districtId=all.`,
    ]);
  });

  it('keeps personal data out of that log line (covers: AC-22)', async () => {
    const h = harness();

    await h.service.export({}, STAFF);

    const line = String(logSpy.mock.calls[0][0]);
    expect(line).not.toContain('owner@example.com');
    expect(line).not.toContain('Grace Mukamana');
    expect(line).not.toContain('+250788123456');
  });
});

describe('AdminWaitlistService · invite', () => {
  it('only sets invited_at on a row that has none yet (covers: AC-17)', async () => {
    const h = harness({ invitedAt: NOW });

    await h.service.invite(ID, STAFF);

    const { sql, params } = dialect.sqlToQuery(h.calls.updates[0].where);
    expect(sql).toMatch(/"waitlist_signups"\."id" = \$1/);
    expect(sql).toMatch(/"waitlist_signups"\."invited_at" is null/);
    expect(params).toEqual([ID]);
    expect(h.calls.updates[0].set.invitedAt).toEqual(NOW);
  });

  it('returns the timestamp already stored, never a new one, when invited twice (covers: AC-17)', async () => {
    const original = new Date('2026-09-01T10:00:00.000Z');
    const h = harness({ invitedAt: original });

    const result = await h.service.invite(ID, STAFF);

    expect(result).toEqual({ invitedAt: '2026-09-01T10:00:00.000Z' });
  });

  it('answers 404 for a signup that does not exist (covers: AC-17)', async () => {
    const h = harness({ invitedAt: undefined });

    await expect(h.service.invite(ID, STAFF)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('writes one log line naming the signup, the staff member and the time (covers: AC-22)', async () => {
    const h = harness({ invitedAt: NOW });

    await h.service.invite(ID, STAFF);

    expect(logSpy.mock.calls.map((c) => String(c[0]))).toEqual([
      `Waitlist signup ${ID} marked invited by staff ${STAFF} at ${NOW.toISOString()}.`,
    ]);
  });

  it('logs nothing when there was nobody to invite', async () => {
    const h = harness({ invitedAt: undefined });

    await h.service.invite(ID, STAFF).catch(() => undefined);

    expect(logSpy).not.toHaveBeenCalled();
  });
});
