import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { eq } from 'drizzle-orm';

import { districts } from '../../../database/drizzle/geography';
import {
  trainingCertificates,
  trainingCourses,
  trainingRegistrations,
  trainingSessions,
  trainingVenues,
  users,
} from '../../../database/drizzle/schema';
import {
  DRIZZLE,
  type Database,
} from '../../../shared/database/database.module';
import { QUEUES } from '../../../shared/queues/queues.module';
import { StorageService } from '../../storage/application/storage.service';
import { TrainingNotificationsService } from '../application/training-notifications.service';
import { verificationUrl } from '../domain/training-certificate';
import {
  TRAINING_CONFIG,
  type TrainingConfig,
} from '../domain/training-config';
import {
  TRAINING_MAIL_JOB,
  TRAINING_REMINDER_SCHEDULE_JOB,
  type TrainingMailJob,
  type TrainingReminderScheduleJob,
} from '../domain/training-mail';
import { TrainingMailer } from './training-mailer';

/**
 * Sends the training emails, in the worker (ADR-049 AC-20, AC-21).
 *
 * ## Why it reads the rows instead of trusting the job
 *
 * The job carries a registration id and an event name. Everything the mail says
 * is read HERE, at send time, which buys the two things `booking-mail.processor`
 * spells out and one more that only this feature needs.
 *
 * No personal data goes into Redis: a queued job is a row in a second store
 * with its own retention and its own backups, and a learner's name, address and
 * phone stay in Postgres with the rest of their record.
 *
 * A delayed job cannot deliver a stale fact, which matters far more here than
 * it does for a booking. The reminder is queued when a session is PUBLISHED and
 * runs up to months later; between those two moments the learner may have
 * withdrawn, the session may have moved twice, and the venue may have been
 * renamed. Every one of those is read as it is now, and `stillTrue` below drops
 * the job rather than sending a sentence that has stopped being true.
 *
 * And the recipient is read from `users` every time (AC-20). The registration
 * carries an email SNAPSHOT, taken when the person signed up, and mailing that
 * would send a certificate to an address somebody has since moved off.
 *
 * ## A learner with no email address
 *
 * A user may have signed in by phone (ADR-039), and a walk-in may have been
 * created from a name a trainer typed. That is not a failure and must not be
 * retried five times: it is logged once and the job completes. SMS for those
 * learners is owed work, not a bug to throw on.
 *
 * ## The certificate mail is the one that may fail on purpose
 *
 * AC-20 says the certificate goes out WITH THE PDF ATTACHED, so a mail with no
 * attachment is not a lesser version of it, it is a different message. If the
 * PDF is not in the store yet the job throws, BullMQ retries it across the next
 * fifteen minutes, and a certificate whose file genuinely never stored lands in
 * the failed set where somebody can see it. `removeOnFail: false` is what makes
 * that visible rather than silent.
 */
