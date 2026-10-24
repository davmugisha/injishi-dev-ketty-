import fastifyCookie from '@fastify/cookie';
import fastifyHelmet from '@fastify/helmet';
import fastifyMultipart from '@fastify/multipart';
import {
  ClassSerializerInterceptor,
  Module,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, NestFactory, Reflector } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Logger, LoggerModule } from 'nestjs-pino';

import { AdminApiModule } from './api/admin/admin-api.module';
import { PublicApiModule } from './api/public/public-api.module';
import {
  AuthModule,
  AUTH_REGISTRY,
  type AuthRegistry,
} from './modules/auth/auth.module';
import { resolveAuthSurface } from './shared/config/auth-surface';
import { PLATFORM, type Platform } from './shared/config/platform';
import { scrubForeignSessionCookies } from './shared/http/foreign-session-cookies';
import { registerAuthRoutes } from './modules/auth/infrastructure/auth-http';
import { BookingModule } from './modules/booking/booking.module';
import { GeographyModule } from './modules/geography/geography.module';
import { ListingModule } from './modules/listing/listing.module';
import { envFilesFor } from './shared/config/env-files';
import {
  resolveAllowedOrigins,
  resolveCookieSecret,
} from './shared/config/security.config';
import { resolveTrustProxy } from './shared/config/trust-proxy';
import { DatabaseModule } from './shared/database/database.module';
import { QueuesModule } from './shared/queues/queues.module';
import { ReportingExceptionFilter } from './shared/observability/reporting-exception.filter';

@Module({
  imports: [
    // One env file per environment, picked by APP_ENV (shared/config/env-files.ts).
    ConfigModule.forRoot({ isGlobal: true, envFilePath: envFilesFor() }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        // A logged session cookie or bearer token is a working credential for
        // anyone who can read the logs, so no environment writes one (ADR-043,
        // AC-15). Redacted at the logger, so every line that carries the
        // request or response, error lines included, is covered at once.
        // The mobile assistant's `x-assistant-token` opens a signed out
        // conversation exactly as its cookie does (ADR-061 D-c), so it is one.
        redact: [
          'req.headers.cookie',
          'req.headers.authorization',
          'req.headers["x-assistant-token"]',
          'res.headers["set-cookie"]',
        ],
        transport:
          process.env.NODE_ENV === 'production'
            ? undefined
            : { target: 'pino-pretty', options: { singleLine: true } },
      },
    }),
    // Shared infrastructure
    DatabaseModule,
    QueuesModule,
    // Domain modules - never import each other directly (events or application services only)
    AuthModule,
    GeographyModule,
    ListingModule,
    BookingModule,
    // HTTP surface
    PublicApiModule,
    AdminApiModule,
  ],
  // ADR-063 AC-12: a request that fails with a 500 is reported, then answered
  // exactly as Nest's own handler would. The worker has no HTTP, so it never runs.
  providers: [{ provide: APP_FILTER, useClass: ReportingExceptionFilter }],
})
export class AppModule {
  /** HTTP + WS process (:8000). */
  static async main(): Promise<void> {
    // Which proxy hops may name the client in X-Forwarded-For, and therefore
    // what `request.ip` (every address keyed rate limit) says. Read from
    // process.env rather than ConfigService because the adapter exists before
    // the container does; ConfigModule.forRoot has already loaded .env into
    // process.env by the time this runs. Off unless the deploy states its proxy
    // chain, and a value that does not parse fails the boot (trust-proxy.ts).
    const app = await NestFactory.create<NestFastifyApplication>(
      AppModule,
      new FastifyAdapter({
        trustProxy: resolveTrustProxy(process.env.TRUST_PROXY),
      }),
      { bufferLogs: true },
    );
    app.useLogger(app.get(Logger));
    const config = app.get(ConfigService);

    // Resolved once, up front: a bad security posture must fail the boot, not
    // degrade into a permissive default. The same allowlist feeds CORS below
    // and Better Auth's trustedOrigins (see AuthModule).
    const env = {
      nodeEnv: config.get<string>('NODE_ENV'),
      corsOrigins: config.get<string>('CORS_ORIGINS'),
      cookieSecret: config.get<string>('COOKIE_SECRET'),
    };
    const allowedOrigins = resolveAllowedOrigins(env);

    // A demo process drops production's session cookies before anything reads
    // the request (ADR-043, AC-14). Added first, so it runs ahead of
    // @fastify/cookie's parse below and of the request logger, which Nest only
    // wires at listen time. Production never registers it: it would strip
    // production's own session.
    if (app.get<Platform>(PLATFORM).environment === 'demo') {
      app
        .getHttpAdapter()
        .getInstance()
        .addHook('onRequest', (request, _reply, done) => {
          scrubForeignSessionCookies(request.raw);
          done();
        });
    }

    await app.register(fastifyHelmet);
    await app.register(fastifyCookie, { secret: resolveCookieSecret(env) });
    await app.register(fastifyMultipart);

    // Better Auth mounts at /api/auth (VERSION_NEUTRAL, outside /api/v1) as raw
    // Fastify routes so it owns cookies/redirects verbatim (F-S01).
    //
    // The instance is picked per request from the Host header on one axis, the
    // surface (ADR-018, D-o): a sign-in that arrives on a government console
    // host is signed by the console's own instance, with its own secret and
    // cookie name, so the session it mints opens nothing else. Any other host
    // is the marketplace. Whether that instance issues the fixed demo code is
    // not a per request question any more: the whole process is production or
    // demo (ADR-043, `shared/config/platform.ts`).
    const authRegistry = app.get<AuthRegistry>(AUTH_REGISTRY);
    registerAuthRoutes(app.getHttpAdapter().getInstance(), (host) =>
      authRegistry.for(resolveAuthSurface(host, authRegistry.oversightHosts)),
    );

    // Product APIs at /api/v1.
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        errorHttpStatusCode: 422,
      }),
    );
    app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
    // Never `origin: true` with credentials - that reflects the caller's Origin
    // back, letting any site make authenticated cross-origin calls as the user.
    //
    // `methods` is spelled out because the default is not what it looks like:
    // `@fastify/cors` answers a preflight with `GET,HEAD,POST` only, so every
    // PATCH and DELETE a browser sent from the operator app was refused before
    // it left the page — department edits, menu edits, removing an amenity and
    // letting a held room go. The routes themselves were never the problem.
    app.enableCors({
      origin: allowedOrigins,
      credentials: true,
      methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],
    });
    app.enableShutdownHooks();

    const port = Number(config.get<string>('PORT') ?? 8000);
    await app.listen(port, '0.0.0.0');
  }

  /** BullMQ worker process. Queue processors register in their module's infrastructure layer. */
  static async worker(): Promise<void> {
    const app = await NestFactory.createApplicationContext(AppModule, {
      bufferLogs: true,
    });
    const logger = app.get(Logger);
    app.useLogger(logger);
    app.enableShutdownHooks();
    logger.log('Worker process started');
  }
}
