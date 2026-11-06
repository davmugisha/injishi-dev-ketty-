import { Inject, Injectable, Logger } from '@nestjs/common';

import { MAILER_PORT, type MailerPort } from '../../mailer/domain/mailer-port';
import type { EntitlementNotice } from '../domain/entitlement-notice';

/**
 * Mails the owner a product change (ADR-076 G8) through the mailer seam.
 *
 * The same shape as the other feature mailers: an 8 second ceiling and a send
 * that never throws. The change has committed and its in app notice was
 * written in the same transaction, so a mail that fails is logged rather than
 * undoing anything.
 */
@Injectable()
export class EntitlementMailer {
  private static readonly SEND_TIMEOUT_MS = 8_000;

  private readonly logger = new Logger(EntitlementMailer.name);

  constructor(@Inject(MAILER_PORT) private readonly mailer: MailerPort) {}

  async send(orgId: string, to: string, notice: EntitlementNotice): Promise<boolean> {
    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        this.mailer.send({ to, subject: notice.subject, text: notice.text }),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(
            () =>
              reject(
                new Error(
                  `mail transport did not respond within ${EntitlementMailer.SEND_TIMEOUT_MS}ms`,
                ),
              ),
            EntitlementMailer.SEND_TIMEOUT_MS,
          );
        }),
      ]);
      this.logger.log(`Product change for org ${orgId} mailed to ${to}`);
      return true;
    } catch (cause) {
      this.logger.error(
        `Product change for org ${orgId} was not mailed to ${to}: ${
          cause instanceof Error ? cause.message : 'mail transport failed'
        }. The change and its in app notice stand.`,
      );
      return false;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
