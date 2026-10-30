import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger, OnModuleInit } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { lt, sql } from 'drizzle-orm';

import { idempotencyKeys } from '../../database/drizzle/schema';
import { DRIZZLE, type Database } from '../database/database.module';
import { QUEUES } from '../queues/queues.module';
import { IDEMPOTENCY_RETENTION_DAYS } from './idempotency.interceptor';

export const IDEMPOTENCY_SWEEP = 'idempotency-sweep';

/**
 * Deletes stored answers older than `IDEMPOTENCY_RETENTION_DAYS` (mobile spec
 * 0003, D-r). Daily at 03:40 Kigali; a resend that late was refused anyway,
 * because an offline write older than 7 days is `422 reported_time_too_old`.
 * Worker only.
 */
@Processor(QUEUES.idempotencySweep)
export class IdempotencySweepProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(IdempotencySweepProcessor.name);

  constructor(
    @InjectQueue(QUEUES.idempotencySweep) private readonly queue: Queue,
    @Inject(DRIZZLE) private readonly db: Database,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    await this.queue.upsertJobScheduler(
      IDEMPOTENCY_SWEEP,
      { pattern: '40 3 * * *', tz: 'Africa/Kigali' },
      { name: IDEMPOTENCY_SWEEP },
    );
    this.logger.log(`Scheduled ${IDEMPOTENCY_SWEEP} daily at 03:40`);
  }

  async process(job: Job): Promise<void> {
    if (job.name !== IDEMPOTENCY_SWEEP) {
      this.logger.warn(`Ignoring unknown job "${job.name}" on ${QUEUES.idempotencySweep}`);
      return;
    }
    const deleted = await this.sweep();
    if (deleted > 0) this.logger.log(`Idempotency sweep: ${deleted} stored answer(s) deleted`);
  }

  /** The rows past retention, deleted; the count deleted. */
  async sweep(): Promise<number> {
    const rows = await this.db
      .delete(idempotencyKeys)
      .where(lt(idempotencyKeys.createdAt, sql`now() - ${sql.raw(`interval '${IDEMPOTENCY_RETENTION_DAYS} days'`)}`))
      .returning({ key: idempotencyKeys.key });
    return rows.length;
  }
}
