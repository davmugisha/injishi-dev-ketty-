import { Job, type Queue } from 'bullmq';

import { BOOKING_MAIL_EVENTS, bookingMailJobId } from '../../modules/booking/domain/booking-mail';
import { trainingMailJobId, trainingReminderJobId } from '../../modules/training/domain/training-mail';
import { queueJobId } from './job-id';

/**
 * BullMQ's own id rule, run offline.
 *
 * `Job.validateOptions` is the check `queue.add` runs before it touches Redis,
 * so these tests hold the real library to the real keys without a server. The
 * first case is the control: it proves the validator refuses the shape our keys
 * used to be sent in, so the passing cases below mean something.
 */
function bullmqVerdict(jobId: string): 'accepted' | string {
  const queue = {
    opts: {},
    qualifiedName: 'bull:probe',
    keys: {},
    toKey: (type: string) => `bull:probe:${type}`,
    client: Promise.resolve({}),
  } as unknown as Queue;
  try {
    // `validateOptions` is protected; it is called here exactly as `addJob` calls it.
    const job = new Job(queue, 'probe', {}, { jobId }) as unknown as {
      validateOptions(json: { data: string }): void;
    };
    job.validateOptions({ data: '{}' });
    return 'accepted';
  } catch (err) {
    return (err as Error).message;
  }
}

describe('queueJobId', () => {
  const WORKSPACE = '0f9a1b00-0000-4000-8000-000000000002';
  const TOKEN = 'e8c9979d-116d-4987-939b-a371fa61e7b8';
  const keys = [
    `void:${WORKSPACE}:booking-capture:${TOKEN}`,
    `refund:${WORKSPACE}:booking-capture:${TOKEN}`,
    `refund:refund:${WORKSPACE}:booking-capture:${TOKEN}`,
    `escrow-release:${WORKSPACE}:booking-capture:${TOKEN}`,
    `void:${WORKSPACE}:order-capture:${TOKEN}`,
    `${WORKSPACE}:escrow-release:${TOKEN}`,
  ];

  it('is refused by BullMQ when the raw key is used (the control)', () => {
    expect(bullmqVerdict(keys[0]!)).toBe('Custom Id cannot contain :');
  });

  it.each(keys)('turns %s into an id BullMQ accepts', (key) => {
    expect(bullmqVerdict(queueJobId(key))).toBe('accepted');
  });

  it('is deterministic, so a key enqueued twice is still one job', () => {
    expect(queueJobId(keys[0]!)).toBe(queueJobId(keys[0]!));
  });

  it('gives different keys different ids', () => {
    const ids = new Set(keys.map(queueJobId));
    expect(ids.size).toBe(keys.length);
  });
});

/*
 * The other derived ids in the API, held to the same validator. A mail id with
 * a fourth colon part is refused exactly as a money key was, and a rescheduled
 * training mail used to be one.
 */
describe('derived mail job ids', () => {
  const ID = '0f9a1b00-0000-4000-8000-000000000777';
  const at = new Date('2026-10-01T08:00:00Z');

  it('a rescheduled training mail id is accepted', () => {
    expect(bullmqVerdict(trainingMailJobId({ registrationId: ID, event: 'rescheduled' }, at))).toBe('accepted');
  });

  it('two reschedules of one registration are still two jobs', () => {
    const later = new Date(at.getTime() + 3_600_000);
    expect(trainingMailJobId({ registrationId: ID, event: 'rescheduled' }, at)).not.toBe(
      trainingMailJobId({ registrationId: ID, event: 'rescheduled' }, later),
    );
  });

  it.each(['registered', 'cancelled', 'certificate_issued'] as const)(
    'a %s training mail id is accepted',
    (event) => {
      expect(bullmqVerdict(trainingMailJobId({ registrationId: ID, event }))).toBe('accepted');
    },
  );

  it('a reminder training mail id, which carries the start it reminds of, is accepted', () => {
    expect(bullmqVerdict(trainingMailJobId({ registrationId: ID, event: 'reminder' }, at))).toBe('accepted');
  });

  it('the training reminder scheduler id is accepted', () => {
    expect(bullmqVerdict(trainingReminderJobId(ID, at))).toBe('accepted');
  });

  it.each(BOOKING_MAIL_EVENTS)('a %s booking mail id is accepted', (event) => {
    expect(bullmqVerdict(bookingMailJobId({ bookingId: ID, event }))).toBe('accepted');
  });
});
