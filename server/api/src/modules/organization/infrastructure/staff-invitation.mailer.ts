import type { OrgRole } from '@injishi/contracts';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { resolveWebUrl } from '../../../shared/config/web-url';
import {
  MAILER_PORT,
  type MailerPort,
} from '../../mailer/domain/mailer-port';
import {
  staffInvitationLink,
  staffInvitationMail,
} from '../domain/staff-invitation';

/**
 * Mails a staff invitation through the mailer seam.
 *
 * The same shape as `ClaimInvitationMailer`: `WEB_URL` resolved once at boot,
 * an 8 second ceiling, and a send that never throws — the invitation row
 * stands, and the owner can send it again from the People screen.
 */
@Injectable()
export class StaffInvitationMailer {
  private static readonly SEND_TIMEOUT_MS = 8_000;

  private readonly logger = new Logger(StaffInvitationMailer.name);
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
    orgId: string;
    email: string;
    token: string;
    expiresAt: Date;
    legalName: string;
    orgRole: OrgRole;
    inviterName: string | null;
  }): Promise<boolean> {
    const mail = staffInvitationMail({
      legalName: input.legalName,
      orgRole: input.orgRole,
      inviterName: input.inviterName,
      email: input.email,
      link: staffInvitationLink(this.webUrl, input.orgId, input.token),
      expiresAt: input.expiresAt,
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
                  `mail transport did not respond within ${StaffInvitationMailer.SEND_TIMEOUT_MS}ms`,
                ),
              ),
            StaffInvitationMailer.SEND_TIMEOUT_MS,
          );
        }),
      ]);
      // The address is logged; the token and the link never are.
      this.logger.log(`Staff invitation for org ${input.orgId} mailed to ${input.email}`);
      return true;
    } catch (cause) {
      this.logger.error(
        `Staff invitation for org ${input.orgId} was not mailed: ${
          cause instanceof Error ? cause.message : 'mail transport failed'
        }. The invitation row stands.`,
      );
      return false;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
