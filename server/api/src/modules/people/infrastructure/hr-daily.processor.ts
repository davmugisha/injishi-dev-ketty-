import { InjectQueue, OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { Job, Queue } from 'bullmq';

import { QUEUES } from '../../../shared/queues/queues.module';
import { AttendanceSweepService } from '../application/attendance-sweep.service';
import { HrDailyService } from '../application/hr-daily.service';
import { reportJobFailure } from '../../../shared/observability/report-job-failure';

export const HR_DAILY = 'hr-daily';
/** The attendance sweep (058-time AC-TM4), every 15 minutes on the same queue. */
export const HR_ATTENDANCE_SWEEP = 'hr-attendance-sweep';
const SWEEP_EVERY_MS = 15 * 60_000;

/**
 * The HR daily job (ADR-058, "Configuration required").
 *
 * At 00:15 in Kigali, so "today" is the day the business lives in whatever
 * timezone the worker runs in. Worker only, like every sweep beside it: the
 * HTTP process never moves a contract as a side effect of serving a request.
 *
 * The attendance sweep shares the queue, on its own 15 minute schedule.
 */
@Processor(QUEUES.hrDaily)
export class HrDailyProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(HrDailyProcessor.name);

  constructor(
    @InjectQueue(QUEUES.hrDaily) private readonly queue: Queue,
    private readonly daily: HrDailyService,
    private readonly sweep: AttendanceSweepService,
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
    await this.queue.upsertJobScheduler(HR_ATTENDANCE_SWEEP, { every: SWEEP_EVERY_MS }, { name: HR_ATTENDANCE_SWEEP });
    this.logger.log(`Scheduled ${HR_ATTENDANCE_SWEEP} every ${SWEEP_EVERY_MS / 60_000} minutes`);
  }

  async process(job: Job): Promise<void> {
    if (job.name === HR_ATTENDANCE_SWEEP) {
      const { closed } = await this.sweep.run();
      if (closed > 0) this.logger.log(`Attendance sweep: ${closed} record(s) closed`);
      return;
    }
    if (job.name !== HR_DAILY) {
      this.logger.warn(`Ignoring unknown job "${job.name}" on ${QUEUES.hrDaily}`);
      return;
    }
    const outcome = await this.daily.run();
    this.logger.log(
      `HR daily: ${outcome.ended} contract(s) ended, ${outcome.started} started, ${outcome.accrued} accrual row(s), ${outcome.skippedOrgs} business(es) skipped, ${outcome.reminded} document reminder(s), ${outcome.generated} rotation shift(s), ${outcome.drafted} draft pay run(s)`,
    );
  }

  /** A job failing its last attempt is reported (ADR-063 AC-12). Earlier attempts are retries. */
  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, error: Error): void {
    reportJobFailure(QUEUES.hrDaily, job, error);
  }
}
