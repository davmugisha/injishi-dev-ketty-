/**
 * What a learner is told about a training session, and when (ADR-049 AC-20,
 * AC-21).
 *
 * ## The shape is ADR-047's, deliberately
 *
 * The booking mails answered the same question a year of this codebase later:
 * how does a committed write tell a person about itself without being able to
 * fail the write? Everything here follows that answer — a queue, a job carrying
 * ids, a processor that reads the rows at send time, and a job id derived so
 * that raising the same event twice sends one mail. Where this file departs
 * from `booking/domain/booking-mail.ts` it says so and why; everything else is
 * the same on purpose, because two mail paths that differ for no reason are two
 * paths to maintain.
 *
 * ## Why the job carries ids and not a message
 *
 * A queued job is a row in Redis: a second store, with its own retention, its
 * own backups and nobody's eyes on it. A learner's name, address and phone stay
 * in Postgres where the rest of their record is. The processor reads what it
 * needs when it runs, which also means a job that sat through four retries
 * cannot deliver a stale fact — a session cancelled while its reminder was
 * queued is read as cancelled when the job finally runs.
 *
 * ## The one exception, and the reason for it
 *
 * `rescheduleReason` travels ON the job. Every other fact these mails print is
 * read back from a row, and the reason cannot be: ADR-049's data model gives
 * `training_sessions` a `cancellation_reason` column and NO reschedule
 * equivalent, while its API surface takes `rescheduleReason` as an input to the
 * PATCH and AC-21 requires the mail to carry it. So the request is the only
 * place that value ever exists.
 *
 * That is safe on both counts the rule above protects. It is not personal data
 * — it is a sentence about a session, written by a trainer. And it cannot go
 * stale, because it describes the act that raised the job rather than the state
 * of anything: "the trainer moved this session, and here is what they said
 * about it" stays true however long the job waits.
 */

/** The five moments a learner hears from us about one session. */
export const TRAINING_MAIL_EVENTS = [
  /** Their place is booked. Raised when the registration row is written. */
  'registered',
  /** 24 hours out. Fanned out from the scheduler job below. */
  'reminder',
  /** They were marked present, and here is the certificate it issued. */
  'certificate_issued',
  /** The session moved. Carries the trainer's reason. */
  'rescheduled',
  /** The session is off. Carries the reason, and says what it means for them. */
  'cancelled',
] as const;

export type TrainingMailEvent = (typeof TRAINING_MAIL_EVENTS)[number];

/** The BullMQ job name for one mail to one person. */
export const TRAINING_MAIL_JOB = 'training-mail';

/**
 * The delayed job that has no recipient of its own.
 *
 * A SECOND job name rather than a sixth event, because it is not a mail: it
 * wakes up 24 hours before a session and queues one `reminder` job per live
 * registration. One delayed job per session rather than one per registrant is
 * what makes AC-21 simple — rescheduling removes ONE job and adds ONE back, and
 * somebody who withdraws in the meantime is simply not in the roster the
 * scheduler reads.
 */
export const TRAINING_REMINDER_SCHEDULE_JOB = 'training-reminder-schedule';

/** How far ahead of a session its reminder goes out (AC-20). */
export const REMINDER_LEAD_MS = 24 * 60 * 60 * 1000;

/** Everything one queued training mail needs. Ids, and one recorded sentence. */
export interface TrainingMailJob {
  registrationId: string;
  event: TrainingMailEvent;
  /** Only on `rescheduled`. See the note above on why this one travels. */
  rescheduleReason?: string;
}

/** The delayed scheduler job. One session, nothing else. */
export interface TrainingReminderScheduleJob {
  sessionId: string;
}

/**
 * The job id, and why it is derived rather than random.
 *
 * BullMQ deduplicates by job id, so deriving it makes the whole path idempotent
 * for free. That is not a nicety here, it is load bearing twice over:
 *
 * - AC-4 makes a second registration attempt RETURN the existing registration
 *   rather than create one. The service raises `registered` either way, because
 *   it cannot tell the caller's intent apart — and this makes the second raise
 *   a no-op instead of a second identical mail.
 * - The attendance verb is idempotent on its own key (AC-9), so a retried tick
 *   re-raises `certificate_issued` for a certificate that already existed. Same
 *   answer: one mail.
 *
 * `rescheduled` and `reminder` are the events a session may genuinely produce
 * twice, so their ids carry the start time the mail is about: the new start for
 * a move, the start being reminded of for a reminder. Two moves send two mails,
 * and one move raised twice still sends one. The reminder learned this the
 * hard way: a session whose reminder had gone out and that then moved again
 * queued its second reminder under the first one's id, BullMQ kept the
 * completed first job, and the new time was never reminded of (live mail run,
 * 2026-09-13).
 *
 * The start time is joined with `_`, never `:`. BullMQ refuses a custom id
 * containing a colon unless it has exactly three colon separated parts, so a
 * fourth part made every rescheduled mail throw at `queue.add` (booking audit,
 * 2026-09-13; `shared/queues/job-id.ts` carries the full story).
 */
export function trainingMailJobId(
  job: TrainingMailJob,
  startsAt?: Date,
): string {
  const suffix =
    (job.event === 'rescheduled' || job.event === 'reminder') && startsAt
      ? `_${startsAt.getTime()}`
      : '';
  return `${TRAINING_MAIL_JOB}:${job.registrationId}:${job.event}${suffix}`;
}

/**
 * The scheduler's job id, carrying the session's start time.
 *
 * Rescheduling has to remove the pending reminder and queue a new one (AC-21),
 * and BullMQ can only remove a job by id — so the id has to be one the
 * rescheduling code can compute from the OLD start time and the new one from
 * the new. Deriving it from the session id alone would make the two
 * indistinguishable, and removing then adding under one id races with itself.
 */
export function trainingReminderJobId(
  sessionId: string,
  startsAt: Date,
): string {
  return `${TRAINING_REMINDER_SCHEDULE_JOB}:${sessionId}:${startsAt.getTime()}`;
}

/** When the reminder for a session starting at `startsAt` should go out. */
export function reminderDelayMs(startsAt: Date, now: Date): number {
  return startsAt.getTime() - REMINDER_LEAD_MS - now.getTime();
}
