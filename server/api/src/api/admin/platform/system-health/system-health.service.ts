import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { sql } from 'drizzle-orm';
import { AdminSystemHealth } from '@injishi/contracts';

import {
  DRIZZLE,
  type Database,
} from '../../../../shared/database/database.module';
import { PlatformHealthSnapshotService } from '../health-snapshots.service';

/**
 * Where drizzle-kit records what it has applied. `scripts/migrate.mjs` uses
 * `drizzle-orm/node-postgres/migrator`, which writes `drizzle.__drizzle_migrations`
 * — schema-qualified, because it is not in the public search path.
 */
const MIGRATIONS_TABLE = 'drizzle.__drizzle_migrations';

interface DatabaseHealth {
  reachable: boolean;
  migrationsApplied: number | null;
  latencyMs: number | null;
}

/**
 * `GET /api/v1/admin/system-health` (INTERFACE.md §9).
 *
 * **This screen must render when the thing it monitors is broken.** That is
 * not a nicety: a console that 500s because the database is down tells an
 * on-call engineer nothing except that the console is also down, and the one
 * moment anybody opens System health is the moment something is wrong. So every
 * read below is individually survivable — a failed snapshot query answers `[]`,
 * an unreachable database answers `reachable: false`, and the process block
 * needs no I/O at all and therefore always answers.
 *
 * It does NOT duplicate `GET /api/v1/health`. That probe is unauthenticated and
 * says one thing — the process is up — because a load balancer is asking and a
 * load balancer must not be told about the database. This route is behind
 * `StaffGuard` and answers the follow-up questions: which adapters reported,
 * how deep the queues are, and whether the database answers a query rather than
 * merely holding a configuration that looks fine.
 */
@Injectable()
export class AdminSystemHealthService {
  private readonly logger = new Logger(AdminSystemHealthService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly snapshots: PlatformHealthSnapshotService,
    private readonly config: ConfigService,
  ) {}

  async read(): Promise<AdminSystemHealth> {
    const [adapters, queues, database] = await Promise.all([
      this.survivable('adapter health snapshots', () =>
        this.snapshots.adapters(),
      ),
      this.survivable('queue health snapshots', () => this.snapshots.queues()),
      this.probeDatabase(),
    ]);

    return AdminSystemHealth.parse({
      adapters: adapters ?? [],
      queues: queues ?? [],
      database,
      process: {
        nodeVersion: process.version,
        // Rounded, because a health screen showing 41283.7183 seconds is
        // reporting precision it does not have a use for.
        uptimeSeconds: Math.round(process.uptime()),
        environment: this.config.get<string>('NODE_ENV') ?? 'development',
      },
    });
  }

  /**
   * Is the database actually answering, and how fast?
   *
   * `select 1` rather than reading a table: it proves a connection can be
   * checked out of the pool and a statement round-tripped, without depending on
   * any schema being present. `latencyMs` is that round trip — it includes
   * waiting for a pool slot, which is the right thing to measure, because a
   * pool with every connection held by a stalled query IS a database the
   * platform cannot reach even though the server is fine.
   *
   * Returns rather than throws. The contract's own comment says why
   * `migrationsApplied` is nullable: it is unanswerable when the database is
   * unreachable, and a 0 would read as "no migration has ever run".
   */
  private async probeDatabase(): Promise<DatabaseHealth> {
    const startedAt = Date.now();
    try {
      await this.db.execute(sql`select 1`);
      const latencyMs = Date.now() - startedAt;
      return {
        reachable: true,
        migrationsApplied: await this.countMigrations(),
        latencyMs,
      };
    } catch (error) {
      this.logger.warn(
        `Database probe failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return { reachable: false, migrationsApplied: null, latencyMs: null };
    }
  }

  /**
   * How many migrations the connected database has applied.
   *
   * Its own try/catch, separate from the probe above, because the two failures
   * mean different things: an unreachable database is an incident, while a
   * missing `drizzle` schema means this database was never migrated — a
   * REACHABLE database with nothing in it. Collapsing them would report an
   * un-migrated database as unreachable and send somebody to look at the
   * network.
   */
  private async countMigrations(): Promise<number | null> {
    try {
      const result = await this.db.execute<{ n: number }>(
        sql`select count(*)::int as n from ${sql.raw(MIGRATIONS_TABLE)}`,
      );
      const [row] = result.rows;
      return row === undefined ? null : Number(row.n);
    } catch (error) {
      this.logger.warn(
        `Could not read ${MIGRATIONS_TABLE}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  /**
   * Run a read, and answer `null` instead of throwing if it fails.
   *
   * The failure is LOGGED rather than swallowed. A silent catch here would turn
   * a broken snapshot query into a permanently empty adapter table that looks
   * exactly like a platform where nothing has reported yet, and nobody would
   * ever find out which it was.
   */
  private async survivable<T>(
    what: string,
    read: () => Promise<T>,
  ): Promise<T | null> {
    try {
      return await read();
    } catch (error) {
      this.logger.warn(
        `System health could not read ${what}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }
}
