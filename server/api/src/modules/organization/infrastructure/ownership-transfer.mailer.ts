import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { resolveAppUrl } from '../../../shared/config/app-url';
import { MAILER_PORT, type MailerPort } from '../../mailer/domain/mailer-port';
import { ownershipTransferMail, type OwnershipTransferMailInput } from '../domain/ownership-transfer';

/**
 * Tells the member asked to become owner that a request is waiting (migration 0155). Best effort, like the staff
 * invitation mail: the request stands whether or not the mail went, and the member also sees it on their screen when
 * they sign in. The mail carries no token and no code; only the address it went to is logged.
 */
@Injectable()
export class OwnershipTransferMailer {
  private static readonly SEND_TIMEOUT_MS = 8_000;
  private readonly logger = new Logger(OwnershipTransferMailer.name);
  private readonly appUrl: string;

  constructor(
    @Inject(MAILER_PORT) private readonly mailer: MailerPort,
    config: ConfigService,
  ) {
    this.appUrl = resolveAppUrl({ appUrl: config.get<string>('APP_URL'), nodeEnv: config.get<string>('NODE_ENV') });
  }

  async requested(input: Omit<OwnershipTransferMailInput, 'appUrl'> & { orgId: string; to: string }): Promise<boolean> {
    const mail = ownershipTransferMail({ ...input, appUrl: this.appUrl });
    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        this.mailer.send({ to: input.to, ...mail }),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(
            () => reject(new Error(`mail transport did not respond within ${OwnershipTransferMailer.SEND_TIMEOUT_MS}ms`)),
            OwnershipTransferMailer.SEND_TIMEOUT_MS,
          );
        }),
      ]);
      this.logger.log(`Ownership transfer request for org ${input.orgId} mailed to ${input.to}`);
      return true;
    } catch (cause) {
      this.logger.warn(
        `Ownership transfer request for org ${input.orgId} was not mailed: ${
          cause instanceof Error ? cause.message : 'mail transport failed'
        }. The request stands and shows on the member's screen.`,
      );
      return false;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
