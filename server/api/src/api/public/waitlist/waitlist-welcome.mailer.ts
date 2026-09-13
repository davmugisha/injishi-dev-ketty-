import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  MAILER_PORT,
  type MailerPort,
} from '../../../modules/mailer/domain/mailer-port';

/**
 * The waitlist welcome note (ADR-048 copy.md §9).
 *
 * Built on the existing mailer seam, so it reaches Mailpit on a laptop and the
 * relay in `SMTP_URL` when deployed, and nothing here knows or cares which.
 *
 * TWO RULES HOLD OVER EVERY LINE OF THIS MAIL and both come from the decision
 * record rather than from taste:
 *
 * 1. NO DATE. Not a month, not a quarter, not a year. The mail promises exactly
 *    one further message, "the day it opens", and a pre-launch promise with a
 *    date in it is the one thing on this surface that can expire into a lie.
 * 2. EVERY SEND CARRIES AN UNSUBSCRIBE LINK, from the very first one (AC-12).
 *    Withdrawal has to be available from the first contact, not from the
 *    second, which is what Law 058/2021 expects and what the token column
 *    exists for.
 */
export interface WaitlistWelcome {
  email: string;
  fullName: string;
  unsubscribeToken: string;
  /** Present only for an owner, and only then is the second paragraph included. */
  businessName?: string | null;
  districtName?: string | null;
}

@Injectable()
export class WaitlistWelcomeMailer {
  constructor(
    @Inject(MAILER_PORT) private readonly mailer: MailerPort,
    private readonly config: ConfigService,
  ) {}

  async send(welcome: WaitlistWelcome): Promise<void> {
    const webUrl =
      this.config.get<string>('NEXT_PUBLIC_WEB_URL') ?? 'http://localhost:3000';
    const unsubscribe = `${webUrl}/waitlist/unsubscribe/${welcome.unsubscribeToken}`;

    await this.mailer.send({
      to: welcome.email,
      subject: 'You are on the Injishi waitlist',
      text: plainText(welcome, unsubscribe),
      html: html(welcome, unsubscribe),
    });
  }
}

/**
 * The owner-only paragraph.
 *
 * Included only when `audience` was `owner`, which is the same thing as having
 * a business name: the database refuses an owner row without one. A traveller
 * never sees a sentence about a property they did not tell us about.
 */
function ownerParagraph(welcome: WaitlistWelcome): string | null {
  if (!welcome.businessName) return null;
  const where = welcome.districtName ?? 'your district';
  return `You told us about ${welcome.businessName} in ${where}. We onboard properties district by district, and when we reach yours we will contact you directly to get you listed before we open to travellers.`;
}

function plainText(welcome: WaitlistWelcome, unsubscribe: string): string {
  const owner = ownerParagraph(welcome);

  return [
    `Hello ${welcome.fullName},`,
    '',
    'Thank you for joining the Injishi waitlist.',
    '',
    'Injishi is a new way to find and book places to stay across Rwanda, and a',
    'new way for the people who run those places to fill them. We are building',
    'it now.',
    '',
    'You will hear from us once more: the day it opens.',
    ...(owner ? ['', owner] : []),
    '',
    'Injishi',
    '',
    '---',
    'You are receiving this because you joined the Injishi waitlist.',
    `Unsubscribe: ${unsubscribe}`,
  ].join('\n');
}

/**
 * Inline styles only, and a very short list of them.
 *
 * Mail clients strip stylesheets, and the ones that do not disagree about
 * almost everything else, so this follows `renderOtpEmail`: plain structure
 * that degrades to readable text rather than a layout that breaks into
 * nonsense. The preheader is the hidden first line most clients show beside the
 * subject in the inbox list.
 */
function html(welcome: WaitlistWelcome, unsubscribe: string): string {
  const owner = ownerParagraph(welcome);

  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#042330;">
    <span style="display:none;max-height:0;overflow:hidden;">We will email you the day we open.</span>
    <p>Hello ${escapeHtml(welcome.fullName)},</p>
    <p>Thank you for joining the Injishi waitlist.</p>
    <p>
      Injishi is a new way to find and book places to stay across Rwanda, and a
      new way for the people who run those places to fill them. We are building
      it now.
    </p>
    <p>You will hear from us once more: the day it opens.</p>
    ${owner ? `<p>${escapeHtml(owner)}</p>` : ''}
    <p>Injishi</p>
    <hr style="border:none;border-top:1px solid #E6E9F2;margin:24px 0;" />
    <p style="font-size:12px;color:#696D78;">
      You are receiving this because you joined the Injishi waitlist.
      <a href="${unsubscribe}">Unsubscribe</a>.
    </p>
  </body>
</html>`;
}

/**
 * Every value interpolated into the HTML above came from a stranger through a
 * public form, so none of it is trusted. The contract caps the length; this
 * stops a name from closing a tag.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
