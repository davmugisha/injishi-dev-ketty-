// `@injishi/auth` is ESM and outside what ts-jest transforms, so `createAuth`
// is a recorder here, as in `auth-registry.spec.ts`: this spec reads the
// `onServerError` callback the registry hands Better Auth and calls it.
jest.mock('@injishi/auth', () => ({
  DEMO_OTP_CODE: '123456',
  DEMO_COOKIE_PREFIX: 'injishi-demo',
  createAuth: (config: unknown) => ({ config }),
}));

import {
  Controller,
  Get,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
  VersioningType,
} from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import * as Sentry from '@sentry/node';
import type { Job } from 'bullmq';
import { DrizzleQueryError } from 'drizzle-orm';

import { createAuthRegistry } from '../../modules/auth/auth.module';
import type { Platform } from '../config/platform';
import type { Database } from '../database/database.module';
import {
  EXCEPTION_WINDOW_MS,
  apiSentryOptions,
  createErrorReporter,
  reportAlarm,
  reportException,
  reportingEnvironment,
  setErrorReporter,
  type ErrorReporter,
} from './error-reporter';
import { reportJobFailure } from './report-job-failure';
import { ReportingExceptionFilter } from './reporting-exception.filter';

/**
 * What the API sends to Sentry, end to end (ADR-063 AC-12), through the real
 * SDK into a transport that records instead of sending.
 *
 * The cases are the spec's critical scenario for the API: a 500 is one event
 * with the route pattern and nothing from the request; an answer is nothing;
 * fifty of the same fault are one event; a database error's personal text is
 * cut; a Better Auth fault and a job's last attempt arrive; a money alarm is
 * untouched; staging starts nothing.
 */

type LightMyRequestResponse = Awaited<ReturnType<NestFastifyApplication['inject']>>;

type Envelope = [Record<string, unknown>, Array<[{ type: string }, unknown]>];

const sent: Sentry.ErrorEvent[] = [];

/**
 * The real SDK, minus what must not run in a jest worker (the process exit
 * handlers) and minus ContextLines: it attaches the source line that threw, and
 * here that line is in this file and spells the very values the leak checks
 * look for. In production it is application source, never runtime data.
 */
const RECORDING: Partial<Sentry.NodeOptions> = {
  transport: () => ({
    send: async (envelope: unknown) => {
      for (const [header, payload] of (envelope as Envelope)[1]) {
        if (header.type === 'event') sent.push(payload as Sentry.ErrorEvent);
      }
      return {};
    },
    flush: async () => true,
  }),
  integrations: (defaults) =>
    defaults.filter(
      (integration) =>
        !['RequestData', 'OnUncaughtException', 'OnUnhandledRejection', 'ContextLines'].includes(integration.name),
    ),
};

const PRODUCTION_ENV = {
  SENTRY_DSN: 'https://public@o0.ingest.de.sentry.io/1',
  INJISHI_ENVIRONMENT: 'production',
  INJISHI_DATABASE_KIND: 'real',
  INJISHI_COMMIT: '5fffa0d',
};

async function flushed(): Promise<Sentry.ErrorEvent[]> {
  await Sentry.flush(2000);
  return sent;
}

function start(env: Record<string, string> = PRODUCTION_ENV): ErrorReporter {
  const reporter = createErrorReporter(env, RECORDING);
  setErrorReporter(reporter);
  return reporter;
}

beforeEach(async () => {
  // Whatever the last case left in flight lands before the slate is cleared.
  await Sentry.flush(2000);
  sent.length = 0;
  start();
});

afterAll(async () => {
  setErrorReporter(null);
  await Sentry.close();
});

@Controller({ path: 'x', version: '1' })
class FaultsController {
  @Get(':id')
  fault(): never {
    throw new Error('lease 3f0c2a9e-1b2c-4d5e-8f90-a1b2c3d4e5f6 failed for jane@x.rw');
  }

  @Get(':id/internal')
  internal(): never {
    throw new InternalServerErrorException('bookings ledger refused the row');
  }

  @Get(':id/missing')
  missing(): never {
    throw new NotFoundException();
  }

  @Get(':id/refused')
  refused(): never {
    throw new UnprocessableEntityException('Jane Mukamana is not a member of Kimihurura cell');
  }

