import { randomUUID } from 'node:crypto';

import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { PayoutAccountInput, PayoutAccountList } from '@injishi/contracts';

import type { TokenCipher } from '../../platform/fiscal/infrastructure/token-cipher';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { destinationOf, detailsOf, last4, sameDestination, type PayoutAccountDetails } from '../domain/payout-accounts';
import { assertResidence, type ResidenceWorkspace } from '../domain/residence';
import { PAYOUT_ACCOUNT_CIPHER, accountNumberContext } from '../infrastructure/payout-account-cipher';
import {
  PayoutAccountsRepository,
  type PayoutAccountRow,
  type PayoutAccountStored,
} from '../infrastructure/payout-accounts.repository';
import { RentalsAuditWriter } from '../infrastructure/rentals-writers';
import { presentPayoutAccount } from './rentals-presenters';

/**
 * Getting paid (blueprint 1.2 and 2.3; feat/rentals' payout accounts, ported):
 * the bank account, MoMo number or MoMo Pay code the gateway pays the
 * business's rent out to.
 *
 * Read by whoever reads the money; changed only with `payout.manage`, the
 * owner's by default, because whoever changes it decides where every tenant's
 * rent lands. One active primary per business: the first account added is
 * primary whatever was asked, a retired primary hands over to the newest
 * other account, and every change is audited against the account. A bank
 * account number is sealed before it reaches the repository and only its last
 * four digits ever leave this service. Every write answers the whole list.
 *
 * Held payouts released when an account is added, and the email to the
 * business's owners on every change, come with the payout job (WP 1.6b).
 */
