import { ConflictException, NotFoundException } from '@nestjs/common';
import { PayoutAccountInput } from '@injishi/contracts';

import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { resolvePayoutAccountCipher } from '../infrastructure/payout-account-cipher';
import type { PayoutAccountRow, PayoutAccountsRepository, PayoutAccountStored } from '../infrastructure/payout-accounts.repository';
import type { RentalsAuditWriter } from '../infrastructure/rentals-writers';
import { PayoutAccountsService } from './payout-accounts.service';

/**
 * Getting paid: the shape of what is stored and shown, and the primary rules,
 * over an in-memory repository and the real cipher.
 *
 * Pinned: a bank account number is stored sealed with its last four digits and
 * never answered whole; the first account is primary whatever was asked, a
 * later one only when asked, and one org never has two; the same destination
 * twice is refused; retiring the primary hands over to the newest other
 * account; an account of another business is 404; every change is audited.
 */
const WS = '11111111-1111-4111-8111-111111111111';
const ORG = '22222222-2222-4222-8222-222222222222';
const USER = '77777777-7777-4777-8777-777777777777';

const ws = {
  workspaceId: WS,
  kind: 'business',
  orgId: ORG,
  domain: 'residence',
  orgRole: 'owner',
  registrationStatus: 'active',
  permissions: ['payout.manage'],
  branchScope: { coverage: 'all', selectedPropertyId: null, propertyIds: [], includesUnbranched: true },
} as unknown as ScopedWorkspace;

// The doubles' types are what the test reads back; they are inferred.
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function harness() {
  const rows: PayoutAccountRow[] = [];
  let clock = Date.parse('2026-10-24T08:00:00Z');
  const active = (orgId: string): PayoutAccountRow[] =>
    rows.filter((r) => r.orgId === orgId && r.status === 'active').sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || b.createdAt.getTime() - a.createdAt.getTime());
  const repo = {
    list: async (orgId: string) => active(orgId),
    lockOrg: async (_tx: unknown, orgId: string) => active(orgId),
    find: async (id: string) => rows.find((r) => r.id === id) ?? null,
    insert: async (_tx: unknown, v: PayoutAccountStored & { id: string; orgId: string; workspaceId: string; createdByUserId: string; isPrimary: boolean }) => {
      clock += 1000;
      rows.push({
        ...v,
        status: 'active',
        verifiedName: null,
        retiredAt: null,
        retiredByUserId: null,
        createdAt: new Date(clock),
        updatedAt: new Date(clock),
      } as PayoutAccountRow);
      if (rows.filter((r) => r.orgId === v.orgId && r.status === 'active' && r.isPrimary).length > 1) {
        throw new Error('payout_accounts_primary_uk');
      }
    },
    update: async (_tx: unknown, id: string, v: PayoutAccountStored) => {
      Object.assign(rows.find((r) => r.id === id) as PayoutAccountRow, v);
    },
    clearPrimary: async (_tx: unknown, orgId: string) => {
      for (const r of rows) if (r.orgId === orgId) r.isPrimary = false;
    },
    makePrimary: async (_tx: unknown, orgId: string, id: string) => {
      for (const r of rows) if (r.orgId === orgId) r.isPrimary = r.id === id && r.status === 'active';
    },
    retire: async (_tx: unknown, id: string, userId: string) => {
      Object.assign(rows.find((r) => r.id === id) as PayoutAccountRow, { status: 'retired', isPrimary: false, retiredAt: new Date(), retiredByUserId: userId });
    },
  };
  const audits: { eventType: string; diff?: Record<string, unknown> }[] = [];
  const audit = { write: async (_tx: unknown, e: { eventType: string; diff?: Record<string, unknown> }) => void audits.push(e) };
  const db = { transaction: async <T>(cb: (tx: unknown) => Promise<T>): Promise<T> => cb({}) };
  const cipher = resolvePayoutAccountCipher({ nodeEnv: 'test', environment: 'production' });
  const service = new PayoutAccountsService(
    db as never,
    repo as unknown as PayoutAccountsRepository,
    cipher,
    audit as unknown as RentalsAuditWriter,
  );
  return { service, rows, audits };
}

const bank = (accountNumber = '000123456789', makePrimary?: boolean): PayoutAccountInput =>
  PayoutAccountInput.parse({ kind: 'bank', accountName: 'Kacyiru Court Ltd', bankName: 'Bank of Kigali', accountNumber, makePrimary });
