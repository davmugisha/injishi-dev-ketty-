import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { Job, Queue } from 'bullmq';

import { QUEUES } from '../../../shared/queues/queues.module';
import { RegistrationService } from '../application/registration.service';

/** The single job name this processor handles on its queue. */
export const RECHECK_PENDING_TINS = 'recheck-pending-tins';

/**
 * Every minute.
 *
 * The shortest wait in the backoff table is five minutes, so a one minute tick
 * keeps every attempt within a minute of when it is due. Running more often than
 * anything is due costs one indexed read per tick and changes nothing, because
 * `tinRecheckDue` is what decides; the tick only decides how late an attempt can
 * be. A slower tick would quietly stretch the first retry past the five minutes
 * the table promises.
 */
const SWEEP_EVERY_MS = 60_000;

/**
 * The RRA TIN retry sweep (ADR-053, AC-R5).
 *
 * Registered only in the worker process, like `NightAuditProcessor`, so the HTTP
 * process serves requests and never consumes jobs. The scheduler is upserted by
 * id on boot, so restarts and several worker replicas converge on ONE schedule
 * rather than stacking duplicate sweeps against a third party.
 */
@Processor(QUEUES.registrationTinRecheck)
export class RegistrationTinRecheckProcessor
  extends WorkerHost
  implements OnModuleInit
{
  private readonly logger = new Logger(RegistrationTinRecheckProcessor.name);

  constructor(
    @InjectQueue(QUEUES.registrationTinRecheck) private readonly queue: Queue,
    private readonly registrations: RegistrationService,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    await this.queue.upsertJobScheduler(
      RECHECK_PENDING_TINS,
      { every: SWEEP_EVERY_MS },
      { name: RECHECK_PENDING_TINS },
    );
    this.logger.log(
      `Scheduled ${RECHECK_PENDING_TINS} every ${SWEEP_EVERY_MS / 1000}s`,
    );
  }

  async process(job: Job): Promise<void> {
    if (job.name !== RECHECK_PENDING_TINS) {
      this.logger.warn(
        `Ignoring unknown job "${job.name}" on ${QUEUES.registrationTinRecheck}`,
      );
      return;
    }
    const outcome = await this.registrations.recheckPendingTins();
    if (outcome.due > 0 || outcome.stalled > 0) {
      this.logger.log(
        `TIN recheck: ${outcome.rechecked}/${outcome.due} due rechecked, ${outcome.stalled} stalled at the ceiling`,
      );
    }
  }
}
