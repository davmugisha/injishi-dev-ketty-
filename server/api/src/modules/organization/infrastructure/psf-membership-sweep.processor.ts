import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { Job, Queue } from 'bullmq';

import { QUEUES } from '../../../shared/queues/queues.module';
import { PsfMembershipService } from '../application/psf-membership.service';

export const PSF_MEMBERSHIP_SWEEP = 'psf-membership-sweep';

/**
 * The daily PSF membership sweep (ADR-056 AC-18).
 *
 * At 06:00 in Kigali, so the mail lands in the morning and "today" is the day
 * PSF's paperwork uses, whatever timezone the worker runs in. Everything it
 * does is a guarded update, so a rerun the same day ends nothing twice and
 * mails nobody twice. Worker only, like the TIN sweep beside it.
 */
@Processor(QUEUES.psfMembershipSweep)
export class PsfMembershipSweepProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(PsfMembershipSweepProcessor.name);

  constructor(
    @InjectQueue(QUEUES.psfMembershipSweep) private readonly queue: Queue,
    private readonly psf: PsfMembershipService,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    await this.queue.upsertJobScheduler(
      PSF_MEMBERSHIP_SWEEP,
      { pattern: '0 6 * * *', tz: 'Africa/Kigali' },
      { name: PSF_MEMBERSHIP_SWEEP },
    );
    this.logger.log(`Scheduled ${PSF_MEMBERSHIP_SWEEP} daily at 06:00 Africa/Kigali`);
  }

  async process(job: Job): Promise<void> {
    if (job.name !== PSF_MEMBERSHIP_SWEEP) {
      this.logger.warn(`Ignoring unknown job "${job.name}" on ${QUEUES.psfMembershipSweep}`);
      return;
    }
    const outcome = await this.psf.sweep();
    if (outcome.ended + outcome.reminded + outcome.stamped > 0) {
      this.logger.log(
        `PSF sweep: ${outcome.ended} ended, ${outcome.reminded} reminded, ${outcome.stamped} queue stamp(s) caught up`,
      );
    }
  }
}
