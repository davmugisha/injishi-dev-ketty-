import * as Sentry from '@sentry/node';
import { redactText } from '@injishi/contracts';

import { expectedDatabaseKind, processCommit, processEnvironment, type PlatformEnv } from '../config/platform';

/**
 * WHERE A FAILURE WAKES A HUMAN UP (booking audit, 2026-09-13; ADR-063).
 *
 * The API's loudest failures were log lines: `STUCK MONEY` when a compensating
 * refund failed, `UNRECORDED COMPENSATION` when the table that says money must
 * move refused the row, and a warning when the queue refused to wake the
 * worker. A log line nobody is tailing wakes nobody. This is the one seam that
 * reports to Sentry, and since ADR-063 it reports what breaks as well as what
 * costs money: a request that fails with a 500, a fault inside Better Auth's
 * routes, a worker job failing its last attempt, and a process that dies.
 *
 * WHO REPORTS. Started once, at boot, by `instrument.ts`, in both the HTTP and
 * the worker process. Inert without `SENTRY_DSN`, and inert unless this is the
 * production stack over its real database or the demo stack over its sample
 * one. Staging (production over a sample database) and a laptop (neither
 * pinned) never report, even if a DSN reaches them.
 *
 * WHAT GOES. No request, header, body, query string, user, breadcrumb or job
 * data. A message and an exception's text pass `redactText`, the one
 * definition of personal data in free text, shared with the phone. The four
 * money alarms are untouched: their context, tag, fingerprint and message are
 * the only thread to the provider's record.
 *
 * A module-level reporter rather than an injected provider, on purpose: Sentry
 * itself is process-global, both processes must report, and a provider would
 * have to be threaded through every module and spec that builds these
 * services by hand.
 */

/** The alarms this platform raises. Each is money, or the thing that moves it. */
export type Alarm =
  /** A capture could not be refunded; the refund is queued and a person must confirm it. */
  | 'STUCK_MONEY'
  /** The compensation row itself could not be written: the replay is manual. */
  | 'UNRECORDED_COMPENSATION'
  /** The queue refused a compensation's wake-up; the drain will retry. */
  | 'QUEUE_WAKE_REFUSED'
  /** A payment hold never recorded a provider reference. */
  | 'UNRESOLVED_HOLD'
  /** The bank reversed a payment it had reported successful (073-gtbank-payments AC-18). */
  | 'PAYMENT_REVERSED'
  /** A disbursement waits because Hangaa's account cannot cover it (073 AC-14a). */
  | 'TREASURY_SHORT'
  /** A payment may have reached the bank and nothing knows its outcome (073 AC-7, AC-27). */
  | 'PAYMENT_PARKED'
  /** The daily comparison with the bank's report found a difference (073 AC-22). */
  | 'RECONCILIATION_DISCREPANCY'
  /** A guest checked out and the stay's escrow could not be released to the host (0116). */
  | 'STAY_COMPLETION_FAILED'
  /** Credit a desk change left on the bill was not refunded at check out (0120): a person must pay it. */
  | 'CHANGE_CREDIT_REFUND_FAILED';

/** Where an HTTP fault happened. `route` is the pattern, never the path. */
export interface HttpFacts {
  method: string;
  route: string;
  status: number;
}

/** Which worker job failed for the last time. Never its data or id. */
export interface JobFacts {
  queue: string;
  job: string;
  attemptsMade: number;
}

export interface ErrorReporter {
  /** Whether reports leave the process. */
  readonly enabled: boolean;
  alarm(alarm: Alarm, message: string, context?: Record<string, unknown>, error?: unknown): void;
  /** One event for a fault; `suppressed` is how many like it the cap held back. */
  exception(error: unknown, facts: HttpFacts | JobFacts, suppressed: number): void;
}

/** Reports nothing. What a process without `SENTRY_DSN` runs. */
export const INERT_REPORTER: ErrorReporter = {
  enabled: false,
  alarm: () => undefined,
  exception: () => undefined,
};