  @Get(':id/unavailable')
  unavailable(): never {
    throw new ServiceUnavailableException('payments are paused');
  }

  @Get(':id/database')
  database(): never {
    throw new DrizzleQueryError(
      'select * from leases where tenant_name = $1',
      ['Jane Mukamana', 'jane@x.rw'],
      new Error('invalid input syntax for type uuid: "Jane Mukamana"'),
    );
  }
}

describe('a request that fails (AC-12)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [FaultsController],
      providers: [{ provide: APP_FILTER, useClass: ReportingExceptionFilter }],
    }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), { logger: false });
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(() => app.close());

  async function get(url: string, headers: Record<string, string> = {}): Promise<LightMyRequestResponse> {
    return app.inject({ method: 'GET', url, headers });
  }

  it('is one event, named by its route pattern, carrying nothing from the request', async () => {
    const response = await get('/api/v1/x/3f0c2a9e-1b2c-4d5e-8f90-a1b2c3d4e5f6?email=jane@x.rw', {
      authorization: 'Bearer s3cr3t',
      cookie: 'better-auth.session_token=abc',
    });
    expect(response.statusCode).toBe(500);

    const events = await flushed();
    expect(events).toHaveLength(1);
    const [event] = events;
    expect(event.transaction).toBe('GET /api/v1/x/:id');
    expect(event.tags).toMatchObject({
      'http.method': 'GET',
      'http.route': '/api/v1/x/:id',
      'http.status_code': '500',
    });
    expect(event.environment).toBe('production');
    expect(event.release).toBe('5fffa0d');
    expect(event.request).toBeUndefined();
    expect(event.user).toBeUndefined();
    expect(event.breadcrumbs).toBeUndefined();
    expect(event.server_name).toBeUndefined();
    expect(Object.keys(event.contexts ?? {}).every((name) => ['runtime', 'os'].includes(name))).toBe(true);
    const serialised = JSON.stringify(event);
    for (const leak of ['jane', 'Bearer s3cr3t', 'session_token', '3f0c2a9e']) {
      expect(serialised).not.toContain(leak);
    }
    expect(event.exception?.values?.at(-1)?.value).toBe('lease :id failed for [email]');
  });

  it('reports an HttpException whose status is exactly 500', async () => {
    await get('/api/v1/x/7/internal');
    expect(await flushed()).toHaveLength(1);
  });

  it('never reports an answer: a 404, a 422, or a deliberate 503', async () => {
    expect((await get('/api/v1/x/7/missing')).statusCode).toBe(404);
    expect((await get('/api/v1/x/7/refused')).statusCode).toBe(422);
    expect((await get('/api/v1/x/7/unavailable')).statusCode).toBe(503);
    expect(await flushed()).toHaveLength(0);
  });

  it('answers exactly as Nest would', async () => {
    const response = await get('/api/v1/x/7');
    expect(response.json()).toEqual({ statusCode: 500, message: 'Internal server error' });
  });

  it('sends one event for fifty of the same fault, and counts the rest on the next', async () => {
    // The cap reads only the clock, so only the clock moves: fake timers would
    // also stall the SDK's own flush.
    const start = Date.now();
    const clock = jest.spyOn(Date, 'now').mockReturnValue(start);
    try {
      for (let i = 0; i < 50; i += 1) await get(`/api/v1/x/${i}`);
      expect(await flushed()).toHaveLength(1);
      clock.mockReturnValue(start + EXCEPTION_WINDOW_MS + 1);
      await get('/api/v1/x/51');
      const events = await flushed();
      expect(events).toHaveLength(2);
      expect(events[1].tags).toMatchObject({ suppressed: '49' });
    } finally {
      clock.mockRestore();
    }
  });

  it("cuts a database error's parameters and the value Postgres quotes", async () => {
    await get('/api/v1/x/7/database');
    const [event] = await flushed();
    const values = event.exception?.values?.map((value) => value.value) ?? [];
    expect(values.join('\n')).toContain('params: [redacted]');
    expect(values.join('\n')).toContain('invalid input syntax for type uuid: "[value]"');
    expect(JSON.stringify(event)).not.toContain('Jane');
  });

  it('names a request no route matched as unmatched', async () => {
    const filter = new ReportingExceptionFilter();
    const host = {
      getType: () => 'http',
      switchToHttp: () => ({ getRequest: () => ({ method: 'POST' }) }),
    };
    // The base filter's answer needs an adapter; only the report is under test.
    jest.spyOn(Object.getPrototypeOf(ReportingExceptionFilter.prototype), 'catch').mockImplementation(() => undefined);
    filter.catch(new Error('no route'), host as never);
    const [event] = await flushed();
    expect(event.transaction).toBe('POST unmatched');
    jest.restoreAllMocks();
  });
});

