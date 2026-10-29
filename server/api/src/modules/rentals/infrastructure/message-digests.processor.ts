import { InjectQueue, OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { Job, Queue } from 'bullmq';

import { reportJobFailure } from '../../../shared/observability/report-job-failure';
import { QUEUES } from '../../../shared/queues/queues.module';
import { MessageDigestsService } from '../application/message-digests.service';

/** The single job name this processor handles on the MessageDigests queue. */
export const MESSAGE_DIGESTS_JOB = 'message-digests';

/** Every two minutes: a message left unread for five gets its email within seven. */
const EVERY_MS = 2 * 60_000;

/** The unread-message emails (rentals P3.4), in the worker process only. */
@Processor(QUEUES.messageDigests)
export class MessageDigestsProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(MessageDigestsProcessor.name);

  constructor(
    @InjectQueue(QUEUES.messageDigests) private readonly queue: Queue,
    private readonly digests: MessageDigestsService,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    await this.queue.upsertJobScheduler(MESSAGE_DIGESTS_JOB, { every: EVERY_MS }, { name: MESSAGE_DIGESTS_JOB });
    this.logger.log(`Scheduled ${MESSAGE_DIGESTS_JOB} every ${EVERY_MS / 60_000}m`);
  }

  async process(job: Job): Promise<void> {
    if (job.name !== MESSAGE_DIGESTS_JOB) {
      this.logger.warn(`Ignoring unknown job "${job.name}" on ${QUEUES.messageDigests}`);
      return;
    }
    await this.digests.run();
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, error: Error): void {
    reportJobFailure(QUEUES.messageDigests, job, error);
  }
}
