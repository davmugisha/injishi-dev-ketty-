import { describe, expect, it, type Mock, vi } from 'vitest';

import type { Job } from 'bullmq';

import { users } from '../../../database/drizzle/schema';
import type { Database } from '../../../shared/database/database.module';
import type { StorageService } from '../../storage/application/storage.service';
import type { TrainingNotificationsService } from '../application/training-notifications.service';
import type { TrainingConfig } from '../domain/training-config';
import {
  TRAINING_MAIL_JOB,
  TRAINING_REMINDER_SCHEDULE_JOB,
  type TrainingMailJob,
} from '../domain/training-mail';
import { TrainingMailProcessor } from './training-mail.processor';
import type { TrainingMailer } from './training-mailer';

/**
 * The worker side of the training mails (ADR-049 AC-20, AC-21).
 *
 * Postgres is stood in for at the Drizzle boundary: every `select` answers the
 * next row set in order, and the projection it asked for is kept, so "the mail
 * goes to the account's current address" is checked against the column the
 * processor read rather than against a value the fake happened to be given.
 * Delivery itself is `scripts/verify-training.mjs`, against a live worker.
 */

const REG = '7e600000-0000-4000-8000-000000000001';
const SESSION = '5e551011-0000-4000-8000-000000000001';
const STARTS = new Date('2026-10-05T07:00:00Z');

type Row = Record<string, unknown>;

function mailRow(overrides: Row = {}): Row {
  return {
    registrationStatus: 'registered',
    registeredName: 'Aline Snapshot',
    feeRwf: '25000',
    learnerEmail: 'current@example.test',
    learnerName: 'Aline Uwase',
    courseTitle: 'Host basics',
    sessionStatus: 'published',
    startsAt: STARTS,
    endsAt: new Date(STARTS.getTime() + 6 * 3_600_000),
    cancelledAt: null,
    cancellationReason: null,
    rescheduledFrom: null,
    venueName: 'Injishi office',
    venueAddress: 'KN 4 Ave',
    districtName: 'Nyarugenge',
    ...overrides,
  };
}

interface Harness {
  processor: TrainingMailProcessor;
  send: Mock;
  readBytes: Mock;
  fanOutReminder: Mock;
  projections: Row[];
}

function harness(
  results: Row[][],
  opts: { mailFails?: boolean; pdf?: Buffer } = {},
): Harness {
  const projections: Row[] = [];
  const queue = [...results];
  const chain: Record<string, unknown> = {};
  for (const step of ['from', 'innerJoin', 'leftJoin', 'where']) {
    chain[step] = () => chain;
  }
  chain.limit = async () => queue.shift() ?? [];
  const db = {
    select: vi.fn((projection: Row) => {
      projections.push(projection);
      return chain;
    }),
  };
  const send = vi.fn(async () => {
    if (opts.mailFails) throw new Error('SMTP delivery failed: timeout');
  });
  const readBytes = vi.fn(async () => opts.pdf ?? Buffer.from('%PDF-1.7 stored'));
  const fanOutReminder = vi.fn(async () => 2);
  const config = { verifyBaseUrl: 'https://www.injishi.com/' } as TrainingConfig;

  const processor = new TrainingMailProcessor(
    db as unknown as Database,
    config,
    { send } as unknown as TrainingMailer,
    { readBytes } as unknown as StorageService,
    { fanOutReminder } as unknown as TrainingNotificationsService,
  );
  return { processor, send, readBytes, fanOutReminder, projections };
}

function mailJob(data: TrainingMailJob): Job {
  return { name: TRAINING_MAIL_JOB, data } as Job;
}

describe('TrainingMailProcessor, one mail', () => {
  it('addresses the ACCOUNT\'s current email, never the registration snapshot (AC-20)', async () => {
    const h = harness([[mailRow()]]);
    await h.processor.process(mailJob({ registrationId: REG, event: 'registered' }));

    expect(h.projections[0]!.learnerEmail).toBe(users.email);
    expect(h.send).toHaveBeenCalledTimes(1);
    const [event, facts] = h.send.mock.calls[0];
    expect(event).toBe('registered');
    expect(facts).toMatchObject({
      learnerEmail: 'current@example.test',
      learnerName: 'Aline Uwase',
      feeRwf: 25_000,
      trainingUrl: 'https://www.injishi.com/training',
    });
  });

  it('falls back to the registered name only when the account has none', async () => {
    const h = harness([[mailRow({ learnerName: null })]]);
    await h.processor.process(mailJob({ registrationId: REG, event: 'reminder' }));
    expect(h.send.mock.calls[0][1].learnerName).toBe('Aline Snapshot');
  });

  it('a learner with no account email is logged and completed, not retried', async () => {
    const h = harness([[mailRow({ learnerEmail: null })]]);
    await expect(
      h.processor.process(mailJob({ registrationId: REG, event: 'registered' })),
    ).resolves.toBeUndefined();
    expect(h.send).not.toHaveBeenCalled();
  });

  it('an unknown registration is dropped', async () => {
    const h = harness([[]]);
    await h.processor.process(mailJob({ registrationId: REG, event: 'registered' }));
    expect(h.send).not.toHaveBeenCalled();
  });

  it('a rescheduled mail carries the reason from the job and the old start from the row', async () => {
    const was = new Date('2026-10-04T07:00:00Z');
    const h = harness([[mailRow({ rescheduledFrom: was })]]);
    await h.processor.process(
      mailJob({ registrationId: REG, event: 'rescheduled', rescheduleReason: 'The hall flooded.' }),
    );
    expect(h.send.mock.calls[0][1]).toMatchObject({
      reason: 'The hall flooded.',
      previousStartsAt: was,
    });
  });

  it('a cancelled mail carries the stored cancellation reason, even to the released', async () => {
    const h = harness([
      [
        mailRow({
          registrationStatus: 'released',
          sessionStatus: 'cancelled',
          cancelledAt: new Date(),
          cancellationReason: 'Too few registrations.',
        }),
      ],
    ]);
    await h.processor.process(mailJob({ registrationId: REG, event: 'cancelled' }));
    expect(h.send).toHaveBeenCalledTimes(1);
    expect(h.send.mock.calls[0][1].reason).toBe('Too few registrations.');
  });

  it.each([
    ['reminder', 'to a withdrawn learner', { registrationStatus: 'withdrawn' }],
    ['registered', 'on a cancelled session', { sessionStatus: 'cancelled' }],
    ['rescheduled', 'after the session was cancelled', { registrationStatus: 'released', sessionStatus: 'cancelled' }],
    ['certificate_issued', 'after a correction to absent', { registrationStatus: 'absent' }],
    ['cancelled', 'for a session still running', { sessionStatus: 'published' }],
    ['cancelled', 'to somebody who withdrew', { sessionStatus: 'cancelled', registrationStatus: 'withdrawn' }],
  ] as const)('a %s mail %s is dropped', async (event, _label, state) => {
    const h = harness([[mailRow(state)]]);
    await h.processor.process(mailJob({ registrationId: REG, event }));
    expect(h.send).not.toHaveBeenCalled();
  });

  it('a mail that fails to send throws, so BullMQ retries it', async () => {
    const h = harness([[mailRow()]], { mailFails: true });
    await expect(
      h.processor.process(mailJob({ registrationId: REG, event: 'registered' })),
    ).rejects.toThrow('SMTP delivery failed');
  });

  it('ignores a job name it does not own', async () => {
    const h = harness([[mailRow()]]);
    await h.processor.process({ name: 'something-else', data: {} } as Job);
    expect(h.send).not.toHaveBeenCalled();
    expect(h.projections).toHaveLength(0);
  });
});

