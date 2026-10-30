import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { resolveAppUrl } from '../../../shared/config/app-url';
import { MAILER_PORT, type MailAttachment, type MailerPort } from '../../mailer/domain/mailer-port';
import { renderRentalsMail, signingCodeMail, type RentalsMail } from '../domain/rentals-mail';

/** One send waits this long for the transport before it counts as failed. */
const SEND_TIMEOUT_MS = 8_000;

/**
 * Sends the rentals emails (WP 1.5b) through the mailer seam.
 *
 * `APP_URL` is resolved once, at boot, so a production API without it refuses
 * to start rather than mail tenants a link to localhost. Every send has an 8
 * second ceiling and answers whether it went; none throws. The thing a mail is
 * about (a signature, an invitation, a started tenancy) is already written
 * when it is sent, and stands whether or not the mail arrives.
 */
@Injectable()
export class RentalsMailer {
  private readonly log = new Logger(RentalsMailer.name);
  readonly appUrl: string;

  constructor(
    @Inject(MAILER_PORT) private readonly mailer: MailerPort,
    config: ConfigService,
  ) {
    this.appUrl = resolveAppUrl({ appUrl: config.get<string>('APP_URL'), nodeEnv: config.get<string>('NODE_ENV') });
  }

  /** A signing code. The signer is waiting on it: false when it did not go. */
  async signingCode(to: string, code: string, home: string, minutes: number): Promise<boolean> {
    return this.deliver('signing code', to, signingCodeMail({ code, home, minutes }));
  }

  /** One of the rentals emails, with files when it carries the signed lease. */
  async send(ref: string, to: string, mail: RentalsMail, attachments?: MailAttachment[]): Promise<boolean> {
    return this.deliver(`${ref} "${mail.subject}"`, to, renderRentalsMail(mail), attachments);
  }

  private async deliver(
    what: string,
    to: string,
    message: { subject: string; text: string; html: string },
    attachments?: MailAttachment[],
  ): Promise<boolean> {
    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        this.mailer.send({ to, ...message, ...(attachments?.length ? { attachments } : {}) }),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => reject(new Error(`mail transport did not respond within ${SEND_TIMEOUT_MS}ms`)), SEND_TIMEOUT_MS);
        }),
      ]);
      this.log.log(`Rentals mail sent: ${what}.`);
      return true;
    } catch (cause) {
      this.log.error(`Rentals mail not sent: ${what}: ${cause instanceof Error ? cause.message : 'mail transport failed'}.`);
      return false;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
