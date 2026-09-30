import type { PlatformEnvironment } from '@injishi/auth';

import { isProduction } from './security.config';

export type { PlatformEnvironment };

/**
 * Which platform this API process is, decided once at boot (ADR-043).
 *
 * A process has exactly ONE environment. It used to serve production and demo
 * at once and choose per request from the `Host` header, which meant one process
 * held a second database pool, a second auth instance, a queue router and a
 * second bucket, and a mistake in any of them reached production. The demo is
 * now its own stack, so the only question left is which one THIS process is.
 *
 * Two inputs answer it, and they must agree:
 *
 * - `INJISHI_ENVIRONMENT`, pinned in each deploy compose file. Unset means
 *   `production` under `NODE_ENV=production` and `demo` otherwise, so a laptop
 *   is the demo by default.
 * - The `database_identity` marker. No row means real data. A `sample` row can
 *   only be written while `users` is empty (migration 0030), so a database that
 *   ever held a real account can never carry it.
 *
 * The fixed sign in code exists only in a `demo` process, and a `demo` process
 * refuses to boot without the marker. So the code can only ever be issued over a
 * database that was empty when it was marked, whatever an env file says.
 *
 * This file is the only reader of `INJISHI_ENVIRONMENT` and
 * `INJISHI_DATABASE_KIND`. Everything else injects `PLATFORM`.
 */
export interface Platform {
  readonly environment: PlatformEnvironment;
  /** The database carries the `sample` marker. */
  readonly sampleData: boolean;
  /**
   * The git commit this process was BUILT from (`INJISHI_COMMIT`, stamped on
   * the image by the compose files), or null when nothing said.
   *
   * Read here rather than wherever it is reported, because it is a fact about
   * the process and this file is where a process's facts are decided — once, at
   * boot. It changes no behaviour; it is what makes "this deploy is running
   * that commit" a question anybody can ask instead of a claim nobody can
   * check.
   */
  readonly commit: string | null;
}

/** DI token for this process's `Platform`, provided by `DatabaseModule`. */
export const PLATFORM = Symbol('PLATFORM');

/** What a database is: `real` has no marker row, `sample` has one. */
export type DatabaseKind = 'real' | 'sample';

/** The variables the boot check reads. Every key is optional; see each rule. */
export interface PlatformEnv {
  INJISHI_ENVIRONMENT?: string;
  INJISHI_DATABASE_KIND?: string;
  INJISHI_COMMIT?: string;
  NODE_ENV?: string;
  PAYMENT_ADAPTER_MODE?: string;
  VSDC_ADAPTER_MODE?: string;
}

/**
 * A boot the platform check refuses. Its message names the fix, and it is
 * thrown from a provider factory, so Nest fails the bootstrap and `main.ts`
 * exits 1 before anything listens or consumes a queue.
 */
export class PlatformBootRefusal extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlatformBootRefusal';
  }
}

/** `INJISHI_ENVIRONMENT`, read once. An unreadable value refuses, never defaults. */
export function processEnvironment(env: PlatformEnv): PlatformEnvironment {
  const raw = (env.INJISHI_ENVIRONMENT ?? '').trim().toLowerCase();
  if (raw === '') return isProduction(env.NODE_ENV) ? 'production' : 'demo';
  if (raw === 'production' || raw === 'demo') return raw;
  throw new PlatformBootRefusal(
    `INJISHI_ENVIRONMENT must be "production" or "demo", got "${env.INJISHI_ENVIRONMENT}".`,
  );
}

/** `INJISHI_DATABASE_KIND`: what the database must be, or null when unset. */
export function expectedDatabaseKind(env: PlatformEnv): DatabaseKind | null {
  const raw = (env.INJISHI_DATABASE_KIND ?? '').trim().toLowerCase();
  if (raw === '') return null;
  if (raw === 'real' || raw === 'sample') return raw;
  throw new PlatformBootRefusal(
    `INJISHI_DATABASE_KIND must be "real" or "sample", got "${env.INJISHI_DATABASE_KIND}".`,
  );
}

/**
 * `INJISHI_COMMIT`, read once. Unset, blank or unreadable means null.
 *
 * A build stamps it; a working tree usually does not, and that is not an error
 * — an API you started yourself is one whose code you are holding. It NEVER
 * refuses a boot: a deploy that dies over a label it only reports would be a
 * worse outcome than one that cannot name itself. Anything that is not a git
 * sha is dropped rather than echoed, because a field a client may render must
 * not carry whatever a stray variable happened to hold.
 */
export function processCommit(env: PlatformEnv): string | null {
  const raw = (env.INJISHI_COMMIT ?? '').trim().toLowerCase();
  return /^[0-9a-f]{7,40}$/.test(raw) ? raw : null;
}

/** An adapter mode is live exactly as its owning module reads it. */
function isLive(mode: string | undefined): boolean {
  return (mode ?? '').trim().toLowerCase() === 'live';
}

export interface PlatformInputs {
  environment: PlatformEnvironment;
  expectedKind: DatabaseKind | null;
  /** What the marker says, from `readDatabaseKind`. */
  marker: DatabaseKind;
  /** The build's commit, from `processCommit`. Reported, never enforced. */
  commit?: string | null;
  paymentAdapterMode?: string;
  vsdcAdapterMode?: string;
}

