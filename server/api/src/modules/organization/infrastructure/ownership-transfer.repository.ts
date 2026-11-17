import { mayElevate, type OrgRole } from '@injishi/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { aliasedTable, and, eq, gt, lte, sql } from 'drizzle-orm';

import {
  identityDocuments,
  orgMemberships,
  orgs,
  ownershipTransfers,
  users,
  verifiedIdentities,
} from '../../../database/drizzle/schema';
import { AuditWriter } from '../../../shared/audit/audit-writer';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';

/** Why a transfer step was refused. The service decides what the caller is told (most collapse to one sentence). */
export class TransferRefused extends Error {
  constructor(
    readonly why:
      | 'already_pending'
      | 'not_open'
      | 'expired'
      | 'requester_not_owner'
      | 'recipient_not_member'
      | 'recipient_not_verified',
  ) {
    super(why);
  }
}

export interface TransferRow {
  id: string;
  orgId: string;
  legalName: string;
  fromUserId: string;
  fromName: string;
  toUserId: string;
  toName: string;
  toEmail: string;
  previousOwnerRole: OrgRole;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled' | 'expired';
  expiresAt: Date;
  createdAt: Date;
}

const fromUser = aliasedTable(users, 'from_user');
const toUser = aliasedTable(users, 'to_user');

/** A request that can still be decided: pending and not past its expiry. */
const open = () => and(eq(ownershipTransfers.status, 'pending'), gt(ownershipTransfers.expiresAt, sql`now()`));

/**
 * Ownership transfer requests and the one transaction that changes hands (migration 0155).
 *
 * Every write is conditional on the request still being `pending` (and, to accept, unexpired and addressed to the
 * person accepting), so two presses, or a cancel racing an accept, end with one outcome and never a doubled change.
 * Accepting makes the new owner `owner` BEFORE the person who asked takes their new role, so the business never has
 * no owner, not even inside the transaction.
 */
