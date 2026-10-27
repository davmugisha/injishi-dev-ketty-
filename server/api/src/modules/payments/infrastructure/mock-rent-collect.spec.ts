import { PaymentDeclinedError, type RentCollectCommand, type VendorPayoutCommand } from '../domain/payment-port';
import { MockPaymentAdapter, decodeCaptureRef, mockCallbackSignature } from './mock-payment.adapter';
import { OffPaymentAdapter } from './off-payment.adapter';

/**
 * The rentals additions to the mock rail (blueprint 2.7; WP 1.6b): rent is
 * collected from a handset like a booking is, a payout or a vendor transfer
 * to a destination ending 0000 is refused, and the mock's callback is read
 * from a signed raw body and nothing else. The off adapter refuses them all.
 */
describe('MockPaymentAdapter: rent, vendors and callbacks', () => {
  const WORKSPACE = '33333333-3333-3333-3333-333333333333';

  const collect = (over: Partial<RentCollectCommand> = {}): RentCollectCommand => ({
    kind: 'rent_collect',
    idempotencyKey: `${WORKSPACE}:rent-collect:p1`,
    amountRwf: 90_323,
    currency: 'RWF',
    workspaceId: WORKSPACE,
    instrument: { kind: 'mobile_money', network: 'mtn_momo', msisdn: '788123456' },
    leaseRef: 'lease-1',
    paymentRef: 'p1',
    ...over,
  });

  beforeEach(() => {
    process.env.MOCK_MOMO_APPROVAL_MS = '0';
  });

  it('answers a rent collection pending with a rent reference, and settles it on the read', async () => {
    process.env.MOCK_MOMO_APPROVAL_MS = '60000';
    const adapter = new MockPaymentAdapter();
    const receipt = await adapter.collectRent(collect());
    expect(receipt.settlement).toBe('pending');
    expect(receipt.adapterRef).toMatch(/^mock_rent_collect_/);
    expect(decodeCaptureRef(receipt.adapterRef)).toMatchObject({ kind: 'rent_collect', workspaceId: WORKSPACE, amountRwf: 90_323 });
    expect((await adapter.fetchTransaction(WORKSPACE, receipt.adapterRef))?.settlement).toBe('pending');
    process.env.MOCK_MOMO_APPROVAL_MS = '0';
    const quick = await new MockPaymentAdapter().collectRent(collect({ idempotencyKey: 'k2' }));
    expect((await new MockPaymentAdapter().fetchTransaction(WORKSPACE, quick.adapterRef))?.settlement).toBe('settled');
  });

  it('declines a payer number ending 0000', async () => {
    await expect(new MockPaymentAdapter().collectRent(collect({ instrument: { kind: 'mobile_money', network: 'mtn_momo', msisdn: '788120000' } }))).rejects.toBeInstanceOf(PaymentDeclinedError);
  });

  it('replays a rent collection on the same key and refuses a different amount', async () => {
    const adapter = new MockPaymentAdapter();
    const first = await adapter.collectRent(collect());
    const second = await adapter.collectRent(collect());
    expect(second).toMatchObject({ adapterRef: first.adapterRef, replayed: true });
    await expect(adapter.collectRent(collect({ amountRwf: 1 }))).rejects.toBeInstanceOf(PaymentDeclinedError);
  });

  it('refuses a payout or a vendor transfer to a destination ending 0000, and pays others at once', async () => {
    const adapter = new MockPaymentAdapter();
    await expect(adapter.payLandlord({ kind: 'landlord_payout', idempotencyKey: 'po-1', amountRwf: 1000, currency: 'RWF', workspaceId: WORKSPACE, destination: 'momo', destinationRef: '+250788120000' })).rejects.toBeInstanceOf(PaymentDeclinedError);
    const paid = await adapter.payLandlord({ kind: 'landlord_payout', idempotencyKey: 'po-2', amountRwf: 1000, currency: 'RWF', workspaceId: WORKSPACE, destination: 'momo_pay', destinationRef: '123456' });
    expect(paid.settlement).toBe('settled');
    const vendor: VendorPayoutCommand = {
      kind: 'vendor_payout',
      idempotencyKey: 'v-1',
      amountRwf: 20_000,
      currency: 'RWF',
      workspaceId: WORKSPACE,
      instrument: { kind: 'mobile_money', network: 'mtn_momo', msisdn: '788123456' },
      destination: 'momo',
      destinationRef: '+250722330000',
      subjectRef: 'ticket-1',
    };
    await expect(adapter.payVendor(vendor)).rejects.toBeInstanceOf(PaymentDeclinedError);
    expect((await adapter.payVendor({ ...vendor, destinationRef: '+250722331234' })).adapterRef).toMatch(/^mock_vendor_payout_/);
  });

  it('settles a card subscription at once, waits on a handset, and sends a checkout to its page', async () => {
    const adapter = new MockPaymentAdapter();
    const base = { idempotencyKey: 's-1', amountRwf: 10_000, currency: 'RWF' as const, workspaceId: WORKSPACE, subscriptionRef: 'sub-1', kind: 'subscription_charge' as const };
    expect((await adapter.chargeSubscription({ ...base, instrument: { kind: 'card', token: 'tok_1' } })).settlement).toBe('settled');
    await expect(adapter.chargeSubscription({ ...base, idempotencyKey: 's-2', instrument: { kind: 'saved_card', token: 'tok_0000' } })).rejects.toBeInstanceOf(PaymentDeclinedError);
    const checkout = await adapter.chargeSubscription({ ...base, idempotencyKey: 's-3', instrument: { kind: 'card_checkout', returnUrl: 'http://localhost:3002/broker/plan' } });
    expect(checkout).toMatchObject({ settlement: 'pending', checkoutUrl: 'http://localhost:3002/broker/plan?gateway=mock' });
    expect((await adapter.fetchTransaction(WORKSPACE, checkout.adapterRef))?.savedCardToken).toBe('mock_card_tok_s-3');
  });

  it('reads only a callback signed over the raw body, for the mock provider', () => {
    const adapter = new MockPaymentAdapter();
    const raw = Buffer.from(JSON.stringify({ eventId: 'evt-1', adapterRef: 'mock_rent_collect_x', outcome: 'settled', amountRwf: 90_323 }));
    const headers = { 'x-mock-signature': mockCallbackSignature(raw) };
    expect(adapter.parseCallback('mock', headers, raw)).toEqual({ provider: 'mock', eventId: 'evt-1', adapterRef: 'mock_rent_collect_x', outcome: 'settled', amountRwf: 90_323 });
    expect(adapter.parseCallback('mtn', headers, raw)).toBeNull();
    expect(adapter.parseCallback('mock', { 'x-mock-signature': 'forged' }, raw)).toBeNull();
    expect(adapter.parseCallback('mock', {}, raw)).toBeNull();
    const bad = Buffer.from('{"eventId": 1}');
    expect(adapter.parseCallback('mock', { 'x-mock-signature': mockCallbackSignature(bad) }, bad)).toBeNull();
    const broken = Buffer.from('not json');
    expect(adapter.parseCallback('mock', { 'x-mock-signature': mockCallbackSignature(broken) }, broken)).toBeNull();
  });

  it('is refused as unavailable by the off adapter, which reads no callbacks', async () => {
    const off = new OffPaymentAdapter();
    await expect(off.collectRent(collect())).rejects.toThrow(/switched off/);
    expect(off.parseCallback()).toBeNull();
  });
});
