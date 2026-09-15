import type { EbmItemMapping } from '@injishi/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gt, isNull, lt, sql } from 'drizzle-orm';

import {
  ebmConnections,
  ebmInvoices,
  ebmOauthStates,
  orgs,
  workspaces,
} from '../../../database/drizzle/schema';
import {
  DRIZZLE,
  type Database,
} from '../../../shared/database/database.module';

export type EbmConnectionRow = typeof ebmConnections.$inferSelect;

/** The provider account states `ebm_connections_account_status_known` allows. */
const KNOWN_ACCOUNT_STATUSES: ReadonlySet<string> = new Set(['submitted', 'approved', 'disabled']);

/**
 * The provider's account state as it may be stored (platform audit step 3).
 *
 * A word outside the three is stored as null, "not known", which is what
 * every reader already made of it (`toAccountStatus`): it is not `approved`,
 * so it still cannot invoice. Storing the raw word would now fail the CHECK
 * and turn a provider adding a state into a failed connect.
 */
export function storableAccountStatus(value: string | null | undefined): string | null {
  return value != null && KNOWN_ACCOUNT_STATUSES.has(value) ? value : null;
}

/** The token half of a connection, sealed. Never plaintext past this line. */
export interface SealedTokens {
  accessTokenCiphertext: string;
  refreshTokenCiphertext: string | null;
  accessTokenExpiresAt: Date;
}

export interface ConnectedAccount {
  tin: string;
  accountName: string | null;
  accountStatus: string | null;
  branchId: string | null;
  vatRegistered: boolean | null;
  scopes: string[];
}

/**
 * `ebm_connections` and `ebm_oauth_states` (ADR-041).
 *
 * The repository never sees a plaintext token: callers hand it ciphertext from
 * `TokenCipher` and get ciphertext back. That keeps the one place a credential
 * is ever in the clear inside the service that is about to use it.
 */
