import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import type { Queue } from 'bullmq';
import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';

import type { Database } from '../../../shared/database/database.module';
import {
  REMINDER_LEAD_MS,
  TRAINING_MAIL_JOB,
  TRAINING_REMINDER_SCHEDULE_JOB,
  trainingMailJobId,
  trainingReminderJobId,
} from '../domain/training-mail';
import { TrainingNotificationsService } from './training-notifications.service';

/**
 * What gets queued, under which id, and when (ADR-049 AC-20, AC-21).
 *
 * The queue is a mock and Postgres is stood in for at the Drizzle boundary, with
 * the roster predicate rendered to real SQL, so "only people still holding a
 * place" is checked as the question asked rather than as a value the fake was
 * handed. That the jobs actually become mails is `scripts/verify-training.mjs`,
 * against a live worker and Mailpit.
 */

const dialect = new PgDialect();
const SESSION = '5e551011-0000-4000-8000-000000000001';
const NOW = new Date('2026-10-01T06:00:00Z');
const STARTS = new Date('2026-10-05T07:00:00Z');
const MOVED = new Date('2026-10-06T07:00:00Z');

interface Harness {
  service: TrainingNotificationsService;
  queue: { add: Mock; addBulk: Mock; remove: Mock };
  rosterQueries: SQL[];
  calls: string[];
}

function harness(
  roster: string[] = [],
  opts: { addFails?: boolean; addBulkFails?: boolean; removeFails?: boolean } = {},
): Harness {
  const calls: string[] = [];
  const rosterQueries: SQL[] = [];
  const queue = {
    add: vi.fn(async (name: string) => {
      calls.push(`add:${name}`);
      if (opts.addFails) throw new Error('redis is down');
    }),
    addBulk: vi.fn(async () => {
      calls.push('addBulk');
      if (opts.addBulkFails) throw new Error('redis is down');
    }),
    remove: vi.fn(async () => {
      calls.push('remove');
      if (opts.removeFails) throw new Error('redis is down');
    }),
  };
  const db = {
    select: vi.fn(() => ({
      from: () => ({
        where: async (where: SQL) => {
          rosterQueries.push(where);
          return roster.map((id) => ({ id }));
        },
      }),
    })),
  };
  const service = new TrainingNotificationsService(
    db as unknown as Database,
    queue as unknown as Queue,
  );
  return { service, queue, rosterQueries, calls };
}

function rendered(where: SQL): { sql: string; params: unknown[] } {
  return dialect.sqlToQuery(where);
}

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toNotFake: ['nextTick', 'setImmediate'] });
});
afterEach(() => {
  vi.useRealTimers();
});

describe('TrainingNotificationsService, one mail to one person', () => {
  it('queues a registered mail carrying only ids, under the derived id', async () => {
    const h = harness();
    await h.service.registered('reg-1');

    expect(h.queue.add).toHaveBeenCalledTimes(1);
    const [name, data, opts] = h.queue.add.mock.calls[0];
    expect(name).toBe(TRAINING_MAIL_JOB);
    expect(data).toEqual({ registrationId: 'reg-1', event: 'registered' });
    expect(opts).toMatchObject({
      jobId: trainingMailJobId({ registrationId: 'reg-1', event: 'registered' }),
      attempts: 5,
      removeOnFail: false,
    });
  });

  it('raising the same event twice uses the same job id, so BullMQ keeps one', async () => {
    const h = harness();
    await h.service.certificateIssued('reg-1');
    await h.service.certificateIssued('reg-1');

    const ids = h.queue.add.mock.calls.map((c) => c[2].jobId);
    expect(ids).toHaveLength(2);
    expect(ids[0]).toBe(ids[1]);
  });

  it('never throws when Redis refuses the add: the write that raised it stands', async () => {
    const h = harness([], { addFails: true });
    await expect(h.service.registered('reg-1')).resolves.toBeUndefined();
  });
});

