/**
 * Where crash reports go, read once at build time (ADR-063).
 *
 * This is the ONLY file that reads `EXPO_PUBLIC_SENTRY_DSN` and
 * `EXPO_PUBLIC_SENTRY_ENVIRONMENT`, and unlike `env.ts` it never throws. The
 * crash reporter starts before any route module loads, so a throw here would
 * be a crash nothing could report; and `env.ts` throwing (no API origin) is
 * itself something the reporter should be running to see.
 *
 * Both values are set per build profile in `eas.json`, never in `.env`, so a
 * development build has no DSN and never reports. As in `env.ts`, each
 * `process.env.EXPO_PUBLIC_*` is written out in full, because Expo inlines
 * them by textual substitution and a computed key is never substituted.
 */

/** The three environments a report may be filed under. */
export type CrashEnvironment = 'preview' | 'beta' | 'production';

const ENVIRONMENTS: readonly CrashEnvironment[] = ['preview', 'beta', 'production'];

function readDsn(raw: string | undefined): string | null {
  const dsn = typeof raw === 'string' ? raw.trim() : '';
  return dsn ? dsn : null;
}

/**
 * The environment name, only when it is exactly one of the three. Anything
 * else (unset, a typo, `development`) is null, and the reporter stays inert:
 * Sentry's own default is `production`, so a guess here would file a tester's
 * crash as a production one.
 */
function readEnvironment(raw: string | undefined): CrashEnvironment | null {
  return ENVIRONMENTS.includes(raw as CrashEnvironment) ? (raw as CrashEnvironment) : null;
}

/** The `injishi-mobile` DSN for this build, or null when it has none. */
export const CRASH_DSN: string | null = readDsn(process.env.EXPO_PUBLIC_SENTRY_DSN);

/** The environment this build reports under, or null when it must not report. */
export const CRASH_ENVIRONMENT: CrashEnvironment | null = readEnvironment(
  process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT,
);

/**
 * Whether this is a development build. The one predicate every crash
 * reporting gate reads: the reporter never starts in one, and the crash screen
 * still shows the error message in one.
 */
export const IS_DEVELOPMENT_BUILD: boolean = typeof __DEV__ !== 'undefined' && __DEV__ === true;

/**
 * Whether the Diagnostics screen exists in this build (AC-7): development
 * builds, and the two tester builds. Never in production.
 */
export const DIAGNOSTICS_ALLOWED: boolean =
  IS_DEVELOPMENT_BUILD || CRASH_ENVIRONMENT === 'preview' || CRASH_ENVIRONMENT === 'beta';
