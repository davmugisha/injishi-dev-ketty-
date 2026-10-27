import { ConflictException } from '@nestjs/common';

import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { MockPaymentAdapter } from '../../payments/infrastructure/mock-payment.adapter';
import type { PaymentRow } from '../infrastructure/lease-payments.repository';
import type { PayoutAccountRow } from '../infrastructure/payout-accounts.repository';
import type { PayoutRow, PayoutsRepository } from '../infrastructure/payouts.repository';
import type { RentalsContextRepository } from '../infrastructure/rentals-context.repository';
import type { RentalsMoneyQueue } from '../infrastructure/rentals-money.queue';
import type { RentalsAuditWriter } from '../infrastructure/rentals-writers';
import type { PayoutAccountsService } from './payout-accounts.service';
import { PayoutsService } from './payouts.service';

/**
 * Payouts with the repository doubled and the real mock rail (WP 1.6b).
 * Pinned here: a settled payment makes one payout, queued to the primary
 * account or held without one; sending pays it, a destination ending 0000
 * fails it with the reason, a retired account hands over to the primary;
 * the hourly pass releases held payouts once an account exists and queues
 * lost ones again; the landlord's retry needs an account and queues it.
 */
const WS = '11111111-1111-4111-8111-111111111111';
const ORG = '22222222-2222-4222-8222-222222222222';
const PAYMENT = '99999999-9999-4999-8999-999999999999';
const PAYOUT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const ws = {
  workspaceId: WS,
  kind: 'business',
  orgId: ORG,
  domain: 'residence',
  orgRole: 'owner',
  permissions: ['payout.manage'],
  branchScope: { coverage: 'all', selectedPropertyId: null, propertyIds: [], includesUnbranched: true },
} as unknown as ScopedWorkspace;

const momo = (over: Partial<PayoutAccountRow> = {}): PayoutAccountRow =>
  ({ id: 'acct-1', orgId: ORG, kind: 'momo', accountName: 'Emmanuel', bankName: null, accountNumberCiphertext: null, accountLast4: null, momoNetwork: 'mtn', momoPhone: '+250788301122', merchantCode: null, status: 'active', isPrimary: true, ...over }) as PayoutAccountRow;

const payment = (over: Partial<PaymentRow> = {}): PaymentRow => ({ id: PAYMENT, workspaceId: WS, amountRwf: 700_000, status: 'succeeded', ...over }) as PaymentRow;