describe('TrainingNotificationsService, the reminder clock', () => {
  it('publishing queues ONE delayed job that fires 24 hours before the start', async () => {
    const h = harness();
    await h.service.sessionPublished(SESSION, STARTS);

    expect(h.queue.add).toHaveBeenCalledTimes(1);
    const [name, data, opts] = h.queue.add.mock.calls[0];
    expect(name).toBe(TRAINING_REMINDER_SCHEDULE_JOB);
    expect(data).toEqual({ sessionId: SESSION });
    expect(opts.jobId).toBe(trainingReminderJobId(SESSION, STARTS));
    expect(opts.delay).toBe(STARTS.getTime() - REMINDER_LEAD_MS - NOW.getTime());
  });

  it('a session starting inside 24 hours gets no reminder at all', async () => {
    const h = harness();
    await h.service.sessionPublished(SESSION, new Date(NOW.getTime() + REMINDER_LEAD_MS - 1));
    expect(h.queue.add).not.toHaveBeenCalled();
  });

  it('never throws when the reminder cannot be scheduled', async () => {
    const h = harness([], { addFails: true });
    await expect(h.service.sessionPublished(SESSION, STARTS)).resolves.toBeUndefined();
  });

  it('fans a due reminder out to every registrant still holding a place', async () => {
    const h = harness(['reg-1', 'reg-2']);
    await expect(h.service.fanOutReminder(SESSION, STARTS)).resolves.toBe(2);

    const { sql, params } = rendered(h.rosterQueries[0]!);
    expect(sql).toMatch(/"training_registrations"\."session_id" = \$\d/);
    expect(sql).toMatch(/"training_registrations"\."status" = \$\d/);
    expect(params).toEqual([SESSION, 'registered']);

    const jobs = h.queue.addBulk.mock.calls[0][0];
    expect(jobs.map((j: { data: unknown }) => j.data)).toEqual([
      { registrationId: 'reg-1', event: 'reminder' },
      { registrationId: 'reg-2', event: 'reminder' },
    ]);
    expect(jobs.every((j: { name: string }) => j.name === TRAINING_MAIL_JOB)).toBe(true);
  });

  // REGRESSION (live mail run, 2026-09-13): a session whose reminder had gone
  // out and that then moved again queued its second reminder under the first
  // one's id, and BullMQ dropped it as a duplicate of the completed job.
  it('a reminder for a MOVED session is a different job from the reminder for its old time', async () => {
    const h = harness(['reg-1']);
    await h.service.fanOutReminder(SESSION, STARTS);
    await h.service.fanOutReminder(SESSION, MOVED);

    const first = h.queue.addBulk.mock.calls[0][0][0].opts.jobId;
    const second = h.queue.addBulk.mock.calls[1][0][0].opts.jobId;
    expect(first).not.toBe(second);
    expect(second).toBe(
      trainingMailJobId({ registrationId: 'reg-1', event: 'reminder' }, MOVED),
    );
  });

  it('the same reminder fanned out twice is still one job per registrant', async () => {
    const h = harness(['reg-1']);
    await h.service.fanOutReminder(SESSION, STARTS);
    await h.service.fanOutReminder(SESSION, STARTS);
    expect(h.queue.addBulk.mock.calls[0][0][0].opts.jobId).toBe(
      h.queue.addBulk.mock.calls[1][0][0].opts.jobId,
    );
  });

  it('an empty roster queues nothing and reports zero', async () => {
    const h = harness([]);
    await expect(h.service.fanOutReminder(SESSION, STARTS)).resolves.toBe(0);
    expect(h.queue.addBulk).not.toHaveBeenCalled();
  });

  it('a roster that cannot be queued reports zero rather than throwing', async () => {
    const h = harness(['reg-1'], { addBulkFails: true });
    await expect(h.service.fanOutReminder(SESSION, STARTS)).resolves.toBe(0);
  });
});

describe('TrainingNotificationsService, moving and cancelling (AC-21)', () => {
  it('a move tells the roster with the reason, drops the old reminder, then sets a new one', async () => {
    const h = harness(['reg-1', 'reg-2']);
    await h.service.sessionRescheduled(SESSION, STARTS, MOVED, 'The hall flooded.');

    expect(h.calls).toEqual(['addBulk', 'remove', `add:${TRAINING_REMINDER_SCHEDULE_JOB}`]);

    const jobs = h.queue.addBulk.mock.calls[0][0];
    expect(jobs[0].data).toEqual({
      registrationId: 'reg-1',
      event: 'rescheduled',
      rescheduleReason: 'The hall flooded.',
    });
    expect(jobs[0].opts.jobId).toBe(
      trainingMailJobId({ registrationId: 'reg-1', event: 'rescheduled' }, MOVED),
    );
    expect(rendered(h.rosterQueries[0]!).params).toEqual([SESSION, 'registered']);

    expect(h.queue.remove).toHaveBeenCalledWith(trainingReminderJobId(SESSION, STARTS));
    const [, , opts] = h.queue.add.mock.calls[0];
    expect(opts.jobId).toBe(trainingReminderJobId(SESSION, MOVED));
    expect(opts.delay).toBe(MOVED.getTime() - REMINDER_LEAD_MS - NOW.getTime());
  });

  it('a reminder that cannot be removed still gets its replacement', async () => {
    const h = harness(['reg-1'], { removeFails: true });
    await expect(
      h.service.sessionRescheduled(SESSION, STARTS, MOVED, 'Moved.'),
    ).resolves.toBeUndefined();
    expect(h.queue.add).toHaveBeenCalledTimes(1);
  });

  it('a cancel tells everybody who did not withdraw, and removes the reminder', async () => {
    const h = harness(['reg-released', 'reg-attended']);
    await h.service.sessionCancelled(SESSION, STARTS);

    const { sql, params } = rendered(h.rosterQueries[0]!);
    expect(sql).toMatch(/"training_registrations"\."status" <> \$\d/);
    expect(params).toEqual([SESSION, 'withdrawn']);

    const jobs = h.queue.addBulk.mock.calls[0][0];
    expect(jobs.map((j: { data: unknown }) => j.data)).toEqual([
      { registrationId: 'reg-released', event: 'cancelled' },
      { registrationId: 'reg-attended', event: 'cancelled' },
    ]);
    expect(h.queue.remove).toHaveBeenCalledWith(trainingReminderJobId(SESSION, STARTS));
    expect(h.queue.add).not.toHaveBeenCalled();
  });
});
