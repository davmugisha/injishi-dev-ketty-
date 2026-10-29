import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { resolveWebUrl } from '../../../shared/config/web-url';
import { MAILER_PORT, type MailerPort } from '../../mailer/domain/mailer-port';
import type { RefundMailEvent } from '../domain/refund-mail';

export interface RefundMailFacts {
  payerEmail: string;
  payerName: string | null;
  amountRwf: number;
  /** The booking reference, or null for a refund with no booking (a duplicate fee). */
  bookingReference: string | null;
}

/**
 * What a refund mail SAYS (073-gtbank-payments AC-12, AC-12a). The words and
 * nothing else; how it leaves is `MailerModule`'s.
 *
 * Neither mail repeats an ID number, a wallet or a name back to the payer: a
 * mailbox is not where those belong, and the page the link opens is behind
 * their own sign in.
 */
@Injectable()
export class RefundMailer {
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

  async send(event: RefundMailEvent, facts: RefundMailFacts): Promise<void> {
    const { subject, body } = composeRefundMail(event, facts, new URL('/account/refunds', this.webUrl).toString());
    await this.mailer.send({ to: facts.payerEmail, subject, text: body });
  }
}

/** Exported for the spec: the copy is the product here. */
export function composeRefundMail(
  event: RefundMailEvent,
  f: RefundMailFacts,
  link: string,
): { subject: string; body: string } {
  const hi = f.payerName ? `Hi ${f.payerName.split(' ')[0]},` : 'Hi,';
  const amount = `RWF ${f.amountRwf.toLocaleString('en-RW')}`;
  const what = f.bookingReference ? `your refund for booking ${f.bookingReference}` : 'your refund';
  const tag = f.bookingReference ? ` — ${f.bookingReference}` : '';

  switch (event) {
    case 'refund_details_needed':
      return {
        subject: `We need your details to send your refund${tag}`,
        body: [
          hi,
          '',
          `${amount} is ready to go back to the mobile money number you paid from. The bank asks for the full name and ID or passport number of the person it pays, and we do not have them on file for you yet.`,
          '',
          `Add them here and ${what} goes out straight away:`,
          link,
          '',
          'The refund always goes back to the number that paid. Nobody can change where it is sent.',
        ].join('\n'),
      };
    case 'refund_delayed':
      return {
        subject: `Your refund is delayed${tag}`,
        body: [
          hi,
          '',
          `${what[0]?.toUpperCase()}${what.slice(1)} of ${amount} did not go through on the first attempt. Nothing is lost: the money is owed to you, and our team is on it.`,
          '',
          `You can follow it here: ${link}`,
          '',
          'You do not need to do anything unless we ask you to.',
        ].join('\n'),
      };
    default:
      throw new Error(`No refund mail for "${String(event)}".`);
  }
}