const momo = (phone = '0788123456', makePrimary?: boolean): PayoutAccountInput =>
  PayoutAccountInput.parse({ kind: 'momo', accountName: 'Jean Mugabo', momoNetwork: 'mtn', momoPhone: phone, makePrimary });

describe('PayoutAccountsService', () => {
  it('stores a bank account number sealed, shows only its last four digits, and makes the first account primary', async () => {
    const h = harness();
    const { accounts } = await h.service.create(ws, USER, bank());
    expect(accounts).toHaveLength(1);
    expect(accounts[0]).toMatchObject({ kind: 'bank', accountLast4: '6789', destination: 'Bank of Kigali ••••6789', isPrimary: true });
    expect(JSON.stringify(accounts)).not.toContain('000123456789');
    const stored = h.rows[0] as PayoutAccountRow;
    expect(stored.accountNumberCiphertext).toMatch(/^v1\./);
    expect(stored.accountNumberCiphertext).not.toContain('000123456789');
    expect(h.service.openAccountNumber(stored)).toBe('000123456789');
    expect(h.audits[0]).toMatchObject({ eventType: 'payout_account.added', diff: { primary: true } });
    expect(JSON.stringify(h.audits)).not.toContain('000123456789');
  });

  it('a later account is primary only when asked, and the org keeps one primary', async () => {
    const h = harness();
    await h.service.create(ws, USER, bank());
    let { accounts } = await h.service.create(ws, USER, momo());
    expect(accounts.filter((a) => a.isPrimary).map((a) => a.kind)).toEqual(['bank']);
    ({ accounts } = await h.service.create(ws, USER, momo('0788999888', true)));
    expect(accounts.filter((a) => a.isPrimary).map((a) => a.destination)).toEqual(['MTN MoMo 078••••888']);
    expect(accounts[0]?.isPrimary).toBe(true);
  });

  it('refuses an account the business already has, by where the money lands', async () => {
    const h = harness();
    await h.service.create(ws, USER, bank());
    await expect(h.service.create(ws, USER, bank())).rejects.toBeInstanceOf(ConflictException);
    await h.service.create(ws, USER, momo());
    await expect(h.service.create(ws, USER, momo('078 812 3456'))).rejects.toThrow(/already on your list/);
  });

  it('make primary moves the primary; retiring the primary hands over to the newest other account', async () => {
    const h = harness();
    await h.service.create(ws, USER, bank());
    await h.service.create(ws, USER, momo());
    const second = h.rows[1] as PayoutAccountRow;
    let { accounts } = await h.service.makePrimary(ws, USER, second.id);
    expect(accounts[0]).toMatchObject({ id: second.id, isPrimary: true });
    ({ accounts } = await h.service.retire(ws, USER, second.id));
    expect(accounts).toHaveLength(1);
    expect(accounts[0]).toMatchObject({ kind: 'bank', isPrimary: true });
    expect(h.audits.map((a) => a.eventType)).toEqual([
      'payout_account.added',
      'payout_account.added',
      'payout_account.made_primary',
      'payout_account.retired',
    ]);
  });

  it('an edit sends the whole account again and keeps it sealed', async () => {
    const h = harness();
    await h.service.create(ws, USER, bank());
    const id = (h.rows[0] as PayoutAccountRow).id;
    const { accounts } = await h.service.update(ws, USER, id, bank('000987654321'));
    expect(accounts[0]).toMatchObject({ accountLast4: '4321' });
    expect(h.service.openAccountNumber(h.rows[0] as PayoutAccountRow)).toBe('000987654321');
  });

  it('another business\'s account is 404; a retired one says so in words', async () => {
    const h = harness();
    await h.service.create(ws, USER, bank());
    const id = (h.rows[0] as PayoutAccountRow).id;
    const other = { ...ws, orgId: '99999999-9999-4999-8999-999999999999' } as ScopedWorkspace;
    await expect(h.service.makePrimary(other, USER, id)).rejects.toBeInstanceOf(NotFoundException);
    await h.service.retire(ws, USER, id);
    await expect(h.service.retire(ws, USER, id)).rejects.toThrow('That account was removed. Add it again to use it.');
  });

  it('a hotel has no payout accounts here: 404', async () => {
    const h = harness();
    await expect(h.service.list({ ...ws, domain: 'hospitality' } as ScopedWorkspace)).rejects.toBeInstanceOf(NotFoundException);
  });
});
