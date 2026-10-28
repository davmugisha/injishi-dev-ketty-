import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { resolveAppUrl } from '../../../shared/config/app-url';
import { MAILER_PORT, type MailerPort } from '../../mailer/domain/mailer-port';
import type { GuestMail } from '../domain/guest-mail';

/**
 * Sends the guest mails through the mailer seam (P5). `APP_URL` is resolved
 * once at boot; each send has an 8 second ceiling and never throws: a guest is
 * registered and in the leader's list whether or not a mail went out.
 */
@Injectable()
export class GuestNotifier {
  private static readonly SEND_TIMEOUT_MS = 8_000;
  private readonly logger = new Logger(GuestNotifier.name);
  readonly appUrl: string;

  constructor(
    @Inject(MAILER_PORT) private readonly mailer: MailerPort,
    config: ConfigService,
  ) {
    this.appUrl = resolveAppUrl({ appUrl: config.get<string>('APP_URL'), nodeEnv: config.get<string>('NODE_ENV') });
  }

  /** True when the transport took it. The address is logged; the guest is not. */
  async send(to: string, mail: GuestMail, what: string): Promise<boolean> {
    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        this.mailer.send({ to, ...mail }),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(
            () => reject(new Error(`mail transport did not respond within ${GuestNotifier.SEND_TIMEOUT_MS}ms`)),
            GuestNotifier.SEND_TIMEOUT_MS,
          );
        }),
      ]);
      this.logger.log(`Guest mail (${what}) sent to ${to}`);
      return true;
    } catch (cause) {
      this.logger.error(`Guest mail (${what}) to ${to} was not sent: ${cause instanceof Error ? cause.message : 'mail failed'}.`);
      return false;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
