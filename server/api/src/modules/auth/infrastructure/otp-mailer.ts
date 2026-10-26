import type { OtpType, SendOtp } from '@injishi/auth';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { isProduction } from '../../../shared/config/security.config';
import {
  MAILER_PORT,
  type MailerPort,
} from '../../mailer/domain/mailer-port';

/**
 * Delivers passwordless OTP codes over email, through the mailer seam
 * (`MAILER_PORT`, F-S07). This class owns the WORDS and the failure rule; how a
 * message leaves the building is `MailerModule`'s business. OTP validity +
 * shape are owned by @injishi/auth (10 min, 6 digits).
 *
 * A printed OTP is a working credential: anyone who can read the logs can sign
 * in as anyone. So codes are only ever logged when `OTP_DEBUG_LOG=true` is set
 * explicitly, and never in production whatever the flag says. Without that
 * opt-in, a failed send raises - a silently swallowed OTP is a user who can
 * never sign in.
 */
@Injectable()
export class OtpMailer {
  /**
   * Longest we will wait for the mail transport before treating the send as
   * failed. Sign-in is a foreground request; a relay that is unreachable
   * (no egress, DNS blackhole, a server that never greets) must not hold it
   * open. The SMTP adapter bounds each stage of its own exchange as well, so
   * the connection under an abandoned send does not outlive it by much.
   */
  private static readonly SEND_TIMEOUT_MS = 8_000;

  private readonly logger = new Logger(OtpMailer.name);
  private readonly debugLogOtp: boolean;

  constructor(
    @Inject(MAILER_PORT) private readonly mailer: MailerPort,
    config: ConfigService,
  ) {
    this.debugLogOtp =
      !isProduction(config.get<string>('NODE_ENV')) &&
      config.get<string>('OTP_DEBUG_LOG') === 'true';
  }

  /** Bound so it can be handed to `createAuth({ sendOtp })` as a value. */
  readonly send: SendOtp = async ({ email, otp, type }) => {
    // A `forget-password` code sets a password: a first one from the account
    // screen, or a new one after "Forgot password?" (2026-10-22). Calling it a
    // sign-in code would tell the person the wrong thing to do with it.
    const password = type === 'forget-password';
    const subject =
      type === 'sign-in'
        ? 'Your Injishi sign-in code'
        : password
          ? 'Your Injishi password code'
          : 'Your Injishi verification code';

    try {
      await this.withTimeout(
        this.mailer.send({
          to: email,
          subject,
          text: `Your Injishi code is ${otp}. It expires in 10 minutes. If you didn't request this, you can ignore this email.`,
          html: renderOtpEmail(otp, password),
        }),
      );
    } catch (cause) {
      // A send that never returns is worse than one that fails: Better Auth
      // awaits this hook inside the request, so an outbound call with no
      // ceiling leaves /email-otp/send-verification-otp hanging until the
      // client gives up, and the caller cannot tell a slow mailer from a dead
      // one. A timeout, a refused recipient and an unset `SMTP_URL` all take
      // this one route.
      this.deliveryFailed(
        email,
        type,
        otp,
        cause instanceof Error ? cause.message : 'mail transport failed',
      );
      return;
    }
    this.logger.log(`OTP email sent to ${email} (${type})`);
  };

  /**
   * Outbound mail gets a hard ceiling. Rejects rather than resolving, so the
   * caller cannot mistake a timeout for a successful send.
   */
  private withTimeout<T>(work: Promise<T>): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    const ceiling = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(
        () =>
          reject(
            new Error(
              `mail transport did not respond within ${OtpMailer.SEND_TIMEOUT_MS}ms`,
            ),
          ),
        OtpMailer.SEND_TIMEOUT_MS,
      );
    });
    return Promise.race([work, ceiling]).finally(() => {
      if (timer) clearTimeout(timer);
    }) as Promise<T>;
  }

  /**
   * The code could not be mailed. With `OTP_DEBUG_LOG=true` (never production)
   * print it so the sign-in flow stays exercisable without a mail provider;
   * otherwise fail loudly rather than leave the user with no code and no error.
   */
  private deliveryFailed(
    email: string,
    type: OtpType,
    otp: string,
    reason: string,
  ): void {
    if (this.debugLogOtp) {
      this.logger.warn(
        `[OTP_DEBUG_LOG] ${reason} — OTP for ${email} (${type}): ${otp}`,
      );
      return;
    }
    this.logger.error(`Failed to send OTP email to ${email}: ${reason}`);
    throw new Error(`Failed to send OTP email: ${reason}`);
  }
}

/** Minimal on-brand OTP email (ink text, generous spacing). */
function renderOtpEmail(otp: string, password = false): string {
  const title = password ? 'Your password code' : 'Your sign-in code';
  const lead = password
    ? 'Enter this code to set your Injishi password. It expires in 10 minutes.'
    : 'Enter this code to sign in to Injishi. It expires in 10 minutes.';
  return `<!doctype html>
<html>
  <body style="margin:0;background:#f4f6f6;padding:32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#042330;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:420px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;">
      <tr><td>
        <h1 style="margin:0 0 8px;font-size:20px;color:#042330;">${title}</h1>
        <p style="margin:0 0 24px;font-size:14px;color:#4a5c62;">${lead}</p>
        <div style="font-size:32px;font-weight:700;letter-spacing:10px;color:#22AD01;text-align:center;padding:16px 0;background:#f4f6f6;border-radius:12px;">${otp}</div>
        <p style="margin:24px 0 0;font-size:12px;color:#8a999e;">Didn't request this? You can safely ignore this email — no one can sign in without the code.</p>
      </td></tr>
    </table>
  </body>
</html>`;
}
