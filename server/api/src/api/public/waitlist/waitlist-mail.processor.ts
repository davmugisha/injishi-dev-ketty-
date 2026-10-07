import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { eq } from 'drizzle-orm';

import { districts } from '../../../database/drizzle/geography';
import { waitlistSignups } from '../../../database/drizzle/waitlist';
import {
  DRIZZLE,
  type Database,
} from '../../../shared/database/database.module';
import { QUEUES } from '../../../shared/queues/queues.module';
import {
  WAITLIST_WELCOME_JOB,
  type WaitlistWelcomeJob,
} from './waitlist-mail';
import { WaitlistWelcomeMailer } from './waitlist-welcome.mailer';
import { reportJobFailure } from '../../../shared/observability/report-job-failure';

/**
 * Sends the waitlist welcome note, in the worker (ADR-048 AC-11).
 *
 * ## Why it reads the row instead of trusting the job
 *
 * The job carries a signup id and nothing else, so no name, address or phone
 * number is ever written into Redis. Everything the mail says is read here, at
 * send time, from the one table that is covered by the privacy notice the
 * person agreed to.
 *
 * It also means a retry cannot deliver a stale fact. Somebody who unsubscribed
 * between joining and the send gets nothing: the read below filters on
 * `unsubscribed_at`, so the first mail can never arrive after the person has
 * already asked to be left alone.
 *
 * ## A missing row is not a failure
 *
 * The row can be gone by the time this runs. That is not something to retry
 * five times and then park in a dead letter list: it is logged once and the job
 * completes.
 */
@Injectable()
@Processor(QUEUES.waitlistEmail)
export class WaitlistMailProcessor extends WorkerHost {
  private readonly log = new Logger(WaitlistMailProcessor.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly mailer: WaitlistWelcomeMailer,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name !== WAITLIST_WELCOME_JOB) return;
    const { signupId } = job.data as WaitlistWelcomeJob;

    const [row] = await this.db
      .select({
        email: waitlistSignups.email,
        fullName: waitlistSignups.fullName,
        unsubscribeToken: waitlistSignups.unsubscribeToken,
        businessName: waitlistSignups.businessName,
        unsubscribedAt: waitlistSignups.unsubscribedAt,
        districtName: districts.name,
      })
      .from(waitlistSignups)
      .leftJoin(districts, eq(waitlistSignups.districtId, districts.id))
      .where(eq(waitlistSignups.id, signupId))
      .limit(1);

    if (!row) {
      this.log.warn(`Waitlist signup ${signupId} is gone; nothing to send.`);
      return;
    }

    if (row.unsubscribedAt) {
      this.log.log(
        `Waitlist signup ${signupId} unsubscribed before the welcome went out; skipped.`,
      );
      return;
    }

    await this.mailer.send({
      email: row.email,
      fullName: row.fullName,
      unsubscribeToken: row.unsubscribeToken,
      businessName: row.businessName,
      districtName: row.districtName,
    });
  }

  /** A job failing its last attempt is reported (ADR-063 AC-12). Earlier attempts are retries. */
  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, error: Error): void {
    reportJobFailure(QUEUES.waitlistEmail, job, error);
  }
}
