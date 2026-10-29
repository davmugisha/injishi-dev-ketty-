import {
  createAuth,
  DEMO_COOKIE_PREFIX,
  DEMO_OTP_CODE,
  type AuthInstance,
} from '@injishi/auth';
import { Module, Scope } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { REQUEST } from '@nestjs/core';

import {
  assertSurfaceSecretsDiffer,
  hostFromHeaders,
  resolveAuthSurface,
  resolveOversightHosts,
  type AuthSurface,
} from '../../shared/config/auth-surface';
import { PLATFORM, type Platform } from '../../shared/config/platform';
import {
  isProduction,
  requireStrongSecret,
  resolveAllowedOrigins,
} from '../../shared/config/security.config';
import { DRIZZLE, type Database } from '../../shared/database/database.module';
import { reportException } from '../../shared/observability/error-reporter';
import { isWorkerProcess } from '../../shared/process/process-role';
import { MailerModule } from '../mailer/mailer.module';
import { PasswordSetupService } from './application/password-setup.service';
import { OtpMailer } from './infrastructure/otp-mailer';
import { PasswordHolders } from './infrastructure/password-holders';

/** DI token for the Better Auth instance matching THIS request's surface. */
export const AUTH_INSTANCE = Symbol('AUTH_INSTANCE');
/** Every auth instance this process holds, keyed by surface. */
export const AUTH_REGISTRY = Symbol('AUTH_REGISTRY');

export interface AuthRegistry {
  /**
   * The instance for one surface (ADR-018, D-o).
   *
   * The surface axis separates SESSIONS, the marketplace's cookie from the
   * government console's, and comes from the request's host. The environment
   * axis that used to sit beside it is gone (ADR-043): a process is production
   * or demo for its whole life, so every instance here already is too.
   */
  for(surface: AuthSurface): AuthInstance;
  /** The hosts that resolve to the oversight surface. Empty means none do. */
  readonly oversightHosts: readonly string[];
}

interface RequestLike {
  headers?: Record<string, string | string[] | undefined>;
}

/**
 * The Google OAuth pair, or undefined when either half is missing.
 *
 * One rule for two readers: the auth instance mounts the provider from it, and
 * `GET /api/v1/platform` tells the sign in screens from it whether a Google
 * button may be pressed. Two copies of the check could disagree, and a screen
 * would then offer a provider that is not mounted.
 */
export function googleCredentials(
  config: Pick<ConfigService, 'get'>,
): { clientId: string; clientSecret: string } | undefined {
  const clientId = config.get<string>('GOOGLE_CLIENT_ID')?.trim();
  const clientSecret = config.get<string>('GOOGLE_CLIENT_SECRET')?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : undefined;
}

/**
 * The phone app's origins, which Better Auth must trust on top of the browser
 * apps' CORS list.
 *
 * The phone app signs in through `@better-auth/expo`. Its requests carry the
 * app's scheme as their origin, and a Google sign in comes back to it through a
 * deep link (`injishi://`), which Better Auth refuses as a callback unless the
 * origin is trusted. Expo Go in development speaks `exp://` instead, and a
 * development build speaks `injishi-dev://`, so those are trusted outside
 * production only: a production API has no development client to serve.
 *
 * Any other build of the app (the internal test build, `injishi-preview`) is
 * trusted only where its deploy lists it in `MOBILE_EXTRA_SCHEMES` (staging
 * does; production sets nothing). Mobile spec 0001, AC-7.
 */
export const MOBILE_APP_SCHEME = 'injishi';
export const MOBILE_DEV_SCHEME = 'injishi-dev';

/** One of the app's own builds, never a wildcard or another app's scheme. */
const MOBILE_EXTRA_SCHEME = /^injishi-[a-z]+$/;

/**
 * `MOBILE_EXTRA_SCHEMES`, read once at boot: comma separated, each entry
 * trimmed, empty meaning unset. An entry that is not one of the app's own
 * schemes refuses the boot, because a typo here would trust nothing and a
 * pattern would trust too much, and neither shows until a sign in fails.
 */
export function mobileExtraSchemes(raw: string | undefined): string[] {
  const schemes = (raw ?? '')
    .split(',')
    .map((scheme) => scheme.trim())
    .filter(Boolean);
  const refused = schemes.filter((scheme) => !MOBILE_EXTRA_SCHEME.test(scheme));
  if (refused.length > 0) {
    throw new Error(
      `MOBILE_EXTRA_SCHEMES may list only the app's own schemes, such as injishi-preview; refused: ${refused.join(', ')}.`,
    );
  }
  return schemes;
}

export function mobileTrustedOrigins(
  nodeEnv: string | undefined,
  extraSchemes?: string,
): string[] {
  const origins = [`${MOBILE_APP_SCHEME}://`];
  if (!isProduction(nodeEnv)) {
    origins.push(`${MOBILE_DEV_SCHEME}://`, 'exp://', 'exp://**');
  }
  for (const scheme of mobileExtraSchemes(extraSchemes)) {
    origins.push(`${scheme}://`);
  }
  return [...new Set(origins)];
}

