import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { resolveRedisConnection } from './redis.config';

/**
 * Canonical queue names (architecture.md "Backend Worker Queues").
 * Jobs must be idempotent; compliance/money jobs queue, never skip.
 */
export const QUEUES = {
  email: 'Email',
  notification: 'Notification',
  checkoutReminder: 'CheckoutReminder',
  guestReviewLifecycle: 'GuestReviewLifecycle',
  bookingLifecycle: 'BookingLifecycle',
  photoOrphanSweep: 'PhotoOrphanSweep',
  /** ADR-016: posts one room charge per night per in-house stay (AC-15). */
  nightAudit: 'NightAudit',
  /**
   * ADR-020 D-d: chases a money instruction the seam did not confirm — a
   * compensating refund that itself failed, or a capture the provider accepted
   * and never settled. Job id is the idempotency key of the operation it
   * chases, so BullMQ deduplicates a job the same way the port deduplicates a
   * call, and nothing is ever dropped.
   */
  paymentCompensation: 'PaymentCompensation',
  /**
   * ADR-041: certifies one confirmed sale with RRA through the taxpayer's EBM
   * account. One attempt per job — whether to try again is the
   * `ebm_invoices` row's decision, never BullMQ's, because a blind retry of a
   * send that timed out can declare a stay twice.
   */
  ebmEmission: 'EbmEmission',
  /**
   * ADR-053, AC-R5: re checks a registration held at `submitted` on an
   * unanswered RRA TIN check, on a backoff, up to a ceiling. Its own queue
   * rather than a borrowed one, because retry policy, backoff and job id
   * semantics are per queue, and a sweep chasing a third party outage shares
   * none of them with an email send or a booking tick.
   */
  registrationTinRecheck: 'RegistrationTinRecheck',
  /**
   * ADR-048: the waitlist welcome note.
   *
   * ITS OWN QUEUE, NOT `email`, and that is a correctness matter rather than
   * tidiness. `BookingMailProcessor` is the only consumer of `email` and it
   * returns early for any job name it does not know. A second consumer on the
   * same queue would mean the two workers compete for every job, so a waitlist
   * job drawn by the booking worker would be marked complete without ever
   * being sent, and roughly half of all signups would silently never be
   * emailed. A queue per concern is what the four below already do.
   */
  waitlistEmail: 'WaitlistEmail',
  /**
   * ADR-049: everything a learner is told about a training session, and the
   * delayed reminder that fans out into it.
   *
   * ITS OWN QUEUE, for the reason the waitlist note above gives in full: a
   * second consumer on `email` would compete with `BookingMailProcessor` for
   * every job, and the loser is marked complete without being sent. A queue
   * per concern is the rule here, not the exception.
   *
   * It carries two kinds of job and one processor owns both. The reminder
   * SCHEDULER job is delayed until 24 hours before a session and, when it
   * runs, queues one ordinary mail job per live registration — so the roster
   * it fans out to is the roster at send time, and a delayed job never has to
   * be edited when somebody withdraws.
   */
  trainingEmail: 'TrainingEmail',
  /**
   * ADR-056 AC-18: the daily PSF membership sweep. Ends expired memberships,
   * sends the 30 day and on the day emails, and stamps any application that
   * reached PSF's queue without its stamp. Its own queue for the same reason
   * the TIN sweep has one: a scheduler's policy is per queue.
   */
  psfMembershipSweep: 'PsfMembershipSweep',
  /**
   * ADR-058: the HR daily job. Moves contract statuses on Kigali dates and
   * writes the leave accruals each person is owed. Its own queue, because a
   * scheduler's policy is per queue.
   */
  hrDaily: 'HrDaily',
} as const;

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      // BullMQ's default prefix, `bull`, in every stack. Each stack has a Redis
      // of its own (ADR-043), so the prefix no longer separates anything and a
      // second one would only strand jobs queued before a change of name.
      useFactory: (config: ConfigService) => ({
        connection: resolveRedisConnection({
          redisUrl: config.get<string>('REDIS_URL'),
          redisHost: config.get<string>('REDIS_HOST'),
          redisPort: config.get<string>('REDIS_PORT'),
        }),
      }),
    }),
    BullModule.registerQueue(
      ...Object.values(QUEUES).map((name) => ({ name })),
    ),
  ],
  exports: [BullModule],
})
export class QueuesModule {}
