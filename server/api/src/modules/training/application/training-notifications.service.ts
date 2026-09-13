import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { and, eq, ne } from 'drizzle-orm';

import { trainingRegistrations } from '../../../database/drizzle/schema';
import {
  DRIZZLE,
  type Database,
} from '../../../shared/database/database.module';
import { QUEUES } from '../../../shared/queues/queues.module';
import {
  TRAINING_MAIL_JOB,
  TRAINING_REMINDER_SCHEDULE_JOB,
  reminderDelayMs,
  trainingMailJobId,
  trainingReminderJobId,
  type TrainingMailEvent,
} from '../domain/training-mail';

/**
 * The one way a training session tells its learners something (ADR-049 AC-20,
 * AC-21).
 *
 * ## Why it queues, and why that is not a detail
 *
 * Every caller has ALREADY COMMITTED something. A registration row is written,
 * a certificate is issued inside the attendance transaction, a session is
 * cancelled and its undecided registrants released. If sending mail could fail
 * those operations, an unreachable SMTP relay would start rolling back
 * attendance, which is a far worse outcome than a late email.
 *
 * So the send is queued and EVERY METHOD HERE SWALLOWS ITS OWN ERRORS. That is
 * the contract `BookingNotificationsService` states, for the same reason, and
 * it is why each one is safe to call after a transaction with no `try` around
 * it.
 *
 * ## Why there is no `sendNow`
 *
 * Deliberately no synchronous path. A foreground send would put an outbound
 * SMTP round trip inside the request a trainer is watching with thirty people
 * in the room in front of them.
 *
 * ## The reminder is a job, not a mail
 *
 * `sessionPublished` queues ONE delayed job per session. It wakes 24 hours
 * before the start and fans out into one mail per live registration, which is
 * what makes rescheduling and cancelling cheap: one job to remove, one to add,
 * whatever the roster has done in the meantime.
 */
@Injectable()
export class TrainingNotificationsService {
  private readonly log = new Logger(TrainingNotificationsService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    @InjectQueue(QUEUES.trainingEmail) private readonly queue: Queue,
  ) {}

  /** Their place is booked (AC-20). Idempotent, so a re-register is one mail. */
  async registered(registrationId: string): Promise<void> {
    await this.queueMail(registrationId, 'registered');
  }

  /** They were marked present, and the PDF is attached (AC-20). */
  async certificateIssued(registrationId: string): Promise<void> {
    await this.queueMail(registrationId, 'certificate_issued');
  }

  /**
   * A session is open for registration: start its reminder clock (AC-20).
   *
   * A session published INSIDE the 24 hour window gets no reminder, and that is
   * a choice rather than an oversight. A reminder 24 hours before, sent four
   * hours before, is a different message; and queuing it with a negative delay
   * would fire it the instant somebody registers, beside the confirmation they
   * are still reading.
   */
  async sessionPublished(sessionId: string, startsAt: Date): Promise<void> {
    await this.scheduleReminder(sessionId, startsAt);
  }

  /**
   * The session moved (AC-21).
   *
   * Three things, in this order: tell everybody still holding a place, drop the
   * reminder pointing at the old time, and set a new one against the new time.
   * The reason travels on the job because nothing stores it. See
   * `domain/training-mail.ts` for why that is the one value that does.
   */
  async sessionRescheduled(
    sessionId: string,
    previousStartsAt: Date,
    startsAt: Date,
    reason: string,
  ): Promise<void> {
    await this.queueMailToRoster(sessionId, 'rescheduled', {
      onlyRegistered: true,
      reason,
      startsAt,
    });
    await this.cancelReminder(sessionId, previousStartsAt);
    await this.scheduleReminder(sessionId, startsAt);
  }

  /**
   * The session is off (AC-21).
   *
   * Everybody hears, INCLUDING the people already marked present who keep their
   * certificates. A cancellation notice that skipped them would read, to the
   * one group whose record is unaffected, as though theirs had been unmade too.
   * Only somebody who withdrew of their own accord is left out, because they
   * already know.
   */
  async sessionCancelled(sessionId: string, startsAt: Date): Promise<void> {
    await this.queueMailToRoster(sessionId, 'cancelled', {
      onlyRegistered: false,
    });
    await this.cancelReminder(sessionId, startsAt);
  }

  /**
   * Turn one due reminder into one mail per live registration.
   *
   * Called by the processor when the delayed job fires, so the roster it reads
   * is the roster 24 hours out rather than the roster at publish. Somebody who
   * withdrew is simply not in it, and a walk-in added since is.
   *
   * `startsAt` is the start being reminded of, and it goes into every job id.
   * A session that moves after its reminder went out is owed a second one, and
   * without the time in the id that second reminder is a duplicate of the
   * first and BullMQ drops it.
   */
  async fanOutReminder(sessionId: string, startsAt: Date): Promise<number> {
    return this.queueMailToRoster(sessionId, 'reminder', {
      onlyRegistered: true,
      startsAt,
    });
  }