describe('TrainingMailProcessor, the certificate mail (AC-20)', () => {
  const attended = mailRow({ registrationStatus: 'attended' });

  it('attaches the STORED PDF, read back through storage, with the serial and verify link', async () => {
    const stored = Buffer.from('%PDF-1.7 the issued file');
    const h = harness(
      [
        [attended],
        [{ serial: 'INJ-TR-2026-000042', verifyToken: 'ABC123', pdfObjectKey: 'training_certificate/x.pdf', revokedAt: null }],
      ],
      { pdf: stored },
    );
    await h.processor.process(mailJob({ registrationId: REG, event: 'certificate_issued' }));

    expect(h.readBytes).toHaveBeenCalledWith('training_certificate/x.pdf');
    const facts = h.send.mock.calls[0][1];
    expect(facts.serial).toBe('INJ-TR-2026-000042');
    expect(facts.verifyUrl).toMatch(/^https:\/\/www\.injishi\.com\/verify\/ABC123$/);
    expect(facts.pdf).toEqual({
      filename: 'INJ-TR-2026-000042.pdf',
      content: stored,
      contentType: 'application/pdf',
    });
  });

  it('throws when the PDF is not stored yet, so the mail waits for it', async () => {
    const h = harness([
      [attended],
      [{ serial: 'INJ-TR-2026-000042', verifyToken: 'ABC123', pdfObjectKey: null, revokedAt: null }],
    ]);
    await expect(
      h.processor.process(mailJob({ registrationId: REG, event: 'certificate_issued' })),
    ).rejects.toThrow('no stored PDF yet');
    expect(h.send).not.toHaveBeenCalled();
  });

  it('throws when there is no certificate row yet', async () => {
    const h = harness([[attended], []]);
    await expect(
      h.processor.process(mailJob({ registrationId: REG, event: 'certificate_issued' })),
    ).rejects.toThrow('no certificate');
  });

  it('a certificate revoked before the send is dropped without retrying', async () => {
    const h = harness([
      [attended],
      [{ serial: 'INJ-TR-2026-000042', verifyToken: 'ABC123', pdfObjectKey: 'k', revokedAt: new Date() }],
    ]);
    await expect(
      h.processor.process(mailJob({ registrationId: REG, event: 'certificate_issued' })),
    ).resolves.toBeUndefined();
    expect(h.send).not.toHaveBeenCalled();
    expect(h.readBytes).not.toHaveBeenCalled();
  });
});

describe('TrainingMailProcessor, the reminder scheduler', () => {
  const schedule = { name: TRAINING_REMINDER_SCHEDULE_JOB, data: { sessionId: SESSION } } as Job;

  // REGRESSION (live mail run, 2026-09-13): the fan-out has to know which start
  // it is reminding of, or a second reminder after a move reuses the first one's
  // job id and is dropped.
  it('fans out against the session\'s CURRENT start time', async () => {
    const h = harness([[{ status: 'published', cancelledAt: null, startsAt: STARTS }]]);
    await h.processor.process(schedule);
    expect(h.fanOutReminder).toHaveBeenCalledWith(SESSION, STARTS);
    expect(h.send).not.toHaveBeenCalled();
  });

  it.each([
    ['cancelled', { status: 'cancelled', cancelledAt: new Date(), startsAt: STARTS }],
    ['draft', { status: 'draft', cancelledAt: null, startsAt: STARTS }],
  ])('a %s session fans nothing out', async (_label, session) => {
    const h = harness([[session]]);
    await h.processor.process(schedule);
    expect(h.fanOutReminder).not.toHaveBeenCalled();
  });

  it('a session that no longer exists fans nothing out', async () => {
    const h = harness([[]]);
    await h.processor.process(schedule);
    expect(h.fanOutReminder).not.toHaveBeenCalled();
  });
});