/**
 * Every auth instance this process can hand out, built once at boot.
 *
 * Exported rather than left inline in the module so the instances themselves
 * can be inspected in a test: which secret, base URL and cookie name each one
 * actually signs with is the session boundary, and a boundary that is only
 * read about is not checked.
 */
export function createAuthRegistry(
  platform: Platform,
  db: Database,
  config: Pick<ConfigService, 'get' | 'getOrThrow'>,
  mailer: Pick<OtpMailer, 'send'>,
): AuthRegistry {
  const port = config.get<string>('PORT') ?? '8000';
  const nodeEnv = config.get<string>('NODE_ENV');
  const google = googleCredentials(config);
  const mobileOrigins = mobileTrustedOrigins(
    nodeEnv,
    config.get<string>('MOBILE_EXTRA_SCHEMES'),
  );

  // Always required; in production it must also be strong enough to sign
  // sessions with (the .env.example placeholder is not).
  const authSecret = config.getOrThrow<string>('BETTER_AUTH_SECRET');

  /*
   * The domain the session cookie is written for (e.g. `.injishi.com`).
   *
   * Unset by default, and unset is the whole local dev story: the stack
   * runs on `localhost`, where a host-only cookie is exactly right.
   *
   * It exists for the deployed shape, where the apps and this API are
   * separate hosts. Better Auth's default cookie is host-only and
   * `SameSite=Lax`, and each half breaks a different app: `Lax` is never
   * carried to an API on a different SITE, and host-only is never
   * delivered to the operator app's own origin, whose Next.js middleware
   * reads the cookies sent to ITSELF. Naming the shared parent answers
   * both at once — but only while this API is served from that domain,
   * because a response may not set a cookie for a domain its own host is
   * not in. Configure the two together.
   */
  const cookieDomain = config.get<string>('AUTH_COOKIE_DOMAIN')?.trim();

  const oversightHosts = resolveOversightHosts({
    oversightHostnames: config.get<string>('OVERSIGHT_HOSTNAMES'),
  });

  /*
   * The console's own signing secret (ADR-018, D-i).
   *
   * Required as soon as ANY host is listed for the console, and fatal if
   * missing or equal to the marketplace's. Both failures are silent at
   * runtime: an absent secret would fall the console back to the
   * marketplace instance, and an equal one would let each verify the
   * other's cookies. Either way every screen still loads and the boundary
   * is gone, so this is settled at boot.
   */
  const oversightSecret =
    oversightHosts.length > 0
      ? config.getOrThrow<string>('OVERSIGHT_AUTH_SECRET')
      : null;
  if (oversightSecret !== null) {
    assertSurfaceSecretsDiffer(authSecret, oversightSecret);
  }

  const marketplaceBaseUrl =
    config.get<string>('BETTER_AUTH_URL') ?? `http://localhost:${port}`;

  const oversightCookieName =
    config.get<string>('OVERSIGHT_AUTH_COOKIE_NAME') ?? 'injishi-oversight';

  const demo = platform.environment === 'demo';

  // Passwords are for tenants only (2026-10-23): Better Auth asks this before
  // it writes any password row.
  const holders = new PasswordHolders(db);

  const build = (surface: AuthSurface): AuthInstance => {
    const oversight = surface === 'oversight';
    const secretName = oversight ? 'OVERSIGHT_AUTH_SECRET' : 'BETTER_AUTH_SECRET';
    const secret = oversight ? oversightSecret! : authSecret;
    const baseURL = oversight
      ? (config.get<string>('OVERSIGHT_AUTH_BASE_URL') ?? marketplaceBaseUrl)
      : marketplaceBaseUrl;
    return createAuth({
      db,
      secret: isProduction(nodeEnv)
        ? requireStrongSecret(secretName, secret)
        : secret,
      baseURL,
      // The other half of the session boundary. A different secret stops
      // each instance verifying the other's cookie; a different NAME
      // stops the two overwriting each other in one browser, which is
      // what an officer who also runs a hotel would otherwise hit.
      //
      // A demo process names its cookies differently on both surfaces
      // (AC-8). The demo is its own stack with its own secret now, but it
      // still sets cookies on the parent domain production uses, so one name
      // would still mean signing in to the demo signs a person out of
      // production.
      cookiePrefix: oversight
        ? demo
          ? `${oversightCookieName}-demo`
          : oversightCookieName
        : demo
          ? DEMO_COOKIE_PREFIX
          : undefined,
      // Both surfaces share it: the boundary between them is the cookie
      // NAME and the signing secret, never the domain, so widening the
      // domain widens neither.
      cookieDomain: cookieDomain || undefined,
      // Same allowlist Fastify CORS uses (AppModule.main), so the
      // browser's cross-origin check and Better Auth's CSRF check cannot
      // disagree. The phone app's scheme is added here only: it is not a
      // browser, so CORS never applies to it.
      trustedOrigins: [
        ...resolveAllowedOrigins({
          nodeEnv,
          corsOrigins: config.get<string>('CORS_ORIGINS'),
        }),
        ...mobileOrigins,
      ],
      google,
      // THE security boundary (AC-12). Only a demo process hands its
      // instances the fixed code, and a demo process only boots on a
      // database that was empty when it was marked sample
      // (`shared/config/platform.ts`). Production is constructed without it
      // and therefore uses Better Auth's random generator, unconditionally.
      demoOtpCode: demo ? DEMO_OTP_CODE : undefined,
      // ADR-063 AC-12. Better Auth's routes are mounted on Fastify, outside
      // Nest's exception filter, so their faults reach the reporter here. A
      // refused code or a rate limit is an answer and never arrives.
      onServerError: (error) =>
        reportException(error, { method: '*', route: '/api/auth/*', status: 500 }),
      // Every code is mailed, the demo's included. The demo stack has a
      // Mailpit of its own and no relay credential (ADR-043 AC-4), so its
      // mail cannot reach a stranger's inbox, and locally Mailpit shows
      // exactly what production would send.
      sendOtp: mailer.send,
      mayHoldPassword: holders.isTenant,
    });
  };

  const marketplace = build('marketplace');

  // The console is built only when a host can reach it. The officer's
  // identity is the SAME `users` row, because the instance shares the
  // database. It authenticates; it does not register (D-i).
  const oversight = oversightSecret !== null ? build('oversight') : null;

  return {
    oversightHosts,
    for: (surface) =>
      surface === 'oversight' && oversight ? oversight : marketplace,
  };
}

