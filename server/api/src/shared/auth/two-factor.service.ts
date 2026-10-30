import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import {
  ForbiddenException,
  Inject,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  DEMO_OTP_CODE,
  OTP_EXPIRY_SECONDS,
  OTP_LENGTH,
  OTP_MAX_ATTEMPTS,
} from '@injishi/auth';
import { eq } from 'drizzle-orm';

import { OtpMailer } from '../../modules/auth/infrastructure/otp-mailer';
import { sessions, twoFactorChallenges, users } from '../../database/drizzle/schema';
import { PLATFORM, type Platform } from '../config/platform';
import { maskEmail } from '../identity/mask';
import { DRIZZLE, type Database } from '../database/database.module';
import { WorkspaceService } from './workspace.service';

/**
 * The second factor (F-S02): a one-time code emailed at step-up.
 *
 * WHAT THIS IS, HONESTLY. For Google and phone sign-in it is a real mailbox
 * check the session has not yet made. For email OTP sign-in it is NOT asked
 * again: that path already proved the mailbox, and `@injishi/auth` marks the
 * new session stepped up at create time so the person is not shown a second
 * identical code screen. The step-up still buys something for Google/phone —
 * a stolen, still-valid session cookie alone cannot satisfy it — but it is not
 * multi-factor in the sense an authenticator app or a security key would be.
 * Recorded here so nobody later reads "two factor" in a file name and assumes
 * more than is true.
 *
 * WHAT IS ENFORCED, AND WHERE. A person who holds an operator workspace
 * (business or broker) or an oversight assignment must have `twoFactorVerifiedAt`
 * set on THIS session. `WorkspaceGuard` and `OversightGuard` refuse otherwise,
 * which makes the API the boundary; the apps read the same answer from `/me/*`
 * so they can send someone to the code screen before a 403 rather than after
 * one. A guest who holds neither is never asked.
 *
 * THERE IS NO ENROLMENT. That is the point of moving off TOTP: the address is
 * already verified, so the step-up works on a new device, a borrowed laptop and
 * a fresh account with nothing to set up first.
 */

export interface TwoFactorStatus {
  /** Does this person's role require the step-up at all? */
  required: boolean;
  /** Has THIS session presented a valid code? */
  verified: boolean;
}

/** The one refusal a guard raises. Clients route on the `code`. */
export type TwoFactorRefusal = 'two_factor_required';

/** A resend before this has elapsed is refused, so the mailbox is not flooded. */
export const RESEND_COOLDOWN_SECONDS = 30;

/** `samuel@injishi.com` → `sa••••@injishi.com`, for "we sent a code to …". One rule, in `shared/identity/mask`. */
export { maskEmail };