/**
 * The environment this process reports under, or null when it must not
 * report. Production only over its real database, so staging can never
 * report; demo only with its sample database pinned, so a laptop (which reads
 * as demo when nothing is pinned) never does. An unreadable value is null:
 * a refused boot is `bootPlatform`'s job, not this one's.
 */
export function reportingEnvironment(env: PlatformEnv): 'production' | 'demo' | null {
  try {
    const environment = processEnvironment(env);
    const kind = expectedDatabaseKind(env);
    if (environment === 'production' && kind === 'real') return 'production';
    if (environment === 'demo' && kind === 'sample') return 'demo';
    return null;
  } catch {
    return null;
  }
}

/** Contexts an API event may keep. Everything else (device, culture, trace) goes. */
const KEPT_CONTEXTS = ['alarm', 'runtime', 'os'];

/**
 * The last thing an event passes through before it leaves the process.
 * Exported for the tests; Sentry reaches it through `beforeSend`.
 */
export function apiBeforeSend(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  delete event.request;
  delete event.user;
  delete event.breadcrumbs;
  if (event.contexts) {
    for (const name of Object.keys(event.contexts)) {
      if (!KEPT_CONTEXTS.includes(name)) delete event.contexts[name];
    }
  }
  // Free text only. `contexts.alarm`, `tags.alarm` and `extra.message` are a
  // money alarm's keys and references, and are never rewritten.
  if (typeof event.message === 'string') event.message = redactText(event.message);
  // Every entry in the cause chain: the linked errors integration adds a
  // `cause` as its own entry, so a Drizzle error's text may be the last.
  for (const value of event.exception?.values ?? []) {
    if (typeof value.value === 'string') value.value = redactText(value.value);
  }
  return event;
}

/** The `Sentry.init` options (ADR-063, "API init options"). */
export function apiSentryOptions({
  dsn,
  environment,
  release,
}: {
  dsn: string;
  environment: 'production' | 'demo';
  release: string | null;
}): Sentry.NodeOptions {
  return {
    dsn,
    environment,
    // The commit the image was built from; no deploy step sets anything else.
    ...(release ? { release } : {}),
    // No `tracesSampleRate` and no `tracesSampler`: even a rate of 0 installs
    // tracing. And no request ever gains a header.
    tracePropagationTargets: [],
    sendDefaultPii: false,
    includeLocalVariables: false,
    maxBreadcrumbs: 0,
    includeServerName: false,
    // The defaults minus RequestData, which would attach the request. The
    // rejection handler is strict: report, then exit, as Node does today.
    integrations: (defaults) => [
      ...defaults.filter(
        (integration) => integration.name !== 'RequestData' && integration.name !== 'OnUnhandledRejection',
      ),
      Sentry.onUnhandledRejectionIntegration({ mode: 'strict' }),
    ],
    beforeSend: apiBeforeSend,
  };
}

/**
 * The Sentry reporter, or the inert one when this process must not report.
 * The SDK is initialised here and only here. `testOptions` is for tests: a
 * recording transport, and the process handlers left out of a test worker.
 */