/**
 * Layering: domain/ (entities, rules) - application/ (use cases) -
 * infrastructure/ (persistence, adapters). Never import another domain module
 * directly; communicate via events or application services.
 *
 * Owns the Better Auth instances (email-OTP + Google OAuth; Apple is a UI-only
 * placeholder), mounted at `/api/auth/*` from `AppModule.main()`. Codes are
 * mailed by `OtpMailer` through the mailer seam (`MailerModule`, SMTP on
 * nodemailer), which is why that module is imported here.
 *
 * An instance per SURFACE (ADR-018 D-o), in the one environment this process
 * is (ADR-043). The fixed demo code is a constructor argument handed over only
 * when `PLATFORM` says demo, and `PLATFORM` only says demo over a database that
 * carries the sample marker, so no configuration value, environment variable
 * or flag can make production issue it.
 *
 * The surface axis is the government console's trust boundary. It shares the
 * database, so an officer is the same `users` row they are everywhere else, and
 * it signs with its own secret and its own cookie name, so neither session
 * opens the other's surface. Both are refused at boot if misconfigured.
 */
@Module({
  // Supplies `MAILER_PORT` to `OtpMailer`. Not re-exported: nothing outside
  // this module mails directly, and the step-up reaches the transport through
  // the exported `OtpMailer`, keeping one debug-log rule and one timeout.
  imports: [MailerModule],
  providers: [
    OtpMailer,
    {
      provide: PasswordHolders,
      inject: [DRIZZLE],
      useFactory: (db: Database) => new PasswordHolders(db),
    },
    PasswordSetupService,
    {
      provide: AUTH_REGISTRY,
      inject: [PLATFORM, DRIZZLE, ConfigService, OtpMailer],
      useFactory: createAuthRegistry,
    },
    // The instance for THIS request. Request-scoped on the HTTP side so the
    // surface follows the request's host; a worker has no request and never
    // signs anyone in, so it gets the marketplace instance.
    isWorkerProcess()
      ? {
          provide: AUTH_INSTANCE,
          inject: [AUTH_REGISTRY],
          useFactory: (registry: AuthRegistry): AuthInstance =>
            registry.for('marketplace'),
        }
      : {
          provide: AUTH_INSTANCE,
          scope: Scope.REQUEST,
          inject: [REQUEST, AUTH_REGISTRY],
          useFactory: (
            request: RequestLike,
            registry: AuthRegistry,
          ): AuthInstance =>
            // `SessionGuard` is not edited and does not choose: it reads
            // whatever this hands it (ADR-018, D-o).
            registry.for(
              resolveAuthSurface(
                hostFromHeaders(request?.headers),
                registry.oversightHosts,
              ),
            ),
        },
  ],
  // OtpMailer is exported because the emailed step-up (F-S02) sends through
  // the same transport as sign-in: one place that knows how a code reaches a
  // person, one debug-log rule, one timeout.
  exports: [AUTH_INSTANCE, AUTH_REGISTRY, OtpMailer, PasswordSetupService],
})
export class AuthModule {}
