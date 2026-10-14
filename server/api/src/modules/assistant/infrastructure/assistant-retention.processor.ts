import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { Job, Queue } from 'bullmq';

import { QUEUES } from '../../../shared/queues/queues.module';
import { AssistantRetentionService } from '../application/retention.service';

export const ASSISTANT_RETENTION_SWEEP = 'assistant-retention-sweep';

/**
 * The assistant's retention sweep (ADR-061 D-d, slice H), on its own queue so
 * a backlog of mail never delays a deletion the privacy promise depends on.
 * Hourly: a conversation is deleted within an hour of its 7 or 90 days, and a
 * stale approval is closed within the hour. Worker only.
 */
@Processor(QUEUES.assistantRetention)
export class AssistantRetentionProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(AssistantRetentionProcessor.name);

  constructor(
    @InjectQueue(QUEUES.assistantRetention) private readonly queue: Queue,
    private readonly retention: AssistantRetentionService,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    await this.queue.upsertJobScheduler(
      ASSISTANT_RETENTION_SWEEP,
      { pattern: '17 * * * *', tz: 'Africa/Kigali' },
      { name: ASSISTANT_RETENTION_SWEEP },
    );
    this.logger.log(`Scheduled ${ASSISTANT_RETENTION_SWEEP} hourly at :17`);
  }

  async process(job: Job): Promise<void> {
    if (job.name !== ASSISTANT_RETENTION_SWEEP) {
      this.logger.warn(`Ignoring unknown job "${job.name}" on ${QUEUES.assistantRetention}`);
      return;
    }
    const outcome = await this.retention.sweep();
    const total =
      outcome.expiredProposals + outcome.closedApprovals + outcome.deletedConversations + outcome.deletedProposals + outcome.anonymisedUsage;
    if (total > 0) {
      this.logger.log(
        `Assistant retention: ${outcome.deletedConversations} conversation(s) and ${outcome.deletedProposals} proposal(s) deleted, ` +
          `${outcome.expiredProposals} proposal(s) expired, ${outcome.closedApprovals} interrupted approval(s) closed, ` +
          `${outcome.anonymisedUsage} usage row(s) no longer name a person`,
      );
    }
  }
}