@Injectable()
@Processor(QUEUES.trainingEmail)
export class TrainingMailProcessor extends WorkerHost {
  private readonly log = new Logger(TrainingMailProcessor.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    @Inject(TRAINING_CONFIG) private readonly config: TrainingConfig,
    private readonly mailer: TrainingMailer,
    private readonly storage: StorageService,
    private readonly notifications: TrainingNotificationsService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name === TRAINING_REMINDER_SCHEDULE_JOB) {
      return this.fanOutReminder(job.data as TrainingReminderScheduleJob);
    }
    // This queue is this module's, but the guard stays: a job name nothing here
    // owns is left alone rather than failed.
    if (job.name !== TRAINING_MAIL_JOB) return;
    return this.sendOne(job.data as TrainingMailJob);
  }

  /**
   * The delayed job, 24 hours out: turn one session into one mail per learner.
   *
   * It re-reads the session first. A session cancelled after its reminder was
   * queued still has that reminder sitting in Redis — the cancel path removes
   * it, and this is the second line of defence for the case where the removal
   * itself failed and only logged.
   */
  private async fanOutReminder(data: TrainingReminderScheduleJob): Promise<void> {
    const [session] = await this.db
      .select({
        status: trainingSessions.status,
        cancelledAt: trainingSessions.cancelledAt,
        startsAt: trainingSessions.startsAt,
      })
      .from(trainingSessions)
      .where(eq(trainingSessions.id, data.sessionId))
      .limit(1);

    if (!session) {
      this.log.warn(`No training session ${data.sessionId}; dropping its reminder.`);
      return;
    }
    if (session.cancelledAt || session.status !== 'published') {
      this.log.log(
        `Session ${data.sessionId} is "${session.status}", so its reminder is dropped.`,
      );
      return;
    }

    const queued = await this.notifications.fanOutReminder(
      data.sessionId,
      session.startsAt,
    );
    this.log.log(
      `Queued ${queued} reminder${queued === 1 ? '' : 's'} for training session ${data.sessionId}.`,
    );
  }

  /** One mail to one learner. */
  private async sendOne(data: TrainingMailJob): Promise<void> {
    const { registrationId, event } = data;

    const [row] = await this.db
      .select({
        registrationStatus: trainingRegistrations.status,
        registeredName: trainingRegistrations.fullName,
        feeRwf: trainingRegistrations.feeRwf,
        // The ACCOUNT's current address, never the registration's snapshot
        // (AC-20). The snapshot is a record of what was true at sign-up.
        learnerEmail: users.email,
        learnerName: users.name,
        courseTitle: trainingCourses.title,
        sessionStatus: trainingSessions.status,
        startsAt: trainingSessions.startsAt,
        endsAt: trainingSessions.endsAt,
        cancelledAt: trainingSessions.cancelledAt,
        cancellationReason: trainingSessions.cancellationReason,
        rescheduledFrom: trainingSessions.rescheduledFrom,
        venueName: trainingVenues.name,
        venueAddress: trainingVenues.address,
        districtName: districts.name,
      })
      .from(trainingRegistrations)
      .innerJoin(
        trainingSessions,
        eq(trainingSessions.id, trainingRegistrations.sessionId),
      )
      .innerJoin(
        trainingCourses,
        eq(trainingCourses.id, trainingSessions.courseId),
      )
      .innerJoin(trainingVenues, eq(trainingVenues.id, trainingSessions.venueId))
      .leftJoin(districts, eq(districts.id, trainingVenues.districtId))
      .leftJoin(users, eq(users.id, trainingRegistrations.userId))
      .where(eq(trainingRegistrations.id, registrationId))
      .limit(1);

    if (!row) {
      this.log.warn(
        `No training registration ${registrationId}; dropping its "${event}" mail.`,
      );
      return;
    }

    if (!row.learnerEmail) {
      this.log.warn(
        `Training registration ${registrationId} has no account email address, ` +
          `so its "${event}" mail cannot be sent. (Phone-only learners need SMS.)`,
      );
      return;
    }

    if (!stillTrue(event, row.registrationStatus, row.sessionStatus)) {
      this.log.warn(
        `Skipping the "${event}" mail for training registration ${registrationId}: ` +
          `the registration is "${row.registrationStatus}" and the session is ` +
          `"${row.sessionStatus}", so that sentence is no longer true.`,
      );
      return;
    }

    const certificate =
      event === 'certificate_issued'
        ? await this.loadCertificate(registrationId)
        : undefined;

    if (certificate === null) {
      // Withdrawn between the tick and the send. A settled state rather than a
      // wait, so the mail is dropped instead of retried: nobody should be
      // emailed a credential that has been taken back.
      this.log.warn(
        `The certificate for training registration ${registrationId} was ` +
          'revoked before its mail went out; dropping it.',
      );
      return;
    }

    await this.mailer.send(event, {
      learnerEmail: row.learnerEmail,
      learnerName: row.learnerName ?? row.registeredName,
      courseTitle: row.courseTitle,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      venueName: row.venueName,
      venueAddress: row.venueAddress,
      districtName: row.districtName ?? 'Rwanda',
      trainingUrl: `${this.config.verifyBaseUrl.replace(/\/+$/, '')}/training`,
      feeRwf: row.feeRwf === null ? null : Number(row.feeRwf),
      ...(certificate ?? {}),
      ...(event === 'rescheduled' && row.rescheduledFrom
        ? { previousStartsAt: row.rescheduledFrom }
        : {}),
      // The cancellation reason is stored; the reschedule reason is not, and
      // arrives on the job. `domain/training-mail.ts` records why.
      ...(event === 'cancelled' && row.cancellationReason
        ? { reason: row.cancellationReason }
        : {}),
      ...(event === 'rescheduled' && data.rescheduleReason
        ? { reason: data.rescheduleReason }
        : {}),
    });
  }

  /**
   * The certificate, its verification link, and the stored PDF.
   *
   * THROWS rather than returning a partial answer when the PDF is not stored
   * yet, because the mail it feeds is defined by the attachment (AC-20) and a
   * store that has not caught up is worth waiting for. A REVOKED certificate
   * returns `null` instead: that is a settled answer, and retrying five times
   * would only reach it again.
   */
  private async loadCertificate(registrationId: string): Promise<{
    serial: string;
    verifyUrl: string;
    pdf: { filename: string; content: Buffer; contentType: string };
  } | null> {
    const [row] = await this.db
      .select({
        serial: trainingCertificates.serial,
        verifyToken: trainingCertificates.verifyToken,
        pdfObjectKey: trainingCertificates.pdfObjectKey,
        revokedAt: trainingCertificates.revokedAt,
      })
      .from(trainingCertificates)
      .where(eq(trainingCertificates.registrationId, registrationId))
      .limit(1);

    if (!row) {
      throw new Error(
        `Registration ${registrationId} has no certificate to attach yet.`,
      );
    }
    // `null`, not a throw. A revocation is a settled answer, and throwing would
    // put this job through five retries to reach the same one.
    if (row.revokedAt) return null;
    if (!row.pdfObjectKey) {
      throw new Error(
        `Certificate ${row.serial} has no stored PDF yet; retrying its mail.`,
      );
    }

    // Read back rather than re-rendered, so the file in somebody's inbox is
    // byte for byte the file a verifier can be shown (ADR-049 Value sourcing).
    const content = await this.storage.readBytes(row.pdfObjectKey);

    return {
      serial: row.serial,
      verifyUrl: verificationUrl(this.config.verifyBaseUrl, row.verifyToken),
      pdf: {
        filename: `${row.serial}.pdf`,
        content,
        contentType: 'application/pdf',
      },
    };
  }
}

/**
 * Is the sentence this mail is about to say still true?
 *
 * The same guard `booking-mail.processor.ts` applies, and for the same reason:
 * a job that sat through four retries, or a reminder queued two months ago,
 * must not cheerfully tell somebody their cancelled session is tomorrow.
 */
function stillTrue(
  event: TrainingMailJob['event'],
  registrationStatus: string,
  sessionStatus: string,
): boolean {
  switch (event) {
    case 'registered':
    case 'reminder':
    case 'rescheduled':
      // Only somebody still holding a place, on a session still going ahead.
      return registrationStatus === 'registered' && sessionStatus !== 'cancelled';
    case 'certificate_issued':
      // The tick is what makes this true, and a later tick can undo it (AC-11).
      return registrationStatus === 'attended';
    case 'cancelled':
      // Said once the session is actually off, whatever the registration says:
      // the released, the absent and the attended all hear it.
      return sessionStatus === 'cancelled' && registrationStatus !== 'withdrawn';
  }
}
