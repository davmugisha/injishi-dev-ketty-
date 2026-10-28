import { NotFoundException } from '@nestjs/common';

import { TokenCipher } from '../../ebm/infrastructure/token-cipher';
import { accountNumberContext, resolvePayoutAccountCipher } from '../infrastructure/payout-account-cipher';
import { leaseNextAction, nextLeaseReference } from './lease-words';
import { destinationOf, detailsOf, last4, sameDestination } from './payout-accounts';
import { assertResidence, buildingFilter, coversBuilding, leaseStateConflict } from './residence';
import { unitOccupancy, unitTabsOf, type UnitLeaseFacts } from './units';

const WS = '11111111-1111-4111-8111-111111111111';
const ORG = '22222222-2222-4222-8222-222222222222';
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

describe('assertResidence: rentals answer 404 outside a residence business', () => {
  it('passes a residence business and names its org', () => {
    expect(assertResidence({ kind: 'business', domain: 'residence', orgId: ORG, workspaceId: WS })).toEqual({
      workspaceId: WS,
      orgId: ORG,
    });
  });

  it.each([
    ['a hotel', { kind: 'business', domain: 'hospitality', orgId: ORG }],
    ['a broker workspace', { kind: 'broker', domain: null, orgId: null }],
    ['a personal workspace', { kind: 'personal', domain: null, orgId: null }],
    ['a residence with no org', { kind: 'business', domain: 'residence', orgId: null }],
  ] as const)('refuses %s with a 404', (_name, ws) => {
    expect(() => assertResidence({ ...ws, workspaceId: WS } as never)).toThrow(NotFoundException);
  });
});

describe('branch scope over buildings', () => {
  const all = { coverage: 'all' as const, selectedPropertyId: null, propertyIds: [A], includesUnbranched: true };
  const limited = { coverage: 'limited' as const, selectedPropertyId: null, propertyIds: [A], includesUnbranched: false };
  const selected = { coverage: 'all' as const, selectedPropertyId: A, propertyIds: [A], includesUnbranched: false };

  it('an owner covering every branch covers a building made after the scope was read', () => {
    expect(coversBuilding(all, B)).toBe(true);
    expect(buildingFilter({} as never, all)).toBeNull();
  });

  it('a limited member covers only their buildings; a selected branch narrows to it', () => {
    expect(coversBuilding(limited, A)).toBe(true);
    expect(coversBuilding(limited, B)).toBe(false);
    expect(coversBuilding(selected, B)).toBe(false);
    expect(buildingFilter({} as never, limited)).not.toBeNull();
  });
});

describe('a lease state conflict says where the lease stands, in words', () => {
  it('names the current status and what to do instead', () => {
    const e = leaseStateConflict('active', 'A tenancy that has started ends with a move out.');
    expect(e.getStatus()).toBe(409);
    expect(e.getResponse()).toMatchObject({
      code: 'lease_state',
      current: 'active',
      message: 'This lease is active. A tenancy that has started ends with a move out.',
    });
  });
});

describe('unit occupancy is worked out from leases', () => {
  const lease = (over: Partial<UnitLeaseFacts>): UnitLeaseFacts => ({
    id: A,
    reference: 'L-0001',
    status: 'active',
    tenantName: 'Aline Uwera',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    endedOn: null,
    ...over,
  });

  it('occupied while a tenancy runs', () => {
    expect(unitOccupancy([lease({})]).occupancy).toBe('occupied');
    expect(unitOccupancy([lease({ status: 'ending' })]).occupancy).toBe('occupied');
  });

  it('reserved when the next lease is signed or out for signing', () => {
    const v = unitOccupancy([lease({ status: 'signed', reference: 'L-0002' })]);
    expect(v.occupancy).toBe('reserved');
    expect(v.current?.reference).toBe('L-0002');
  });

  it('vacant since the day after the last tenancy ended', () => {
    const v = unitOccupancy([lease({ status: 'ended', endedOn: '2026-06-15' })]);
    expect(v).toMatchObject({ occupancy: 'vacant', current: null, vacantSince: '2026-06-16' });
    expect(unitOccupancy([]).vacantSince).toBeNull();
  });

  it('sorts units into the list tabs', () => {
    expect(unitTabsOf('active', 'vacant')).toEqual(['all', 'vacant']);
    expect(unitTabsOf('active', 'occupied')).toEqual(['all', 'occupied']);
    expect(unitTabsOf('off_market', 'vacant')).toEqual(['all', 'off_market']);
    expect(unitTabsOf('retired', 'vacant')).toEqual(['retired']);
  });
});

