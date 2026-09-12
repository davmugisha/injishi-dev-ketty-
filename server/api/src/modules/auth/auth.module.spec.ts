// `@injishi/auth` is ESM and outside what ts-jest transforms; stood in for as
// in `auth-registry.spec.ts`. This spec is about the Nest wiring, not the
// instances.
jest.mock('@injishi/auth', () => ({
  DEMO_OTP_CODE: '123456',
  DEMO_COOKIE_PREFIX: 'injishi-demo',
  createAuth: (config: unknown) => ({ config }),
}));

import {
  Global,
  Injectable,
  Logger,
  Module,
  type Type,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';

import { PLATFORM, type Platform } from '../../shared/config/platform';
import { DRIZZLE, type Database } from '../../shared/database/database.module';
import { AUTH_REGISTRY, AuthModule } from './auth.module';
import { OtpMailer } from './infrastructure/otp-mailer';

/**
 * A Nest wiring mistake does not fail a typecheck or a unit test: it fails at
 * boot, naming a provider rather than the module that stopped supplying it.
 * `OtpMailer` now depends on `MAILER_PORT`, and its consumers
 * (`TwoFactorService`, via `PublicApiModule` and `AdminSharedModule`) import
 * `AuthModule` and never `MailerModule`. So the graph is pinned here: a
 * consumer shaped like the step-up resolves `OtpMailer`, and that `OtpMailer`
 * really sends through the port the environment chose.
 */

const db = {} as unknown as Database;
const platform: Platform = { environment: 'production', sampleData: false };

/** Stands in for the global ConfigModule and DatabaseModule `AppModule` loads. */
function infrastructure(env: Record<string, string | undefined>): Type<unknown> {
  @Global()
  @Module({
    providers: [
      {
        provide: ConfigService,
        useValue: {
          get: (key: string) => env[key],
          getOrThrow: (key: string) => env[key],
        },
      },
      { provide: DRIZZLE, useValue: db },
      { provide: PLATFORM, useValue: platform },
    ],
    exports: [ConfigService, DRIZZLE, PLATFORM],
  })
  class FakeInfrastructureModule {}
  return FakeInfrastructureModule;
}

/** Shaped like `TwoFactorService`: injects `OtpMailer` from a module that imports `AuthModule` only. */
@Injectable()
class StepUp {
  constructor(readonly mailer: OtpMailer) {}
}

@Module({ imports: [AuthModule], providers: [StepUp] })
class ConsumerModule {}

const LOCAL = {
  NODE_ENV: 'development',
  BETTER_AUTH_SECRET: 'dev-secret',
  BETTER_AUTH_URL: 'http://localhost:8000',
};

beforeEach(() => {
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe('AuthModule · wiring', () => {
  it('gives a consumer that never imported MailerModule an OtpMailer on the chosen port', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [infrastructure(LOCAL), ConsumerModule],
    }).compile();

    const { mailer } = moduleRef.get(StepUp);
    expect(mailer).toBeInstanceOf(OtpMailer);
    // No SMTP_URL in development: the unconfigured adapter, whose refusal is
    // proof the port reached OtpMailer. No network is touched.
    await expect(
      mailer.send({
        email: 'guest@example.com',
        otp: '482913',
        type: 'email-verification',
      }),
    ).rejects.toThrow('Failed to send OTP email: SMTP_URL is not set');
    expect(moduleRef.get(AUTH_REGISTRY)).toBeDefined();
    await moduleRef.close();
  });

  it('refuses to boot in production without SMTP_URL', async () => {
    await expect(
      Test.createTestingModule({
        imports: [
          infrastructure({
            ...LOCAL,
            NODE_ENV: 'production',
            BETTER_AUTH_SECRET: 'p'.repeat(40),
            CORS_ORIGINS: 'https://www.injishi.com',
          }),
          ConsumerModule,
        ],
      }).compile(),
    ).rejects.toThrow(/SMTP_URL is required when NODE_ENV=production/);
  });
});
