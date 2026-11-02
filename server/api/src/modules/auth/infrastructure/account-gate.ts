import type { SignInEvent } from '@injishi/auth';
import { and, eq, isNull } from 'drizzle-orm';

import { signInEvents } from '../../../database/drizzle/auth';
import { userSuspensions } from '../../../database/drizzle/governance';
import type { Database } from '../../../shared/database/database.module';

/** How a Better Auth route made the session, in the words staff read. */
export function signInMethod(path: string): string {
  if (path === '/sign-in/email-otp') return 'Email code';
  if (path === '/sign-in/email') return 'Password';
  if (path.startsWith('/callback/') || path.startsWith('/sign-in/social')) return 'Google';
  if (path.includes('phone')) return 'Phone code';
  if (path === '/change-password' || path.startsWith('/reset-password')) return 'Password change';
  return path ? `Other (${path})` : 'Other';
}

/**
 * The two account checks Better Auth asks the API (2026-11-02): may this
 * person sign in at all (not while suspended), and record each sign in for the
 * history on the person page.
 */
export class AccountGate {
  constructor(private readonly db: Database) {}

  /** `createAuth({ maySignIn })`: false while a suspension is live. */
  readonly maySignIn = async (userId: string): Promise<boolean> => {
    const [row] = await this.db
      .select({ id: userSuspensions.id })
      .from(userSuspensions)
      .where(and(eq(userSuspensions.userId, userId), isNull(userSuspensions.liftedAt)))
      .limit(1);
    return !row;
  };

  /** `createAuth({ onSignIn })`: one `sign_in_events` row. */
  readonly onSignIn = async (event: SignInEvent): Promise<void> => {
    await this.db.insert(signInEvents).values({
      userId: event.userId,
      sessionId: event.sessionId,
      method: signInMethod(event.path),
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
    });
  };
}
