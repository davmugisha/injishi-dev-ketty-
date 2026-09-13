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

/**
 * A file carried by the message (ADR-049 AC-20).
 *
 * ONE shape, and `content` is bytes rather than a path or a URL. A path would
 * make the mailer a reader of the host's filesystem, and a URL would make it a
 * fetcher — both are ways for a caller to talk the transport into reading
 * something it was never handed. The sender reads the bytes itself, through
 * whatever seam owns them, and passes them here.
 */
export interface MailAttachment {
  /**
   * What the recipient's client calls the file. A single line with no path
   * separators: the adapter refuses anything else, because a filename is a
   * header value and a `/` in one is a claim about somebody else's disk.
   */
  filename: string;
  content: Buffer;
  /** The MIME type, e.g. `application/pdf`. Stated, never sniffed. */
  contentType: string;
}

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
  /**
   * Files to attach. Absent on almost every message this platform sends.
   *
   * The one sender today is the training certificate mail (ADR-049 AC-20),
   * which attaches the PDF a trainer's tick issued. It is optional so that the
   * OTP path, which must never grow an attachment, is unchanged by its
   * existence.
   */
  attachments?: readonly MailAttachment[];
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