describe('a fault inside Better Auth (AC-12)', () => {
  it("arrives through the callback the registry hands Better Auth", async () => {
    const production: Platform = { environment: 'production', sampleData: false, commit: null };
    const config = {
      get: <T>(key: string) =>
        ({
          NODE_ENV: 'production',
          BETTER_AUTH_SECRET: 'p'.repeat(40),
          BETTER_AUTH_URL: 'https://api.injishi.com',
          CORS_ORIGINS: 'https://www.injishi.com',
        })[key] as T | undefined,
      getOrThrow: <T>(key: string) => ({ BETTER_AUTH_SECRET: 'p'.repeat(40) })[key] as T,
    };
    const registry = createAuthRegistry(production, {} as Database, config, { send: jest.fn() });
    const requested = (registry.for('marketplace') as unknown as { config: { onServerError: (e: unknown) => void } })
      .config;

    requested.onServerError(new TypeError('sendOtp: SMTP refused the message for jane@x.rw'));
    const [event] = await flushed();
    expect(event.transaction).toBe('* /api/auth/*');
    expect(event.tags).toMatchObject({ 'http.route': '/api/auth/*', 'http.status_code': '500' });
    expect(JSON.stringify(event)).not.toContain('jane@x.rw');
  });
});

describe('a worker job (AC-12)', () => {
  function job(attemptsMade: number, attempts?: number): Job {
    return {
      name: 'booking-confirmed',
      attemptsMade,
      opts: attempts === undefined ? {} : { attempts },
      data: { email: 'jane@x.rw' },
      id: '42',
    } as unknown as Job;
  }

  it('is reported on its last attempt, with the queue and the job name only', async () => {
    reportJobFailure('Email', job(3, 3), new Error('SMTP timeout'));
    const [event] = await flushed();
    expect(event.tags).toMatchObject({ queue: 'Email', job: 'booking-confirmed' });
    const serialised = JSON.stringify(event);
    expect(serialised).not.toContain('jane@x.rw');
    expect(serialised).not.toContain('"42"');
  });

  it('is not reported on an attempt that will be retried', async () => {
    reportJobFailure('Email', job(1, 3), new Error('SMTP timeout'));
    reportJobFailure('Email', undefined, new Error('no job'));
    expect(await flushed()).toHaveLength(0);
  });

  it('treats a job with no attempts set as having one', async () => {
    reportJobFailure('NightAudit', job(1), new Error('audit failed'));
    expect(await flushed()).toHaveLength(1);
  });
});

describe('the money alarms (invariant 8)', () => {
  it('keep their context, tag, fingerprint and message exactly, and are never capped', async () => {
    const context = {
      adapterRef: 'MTN-REF-0788123456',
      amountRwf: 450000,
      captureKey: 'cap_3f0c2a9e',
      refundKey: 'ref_3f0c2a9e',
      workspaceId: '3f0c2a9e-1b2c-4d5e-8f90-a1b2c3d4e5f6',
    };
    for (let i = 0; i < 3; i += 1) {
      reportAlarm('STUCK_MONEY', 'refund failed for capture cap_3f0c2a9e', context, new Error('refund endpoint down'));
    }
    const events = await flushed();
    expect(events).toHaveLength(3);
    const [event] = events;
    expect(event.contexts?.alarm).toEqual(context);
    expect(event.tags).toMatchObject({ alarm: 'STUCK_MONEY' });
    expect(event.fingerprint).toEqual(['alarm', 'STUCK_MONEY']);
    expect(event.extra).toMatchObject({ message: 'refund failed for capture cap_3f0c2a9e' });
    expect(event.level).toBe('fatal');
  });

  it('keep the message of an alarm raised with no error exactly, keys staying in the context', async () => {
    // The wording `payment-attempt.service.ts` raises today. The scrubber runs on
    // `message`, so this pins that no alarm sentence is something it rewrites.
    const context = { idempotencyKey: 'hold_8f2c1d9a4b7e4c3a9d1e6f2b8a7c5d40', workspaceId: 'ws-1', amountRwf: 450000 };
    reportAlarm('UNRESOLVED_HOLD', 'A payment hold never recorded a provider reference.', context);
    const [event] = await flushed();
    expect(event.message).toBe('UNRESOLVED_HOLD: A payment hold never recorded a provider reference.');
    expect(event.contexts?.alarm).toEqual(context);
    expect(event.fingerprint).toEqual(['alarm', 'UNRESOLVED_HOLD']);
  });
});

