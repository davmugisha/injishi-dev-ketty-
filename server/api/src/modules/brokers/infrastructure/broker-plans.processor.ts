import { InjectQueue, OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { Job, Queue } from 'bullmq';

import { reportJobFailure } from '../../../shared/observability/report-job-failure';
import { QUEUES } from '../../../shared/queues/queues.module';
import { BrokerPayoutsService } from '../application/broker-payouts.service';
import { BrokerPlansService } from '../application/broker-plans.service';

/** The single job name this processor handles on the BrokerPlans queue. */
export const BROKER_PLANS_JOB = 'broker-plans';

const EVERY_MS = 60 * 60_000;

/**
 * The BrokerPlans queue (blueprint 2.6), in the worker process only, hourly:
 * settle plan payments the gateway settled, renew plans at their month's end,
 * give a failed renewal three days' grace and then put the broker back on
 * District, apply a cheaper plan chosen for next month, and send brokers their
 * share of hotel commissions (0127). Every part is
 * idempotent, so a repeat or an overlap changes nothing twice.
 */
@Processor(QUEUES.brokerPlans)
export class BrokerPlansProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(BrokerPlansProcessor.name);

  constructor(
    @InjectQueue(QUEUES.brokerPlans) private readonly queue: Queue,
    private readonly plans: BrokerPlansService,
    private readonly payouts: BrokerPayoutsService,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    await this.queue.upsertJobScheduler(BROKER_PLANS_JOB, { every: EVERY_MS }, { name: BROKER_PLANS_JOB });
    this.logger.log(`Scheduled ${BROKER_PLANS_JOB} every ${EVERY_MS / 60_000}m`);
  }

  async process(job: Job): Promise<void> {
    if (job.name !== BROKER_PLANS_JOB) {
      this.logger.warn(`Ignoring unknown job "${job.name}" on ${QUEUES.brokerPlans}`);
      return;
    }
    await this.plans.sweep();
    // Hotel commissions (0127): bulk sums of finished groups, and brokers' shares to their MoMo numbers.
    await this.payouts.sweep();
  }

  /** A job failing its last attempt is reported (ADR-063 AC-12). Earlier attempts are retries. */
  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, error: Error): void {
    reportJobFailure(QUEUES.brokerPlans, job, error);
  }
}
