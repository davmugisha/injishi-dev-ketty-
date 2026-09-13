import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { resolveWebUrl } from '../../../shared/config/web-url';
import {
  MAILER_PORT,
  type MailerPort,
} from '../../mailer/domain/mailer-port';
import { claimInvitationMail, claimLink } from '../domain/owner-claim';

/**
 * Mails an owner claim invitation through the mailer seam (FL02, ADR-049).
 *
 * `WEB_URL` is resolved in the constructor, which Nest runs once at boot, so an
 * API started with `NODE_ENV=production` and no `WEB_URL` refuses to start
 * rather than mailing its first owner a link to `localhost` (AC-R14).
 *
 * A send never throws. It runs after the registration has committed, and a
 * registration that exists must not be reported as failed because a relay was
 * slow: the invitation row stands, the failure is logged, and resending is the
 * follow up ADR-049 enrols.
 */
@Injectable()
export class ClaimInvitationMailer {
  /** The same ceiling `OtpMailer` puts on a foreground send. */
  private static readonly SEND_TIMEOUT_MS = 8_000;

  private readonly logger = new Logger(ClaimInvitationMailer.name);
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
    intendedOwnerName: string;
    registrantName: string | null;
  }): Promise<boolean> {
    const mail = claimInvitationMail({
      legalName: input.legalName,
      intendedOwnerName: input.intendedOwnerName,
      registrantName: input.registrantName,
      link: claimLink(this.webUrl, input.orgId, input.token),
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
                  `mail transport did not respond within ${ClaimInvitationMailer.SEND_TIMEOUT_MS}ms`,
                ),
              ),
            ClaimInvitationMailer.SEND_TIMEOUT_MS,
          );
        }),
      ]);
      // The address is logged, the token and the link never are: a log line
      // carrying the link is a working claim for anyone who can read the logs.
      this.logger.log(`Claim invitation for org ${input.orgId} mailed to ${input.email}`);
      return true;
    } catch (cause) {
      this.logger.error(
        `Claim invitation for org ${input.orgId} was not mailed: ${
          cause instanceof Error ? cause.message : 'mail transport failed'
        }. The invitation row stands.`,
      );
      return false;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