describe('who reports (AC-12)', () => {
  it.each<[string, Record<string, string>, 'production' | 'demo' | null]>([
    ['production over its real database', { INJISHI_ENVIRONMENT: 'production', INJISHI_DATABASE_KIND: 'real' }, 'production'],
    ['the demo over its sample database', { INJISHI_ENVIRONMENT: 'demo', INJISHI_DATABASE_KIND: 'sample' }, 'demo'],
    ['staging: production over a sample database', { INJISHI_ENVIRONMENT: 'production', INJISHI_DATABASE_KIND: 'sample' }, null],
    ['a laptop, which reads as demo with nothing pinned', { NODE_ENV: 'development' }, null],
    ['a deployed process with no database kind', { NODE_ENV: 'production' }, null],
    ['an unreadable environment', { INJISHI_ENVIRONMENT: 'stagin', INJISHI_DATABASE_KIND: 'real' }, null],
  ])('%s', (_name, env, expected) => {
    expect(reportingEnvironment(env)).toBe(expected);
  });

  it('starts nothing on staging, even with a DSN', async () => {
    const reporter = createErrorReporter(
      { ...PRODUCTION_ENV, INJISHI_DATABASE_KIND: 'sample' },
      RECORDING,
    );
    expect(reporter.enabled).toBe(false);
  });

  it('starts nothing without a DSN', () => {
    expect(createErrorReporter({ ...PRODUCTION_ENV, SENTRY_DSN: ' ' }, RECORDING).enabled).toBe(false);
  });

  it('reports nothing through an inert reporter', async () => {
    setErrorReporter(createErrorReporter({ ...PRODUCTION_ENV, SENTRY_DSN: '' }));
    reportException(new Error('fault'), { method: 'GET', route: '/api/v1/me', status: 500 });
    expect(await flushed()).toHaveLength(0);
  });
});

describe('the init options (AC-12)', () => {
  const options = apiSentryOptions({ dsn: 'https://k@o0/1', environment: 'demo', release: 'abc1234' });

  it('installs no tracing, adds no header, and keeps nothing personal', () => {
    expect(options).not.toHaveProperty('tracesSampleRate');
    expect(options).not.toHaveProperty('tracesSampler');
    expect(options).toMatchObject({
      environment: 'demo',
      release: 'abc1234',
      tracePropagationTargets: [],
      sendDefaultPii: false,
      maxBreadcrumbs: 0,
      includeServerName: false,
      includeLocalVariables: false,
    });
  });

  it('drops RequestData and makes the rejection handler strict', () => {
    const integrations = (options.integrations as (d: Array<{ name: string }>) => Array<{ name: string }>)([
      { name: 'InboundFilters' },
      { name: 'RequestData' },
      { name: 'LinkedErrors' },
      { name: 'OnUncaughtException' },
      { name: 'OnUnhandledRejection' },
    ]);
    const names = integrations.map((integration) => integration.name);
    expect(names).not.toContain('RequestData');
    expect(names).toContain('LinkedErrors');
    expect(names).toContain('OnUncaughtException');
    expect(names.filter((name) => name === 'OnUnhandledRejection')).toHaveLength(1);
  });

  it('omits the release when the build named none', () => {
    expect(apiSentryOptions({ dsn: 'https://k@o0/1', environment: 'demo', release: null })).not.toHaveProperty('release');
  });
});