function hash(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

/** Constant-time compare of two hex digests of equal length. */
function digestsMatch(a: string, b: string): boolean {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  if (left.length !== right.length || left.length === 0) return false;
  return timingSafeEqual(left, right);
}

@Injectable()
export class TwoFactorService {
  /**
   * Whether this process is the demo.
   *
   * The demo issues the fixed code so a demo works with no mailbox, exactly as
   * demo sign-in does. Read from `PLATFORM`, which only says demo over a
   * database carrying the sample marker, and the fixed value is only ever read
   * inside this branch, so production cannot be configured into issuing it
   * (ADR-043 AC-12).
   */
  private readonly isDemo: boolean;

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    @Inject(PLATFORM) platform: Platform,
    private readonly workspaces: WorkspaceService,
    private readonly mailer: OtpMailer,
  ) {
    this.isDemo = platform.environment === 'demo';
  }

  /** Operators and officers must step up; a guest who holds nothing need not. */
  async requiredFor(userId: string): Promise<boolean> {
    const [held, grants] = await Promise.all([
      this.workspaces.listForUser(userId),
      this.workspaces.oversightGrantsForUser(userId),
    ]);
    return (
      held.some((w) => w.kind === 'business' || w.kind === 'broker') ||
      grants.length > 0
    );
  }

  /** Has this session stepped up? Asked without the role question. */
  async stateFor(
    _userId: string,
    sessionId: string,
  ): Promise<Pick<TwoFactorStatus, 'verified'>> {
    const [session] = await this.db
      .select({ verifiedAt: sessions.twoFactorVerifiedAt })
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .limit(1);
    return { verified: session?.verifiedAt != null };
  }

  async statusFor(userId: string, sessionId: string): Promise<TwoFactorStatus> {
    const [required, state] = await Promise.all([
      this.requiredFor(userId),
      this.stateFor(userId, sessionId),
    ]);
    return { required, ...state };
  }

  /**
   * The refusal a guard throws, or null when this session may proceed.
   *
   * One cause and one code, unlike the TOTP arrangement this replaced: with
   * nothing to enrol, "you have not set it up" cannot happen, so every client
   * routes to the same screen.
   */
  async refusalFor(
    userId: string,
    sessionId: string,
  ): Promise<{ code: TwoFactorRefusal; message: string } | null> {
    const status = await this.statusFor(userId, sessionId);
    if (!status.required || status.verified) return null;
    return {
      code: 'two_factor_required',
      message: 'Enter the code we emailed you to continue.',
    };
  }

  /** Throws the refusal a guard needs, in the shape the apps read. */
  async assertSatisfied(userId: string, sessionId: string): Promise<void> {
    const refusal = await this.refusalFor(userId, sessionId);
    if (refusal) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        message: refusal.message,
        code: refusal.code,
      });
    }
  }

  /** The address a code goes to, for the screen that asks for it. */
  async emailFor(userId: string): Promise<string> {
    const [row] = await this.db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return row?.email ?? '';
  }

  /**
   * Email a fresh code for THIS session.
   *
   * The challenge is keyed by SESSION, not by person: a code requested on a
   * phone cannot be typed into a laptop that never asked for one, and signing
   * out of one device does not hand its pending code to another.
   *
   * Sending replaces any live challenge, so the newest code is the only one
   * that works — a resend must not leave the previous code valid.
   */
  async sendCode(
    userId: string,
    sessionId: string,
  ): Promise<{ sentTo: string; expiresInSeconds: number }> {
    const [existing] = await this.db
      .select({ createdAt: twoFactorChallenges.createdAt })
      .from(twoFactorChallenges)
      .where(eq(twoFactorChallenges.sessionId, sessionId))
      .limit(1);

    // No resend wait on the demo: its code is fixed and mailed only to its own
    // Mailpit, so there is no mailbox to flood and nothing to protect.
    if (existing && !this.isDemo) {
      const age = (Date.now() - existing.createdAt.getTime()) / 1000;
      if (age < RESEND_COOLDOWN_SECONDS) {
        // Coded so a client that reopened mid wait knows a code is already on
        // its way and just asks for it (mobile spec 0003, D-at).
        throw new UnprocessableEntityException({
          code: 'resend_cooldown',
          message: `Wait ${Math.ceil(RESEND_COOLDOWN_SECONDS - age)} seconds before asking for another code.`,
        });
      }
    }

    const email = await this.emailFor(userId);
    if (!email) {
      throw new UnprocessableEntityException(
        'This account has no email address to send a code to.',
      );
    }

    // Demo issues the fixed code (no mailbox in a demo); production always
    // draws a fresh random one. `randomInt` is the CSPRNG, not `Math.random`.
    const code = this.isDemo
      ? DEMO_OTP_CODE
      : String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, '0');

    const expiresAt = new Date(Date.now() + OTP_EXPIRY_SECONDS * 1000);
    const now = new Date();
    const row = {
      userId,
      sessionId,
      codeHash: hash(code),
      expiresAt,
      attempts: 0,
      createdAt: now,
      updatedAt: now,
    };

    // Hashed at rest, like the sign-in code: a read of this table (a backup, a
    // support query) must not be a working step-up for every pending session.
    await this.db
      .insert(twoFactorChallenges)
      .values(row)
      .onConflictDoUpdate({
        target: twoFactorChallenges.sessionId,
        set: {
          codeHash: row.codeHash,
          expiresAt: row.expiresAt,
          attempts: 0,
          createdAt: now,
          updatedAt: now,
        },
      });

    // `email-verification` rather than `sign-in`: this is a step-up on a
    // session that already exists, and the subject line should say so. The
    // demo mails too: its stack has a Mailpit of its own and no relay, so the
    // mail reaches nobody outside it (ADR-043 AC-4).
    await this.mailer.send({ email, otp: code, type: 'email-verification' });

    return { sentTo: maskEmail(email), expiresInSeconds: OTP_EXPIRY_SECONDS };
  }

  /**
   * Check a code and, when it matches, mark THIS session stepped up.
   *
   * A wrong guess counts against the challenge; the code dies at
   * `OTP_MAX_ATTEMPTS`, so a six digit code cannot be walked through.
   */
  async verify(userId: string, sessionId: string, code: string): Promise<void> {
    const [challenge] = await this.db
      .select()
      .from(twoFactorChallenges)
      .where(eq(twoFactorChallenges.sessionId, sessionId))
      .limit(1);

    if (!challenge || challenge.userId !== userId) {
      throw new UnprocessableEntityException(
        'Ask for a code before entering one.',
      );
    }

    if (challenge.expiresAt.getTime() <= Date.now()) {
      await this.db
        .delete(twoFactorChallenges)
        .where(eq(twoFactorChallenges.sessionId, sessionId));
      throw new UnprocessableEntityException(
        'That code has expired. Ask for a new one.',
      );
    }

    // No attempts cap on the demo: the code is published, so walking it guards
    // nothing, and a burnt code only strands the visitor who mistyped it.
    if (!this.isDemo && challenge.attempts >= OTP_MAX_ATTEMPTS) {
      await this.db
        .delete(twoFactorChallenges)
        .where(eq(twoFactorChallenges.sessionId, sessionId));
      throw new UnprocessableEntityException(
        'Too many wrong codes. Ask for a new one.',
      );
    }

    if (!digestsMatch(challenge.codeHash, hash(code.trim()))) {
      await this.db
        .update(twoFactorChallenges)
        .set({ attempts: challenge.attempts + 1, updatedAt: new Date() })
        .where(eq(twoFactorChallenges.sessionId, sessionId));
      throw new UnprocessableEntityException(
        "That code didn't match. Check the email and try again.",
      );
    }

    const now = new Date();
    await this.db.transaction(async (tx) => {
      await tx
        .update(sessions)
        .set({ twoFactorVerifiedAt: now, updatedAt: now })
        .where(eq(sessions.id, sessionId));
      // Spent. A code that verified must not verify twice.
      await tx
        .delete(twoFactorChallenges)
        .where(eq(twoFactorChallenges.sessionId, sessionId));
    });
  }
}
