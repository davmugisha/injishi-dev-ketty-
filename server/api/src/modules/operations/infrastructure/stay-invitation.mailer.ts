import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { resolveWebUrl } from '../../../shared/config/web-url';
import { MAILER_PORT, type MailerPort } from '../../mailer/domain/mailer-port';
import {
  stayInvitationLink,
  stayInvitationMail,
} from '../domain/stay-invitation';

/**
 * Mails a guest their claim invitation, through the mailer seam (§6.8).
 *
 * The same shape as `StaffInvitationMailer`: `WEB_URL` resolved once at boot,
 * an 8 second ceiling, and a send that NEVER THROWS.
 *
 * That last rule matters more here than anywhere else it is applied. This send
 * happens inside check in, with a guest standing at the counter holding a bag.
 * A relay that is down, a mailbox that is full, a DNS answer that is slow — none
 * of those is a reason to refuse somebody a room, and the code is printed on the
 * slip in their hand either way. So the failure is logged, `false` comes back,
 * and the desk sees "not sent" next to a button that sends it again.
 */
@Injectable()
export class StayInvitationMailer {
  private static readonly SEND_TIMEOUT_MS = 8_000;

  private readonly logger = new Logger(StayInvitationMailer.name);
  private readonly webUrl: string;

  constructor(
    @Inject(MAILER_PORT) private readonly mailer: MailerPort,
    config: ConfigService,
  ) {
    this.webUrl = resolveWebUrl({
      webUrl: config.get<string>('WEB_URL'),
      nodeEnv: config.get<string>('NODE_ENV'),
    });
  }

  async send(input: {
    stayId: string;
    email: string;
    claimCode: string;
    propertyName: string;
    roomLabel: string | null;
    guestName: string | null;
  }): Promise<boolean> {
    const mail = stayInvitationMail({
      propertyName: input.propertyName,
      roomLabel: input.roomLabel,
      guestName: input.guestName,
      claimCode: input.claimCode,
      link: stayInvitationLink(this.webUrl, input.claimCode),
    });

    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        this.mailer.send({ to: input.email, ...mail }),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(
            () =>
              reject(
                new Error(
                  `mail transport did not respond within ${StayInvitationMailer.SEND_TIMEOUT_MS}ms`,
                ),
              ),
            StayInvitationMailer.SEND_TIMEOUT_MS,
          );
        }),
      ]);
      // The stay is logged; the CODE never is. It is a bearer credential, and a
      // log line is read by more people than a mailbox.
      this.logger.log(`Claim invitation for stay ${input.stayId} mailed.`);
      return true;
    } catch (cause) {
      this.logger.error(
        `Claim invitation for stay ${input.stayId} was not mailed: ${
          cause instanceof Error ? cause.message : 'mail transport failed'
        }. The stay and its code stand; the desk can send it again.`,
      );
      return false;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