describe('lease words', () => {
  it('numbers leases L-0001 on, past whatever else the workspace used', () => {
    expect(nextLeaseReference([])).toBe('L-0001');
    expect(nextLeaseReference(['L-0001', 'L-0009', 'L-KC-014'])).toBe('L-0010');
  });

  it('says what the landlord does next', () => {
    expect(leaseNextAction('draft')).toBe('Review and sign');
    expect(leaseNextAction('pending_signature', { invitationAccepted: false })).toBe(
      'Waiting for the tenant to accept the invitation',
    );
    expect(leaseNextAction('signed')).toBe('Start the tenancy');
    // A signed lease starts on its start date, not before.
    expect(leaseNextAction('signed', { startDate: '2026-11-01', today: '2026-10-24' })).toBe('Start the tenancy on 1 November 2026');
    expect(leaseNextAction('signed', { startDate: '2026-11-01', today: '2026-11-01' })).toBe('Start the tenancy');
    expect(leaseNextAction('cancelled')).toBeNull();
  });
});

describe('payout account details', () => {
  it('keeps one kind of fields, and names an "Other" bank by its own name', () => {
    expect(
      detailsOf({ kind: 'bank', accountName: 'Kacyiru Court Ltd', bankName: 'Other', otherBankName: 'Unguka Bank', accountNumber: '000123456789' }),
    ).toEqual({
      kind: 'bank',
      accountName: 'Kacyiru Court Ltd',
      bankName: 'Unguka Bank',
      accountNumber: '000123456789',
      momoNetwork: null,
      momoPhone: null,
      merchantCode: null,
    });
    expect(last4('000123456789')).toBe('6789');
  });

  it('two accounts are the same when the money lands in the same place', () => {
    const momo = detailsOf({ kind: 'momo', accountName: 'A', momoNetwork: 'mtn', momoPhone: '+250788123456' });
    expect(sameDestination(momo, { ...momo, accountName: 'Someone else' })).toBe(true);
    expect(sameDestination(momo, { ...momo, momoPhone: '+250788123457' })).toBe(false);
  });

  it('says where money goes without the whole number', () => {
    expect(
      destinationOf({ kind: 'bank', bankName: 'Bank of Kigali', accountLast4: '6789', momoNetwork: null, momoPhone: null, merchantCode: null }),
    ).toBe('Bank of Kigali ••••6789');
    expect(
      destinationOf({ kind: 'momo', bankName: null, momoNetwork: 'mtn', momoPhone: '+250788123456', merchantCode: null }),
    ).toBe('MTN MoMo 078••••456');
  });
});

describe('the payout account cipher', () => {
  it('a production platform refuses to boot without a key', () => {
    expect(() => resolvePayoutAccountCipher({ nodeEnv: 'production', environment: 'production' })).toThrow(
      /PAYOUT_ACCOUNT_ENCRYPTION_KEY is required/,
    );
    expect(() => resolvePayoutAccountCipher({ nodeEnv: 'production', environment: 'production', key: 'hunter2' })).toThrow(
      /exactly 32 bytes/,
    );
  });

  it('elsewhere a fixed development key stands in', () => {
    expect(resolvePayoutAccountCipher({ nodeEnv: 'development', environment: 'production' })).toBeInstanceOf(TokenCipher);
    expect(resolvePayoutAccountCipher({ nodeEnv: 'production', environment: 'demo' })).toBeInstanceOf(TokenCipher);
  });

  it('a sealed number opens only for its own org and row', () => {
    const cipher = resolvePayoutAccountCipher({
      nodeEnv: 'production',
      environment: 'production',
      key: Buffer.alloc(32, 7).toString('base64'),
    });
    const sealed = cipher.encrypt('000123456789', accountNumberContext(ORG, A));
    expect(sealed).not.toContain('000123456789');
    expect(cipher.decrypt(sealed, accountNumberContext(ORG, A))).toBe('000123456789');
    expect(() => cipher.decrypt(sealed, accountNumberContext(ORG, B))).toThrow();
  });
});
