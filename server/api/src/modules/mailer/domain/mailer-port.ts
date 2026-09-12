/**
 * The mailer seam (F-S07).
 *
 * ONE interface for every email the platform sends, which today is a sign-in or
 * step-up code. Business logic calls this and nothing else: it never names a
 * transport, never sees an SMTP reply code, and never branches on whether mail
 * is configured. Choosing a transport is `mailer.module.ts` and nothing above it
 * (library-docs: never call a provider SDK directly from a domain service).
 *
 * The seam is SMTP-shaped on purpose. Mailpit in development, Mailpit in
 * staging and a relay in production all speak it, so the environments differ
 * by one URL rather than by one adapter each.
 */

/** Nest injection token. Everything depends on the interface, not a class. */
export const MAILER_PORT = 'MAILER_PORT';

/** One email to send. */
export interface MailMessage {
  /**
   * ONE recipient, as a bare address (`someone@example.com`). Not a list and
   * not a display-name form: an address string that silently fans out to a
   * second recipient is how a sign-in code reaches somebody else's inbox, so
   * the adapter refuses anything that is not a single address.
   */
  to: string;
  /** A single line. Line breaks are refused, never folded into a header. */
  subject: string;
  /** The plain-text body. Always present, so every client can read the mail. */
  text: string;
  /** Optional HTML alternative to `text`. */
  html?: string;
}

export interface MailerPort {
  /**
   * Hand one message to the transport, or reject.
   *
   * Resolving means the transport ACCEPTED the message, never that a mailbox
   * received it. Rejection is always an `Error` whose message is safe to log:
   * it never carries the transport's credentials.
   */
  send(message: MailMessage): Promise<void>;
}