export function createErrorReporter(
  env: NodeJS.ProcessEnv = process.env,
  testOptions: Partial<Sentry.NodeOptions> = {},
): ErrorReporter {
  const dsn = (env.SENTRY_DSN ?? '').trim();
  if (!dsn) return INERT_REPORTER;
  // The three variables the platform check reads, passed the way
  // `database.module.ts` passes them: `platform.ts` stays their only reader.
  const platform: PlatformEnv = {
    INJISHI_ENVIRONMENT: env.INJISHI_ENVIRONMENT,
    INJISHI_DATABASE_KIND: env.INJISHI_DATABASE_KIND,
    INJISHI_COMMIT: env.INJISHI_COMMIT,
    NODE_ENV: env.NODE_ENV,
  };
  const environment = reportingEnvironment(platform);
  if (!environment) return INERT_REPORTER;

  Sentry.init({ ...apiSentryOptions({ dsn, environment, release: processCommit(platform) }), ...testOptions });

  return {
    enabled: true,
    alarm(alarm, message, context = {}, error) {
      Sentry.withScope((scope) => {
        scope.setLevel(alarm === 'QUEUE_WAKE_REFUSED' ? 'warning' : 'fatal');
        scope.setTag('alarm', alarm);
        scope.setContext('alarm', context);
        // Grouped by alarm, not by message: every STUCK MONEY is one issue with
        // many events, and each event carries its own keys in the context.
        scope.setFingerprint(['alarm', alarm]);
        if (error instanceof Error) {
          scope.setExtra('message', message);
          Sentry.captureException(error);
        } else {
          Sentry.captureMessage(`${alarm}: ${message}`);
        }
      });
    },
    exception(error, facts, suppressed) {
      Sentry.withScope((scope) => {
        if ('route' in facts) {
          scope.setTransactionName(`${facts.method} ${facts.route}`);
          scope.setTag('http.method', facts.method);
          scope.setTag('http.route', facts.route);
          scope.setTag('http.status_code', String(facts.status));
        } else {
          scope.setTag('queue', facts.queue);
          scope.setTag('job', facts.job);
        }
        if (suppressed > 0) scope.setTag('suppressed', String(suppressed));
        Sentry.captureException(error);
      });
    },
  };
}

let reporter: ErrorReporter | null = null;

/**
 * Install the process reporter, once, at boot (`instrument.ts`). Both
 * processes call it before anything else loads, so a fault while a module
 * loads is reported. Never throws.
 */
export function initErrorReporter(env: NodeJS.ProcessEnv = process.env): ErrorReporter {
  try {
    reporter ??= createErrorReporter(env);
  } catch {
    reporter = INERT_REPORTER;
  }
  return reporter;
}

/** Raise an alarm. Never throws, and is never capped: a reporter failure must not fail the money path. */
export function reportAlarm(
  alarm: Alarm,
  message: string,
  context?: Record<string, unknown>,
  error?: unknown,
): void {
  try {
    // The lazy start is a fallback for tests; a process has already called
    // `initErrorReporter` at boot.
    reporter ??= createErrorReporter();
    reporter.alarm(alarm, message, context, error);
  } catch {
    // The log line at the call site is still the record.
  }
}

/** One event per key per window per process (AC-12). */
export const EXCEPTION_WINDOW_MS = 5 * 60 * 1000;

const recent = new Map<string, { sentAt: number; suppressed: number }>();

function capKey(error: unknown, facts: HttpFacts | JobFacts): string {
  const kind = error instanceof Error ? error.constructor.name : typeof error;
  return 'route' in facts ? `${facts.method} ${facts.route} ${kind}` : `${facts.queue} ${facts.job} ${kind}`;
}

/**
 * Report a fault: a request that failed with a 500, a Better Auth fault, a job
 * on its last attempt. Capped at one event per key (where it happened, and the
 * error's class) per five minutes; the next event for that key carries a
 * `suppressed` tag with how many were held back. Never throws.
 */
export function reportException(error: unknown, facts: HttpFacts | JobFacts): void {
  try {
    reporter ??= createErrorReporter();
    if (!reporter.enabled) return;
    const key = capKey(error, facts);
    const now = Date.now();
    const last = recent.get(key);
    if (last && now - last.sentAt < EXCEPTION_WINDOW_MS) {
      last.suppressed += 1;
      return;
    }
    reporter.exception(error, facts, last?.suppressed ?? 0);
    recent.set(key, { sentAt: now, suppressed: 0 });
  } catch {
    // A reporter failure never changes a response or a job's outcome.
  }
}

/** For tests: swap the process reporter, or pass null to rebuild it from the environment. */
export function setErrorReporter(next: ErrorReporter | null): void {
  reporter = next;
  recent.clear();
}
