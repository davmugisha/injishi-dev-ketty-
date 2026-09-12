import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { isProduction } from '../../shared/config/security.config';
import { MAILER_PORT, type MailerPort } from './domain/mailer-port';
import {
  SMTP_TIMEOUTS,
  SmtpMailerAdapter,
  UnconfiguredMailerAdapter,
} from './infrastructure/smtp-mailer.adapter';

/**
 * The mailer seam's one wiring point (F-S07).
 *
 * `SMTP_URL` chooses the transport and `MAIL_FROM` names the sender, read HERE
 * and nowhere else, once, when the provider is built at boot:
 *
 * - `smtp://mailpit:1025` (development, staging) or `smtps://user:pass@relay:465`
 *   (production): mail goes out through `SmtpMailerAdapter`.
 * - unset, outside production: `UnconfiguredMailerAdapter`, whose every send
 *   rejects. Local development without a mail sink keeps working through
 *   `OTP_DEBUG_LOG`, exactly as it did before there was a seam.
 * - unset in production: the boot is REFUSED. A service that starts, serves and
 *   only reveals at the sign-in box that it cannot send a code has locked
 *   everybody out while reporting itself healthy (the SMS seam's reasoning).
 *
 * Read through `ConfigService` in a factory rather than from `process.env` when
 * the module is defined, as the storage seam now does too (the SMS seam still
 * reads at definition time). `SMTP_URL` for local Mailpit lives in `.env`,
 * which `ConfigModule.forRoot` loads only after every module file has been
 * imported, so a definition-time read would miss it and boot unconfigured. The
 * factory still runs exactly once, during boot, so the refusal stays a boot
 * refusal.
 */

/** The sender when `MAIL_FROM` is unset. */
export const DEFAULT_MAIL_FROM = 'Injishi <no-reply@injishi.com>';

export interface MailerEnv {
  smtpUrl?: string;
  mailFrom?: string;
  nodeEnv?: string;
}

export type MailerConfig =
  | {
      transport: 'smtp';
      smtpUrl: string;
      /** `smtps://relay.example.com:465`: the URL with no credentials, for logs. */
      target: string;
      from: string;
    }
  | { transport: 'unconfigured'; from: string };

const CONTROL_CHARACTER = /\p{Cc}/u;

/**
 * Validate the environment into a transport choice, or throw.
 *
 * No error or log line here ever quotes `SMTP_URL`: in production it carries
 * the relay's password.
 */
export function resolveMailerConfig(env: MailerEnv): MailerConfig {
  const from = env.mailFrom?.trim() || DEFAULT_MAIL_FROM;
  if (CONTROL_CHARACTER.test(from)) {
    // A line break here would be a header of its own on every mail sent.
    throw new Error('MAIL_FROM must be a single line.');
  }

  const smtpUrl = env.smtpUrl?.trim();
  if (!smtpUrl) {
    if (isProduction(env.nodeEnv)) {
      throw new Error(
        'SMTP_URL is required when NODE_ENV=production: without it no ' +
          'sign-in code can be mailed. Set it to the relay, e.g. ' +
          'smtps://user:pass@relay.example.com:465.',
      );
    }
    return { transport: 'unconfigured', from };
  }

  let url: URL;
  try {
    url = new URL(smtpUrl);
  } catch {
    throw new Error(
      'SMTP_URL is not a valid URL (expected smtp://host:port or smtps://user:pass@host:port).',
    );
  }
  if (url.protocol !== 'smtp:' && url.protocol !== 'smtps:') {
    throw new Error(
      `SMTP_URL must use smtp:// or smtps://, got "${url.protocol}//".`,
    );
  }
  if (!url.hostname) {
    throw new Error('SMTP_URL names no host.');
  }
  // Nodemailer applies the URL's query over the options passed beside it, so a
  // timeout named here would silently replace the adapter's bound.
  const bounds = Object.keys(SMTP_TIMEOUTS).map((key) => key.toLowerCase());
  const overridden = [...url.searchParams.keys()].filter((key) =>
    bounds.includes(key.toLowerCase()),
  );
  if (overridden.length > 0) {
    throw new Error(
      `SMTP_URL may not set ${overridden.join(', ')}: the mailer's timeouts ` +
        'are fixed in smtp-mailer.adapter.ts so a silent relay is always abandoned.',
    );
  }

  return {
    transport: 'smtp',
    smtpUrl,
    target: `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ''}`,
    from,
  };
}

/** The adapter for this environment. Exported so the boot choice is testable. */
export function createMailer(env: MailerEnv): MailerPort {
  const config = resolveMailerConfig(env);
  const logger = new Logger('MailerModule');
  if (config.transport === 'smtp') {
    logger.log(`Mail transport: SMTP ${config.target}, from ${config.from}`);
    return new SmtpMailerAdapter(config.smtpUrl, config.from);
  }
  logger.warn(
    'Mail transport: none. SMTP_URL is unset, so every email fails to send ' +
      '(OTP_DEBUG_LOG=true prints sign-in codes instead, outside production).',
  );
  return new UnconfiguredMailerAdapter();
}

@Module({
  providers: [
    {
      provide: MAILER_PORT,
      // `ConfigService` is global (AppModule), so no ConfigModule import here.
      inject: [ConfigService],
      useFactory: (config: ConfigService): MailerPort =>
        createMailer({
          smtpUrl: config.get<string>('SMTP_URL'),
          mailFrom: config.get<string>('MAIL_FROM'),
          nodeEnv: config.get<string>('NODE_ENV'),
        }),
    },
  ],
  exports: [MAILER_PORT],
})
export class MailerModule {}
