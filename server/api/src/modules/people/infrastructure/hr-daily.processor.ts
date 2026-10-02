import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { Job, Queue } from 'bullmq';

import { QUEUES } from '../../../shared/queues/queues.module';
import { HrDailyService } from '../application/hr-daily.service';

export const HR_DAILY = 'hr-daily';

/**
 * The HR daily job (ADR-058, "Configuration required").
 *
 * At 00:15 in Kigali, so "today" is the day the business lives in whatever
 * timezone the worker runs in. Worker only, like every sweep beside it: the
 * HTTP process never moves a contract as a side effect of serving a request.
 */
@Processor(QUEUES.hrDaily)
export class HrDailyProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(HrDailyProcessor.name);

  constructor(
    @InjectQueue(QUEUES.hrDaily) private readonly queue: Queue,
    private readonly daily: HrDailyService,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    await this.queue.upsertJobScheduler(
      HR_DAILY,
      { pattern: '15 0 * * *', tz: 'Africa/Kigali' },
      { name: HR_DAILY },
    );
    this.logger.log(`Scheduled ${HR_DAILY} daily at 00:15 Africa/Kigali`);
  }

  async process(job: Job): Promise<void> {
    if (job.name !== HR_DAILY) {
      this.logger.warn(`Ignoring unknown job "${job.name}" on ${QUEUES.hrDaily}`);
      return;
    }
    const outcome = await this.daily.run();
    this.logger.log(
      `HR daily: ${outcome.ended} contract(s) ended, ${outcome.started} started, ${outcome.accrued} accrual row(s), ${outcome.skippedOrgs} business(es) skipped`,
    );
  }
}
