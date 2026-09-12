import { Inject, Injectable } from '@nestjs/common';
import { desc } from 'drizzle-orm';
import { AdminAdapterHealth, AdminQueueHealth } from '@injishi/contracts';

import {
  adapterHealthSnapshots,
  queueHealthSnapshots,
} from '../../../database/drizzle/governance';
import {
  DRIZZLE,
  type Database,
} from '../../../shared/database/database.module';

/**
 * The one reader of `adapter_health_snapshots` and `queue_health_snapshots`.
 *
 * THREE sections show this data — Overview, System health and Environments —
 * and all three mean the same thing by "current": the NEWEST row per adapter
 * and per queue. These are append-only snapshot tables, not state tables, so
 * "the adapter's status" is not a column anywhere; it is the last observation.
 * Writing that `DISTINCT ON` three times is how the three screens end up
 * disagreeing — one of them ordering by `id`, or forgetting the partition and
 * showing six copies of the payment adapter.
 *
 * `DISTINCT ON` rather than a `row_number()` subquery because Postgres answers
 * it from the same index scan and the intent reads off the line: one row per
 * adapter, newest first. The `ORDER BY` must lead with the distinct-on column
 * or Postgres refuses the statement, which is the property that makes this hard
 * to get subtly wrong.
 */
@Injectable()
export class PlatformHealthSnapshotService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /**
   * The newest observation for each of the six adapters in `adapter_name`.
   *
   * An adapter that has never been observed produces NO ROW rather than a
   * fabricated "up". A fresh platform therefore answers `[]`, which is a true
   * statement — nothing has reported — where an invented row would tell an
   * operator the payment seam is healthy on the strength of no evidence.
   */
  async adapters(): Promise<AdminAdapterHealth[]> {
    const rows = await this.db
      .selectDistinctOn([adapterHealthSnapshots.adapter], {
        adapter: adapterHealthSnapshots.adapter,
        mode: adapterHealthSnapshots.mode,
        status: adapterHealthSnapshots.status,
        errorRate: adapterHealthSnapshots.errorRate,
        latencyMs: adapterHealthSnapshots.latencyMs,
        observedAt: adapterHealthSnapshots.observedAt,
      })
      .from(adapterHealthSnapshots)
      .orderBy(
        adapterHealthSnapshots.adapter,
        desc(adapterHealthSnapshots.observedAt),
      );

    return AdminAdapterHealth.array().parse(
      rows.map((row) => ({
        adapter: row.adapter,
        mode: row.mode,
        status: row.status,
        // `error_rate` is `numeric`, which node-postgres hands back as a
        // STRING to keep arbitrary precision. Null stays null on purpose: the
        // contract says so, because a 0 here would assert a flawless adapter
        // that was in fact never measured.
        errorRate: row.errorRate === null ? null : Number(row.errorRate),
        latencyMs: row.latencyMs,
        observedAt: row.observedAt.toISOString(),
      })),
    );
  }

  /**
   * The newest observation for each BullMQ queue that has ever reported.
   *
   * The four counters are nullable columns and non-null contract fields, and
   * the gap is closed HERE by coalescing to 0 rather than by widening the
   * contract. The reasoning is the contract's own: a snapshot that measured
   * nothing is not a snapshot — the writer fills all four or writes no row — so
   * a null in one of these columns is a defective row, and reading it as 0 is
   * the least misleading repair. A null crossing the wire would instead make
   * every console arithmetic (a total depth, a failure rate) silently NaN.
   */
  async queues(): Promise<AdminQueueHealth[]> {
    const rows = await this.db
      .selectDistinctOn([queueHealthSnapshots.queue], {
        queue: queueHealthSnapshots.queue,
        depth: queueHealthSnapshots.depth,
        failed: queueHealthSnapshots.failed,
        deadLetter: queueHealthSnapshots.deadLetter,
        throughput: queueHealthSnapshots.throughput,
        observedAt: queueHealthSnapshots.observedAt,
      })
      .from(queueHealthSnapshots)
      .orderBy(
        queueHealthSnapshots.queue,
        desc(queueHealthSnapshots.observedAt),
      );

    return AdminQueueHealth.array().parse(
      rows.map((row) => ({
        queue: row.queue,
        depth: row.depth ?? 0,
        failed: row.failed ?? 0,
        deadLetter: row.deadLetter ?? 0,
        // `throughput` is `numeric` — a string out of the driver, like
        // `error_rate` above.
        throughput: row.throughput === null ? 0 : Number(row.throughput),
        observedAt: row.observedAt.toISOString(),
      })),
    );
  }
}