interface Opts {
  primary?: PayoutAccountRow | null;
  payout?: Partial<PayoutRow>;
  held?: boolean;
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function harness(opts: Opts = {}) {
  const adapter = new MockPaymentAdapter();
  const calls: Record<string, unknown[][]> = {};
  const record = (name: string) => (...args: unknown[]) => {
    (calls[name] ??= []).push(args);
  };
  let primary: PayoutAccountRow | null = opts.primary === undefined ? momo() : opts.primary;
  let row: PayoutRow | null = opts.payout
    ? ({ id: PAYOUT, workspaceId: WS, status: 'queued', amountRwf: 700_000, idempotencyKey: `${WS}:payout:${PAYMENT}`, payoutAccountId: 'acct-1', source: 'rent', note: `Rent payment ${PAYMENT}`, createdAt: new Date(), updatedAt: new Date(), ...opts.payout } as PayoutRow)
    : null;
  const db = {};
  const payouts = {
    primaryAccount: jest.fn(async () => primary),
    account: jest.fn(async (id: string) => (primary && primary.id === id ? primary : id === 'retired' ? momo({ id: 'retired', status: 'retired', isPrimary: false }) : null)),
    insert: jest.fn(async (_tx: unknown, values: Partial<PayoutRow>) => {
      record('insert')(values);
      row = { id: PAYOUT, createdAt: new Date(), updatedAt: new Date(), ...values } as PayoutRow;
      return row;
    }),
    find: jest.fn(async () => row),
    update: jest.fn(async (_tx: unknown, id: string, values: Partial<PayoutRow>) => {
      record('update')(id, values);
      if (row) row = { ...row, ...values };
    }),
    orgOf: jest.fn(async () => ORG),
    held: jest.fn(async () => (opts.held && row ? [{ ...row, orgId: ORG }] : [])),
    queuedBefore: jest.fn(async () => []),
    listRow: jest.fn(async () => (row ? { payout: row, accountKind: 'momo', payment: null } : null)),
    list: jest.fn(async () => []),
  };
  const accounts = { openAccountNumber: jest.fn(() => '000123456789') };
  const context = { org: jest.fn(async () => ({ legalName: 'Amani Residences' })) };
  const queue = { sendPayout: jest.fn(async (id: string) => (record('send')(id), true)) };
  const audit = { write: jest.fn(async (_db: unknown, e: unknown) => record('audit')(e)) };
  const service = new PayoutsService(
    db as never,
    payouts as unknown as PayoutsRepository,
    accounts as unknown as PayoutAccountsService,
    context as unknown as RentalsContextRepository,
    queue as unknown as RentalsMoneyQueue,
    audit as unknown as RentalsAuditWriter,
    adapter,
  );
  return { service, calls, payouts, setPrimary: (a: PayoutAccountRow | null) => (primary = a), row: () => row };
}

describe('PayoutsService', () => {
  it('queues a payout to the primary account for a settled payment', async () => {
    const h = harness();
    const out = await h.service.createForPayment({} as never, payment(), ORG);
    expect(h.calls.insert?.[0]?.[0]).toMatchObject({
      payeeType: 'landlord',
      source: 'rent',
      status: 'queued',
      amountRwf: 700_000,
      idempotencyKey: `${WS}:payout:${PAYMENT}`,
      payoutAccountId: 'acct-1',
      destination: 'momo',
      destinationMasked: 'MTN MoMo 078••••122',
      payeeName: 'Amani Residences',
    });
    expect(h.service.payoutWords(out)).toBe('It is on its way to MTN MoMo 078••••122.');
  });

  it('holds it with the reason when the business has no account', async () => {
    const h = harness({ primary: null });
    const out = await h.service.createForPayment({} as never, payment(), ORG);
    expect(out).toMatchObject({ status: 'held', payoutAccountId: null, failureReason: expect.stringContaining('No payout account') });
    expect(h.service.payoutWords(out)).toContain('held until you add a payout account');
  });

  it('sends a queued payout and marks it paid with the rail reference', async () => {
    const h = harness({ payout: {} });
    expect(await h.service.send(PAYOUT)).toBe('paid');
    expect(h.row()).toMatchObject({ status: 'paid', adapterRef: expect.stringContaining('mock_landlord_payout_'), settledAt: expect.any(Date) });
    expect(h.calls.audit?.[0]?.[0]).toMatchObject({ subjectType: 'payment', subjectId: PAYMENT, eventType: 'payout.paid' });
  });

  it('fails a payout the destination refuses, with the reason, and does not throw', async () => {
    const h = harness({ primary: momo({ momoPhone: '+250788120000' }), payout: {} });
    expect(await h.service.send(PAYOUT)).toBe('failed');
    expect(h.row()).toMatchObject({ status: 'failed', failureReason: expect.stringContaining('was refused') });
    expect(h.calls.audit?.[0]?.[0]).toMatchObject({ eventType: 'payout.failed' });
  });

  it('sends to the primary account when the payout account was retired meanwhile', async () => {
    const h = harness({ payout: { payoutAccountId: 'retired' } });
    expect(await h.service.send(PAYOUT)).toBe('paid');
    expect(h.calls.update?.[0]?.[1]).toMatchObject({ payoutAccountId: 'acct-1' });
  });

  it('holds a queued payout that has nowhere to go', async () => {
    const h = harness({ primary: null, payout: { payoutAccountId: null } });
    expect(await h.service.send(PAYOUT)).toBe('held');
  });

  it('does nothing for a payout that is not queued', async () => {
    const h = harness({ payout: { status: 'paid' } });
    expect(await h.service.send(PAYOUT)).toBe('paid');
    expect(h.payouts.update).not.toHaveBeenCalled();
  });

  it('releases held payouts once an account exists and queues the job', async () => {
    const h = harness({ payout: { status: 'held', payoutAccountId: null }, held: true });
    expect(await h.service.sweep()).toEqual({ released: 1, requeued: 0 });
    expect(h.row()).toMatchObject({ status: 'queued', payoutAccountId: 'acct-1', failureReason: null });
    expect(h.calls.send).toEqual([[PAYOUT]]);
  });

  it('leaves a held payout alone while there is still no account', async () => {
    const h = harness({ primary: null, payout: { status: 'held', payoutAccountId: null }, held: true });
    expect(await h.service.sweep()).toEqual({ released: 0, requeued: 0 });
    expect(h.row()?.status).toBe('held');
  });

  it('retries a failed payout to the account as it stands now, and refuses one already paid or without an account', async () => {
    const h = harness({ payout: { status: 'failed', failureReason: 'refused' } });
    const out = await h.service.retry(ws, 'user', PAYOUT);
    expect(out.status).toBe('queued');
    expect(h.calls.send).toEqual([[PAYOUT]]);
    await expect(h.service.retry(ws, 'user', PAYOUT)).rejects.toMatchObject({ response: { code: 'payout_queued' } });
    const paid = harness({ payout: { status: 'paid' } });
    await expect(paid.service.retry(ws, 'user', PAYOUT)).rejects.toThrow(ConflictException);
    const none = harness({ primary: null, payout: { status: 'held' } });
    await expect(none.service.retry(ws, 'user', PAYOUT)).rejects.toMatchObject({ response: { code: 'no_payout_account' } });
  });
});