/**
 * The boot table in ADR-043 § The boot check, as one function.
 *
 * | Process      | Marker | INJISHI_DATABASE_KIND | Result                     |
 * |--------------|--------|-----------------------|----------------------------|
 * | `demo`       | none   | any                   | refuse, names the rebuild  |
 * | any          | any    | set, disagrees        | refuse, names both values  |
 * | `demo`       | sample | unset or `sample`     | run                        |
 * | `production` | any    | unset                 | run (local development)    |
 * | `production` | none   | `real`                | run (production)           |
 * | `production` | sample | `sample`              | run (staging)              |
 *
 * A `demo` process also refuses live payments or live EBM (AC-13): the demo is
 * public and signs anyone in with a published code, so a live adapter there
 * would take real money or certify sales with RRA for strangers.
 */
export function resolvePlatform(input: PlatformInputs): Platform {
  const { environment, expectedKind, marker } = input;

  if (environment === 'demo' && marker !== 'sample') {
    throw new PlatformBootRefusal(
      'This API process is the demo (INJISHI_ENVIRONMENT=demo, or unset outside ' +
        'production), and a demo process needs a sample database. This database ' +
        'carries no sample marker.\n' +
        '  Locally: run `pnpm dev:stack:reset` to rebuild it as a sample database,\n' +
        '  or set INJISHI_ENVIRONMENT=production to run against it as it is.\n' +
        '  On a server: rebuild the demo (infra/docker/DOKPLOY.md).',
    );
  }

  if (expectedKind !== null && expectedKind !== marker) {
    throw new PlatformBootRefusal(
      `INJISHI_DATABASE_KIND is "${expectedKind}" but the database is "${marker}" ` +
        `(${marker === 'sample' ? 'it carries the' : 'it has no'} database_identity marker). ` +
        'The compose file says which database this stack must run on; this is not it.',
    );
  }

  /*
   * No imaginary money on a real database (booking audit, 2026-09-13).
   *
   * `PAYMENT_ADAPTER_MODE` unset means mock. The production compose file
   * declared `INJISHI_DATABASE_KIND=real` and no payment mode, so production
   * would have booked real guests against a mock provider: a confirmed stay,
   * an escrow row reading `captured`, and no money anywhere. A stack that says
   * its database is real must say how it takes money: `live`, or `off` until a
   * provider exists. Local development leaves the kind unset and is unaffected.
   */
  if (expectedKind === 'real') {
    const payment = (input.paymentAdapterMode ?? '').trim().toLowerCase();
    if (payment !== 'live' && payment !== 'off') {
      throw new PlatformBootRefusal(
        `INJISHI_DATABASE_KIND is "real" but PAYMENT_ADAPTER_MODE is ` +
          `${payment === '' ? 'unset (which means mock)' : `"${payment}"`}. A real database ` +
          'must never record mock payments as captured money. Set PAYMENT_ADAPTER_MODE=off ' +
          'until a live payment adapter is registered, or live once one is.',
      );
    }
  }

  if (environment === 'demo') {
    const live = [
      isLive(input.paymentAdapterMode) ? 'PAYMENT_ADAPTER_MODE=live' : null,
      isLive(input.vsdcAdapterMode) ? 'VSDC_ADAPTER_MODE=live' : null,
    ].filter((v): v is string => v !== null);
    if (live.length > 0) {
      throw new PlatformBootRefusal(
        `A demo process cannot run ${live.join(' or ')}. The demo signs anyone ` +
          'in with a published code, so a live adapter there would take real ' +
          'money or certify sales with RRA. Set the mode to mock.',
      );
    }
  }

  return {
    environment,
    sampleData: marker === 'sample',
    commit: input.commit ?? null,
  };
}

/** The part of a `pg` pool or client the marker read needs. */
export interface Queryable {
  query(text: string): Promise<{ rows: Array<Record<string, unknown>> }>;
}

/** Postgres `undefined_table`. */
const UNDEFINED_TABLE = '42P01';

/**
 * Read the marker. No row means real.
 *
 * Only an EMPTY read is an answer. A connection or query error is not "no
 * marker": it fails the boot with the database's own error (AC-11), because
 * reading a failure as "real" would let a demo process decide it is on a real
 * database, and reading it as "sample" would do the reverse.
 */
export async function readDatabaseKind(db: Queryable): Promise<DatabaseKind> {
  let rows: Array<Record<string, unknown>>;
  try {
    ({ rows } = await db.query('select kind from database_identity limit 1'));
  } catch (error) {
    if ((error as { code?: string }).code === UNDEFINED_TABLE) {
      // Still the database's own message, with the one step that fixes it.
      throw new Error(
        `${(error as Error).message}. This database predates migration 0030; ` +
          'apply the migrations first (`pnpm --filter @injishi/api db:migrate`).',
        { cause: error },
      );
    }
    throw error;
  }
  return rows[0]?.kind === 'sample' ? 'sample' : 'real';
}

/** The whole boot check: read the variables, read the marker, apply the table. */
export async function bootPlatform(
  db: Queryable,
  env: PlatformEnv,
): Promise<Platform> {
  const environment = processEnvironment(env);
  const expectedKind = expectedDatabaseKind(env);
  const marker = await readDatabaseKind(db);
  return resolvePlatform({
    environment,
    expectedKind,
    marker,
    commit: processCommit(env),
    paymentAdapterMode: env.PAYMENT_ADAPTER_MODE,
    vsdcAdapterMode: env.VSDC_ADAPTER_MODE,
  });
}
