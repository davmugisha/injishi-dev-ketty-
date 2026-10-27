import { and, eq, gt, or, sql } from 'drizzle-orm';

import { accounts, sessions, users } from '../../../database/drizzle/auth';
import { leaseInvitations, tenants } from '../../../database/drizzle/residence';
import type { Database } from '../../../shared/database/database.module';

/**
 * The reads behind "passwords are for tenants" (2026-10-23).
 *
 * A tenant is somebody a tenant record is linked to (`tenants.user_id`, set
 * when they accept a lease invitation), or somebody with an open or accepted
 * lease invitation to their address: the moment they confirm the invitation's
 * code they are offered a password, before the lease is theirs. An expired or
 * revoked invitation offers nothing.
 */
export class PasswordHolders {
  constructor(private readonly db: Database) {}

  /** `createAuth({ mayHoldPassword })`, and the API's own check. */
  readonly isTenant = async (userId: string): Promise<boolean> => {
    const [linked] = await this.db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.userId, userId))
      .limit(1);
    if (linked) return true;
    const [invited] = await this.db
      .select({ id: leaseInvitations.id })
      .from(leaseInvitations)
      .innerJoin(users, sql`${leaseInvitations.email} = lower(${users.email})`)
      .where(
        and(
          eq(users.id, userId),
          or(
            eq(leaseInvitations.status, 'accepted'),
            and(eq(leaseInvitations.status, 'sent'), gt(leaseInvitations.expiresAt, sql`now()`)),
          ),
        ),
      )
      .limit(1);
    return Boolean(invited);
  };

  /** Whether this user has a password already. */
  async hasPassword(userId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: accounts.id })
      .from(accounts)
      .where(and(eq(accounts.userId, userId), eq(accounts.providerId, 'credential')))
      .limit(1);
    return Boolean(row);
  }

  /** When this session was made, and when it last proved an emailed code. */
  async session(sessionId: string): Promise<{ createdAt: Date; twoFactorVerifiedAt: Date | null } | null> {
    const [row] = await this.db
      .select({ createdAt: sessions.createdAt, twoFactorVerifiedAt: sessions.twoFactorVerifiedAt })
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .limit(1);
    return row ?? null;
  }
}
