import type { WaitlistSignupInput } from '@injishi/contracts';
import { Logger } from '@nestjs/common';
import type { Queue } from 'bullmq';
import type { Query, SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';

import type { Database } from '../../../shared/database/database.module';
import { WAITLIST_WELCOME_JOB } from './waitlist-mail';
import { WaitlistService } from './waitlist.service';

/**
 * The waitlist write path (ADR-048), with Postgres stood in for at the Drizzle
 * boundary.
 *
 * The stand in is not a stub that answers whatever a test configures. It keeps
 * rows, refuses a second row for one lower-cased email the way
 * `waitlist_signups_email_uk` does, and answers a lookup by RENDERING the
 * predicate the service built into real SQL and reading its bound parameter.
 * So a test that passes here passes because the service asked the database the
 * right question, not because the fake was told the answer.
 *
 * What no fake can prove (the unique index under a real race, the owner check
 * constraint, the `+250` check) belongs to `/check verify` against a database.
 */

const dialect = new PgDialect();
const render = (where: SQL): Query => dialect.sqlToQuery(where);

interface Row {
  id: string;
  email: string;
  unsubscribeToken: string;
  values: Record<string, unknown>;
}

interface Harness {
  service: WaitlistService;
  db: { insert: jest.Mock; select: jest.Mock; update: jest.Mock };
  rows: Row[];
  inserts: Record<string, unknown>[];
  lookups: SQL[];
  updates: { set: Record<string, unknown>; where: SQL }[];
  add: jest.Mock;
}

function harness(opts: { stored?: string[]; queueFails?: boolean } = {}): Harness {
  const rows: Row[] = [];
  let next = 0;
  const mint = (): string => {
    next += 1;
    return `00000000-0000-4000-8000-${String(next).padStart(12, '0')}`;
  };
  const store = (values: Record<string, unknown>): Row => {
    const row = { id: mint(), email: String(values.email), unsubscribeToken: mint(), values };
    rows.push(row);
    return row;
  };
  for (const email of opts.stored ?? []) store({ email });

  const inserts: Record<string, unknown>[] = [];
  const lookups: SQL[] = [];
  const updates: { set: Record<string, unknown>; where: SQL }[] = [];

  const db = {
    insert: jest.fn(() => ({
      values: (values: Record<string, unknown>) => ({
        onConflictDoNothing: () => ({
          returning: async () => {
            inserts.push(values);
            const email = String(values.email).toLowerCase();
            if (rows.some((r) => r.email.toLowerCase() === email)) return [];
            const row = store(values);
            return [{ id: row.id, unsubscribeToken: row.unsubscribeToken }];
          },
        }),
      }),
    })),
    select: jest.fn(() => ({
      from: () => ({
        where: (where: SQL) => ({
          limit: async () => {
            lookups.push(where);
            const [param] = render(where).params;
            return rows
              .filter((r) => r.email.toLowerCase() === param)
              .map((r) => ({ id: r.id }));
          },
        }),
      }),
    })),
    update: jest.fn(() => ({
      set: (set: Record<string, unknown>) => ({
        where: async (where: SQL) => {
          updates.push({ set, where });
        },
      }),
    })),
  };

  const add = jest.fn(async () => {
    if (opts.queueFails) throw new Error('redis down');
    return {};
  });

  const service = new WaitlistService(
    db as unknown as Database,
    { add } as unknown as Queue,
  );
  return { service, db, rows, inserts, lookups, updates, add };
}

const TRAVELLER: WaitlistSignupInput = {
  audience: 'traveller',
  email: 'amani@example.com',
  fullName: 'Amani Uwase',
  marketingOptIn: false,
};

const OWNER: WaitlistSignupInput = {
  audience: 'owner',
  email: 'owner@example.rw',
  fullName: 'Jean Mugabo',
  phone: '+250788123456',
  businessName: 'Lake Kivu Lodge',
  districtId: 42,
  propertyType: 'lodge',
  sizeBand: '6_20',
  marketingOptIn: true,
};

describe('WaitlistService · join', () => {
  it('stores a new traveller and answers with the new id (covers: AC-9)', async () => {
    const h = harness();

    const result = await h.service.join(TRAVELLER);

    expect(h.rows).toHaveLength(1);
    expect(result).toEqual({ id: h.rows[0].id, alreadyJoined: false });
  });

  it('answers with the id and the flag and nothing the caller sent (covers: AC-9)', async () => {
    const h = harness();

    const result = await h.service.join(OWNER);

    expect(Object.keys(result).sort()).toEqual(['alreadyJoined', 'id']);
    expect(JSON.stringify(result)).not.toContain(OWNER.email);
    expect(JSON.stringify(result)).not.toContain(OWNER.fullName);
  });

  it('writes every owner column as null for a traveller, never undefined (covers: AC-8, AC-14)', async () => {
    const h = harness();

    await h.service.join(TRAVELLER);

    expect(h.inserts[0]).toMatchObject({
      audience: 'traveller',
      phone: null,
      businessName: null,
      districtId: null,
      propertyType: null,
      sizeBand: null,
    });
  });

  it('keeps a traveller phone when one was given (covers: AC-8)', async () => {
    const h = harness();

    await h.service.join({ ...TRAVELLER, phone: '+44 20 7946 0958' });

    expect(h.inserts[0].phone).toBe('+44 20 7946 0958');
  });

  it('writes all five owner fields (covers: AC-8)', async () => {
    const h = harness();

    await h.service.join(OWNER);

    expect(h.inserts[0]).toMatchObject({
      audience: 'owner',
      phone: '+250788123456',
      businessName: 'Lake Kivu Lodge',
      districtId: 42,
      propertyType: 'lodge',
      sizeBand: '6_20',
    });
  });

  it.each([true, false])(
    'stores marketing consent exactly as given, here %s (covers: AC-15)',
    async (marketingOptIn) => {
      const h = harness();

      await h.service.join({ ...TRAVELLER, marketingOptIn });

      expect(h.inserts[0].marketingOptIn).toBe(marketingOptIn);
    },
  );

  it('queues exactly one welcome for a new row, keyed on its id (covers: AC-11)', async () => {
    const h = harness();

    const { id } = await h.service.join(TRAVELLER);

    expect(h.add).toHaveBeenCalledTimes(1);
    expect(h.add).toHaveBeenCalledWith(
      WAITLIST_WELCOME_JOB,
      { signupId: id },
      expect.objectContaining({ jobId: `waitlist-welcome-${id}` }),
    );
  });

  it('keys the welcome job with no colon, which BullMQ refuses in a two part id (covers: AC-11)', async () => {
    // BullMQ 5 throws "Custom Id cannot contain :" unless an id splits into exactly
    // three parts. `waitlist-welcome:<id>` is two, so every add threw, the service
    // swallowed it as designed, and no welcome was ever queued. This mock accepts
    // anything, which is how that shipped green.
    const h = harness();

    await h.service.join(TRAVELLER);

    const { jobId } = h.add.mock.calls[0][2] as { jobId: string };
    expect(jobId).not.toContain(':');
  });

  it('puts no address or name in the queued job, only the row id (covers: AC-11)', async () => {
    const h = harness();

    await h.service.join(OWNER);

    const payload = JSON.stringify(h.add.mock.calls[0]);
    expect(payload).not.toContain(OWNER.email);
    expect(payload).not.toContain(OWNER.fullName);
    expect(payload).not.toContain(OWNER.phone);
  });
});

describe('WaitlistService · join, when the address is already stored', () => {
  it('answers alreadyJoined with the stored id and writes no second row (covers: AC-10)', async () => {
    const h = harness({ stored: [TRAVELLER.email] });
    const storedId = h.rows[0].id;

    const result = await h.service.join(TRAVELLER);

    expect(result).toEqual({ id: storedId, alreadyJoined: true });
    expect(h.rows).toHaveLength(1);
  });

  it('queues no second welcome (covers: AC-10)', async () => {
    const h = harness({ stored: [TRAVELLER.email] });

    await h.service.join(TRAVELLER);

    expect(h.add).not.toHaveBeenCalled();
  });

  it('finds a row stored in another case, by comparing lower(email) (covers: AC-10)', async () => {
    const h = harness({ stored: ['Amani@Example.COM'] });

    const result = await h.service.join(TRAVELLER);

    expect(result).toEqual({ id: h.rows[0].id, alreadyJoined: true });
    const query = render(h.lookups[0]);
    expect(query.sql).toMatch(/^lower\(.*"email"\) = \$1$/);
    expect(query.params).toEqual([TRAVELLER.email]);
  });

  it('attempts the write first and reads only after the conflict, so a race cannot make two rows (covers: AC-10)', async () => {
    const h = harness({ stored: [TRAVELLER.email] });

    await h.service.join(TRAVELLER);

    const insertOrder = h.db.insert.mock.invocationCallOrder[0];
    const selectOrder = h.db.select.mock.invocationCallOrder[0];
    expect(insertOrder).toBeLessThan(selectOrder);
  });

  it('never reads before writing a brand new address (covers: AC-10)', async () => {
    const h = harness();

    await h.service.join(TRAVELLER);

    expect(h.db.select).not.toHaveBeenCalled();
  });
});

describe('WaitlistService · join, when the queue is down', () => {
  let logged: jest.SpyInstance;

  beforeEach(() => {
    logged = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    logged.mockRestore();
  });

  it('still answers the stored signup as a success (covers: AC-11)', async () => {
    const h = harness({ queueFails: true });

    const result = await h.service.join(TRAVELLER);

    expect(result).toEqual({ id: h.rows[0].id, alreadyJoined: false });
  });

  it('logs the failure against the row id, without the address or the name', async () => {
    const h = harness({ queueFails: true });

    await h.service.join(TRAVELLER);

    expect(logged).toHaveBeenCalledTimes(1);
    const line = JSON.stringify(logged.mock.calls[0]);
    expect(line).toContain(h.rows[0].id);
    expect(line).not.toContain(TRAVELLER.email);
    expect(line).not.toContain(TRAVELLER.fullName);
  });
});

describe('WaitlistService · unsubscribe', () => {
  const TOKEN = '6f1c2a3b-4d5e-4f60-8a71-b2c3d4e5f607';
  const NOW = new Date('2026-09-12T08:00:00.000Z');

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('stamps unsubscribedAt instead of deleting the row (covers: AC-12)', async () => {
    const h = harness();

    await h.service.unsubscribe(TOKEN);

    expect(h.updates).toHaveLength(1);
    expect(h.updates[0].set).toEqual({ unsubscribedAt: NOW, updatedAt: NOW });
  });

  it('matches on the token and only while still subscribed, so a spent token changes nothing (covers: AC-12)', async () => {
    const h = harness();

    await h.service.unsubscribe(TOKEN);

    const query = render(h.updates[0].where);
    expect(query.sql).toContain('"unsubscribe_token" = $1');
    expect(query.sql).toContain('"unsubscribed_at" is null');
    expect(query.params).toEqual([TOKEN]);
  });

  it('accepts a token written in upper case', async () => {
    const h = harness();

    await h.service.unsubscribe(TOKEN.toUpperCase());

    expect(h.updates).toHaveLength(1);
  });

  it.each([
    ['empty', ''],
    ['not a uuid', 'not-a-token'],
    ['a uuid with a character short', TOKEN.slice(0, -1)],
    ['an injection attempt', `${TOKEN}' or '1'='1`],
  ])(
    'answers ok for a token that is %s without reaching the database (covers: AC-12)',
    async (_label, token) => {
      const h = harness();

      const result = await h.service.unsubscribe(token);

      expect(result).toEqual({ ok: true });
      expect(h.db.update).not.toHaveBeenCalled();
    },
  );

  it('gives a known, an unknown and a malformed token the same answer (covers: AC-12)', async () => {
    const h = harness();

    const known = await h.service.unsubscribe(TOKEN);
    const unknown = await h.service.unsubscribe('00000000-0000-4000-8000-000000000999');
    const malformed = await h.service.unsubscribe('garbage');

    expect(unknown).toEqual(known);
    expect(malformed).toEqual(known);
  });
});