  /**
   * One mail to one person.
   *
   * Never throws: Redis being down must not fail the write that raised this.
   * The failure is loud in the log instead, and it says plainly that the person
   * has not been told, because queued and sent are different claims.
   */
  private async queueMail(
    registrationId: string,
    event: TrainingMailEvent,
    extra?: { reason?: string; startsAt?: Date },
  ): Promise<void> {
    const job = {
      registrationId,
      event,
      ...(extra?.reason === undefined
        ? {}
        : { rescheduleReason: extra.reason }),
    };
    try {
      await this.queue.add(TRAINING_MAIL_JOB, job, {
        jobId: trainingMailJobId(job, extra?.startsAt),
        ...MAIL_JOB_OPTIONS,
      });
    } catch (error) {
      this.log.error(
        `Could not queue the "${event}" mail for training registration ` +
          `${registrationId}. The record stands; the learner has not been told.`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  /**
   * The same mail to everybody on a session.
   *
   * One `addBulk` rather than a loop of adds: a roster is tens of people, and a
   * round trip each would put that many sequential Redis calls inside a request
   * somebody is waiting on. Every job still carries its own derived id, so the
   * deduplication is unchanged.
   */
  private async queueMailToRoster(
    sessionId: string,
    event: TrainingMailEvent,
    opts: { onlyRegistered: boolean; reason?: string; startsAt?: Date },
  ): Promise<number> {
    try {
      const rows = await this.db
        .select({ id: trainingRegistrations.id })
        .from(trainingRegistrations)
        .where(
          opts.onlyRegistered
            ? and(
                eq(trainingRegistrations.sessionId, sessionId),
                eq(trainingRegistrations.status, 'registered'),
              )
            : and(
                eq(trainingRegistrations.sessionId, sessionId),
                // Everybody except the people who left of their own accord.
                ne(trainingRegistrations.status, 'withdrawn'),
              ),
        );

      if (rows.length === 0) return 0;

      await this.queue.addBulk(
        rows.map((row) => {
          const job = {
            registrationId: row.id,
            event,
            ...(opts.reason === undefined
              ? {}
              : { rescheduleReason: opts.reason }),
          };
          return {
            name: TRAINING_MAIL_JOB,
            data: job,
            opts: {
              jobId: trainingMailJobId(job, opts.startsAt),
              ...MAIL_JOB_OPTIONS,
            },
          };
        }),
      );
      return rows.length;
    } catch (error) {
      this.log.error(
        `Could not queue the "${event}" mails for training session ` +
          `${sessionId}. The session change stands; nobody has been told.`,
        error instanceof Error ? error.stack : undefined,
      );
      return 0;
    }
  }

  /** Queue the delayed fan-out, unless the moment has already gone. */
  private async scheduleReminder(
    sessionId: string,
    startsAt: Date,
  ): Promise<void> {
    const delay = reminderDelayMs(startsAt, new Date());
    if (delay <= 0) {
      this.log.log(
        `Session ${sessionId} starts inside 24 hours, so it gets no reminder. ` +
          'Registrants still get their confirmation.',
      );
      return;
    }
    try {
      await this.queue.add(
        TRAINING_REMINDER_SCHEDULE_JOB,
        { sessionId },
        {
          jobId: trainingReminderJobId(sessionId, startsAt),
          delay,
          // Fewer attempts and a longer backoff than a mail, because this job
          // only reads a roster and queues more jobs. If it fails three times
          // the mails it would have made are already late, and trying again
          // hours later would send "tomorrow" reminders about a session that
          // is under way.
          attempts: 3,
          backoff: { type: 'exponential', delay: 60_000 },
          removeOnComplete: { age: 86_400, count: 1_000 },
          removeOnFail: false,
        },
      );
    } catch (error) {
      this.log.error(
        `Could not schedule the reminder for training session ${sessionId}. ` +
          'The session is published; nobody will be reminded.',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  /**
   * Drop a pending reminder.
   *
   * `remove` on a job that has already run, or never existed, is not an error
   * here: a session cancelled the morning after its reminder went out has
   * nothing to remove, and that is the normal case rather than a fault.
   */
  private async cancelReminder(
    sessionId: string,
    startsAt: Date,
  ): Promise<void> {
    try {
      await this.queue.remove(trainingReminderJobId(sessionId, startsAt));
    } catch (error) {
      this.log.warn(
        'Could not remove the pending reminder for training session ' +
          `${sessionId}. If it was still due, it may yet fire.`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}

/**
 * How hard one mail tries.
 *
 * The booking mails' numbers, and for the booking mails' reason: a relay is
 * commonly down for seconds, not days, and exponential from 30s gives roughly
 * 30s, 1m, 2m, 4m, 8m. `removeOnFail: false` keeps a mail that never went out
 * visible in the queue, because nobody was told is something a person has to be
 * able to find out.
 */
const MAIL_JOB_OPTIONS = {
  attempts: 5,
  backoff: { type: 'exponential' as const, delay: 30_000 },
  removeOnComplete: { age: 86_400, count: 1_000 },
  removeOnFail: false,
};
