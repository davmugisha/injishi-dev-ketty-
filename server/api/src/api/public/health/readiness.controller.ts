import { InjectQueue } from '@nestjs/bullmq';
import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { sql } from 'drizzle-orm';

import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { QUEUES } from '../../../shared/queues/queues.module';

/** How long a dependency may take to answer before it counts as down. */
const PROBE_TIMEOUT_MS = 2000;

export interface DependencyCheck {
  ok: boolean;
  /** How long the probe took. */
  ms: number;
  /** Present only when `ok` is false: a fixed word, never an error message (a message can carry a connection string). */
  reason?: 'timeout' | 'unreachable';
}

export interface ReadinessReport {
  status: 'ready' | 'unavailable';
  checks: { database: DependencyCheck; redis: DependencyCheck };
}

async function probe(run: () => Promise<unknown>, timeoutMs = PROBE_TIMEOUT_MS): Promise<DependencyCheck> {
  const started = Date.now();
  let timer: NodeJS.Timeout | undefined;
  try {
    const outcome = await Promise.race([
      run().then(() => 'ok' as const),
      new Promise<'timeout'>((resolve) => {
        timer = setTimeout(() => resolve('timeout'), timeoutMs);
      }),
    ]);
    const ms = Date.now() - started;
    return outcome === 'ok' ? { ok: true, ms } : { ok: false, ms, reason: 'timeout' };
  } catch {
    return { ok: false, ms: Date.now() - started, reason: 'unreachable' };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Readiness, as opposed to liveness (`GET /health`, which answers whenever the process is up and must stay
 * free of dependencies, so an orchestrator never restarts a healthy process because Redis blinked).
 *
 * `GET /health/ready` says whether this instance can actually do its job: the database answers a query and Redis
 * answers a PING on the very connection the queues use. 200 when both do, 503 when either does not, with the same
 * body. It is public and reveals nothing but those two words and two timings.
 */
@Controller('health')
export class ReadinessController {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    @InjectQueue(QUEUES.email) private readonly queue: Queue,
  ) {}

  @Get('ready')
  async ready(): Promise<ReadinessReport> {
    const [database, redis] = await Promise.all([
      probe(() => this.db.execute(sql`select 1`)),
      probe(async () => {
        // BullMQ types its client narrowly, but it is a real Redis client at runtime: a PING proves a round trip.
        const client = (await this.queue.client) as unknown as { ping(): Promise<string> };
        await client.ping();
      }),
    ]);
    const report: ReadinessReport = { status: database.ok && redis.ok ? 'ready' : 'unavailable', checks: { database, redis } };
    if (report.status !== 'ready') throw new ServiceUnavailableException(report);
    return report;
  }
}