@Injectable()
export class PayoutAccountsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly accounts: PayoutAccountsRepository,
    @Inject(PAYOUT_ACCOUNT_CIPHER) private readonly cipher: TokenCipher,
    private readonly audit: RentalsAuditWriter,
  ) {}

  async list(ws: ScopedWorkspace): Promise<PayoutAccountList> {
    const r = assertResidence(ws);
    return { accounts: (await this.accounts.list(r.orgId)).map(presentPayoutAccount) };
  }

  async create(ws: ScopedWorkspace, userId: string, body: PayoutAccountInput): Promise<PayoutAccountList> {
    const r = assertResidence(ws);
    const details = detailsOf(body);
    const id = randomUUID();
    await this.db.transaction(async (tx) => {
      const current = await this.accounts.lockOrg(tx, r.orgId);
      this.assertNotListed(r, details, current);
      const primary = current.every((a) => !a.isPrimary) || (body.makePrimary ?? false);
      // Clear the old primary first: one active primary per org is a unique index.
      if (primary) await this.accounts.clearPrimary(tx, r.orgId);
      await this.accounts.insert(tx, {
        ...this.seal(r, id, details),
        id,
        orgId: r.orgId,
        workspaceId: r.workspaceId,
        createdByUserId: userId,
        isPrimary: primary,
      });
      await this.audit.write(tx, {
        actorUserId: userId,
        subjectType: 'payout_account',
        subjectId: id,
        eventType: 'payout_account.added',
        diff: { kind: details.kind, destination: destinationOf(this.masked(details)), primary },
      });
    });
    return this.list(ws);
  }

  /** Replace an account's details (the whole account is sent again). Its primary standing stays unless asked. */
  async update(ws: ScopedWorkspace, userId: string, id: string, body: PayoutAccountInput): Promise<PayoutAccountList> {
    const r = assertResidence(ws);
    const details = detailsOf(body);
    await this.db.transaction(async (tx) => {
      const current = await this.accounts.lockOrg(tx, r.orgId);
      const row = current.find((a) => a.id === id);
      if (!row) throw await this.missing(id, r);
      this.assertNotListed(
        r,
        details,
        current.filter((a) => a.id !== id),
      );
      await this.accounts.update(tx, id, this.seal(r, id, details));
      if (body.makePrimary && !row.isPrimary) await this.accounts.makePrimary(tx, r.orgId, id);
      await this.audit.write(tx, {
        actorUserId: userId,
        subjectType: 'payout_account',
        subjectId: id,
        eventType: 'payout_account.changed',
        diff: {
          from: destinationOf(row),
          to: destinationOf(this.masked(details)),
          primary: row.isPrimary || Boolean(body.makePrimary),
        },
      });
    });
    return this.list(ws);
  }

  async makePrimary(ws: ScopedWorkspace, userId: string, id: string): Promise<PayoutAccountList> {
    const r = assertResidence(ws);
    await this.db.transaction(async (tx) => {
      const current = await this.accounts.lockOrg(tx, r.orgId);
      const row = current.find((a) => a.id === id);
      if (!row) throw await this.missing(id, r);
      if (row.isPrimary) return;
      const before = current.find((a) => a.isPrimary) ?? null;
      await this.accounts.makePrimary(tx, r.orgId, id);
      await this.audit.write(tx, {
        actorUserId: userId,
        subjectType: 'payout_account',
        subjectId: id,
        eventType: 'payout_account.made_primary',
        diff: { destination: destinationOf(row), previous: before ? destinationOf(before) : null },
      });
    });
    return this.list(ws);
  }

  /**
   * Retire an account; it stays on file for the payouts that went to it.
   * When it was the primary, the newest other active account takes over, so
   * rent keeps a place to go whenever one exists.
   */
  async retire(ws: ScopedWorkspace, userId: string, id: string): Promise<PayoutAccountList> {
    const r = assertResidence(ws);
    await this.db.transaction(async (tx) => {
      const current = await this.accounts.lockOrg(tx, r.orgId);
      const row = current.find((a) => a.id === id);
      if (!row) throw await this.missing(id, r);
      const wasPrimary = row.isPrimary;
      const destination = destinationOf(row);
      const successor = wasPrimary ? (current.filter((a) => a.id !== id).sort(newestFirst)[0] ?? null) : null;
      await this.accounts.retire(tx, id, userId);
      if (successor) await this.accounts.makePrimary(tx, r.orgId, successor.id);
      await this.audit.write(tx, {
        actorUserId: userId,
        subjectType: 'payout_account',
        subjectId: id,
        eventType: 'payout_account.retired',
        diff: {
          destination,
          wasPrimary,
          primaryNow: successor ? destinationOf(successor) : wasPrimary ? null : undefined,
        },
      });
    });
    return this.list(ws);
  }

  /** The bank account number of one account, opened for the payout job (WP 1.6b). Never for a browser. */
  openAccountNumber(row: Pick<PayoutAccountRow, 'id' | 'orgId' | 'accountNumberCiphertext'>): string | null {
    if (!row.accountNumberCiphertext) return null;
    return this.cipher.decrypt(row.accountNumberCiphertext, accountNumberContext(row.orgId, row.id));
  }

  // --- Helpers -------------------------------------------------------------------

  private seal(r: ResidenceWorkspace, id: string, d: PayoutAccountDetails): PayoutAccountStored {
    return {
      kind: d.kind,
      accountName: d.accountName,
      bankName: d.bankName,
      accountNumberCiphertext: d.accountNumber ? this.cipher.encrypt(d.accountNumber, accountNumberContext(r.orgId, id)) : null,
      accountLast4: d.accountNumber ? last4(d.accountNumber) : null,
      momoNetwork: d.momoNetwork,
      momoPhone: d.momoPhone,
      merchantCode: d.merchantCode,
    };
  }

  private masked(d: PayoutAccountDetails): Parameters<typeof destinationOf>[0] {
    return { ...d, accountLast4: d.accountNumber ? last4(d.accountNumber) : null };
  }

  /** Refuse an account the business already has, by where the money lands. */
  private assertNotListed(r: ResidenceWorkspace, details: PayoutAccountDetails, others: readonly PayoutAccountRow[]): void {
    const clash = others.find((row) => sameDestination(details, this.opened(r, row)));
    if (clash) {
      throw new ConflictException({ code: 'payout_account_listed', message: `That account is already on your list: ${destinationOf(clash)}.` });
    }
  }

  private opened(r: ResidenceWorkspace, row: PayoutAccountRow): PayoutAccountDetails {
    return {
      kind: row.kind,
      accountName: row.accountName,
      bankName: row.bankName,
      accountNumber: row.accountNumberCiphertext ? this.openAccountNumber({ ...row, orgId: r.orgId }) : null,
      momoNetwork: row.momoNetwork,
      momoPhone: row.momoPhone,
      merchantCode: row.merchantCode,
    };
  }

  /** 404 for an account of another business; 409 in words for one already retired. */
  private async missing(id: string, r: ResidenceWorkspace): Promise<Error> {
    const row = await this.accounts.find(id);
    if (row && row.orgId === r.orgId && row.status === 'retired') {
      return new ConflictException({ code: 'payout_account_retired', current: 'retired', message: 'That account was removed. Add it again to use it.' });
    }
    return new NotFoundException('Payout account not found.');
  }
}

function newestFirst(a: PayoutAccountRow, b: PayoutAccountRow): number {
  return b.createdAt.getTime() - a.createdAt.getTime();
}