@Injectable()
export class OwnershipTransferRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  private select() {
    return this.db
      .select({
        id: ownershipTransfers.id,
        orgId: ownershipTransfers.orgId,
        legalName: orgs.legalName,
        fromUserId: ownershipTransfers.fromUserId,
        fromName: sql<string>`coalesce(nullif(trim(${fromUser.name}), ''), ${fromUser.email})`,
        toUserId: ownershipTransfers.toUserId,
        toName: sql<string>`coalesce(nullif(trim(${toUser.name}), ''), ${toUser.email})`,
        toEmail: toUser.email,
        previousOwnerRole: ownershipTransfers.previousOwnerRole,
        status: ownershipTransfers.status,
        expiresAt: ownershipTransfers.expiresAt,
        createdAt: ownershipTransfers.createdAt,
      })
      .from(ownershipTransfers)
      .innerJoin(orgs, eq(orgs.id, ownershipTransfers.orgId))
      .innerJoin(fromUser, eq(fromUser.id, ownershipTransfers.fromUserId))
      .innerJoin(toUser, eq(toUser.id, ownershipTransfers.toUserId));
  }

  /** The business's open request, if any. */
  async openForOrg(orgId: string): Promise<TransferRow | null> {
    const [row] = await this.select().where(and(eq(ownershipTransfers.orgId, orgId), open())).limit(1);
    return (row as TransferRow | undefined) ?? null;
  }

  /** The open requests that would make this person an owner. */
  async openForRecipient(userId: string): Promise<TransferRow[]> {
    return (await this.select().where(and(eq(ownershipTransfers.toUserId, userId), open()))) as TransferRow[];
  }

  /** A member of the business, as the request needs them: role, status and whether their identity is verified. */
  async member(
    orgId: string,
    userId: string,
  ): Promise<{ orgRole: OrgRole; status: string; name: string; email: string; verified: boolean } | null> {
    const [row] = await this.db
      .select({
        orgRole: orgMemberships.orgRole,
        status: orgMemberships.status,
        name: sql<string>`coalesce(nullif(trim(${users.name}), ''), ${users.email})`,
        email: users.email,
      })
      .from(orgMemberships)
      .innerJoin(users, eq(users.id, orgMemberships.userId))
      .where(and(eq(orgMemberships.orgId, orgId), eq(orgMemberships.userId, userId)))
      .limit(1);
    if (!row) return null;
    return { ...row, verified: await this.verified(this.db, userId) };
  }

  /**
   * The members who could become owner: active, not already an owner, and identity-verified by `mayElevate` (KYC
   * verified and an active document), the same rule `accept` checks again at the moment of accepting.
   */
  async eligible(orgId: string): Promise<{ userId: string; name: string; orgRole: OrgRole }[]> {
    const rows = await this.db
      .select({
        userId: orgMemberships.userId,
        name: sql<string>`coalesce(nullif(trim(${users.name}), ''), ${users.email})`,
        orgRole: orgMemberships.orgRole,
        kycStatus: verifiedIdentities.kycStatus,
        activeDocumentCount: sql<number>`(select count(*)::int from ${identityDocuments} d where d.identity_id = ${orgMemberships.userId} and d.status = 'active')`,
      })
      .from(orgMemberships)
      .innerJoin(users, eq(users.id, orgMemberships.userId))
      .leftJoin(verifiedIdentities, eq(verifiedIdentities.userId, orgMemberships.userId))
      .where(and(eq(orgMemberships.orgId, orgId), eq(orgMemberships.status, 'active')));
    return rows
      .filter(
        (r) =>
          r.orgRole !== 'owner' &&
          mayElevate({ kycStatus: r.kycStatus ?? 'unverified', activeDocumentCount: Number(r.activeDocumentCount) }),
      )
      .map((r) => ({ userId: r.userId, name: r.name, orgRole: r.orgRole }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /** `mayElevate`, the platform's one rule for a verified identity: KYC verified and an active document. */
  private async verified(db: Pick<Database, 'select'>, userId: string): Promise<boolean> {
    const [identity] = await db
      .select({ kycStatus: verifiedIdentities.kycStatus })
      .from(verifiedIdentities)
      .where(eq(verifiedIdentities.userId, userId))
      .limit(1);
    const [docs] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(identityDocuments)
      .where(and(eq(identityDocuments.identityId, userId), eq(identityDocuments.status, 'active')));
    return mayElevate({ kycStatus: identity?.kycStatus ?? 'unverified', activeDocumentCount: docs?.n ?? 0 });
  }

  /**
   * Open a request. A request left pending past its expiry is closed as `expired` first, so it never blocks a new
   * one; a live one does (`already_pending`, by the partial unique index as well as here).
   */
  async create(input: {
    orgId: string;
    fromUserId: string;
    toUserId: string;
    previousOwnerRole: OrgRole;
    expiresAt: Date;
  }): Promise<string> {
    return this.db.transaction(async (tx) => {
      await tx
        .update(ownershipTransfers)
        .set({ status: 'expired', updatedAt: new Date() })
        .where(
          and(
            eq(ownershipTransfers.orgId, input.orgId),
            eq(ownershipTransfers.status, 'pending'),
            lte(ownershipTransfers.expiresAt, sql`now()`),
          ),
        );
      const [live] = await tx
        .select({ id: ownershipTransfers.id })
        .from(ownershipTransfers)
        .where(and(eq(ownershipTransfers.orgId, input.orgId), eq(ownershipTransfers.status, 'pending')))
        .limit(1);
      if (live) throw new TransferRefused('already_pending');
      const [row] = await tx
        .insert(ownershipTransfers)
        .values({ ...input, status: 'pending' })
        .returning({ id: ownershipTransfers.id });
      if (!row) throw new Error('ownership transfer insert returned no row');
      await AuditWriter.write(tx, {
        actorUserId: input.fromUserId,
        subjectType: 'org',
        subjectId: input.orgId,
        eventType: 'team.ownership_transfer_requested',
        payloadDiff: {
          transferId: row.id,
          toUserId: input.toUserId,
          previousOwnerRole: input.previousOwnerRole,
          expiresAt: input.expiresAt.toISOString(),
        } as never,
      });
      return row.id;
    });
  }

  /** The owner withdraws the business's open request. */
  async cancel(input: { orgId: string; transferId: string; actorUserId: string }): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const done = await tx
        .update(ownershipTransfers)
        .set({ status: 'cancelled', decidedAt: new Date(), decidedByUserId: input.actorUserId, updatedAt: new Date() })
        .where(
          and(
            eq(ownershipTransfers.id, input.transferId),
            eq(ownershipTransfers.orgId, input.orgId),
            eq(ownershipTransfers.status, 'pending'),
          ),
        )
        .returning({ id: ownershipTransfers.id });
      if (done.length === 0) return false;
      await AuditWriter.write(tx, {
        actorUserId: input.actorUserId,
        subjectType: 'org',
        subjectId: input.orgId,
        eventType: 'team.ownership_transfer_cancelled',
        payloadDiff: { transferId: input.transferId } as never,
      });
      return true;
    });
  }

  /** The person asked says no. Only them, only while the request is open. */
  async decline(input: { transferId: string; userId: string }): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const done = await tx
        .update(ownershipTransfers)
        .set({ status: 'declined', decidedAt: new Date(), decidedByUserId: input.userId, updatedAt: new Date() })
        .where(and(eq(ownershipTransfers.id, input.transferId), eq(ownershipTransfers.toUserId, input.userId), open()))
        .returning({ id: ownershipTransfers.id, orgId: ownershipTransfers.orgId });
      const row = done[0];
      if (!row) return false;
      await AuditWriter.write(tx, {
        actorUserId: input.userId,
        subjectType: 'org',
        subjectId: row.orgId,
        eventType: 'team.ownership_transfer_declined',
        payloadDiff: { transferId: input.transferId } as never,
      });
      return true;
    });
  }

  /**
   * Accept: the business changes hands, all or nothing.
   *
   * In one transaction, under a lock on the request: it must still be pending, unexpired and addressed to the person
   * accepting; the person who asked must still be an active owner; the person accepting must still be an active member
   * with a verified identity. Then the new owner becomes `owner`, the person who asked takes the role they chose, the
   * request is spent, and the audit row is written. Any failed check throws `TransferRefused` and nothing is kept.
   */
  async accept(input: { transferId: string; userId: string }): Promise<{ orgId: string; fromUserId: string; previousOwnerRole: OrgRole }> {
    return this.db.transaction(async (tx) => {
      const [transfer] = await tx
        .select()
        .from(ownershipTransfers)
        .where(
          and(
            eq(ownershipTransfers.id, input.transferId),
            eq(ownershipTransfers.toUserId, input.userId),
            eq(ownershipTransfers.status, 'pending'),
          ),
        )
        .for('update')
        .limit(1);
      if (!transfer) throw new TransferRefused('not_open');
      if (transfer.expiresAt.getTime() <= Date.now()) throw new TransferRefused('expired');

      const [requester] = await tx
        .select({ id: orgMemberships.id })
        .from(orgMemberships)
        .where(
          and(
            eq(orgMemberships.orgId, transfer.orgId),
            eq(orgMemberships.userId, transfer.fromUserId),
            eq(orgMemberships.orgRole, 'owner'),
            eq(orgMemberships.status, 'active'),
          ),
        )
        .limit(1);
      if (!requester) throw new TransferRefused('requester_not_owner');

      const [recipient] = await tx
        .select({ id: orgMemberships.id, orgRole: orgMemberships.orgRole })
        .from(orgMemberships)
        .where(
          and(
            eq(orgMemberships.orgId, transfer.orgId),
            eq(orgMemberships.userId, input.userId),
            eq(orgMemberships.status, 'active'),
          ),
        )
        .limit(1);
      if (!recipient) throw new TransferRefused('recipient_not_member');
      if (!(await this.verified(tx, input.userId))) throw new TransferRefused('recipient_not_verified');

      const now = new Date();
      // The new owner first: from here to the end of the transaction the business always has an owner.
      await tx
        .update(orgMemberships)
        .set({ orgRole: 'owner', updatedAt: now })
        .where(eq(orgMemberships.id, recipient.id));
      const demoted = await tx
        .update(orgMemberships)
        .set({ orgRole: transfer.previousOwnerRole, updatedAt: now })
        .where(and(eq(orgMemberships.id, requester.id), eq(orgMemberships.orgRole, 'owner')))
        .returning({ id: orgMemberships.id });
      if (demoted.length !== 1) throw new TransferRefused('requester_not_owner');

      const [owners] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(orgMemberships)
        .where(
          and(
            eq(orgMemberships.orgId, transfer.orgId),
            eq(orgMemberships.orgRole, 'owner'),
            eq(orgMemberships.status, 'active'),
          ),
        );
      if ((owners?.n ?? 0) < 1) throw new Error('ownership transfer would leave the business without an owner');

      const spent = await tx
        .update(ownershipTransfers)
        .set({ status: 'accepted', decidedAt: now, decidedByUserId: input.userId, updatedAt: now })
        .where(and(eq(ownershipTransfers.id, transfer.id), eq(ownershipTransfers.status, 'pending')))
        .returning({ id: ownershipTransfers.id });
      if (spent.length !== 1) throw new TransferRefused('not_open');

      await AuditWriter.write(tx, {
        actorUserId: input.userId,
        subjectType: 'org',
        subjectId: transfer.orgId,
        eventType: 'team.ownership_transferred',
        payloadDiff: {
          transferId: transfer.id,
          fromUserId: transfer.fromUserId,
          toUserId: input.userId,
          toPreviousRole: recipient.orgRole,
          previousOwnerRole: transfer.previousOwnerRole,
        } as never,
      });
      return { orgId: transfer.orgId, fromUserId: transfer.fromUserId, previousOwnerRole: transfer.previousOwnerRole };
    });
  }
}
