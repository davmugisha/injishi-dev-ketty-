import {
  Global,
  Inject,
  Logger,
  Module,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import * as schema from '../../database/drizzle/schema';
import { bootPlatform, PLATFORM, type Platform } from '../config/platform';

export const DRIZZLE = Symbol('DRIZZLE');
export const PG_POOL = Symbol('PG_POOL');

export type Database = NodePgDatabase<typeof schema>;

const DEV_FALLBACK_URL = 'postgres://injishi:injishi@localhost:5432/injishi';

/**
 * Pool limits (review 2.6).
 *
 * Library defaults are ten connections, no statement timeout and no
 * idle-in-transaction timeout. A request stalled on a hung payment call, or a
 * transaction waiting on a lock, used to hold one of ten forever. Every limit
 * is overridable from the environment; none may be silently absent.
 */
function poolLimits(config: ConfigService): {
  max: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
  statement_timeout: number;
  idle_in_transaction_session_timeout: number;
} {
  const int = (name: string, fallback: number): number => {
    const raw = config.get<string>(name);
    const n = raw === undefined || raw === '' ? NaN : Number(raw);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };
  return {
    max: int('PG_POOL_MAX', 20),
    idleTimeoutMillis: int('PG_IDLE_TIMEOUT_MS', 30_000),
    connectionTimeoutMillis: int('PG_CONNECT_TIMEOUT_MS', 5_000),
    // No query outlives a request; no lock outlives a stalled caller.
    statement_timeout: int('PG_STATEMENT_TIMEOUT_MS', 15_000),
    idle_in_transaction_session_timeout: int('PG_IDLE_TX_TIMEOUT_MS', 10_000),
  };
}

/**
 * Single Drizzle/pg seam for the whole backend. DB access is Drizzle only;
 * inject the DRIZZLE token from a module's infrastructure layer.
 *
 * ONE database per process (ADR-043). The demo is its own stack with its own
 * database, so there is no second pool and nothing here reads a request: the
 * handle is built once, at boot, and every repository shares it.
 *
 * `PLATFORM` is resolved here because it reads the database: the process's
 * environment is only allowed once the `database_identity` marker agrees with
 * it (`shared/config/platform.ts`). `DRIZZLE` depends on `PLATFORM`, so no
 * repository can obtain a database handle in a process that failed that check,
 * and the check runs in the worker exactly as it does in the HTTP process.
 */
@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Pool =>
        new Pool({
          connectionString:
            config.get<string>('DATABASE_URL') ?? DEV_FALLBACK_URL,
          ...poolLimits(config),
        }),
    },
    {
      provide: PLATFORM,
      inject: [PG_POOL, ConfigService],
      useFactory: async (
        pool: Pool,
        config: ConfigService,
      ): Promise<Platform> => {
        const platform = await bootPlatform(pool, {
          INJISHI_ENVIRONMENT: config.get<string>('INJISHI_ENVIRONMENT'),
          INJISHI_DATABASE_KIND: config.get<string>('INJISHI_DATABASE_KIND'),
          INJISHI_COMMIT: config.get<string>('INJISHI_COMMIT'),
          NODE_ENV: config.get<string>('NODE_ENV'),
          PAYMENT_ADAPTER_MODE: config.get<string>('PAYMENT_ADAPTER_MODE'),
          VSDC_ADAPTER_MODE: config.get<string>('VSDC_ADAPTER_MODE'),
        });
        new Logger('Platform').log(
          `Environment ${platform.environment}, ` +
            `${platform.sampleData ? 'sample' : 'real'} database, ` +
            `commit ${platform.commit ?? 'unstamped'}.`,
        );
        return platform;
      },
    },
    {
      provide: DRIZZLE,
      inject: [PG_POOL, PLATFORM],
      useFactory: (pool: Pool): Database => drizzle({ client: pool, schema }),
    },
  ],
  exports: [DRIZZLE, PLATFORM],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