@Injectable()
export class EbmConnectionRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async findByOrg(orgId: string): Promise<EbmConnectionRow | null> {
    const [row] = await this.db
      .select()
      .from(ebmConnections)
      .where(eq(ebmConnections.orgId, orgId))
      .limit(1);
    return row ?? null;
  }

  /** The org's registered TIN and name, the identity a connection must match. */
  async orgIdentity(
    orgId: string,
  ): Promise<{ tin: string | null; legalName: string } | null> {
    const [row] = await this.db
      .select({ tin: orgs.tin, legalName: orgs.legalName })
      .from(orgs)
      .where(eq(orgs.id, orgId))
      .limit(1);
    return row ?? null;
  }

  /**
   * The org's business workspace, which is where the operator app shows its
   * EBM connection. Null when the org has none; the callback then sends the
   * person to the app's front door rather than to a screen that does not exist.
   */
  async businessWorkspaceOf(orgId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(and(eq(workspaces.orgId, orgId), eq(workspaces.kind, 'business')))
      .limit(1);
    return row?.id ?? null;
  }

  /**
   * Record a successful consent.
   *
   * Reconnecting keeps the item mapping. The TIN has already been checked equal
   * to the org's, so it is the same EBM account and the same catalog, and
   * making an operator re-pick three items because a token expired would be
   * friction with nothing behind it.
   */
  async saveConnected(input: {
    orgId: string;
    account: ConnectedAccount;
    tokens: SealedTokens;
    connectedByUserId: string;
  }): Promise<void> {
    const now = new Date();
    const values = {
      status: 'connected' as const,
      tin: input.account.tin,
      accountName: input.account.accountName,
      accountStatus: storableAccountStatus(input.account.accountStatus),
      branchId: input.account.branchId,
      vatRegistered: input.account.vatRegistered,
      scopes: input.account.scopes,
      accessTokenCiphertext: input.tokens.accessTokenCiphertext,
      refreshTokenCiphertext: input.tokens.refreshTokenCiphertext,
      accessTokenExpiresAt: input.tokens.accessTokenExpiresAt,
      connectedByUserId: input.connectedByUserId,
      connectedAt: now,
      revokedAt: null,
      lastError: null,
      updatedAt: now,
    };
    await this.db
      .insert(ebmConnections)
      .values({ orgId: input.orgId, ...values })
      .onConflictDoUpdate({ target: ebmConnections.orgId, set: values });
  }

  async saveTokens(orgId: string, tokens: SealedTokens): Promise<void> {
    await this.db
      .update(ebmConnections)
      .set({ ...tokens, lastError: null, updatedAt: new Date() })
      .where(eq(ebmConnections.orgId, orgId));
  }

  async saveAccountStatus(orgId: string, accountStatus: string | null): Promise<void> {
    await this.db
      .update(ebmConnections)
      .set({ accountStatus: storableAccountStatus(accountStatus), updatedAt: new Date() })
      .where(eq(ebmConnections.orgId, orgId));
  }

  async saveMapping(orgId: string, mapping: EbmItemMapping): Promise<boolean> {
    const updated = await this.db
      .update(ebmConnections)
      .set({ ...mapping, updatedAt: new Date() })
      .where(eq(ebmConnections.orgId, orgId))
      .returning({ id: ebmConnections.id });
    return updated.length > 0;
  }

  /**
   * The connection stopped working. The tokens are overwritten with nothing a
   * cipher could open — not left in place "in case" — because a revoked
   * credential that still decrypts is a credential.
   */
  async revoke(orgId: string, reason: string): Promise<void> {
    const now = new Date();
    await this.db
      .update(ebmConnections)
      .set({
        status: 'revoked',
        revokedAt: now,
        lastError: reason.slice(0, 500),
        accessTokenCiphertext: 'revoked',
        refreshTokenCiphertext: null,
        accessTokenExpiresAt: now,
        updatedAt: now,
      })
      .where(eq(ebmConnections.orgId, orgId));
  }

  // -------------------------------------------------------------------------
  // OAuth states
  // -------------------------------------------------------------------------

  async saveState(input: {
    stateHash: string;
    codeVerifierCiphertext: string;
    orgId: string;
    userId: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.db.insert(ebmOauthStates).values(input);
  }

  /**
   * Take a state, once. The UPDATE is the lock: two callbacks racing on the
   * same state both run it, and only one gets a row back. An expired or used
   * state returns nothing, and so does one that never existed — the caller
   * cannot tell them apart and does not need to.
   */
  async consumeState(
    stateHash: string,
    now: Date = new Date(),
  ): Promise<{ orgId: string; userId: string; codeVerifierCiphertext: string } | null> {
    const [row] = await this.db
      .update(ebmOauthStates)
      .set({ consumedAt: now })
      .where(
        and(
          eq(ebmOauthStates.stateHash, stateHash),
          isNull(ebmOauthStates.consumedAt),
          gt(ebmOauthStates.expiresAt, now),
        ),
      )
      .returning({
        orgId: ebmOauthStates.orgId,
        userId: ebmOauthStates.userId,
        codeVerifierCiphertext: ebmOauthStates.codeVerifierCiphertext,
      });
    return row ?? null;
  }

  /**
   * Delete consents that can no longer be completed — spent, or past their
   * ten minutes — once they are a day old. The day is slack for reading a row
   * while investigating a failed connect; after it, a sealed verifier for a
   * consent nobody can finish is only something to leak.
   */
  async pruneStates(olderThan: Date): Promise<number> {
    const rows = await this.db
      .delete(ebmOauthStates)
      .where(lt(ebmOauthStates.expiresAt, olderThan))
      .returning({ id: ebmOauthStates.id });
    return rows.length;
  }

  // -------------------------------------------------------------------------
  // What the connection is holding up
  // -------------------------------------------------------------------------

  async heldSaleCount(orgId: string): Promise<number> {
    const [row] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(ebmInvoices)
      .where(and(eq(ebmInvoices.orgId, orgId), eq(ebmInvoices.status, 'held')));
    return row?.n ?? 0;
  }

  /**
   * Make every sale waiting on this org's setup due now. Called when the
   * connection becomes usable — connected, mapped, or approved at the provider
   * — so held sales go out without waiting for anyone to notice.
   *
   * Only `held` rows with no next attempt: those are the ones waiting on a
   * precondition. A `failed` row with no next attempt is an unknown outcome
   * waiting on a PERSON, and re-arming it here would be the automatic retry
   * that could declare a stay twice.
   */
  async rearmHeld(orgId: string, now: Date = new Date()): Promise<number> {
    const rows = await this.db
      .update(ebmInvoices)
      .set({ nextAttemptAt: now, updatedAt: now })
      .where(
        and(
          eq(ebmInvoices.orgId, orgId),
          eq(ebmInvoices.status, 'held'),
          isNull(ebmInvoices.nextAttemptAt),
        ),
      )
      .returning({ id: ebmInvoices.id });
    return rows.length;
  }
}
