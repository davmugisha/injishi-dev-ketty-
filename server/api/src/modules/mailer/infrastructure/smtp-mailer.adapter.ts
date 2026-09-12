import type { OnModuleDestroy } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';

import type { MailerPort, MailMessage } from '../domain/mailer-port';

/**
 * How long each stage of an SMTP exchange may take before the send is abandoned.
 *
 * Nodemailer's own defaults are two minutes to connect, thirty seconds for the
 * greeting and TEN MINUTES of socket silence. A relay that accepts the TCP
 * connection and then says nothing (a stuck container, a firewall that
 * swallows rather than refuses) would hold every send, and the socket under
 * it, for that long. Callers put their own ceiling over a send (`OtpMailer`
 * waits 8 seconds), but a ceiling only stops the CALLER waiting: the
 * connection underneath lives on until the transport gives up. These bounds
 * are what make it give up.
 *
 * Constants, not settings: a bound an environment can raise is not a bound.
 * `mailer.module.ts` refuses an `SMTP_URL` that tries to set them.
 */
export const SMTP_TIMEOUTS = {
  /** Resolving the relay's host name. */
  dnsTimeout: 5_000,
  /** Establishing the TCP (or TLS) connection. */
  connectionTimeout: 5_000,
  /** From connect to the server's 220 greeting. The silent-relay case. */
  greetingTimeout: 5_000,
  /** Any later silence mid-conversation, e.g. after DATA. */
  socketTimeout: 10_000,
} as const;

/** Any control character, line breaks included. `\p{Cc}` keeps the regex printable. */
const CONTROL_CHARACTER = /\p{Cc}/u;

/**
 * One bare address: no display name, no list separator, no quoting, no route.
 * Deliberately narrower than RFC 5322, because every address this platform
 * mails is one a person typed into a single email field.
 */
const BARE_ADDRESS = /^[^\s@<>(),;:"[\]\\]+@[^\s@<>(),;:"[\]\\]+$/u;

/**
 * The SMTP side of the mailer seam, on nodemailer.
 *
 * One transport per process, built at boot from `SMTP_URL`. Not pooled: a code
 * is a handful of mails a minute, and a pool is an idle connection held open to
 * a relay for nothing. Nodemailer opens a connection per send and closes it.
 */
export class SmtpMailerAdapter implements MailerPort, OnModuleDestroy {
  private readonly transport: Transporter;
  /**
   * The URL's password in every form it could be echoed in. Nodemailer does
   * not put the URL into its errors today; this makes that a property of the
   * adapter rather than of a dependency's current wording.
   */
  private readonly secrets: string[];

  /**
   * @param smtpUrl Already validated by `mailer.module.ts`. May carry credentials.
   * @param from The `From` header, `MAIL_FROM`. Already validated.
   */
  constructor(
    smtpUrl: string,
    private readonly from: string,
  ) {
    // Nodemailer lets the URL's query string override any option passed beside
    // it, so `?greetingTimeout=600000` would quietly lift a bound. The module
    // refuses such a URL at boot (`resolveMailerConfig`), which is what makes
    // these the bounds actually in force.
    this.transport = createTransport({ url: smtpUrl, ...SMTP_TIMEOUTS });
    this.secrets = passwordForms(smtpUrl);
  }

  async send(message: MailMessage): Promise<void> {
    // Nodemailer would fold a line break in a header into a space. Refused
    // instead: a subject or recipient carrying one is a bug or an injection
    // attempt upstream, and neither should be sent quietly reshaped.
    if (!BARE_ADDRESS.test(message.to) || CONTROL_CHARACTER.test(message.to)) {
      throw new Error('mail recipient must be one bare email address');
    }
    if (CONTROL_CHARACTER.test(message.subject)) {
      throw new Error('mail subject must be a single line');
    }

    try {
      await this.transport.sendMail({
        from: this.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        ...(message.html === undefined ? {} : { html: message.html }),
      });
    } catch (cause) {
      // Re-raised as a plain Error carrying only a scrubbed message. Nodemailer's
      // error objects also carry the server's reply and the command in flight,
      // and a caller that logs the error OBJECT would write all of it down.
      const reason = cause instanceof Error ? cause.message : String(cause);
      throw new Error(`SMTP delivery failed: ${this.scrub(reason)}`);
    }
  }

  onModuleDestroy(): void {
    this.transport.close();
  }

  private scrub(text: string): string {
    return this.secrets.reduce(
      (out, secret) => out.split(secret).join('***'),
      text,
    );
  }
}

/**
 * Stands in when `SMTP_URL` is unset, outside production only (the module
 * refuses the combination in production). Every send rejects, so a code that
 * could not be mailed takes `OtpMailer`'s failure route: an error, or the
 * `OTP_DEBUG_LOG` line in local development. It never pretends to have sent.
 */
export class UnconfiguredMailerAdapter implements MailerPort {
  send(): Promise<void> {
    return Promise.reject(new Error('SMTP_URL is not set'));
  }
}

/** The password in `smtpUrl`, raw and percent-decoded. Empty when there is none. */
function passwordForms(smtpUrl: string): string[] {
  let raw = '';
  try {
    raw = new URL(smtpUrl).password;
  } catch {
    return [];
  }
  const forms = new Set([raw]);
  try {
    forms.add(decodeURIComponent(raw));
  } catch {
    // A malformed escape: the raw form is all there is.
  }
  return [...forms].filter((form) => form.length > 0);
}
