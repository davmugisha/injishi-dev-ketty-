import type { Job } from 'bullmq';
import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';

import type { Database } from '../../../shared/database/database.module';
import { WAITLIST_WELCOME_JOB } from './waitlist-mail';
import { WaitlistMailProcessor } from './waitlist-mail.processor';
import type { WaitlistWelcomeMailer } from './waitlist-welcome.mailer';

/**
 * The worker side of the welcome note (ADR-048 AC-11, AC-12).
 *
 * Postgres is stood in for at the Drizzle boundary and the lookup's predicate is
 * rendered to real SQL, so a test asserting "it read this signup" is checking
 * the question the processor asked, not a value the fake was handed.
 */

const dialect = new PgDialect();
const SIGNUP_ID = '0b9c4a2e-7d61-4f3a-9e0c-5a8f2d1b6c73';

interface StoredRow {
  email: string;
  fullName: string;
  unsubscribeToken: string;
  businessName: string | null;
  unsubscribedAt: Date | null;
  districtName: string | null;
}

interface Harness {
  processor: WaitlistMailProcessor;
  send: jest.Mock;
  lookups: SQL[];
  db: { select: jest.Mock };
}

function harness(row: StoredRow | null, opts: { mailFails?: boolean } = {}): Harness {
  const lookups: SQL[] = [];
  const db = {
    select: jest.fn(() => ({
      from: () => ({
        leftJoin: () => ({
          where: (where: SQL) => ({
            limit: async () => {
              lookups.push(where);
              return row ? [row] : [];
            },
          }),
        }),
      }),
    })),
  };
  const send = jest.fn(async () => {
    if (opts.mailFails) throw new Error('SMTP delivery failed');
  });
  const processor = new WaitlistMailProcessor(
    db as unknown as Database,
    { send } as unknown as WaitlistWelcomeMailer,
  );
  return { processor, send, lookups, db };
}

const job = (name: string, signupId = SIGNUP_ID): Job => ({ name, data: { signupId } }) as unknown as Job;

const TRAVELLER_ROW: StoredRow = {
  email: 'amani@example.com',
  fullName: 'Amani Uwase',
  unsubscribeToken: '8f14e45f-ceea-467a-9f5b-2f7c6d1e0a11',
  businessName: null,
  unsubscribedAt: null,
  districtName: null,
};

describe('WaitlistMailProcessor', () => {
  it('sends the welcome for the signup the job names (covers: AC-11)', async () => {
    const h = harness(TRAVELLER_ROW);

    await h.processor.process(job(WAITLIST_WELCOME_JOB));

    expect(h.send).toHaveBeenCalledTimes(1);
    expect(h.send).toHaveBeenCalledWith({
      email: 'amani@example.com',
      fullName: 'Amani Uwase',
      unsubscribeToken: '8f14e45f-ceea-467a-9f5b-2f7c6d1e0a11',
      businessName: null,
      districtName: null,
    });
  });

  it('looks the row up by the job id and nothing else', async () => {
    const h = harness(TRAVELLER_ROW);

    await h.processor.process(job(WAITLIST_WELCOME_JOB));

    const query = dialect.sqlToQuery(h.lookups[0]);
    expect(query.params).toEqual([SIGNUP_ID]);
    expect(query.sql).toMatch(/"waitlist_signups"\."id" = \$1/);
  });

  it('passes an owner business and district through for the owner paragraph', async () => {
    const h = harness({ ...TRAVELLER_ROW, businessName: 'Umurage Guest House', districtName: 'Musanze' });

    await h.processor.process(job(WAITLIST_WELCOME_JOB));

    expect(h.send).toHaveBeenCalledWith(
      expect.objectContaining({ businessName: 'Umurage Guest House', districtName: 'Musanze' }),
    );
  });

  it('sends nothing when the row is gone', async () => {
    const h = harness(null);

    await expect(h.processor.process(job(WAITLIST_WELCOME_JOB))).resolves.toBeUndefined();
    expect(h.send).not.toHaveBeenCalled();
  });

  it('sends nothing to somebody who unsubscribed before the welcome went out (covers: AC-12)', async () => {
    const h = harness({ ...TRAVELLER_ROW, unsubscribedAt: new Date('2026-01-01T00:00:00Z') });

    await h.processor.process(job(WAITLIST_WELCOME_JOB));

    expect(h.send).not.toHaveBeenCalled();
  });

  it('ignores a job with another name on the same queue, without reading the database', async () => {
    const h = harness(TRAVELLER_ROW);

    await h.processor.process(job('waitlist.something-else'));

    expect(h.db.select).not.toHaveBeenCalled();
    expect(h.send).not.toHaveBeenCalled();
  });

  it('lets a failed send fail the job, so BullMQ retries it (covers: AC-11)', async () => {
    const h = harness(TRAVELLER_ROW, { mailFails: true });

    await expect(h.processor.process(job(WAITLIST_WELCOME_JOB))).rejects.toThrow('SMTP delivery failed');
  });
});
