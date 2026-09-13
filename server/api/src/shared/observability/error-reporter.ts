import * as Sentry from '@sentry/node';

/**
 * WHERE A MONEY FAILURE WAKES A HUMAN UP (booking audit, 2026-09-13).
 *
 * The API's loudest failures were log lines: `STUCK MONEY` when a compensating
 * refund failed, `UNRECORDED COMPENSATION` when the table that says money must
 * move refused the row, and a warning when the queue refused to wake the
 * worker. A log line nobody is tailing wakes nobody. `architecture.md` chose
 * Sentry for errors; this is the one seam that reports to it.
 *
 * INERT WITHOUT A DSN. With `SENTRY_DSN` unset (every laptop, CI, and any stack
 * that has not configured it) nothing is initialised and nothing leaves the
 * process; the log lines at each call site are unchanged and still print. So
 * adding a call here can never break a process that has no Sentry.
 *
 * A module-level reporter rather than an injected provider, on purpose: Sentry
 * itself is process-global, both the HTTP process and the worker must report,
 * and a provider would have to be threaded through every module and spec that
 * builds these services by hand.
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
  | 'UNRESOLVED_HOLD';

export interface ErrorReporter {
  /** Whether reports leave the process. */
  readonly enabled: boolean;
  alarm(alarm: Alarm, message: string, context?: Record<string, unknown>, error?: unknown): void;
}

/** Reports nothing. What a process without `SENTRY_DSN` runs. */
export const INERT_REPORTER: ErrorReporter = { enabled: false, alarm: () => undefined };

/**
 * The Sentry reporter, or the inert one when no DSN is set. The SDK is
 * initialised here and only here, and only when there is somewhere to send to.
 */
export function createErrorReporter(env: NodeJS.ProcessEnv = process.env): ErrorReporter {
  const dsn = (env.SENTRY_DSN ?? '').trim();
  if (!dsn) return INERT_REPORTER;

  Sentry.init({
    dsn,
    environment: env.INJISHI_ENVIRONMENT || env.NODE_ENV || 'unknown',
    release: env.SENTRY_RELEASE || undefined,
    // Errors only. Traces and profiles are a separate decision with a cost.
    tracesSampleRate: 0,
    // Money alarms carry keys and references, never a payer's number (the call
    // sites mask those), and no request bodies or cookies are attached.
    sendDefaultPii: false,
  });

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
  };
}

let reporter: ErrorReporter | null = null;

/** Raise an alarm. Never throws: a reporter failure must not fail the money path. */
export function reportAlarm(
  alarm: Alarm,
  message: string,
  context?: Record<string, unknown>,
  error?: unknown,
): void {
  try {
    reporter ??= createErrorReporter();
    reporter.alarm(alarm, message, context, error);
  } catch {
    // The log line at the call site is still the record.
  }
}

/** For tests: swap the process reporter, or pass null to rebuild it from the environment. */
export function setErrorReporter(next: ErrorReporter | null): void {
  reporter = next;
}
