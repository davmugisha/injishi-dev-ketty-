import { describe, expect, it, type Mock, vi } from 'vitest';

import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

import {
  PaymentUnavailableError,
  type PaymentPort,
  type PaymentReceipt,
} from '../../payments/domain/payment-port';
import type { ProfileService } from '../../user/application/profile.service';
import type { PsfMembershipMailer } from '../infrastructure/psf-membership.mailer';
import {
  OpenPsfApplicationExists,
  type PsfMembershipRepository,
  type PsfOrgFacts,
} from '../infrastructure/psf-membership.repository';
import { buildPsfApplicationRow } from './psf-application-row';
import type { PsfReportRepository } from '../infrastructure/psf-report.repository';
import { PsfMembershipService } from './psf-membership.service';

type ClaimsHarness = { service: PsfMembershipService; repo: Record<string, Mock>; mail: Record<string, Mock> };

/**
 * PSF membership's rules (ADR-056, widened by the PSF path), against a stand in
 * repository, mailer and payment seam. What the SQL itself does is proved over
 * real HTTP by `scripts/verify-psf-path.mjs`; this pins the decisions the
 * service makes.
 */

const ORG = '11111111-1111-4111-8111-111111111111';
const APP = '22222222-2222-4222-8222-222222222222';
const WS = '33333333-3333-4333-8333-333333333333';

function facts(over: Partial<PsfOrgFacts> = {}): PsfOrgFacts {
  return {
    id: ORG,
    domain: 'hospitality',
    legalName: 'Umucyo Garden Guest House',
    tin: '999031001',
    addressText: 'KG 192 St',
    accommodationClass: 'guest_house',
    accommodationClassOther: null,
    registrationStatus: 'tin_verified',
    subsectorName: null,
    districtId: 102,
    districtName: 'Gasabo',
    businessCode: 'GAS0007',
    registrationKind: null,
    registrationNumber: null,
    ownerGroups: [],
    associationName: 'Rwanda Hospitality Association',
    clusterName: 'Services',
    obo: null,
    ...over,
  };
}

/** A PSF business: a metal workshop in Kicukiro, registered nowhere yet. */
const WORKSHOP = facts({
  domain: 'enterprise',
  legalName: 'Gahaya Metal Works',
  tin: null,
  accommodationClass: null,
  registrationStatus: 'active',
  districtId: 103,
  districtName: 'Kicukiro',
  businessCode: 'KIC0001',
  registrationKind: 'none',
  ownerGroups: ['women'],
  associationName: 'Metal Works Association',
  clusterName: 'Industry',
});

const TIER = {
  code: 'indatwa_100k',
  family: 'indatwa' as const,
  nameEn: 'Indatwa, 100,000 to 199,999',
  nameRw: null,
  priceKind: 'range' as const,
  annualFeeRwf: null,
  annualFeeMinRwf: 100000,
  annualFeeMaxRwf: 199999,
  benefitsEn: [],
  benefitsRw: null,
  sortOrder: 30,
  active: true,
  updatedByUserId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const FORM = {
  requestedTierCode: 'indatwa_100k',
  declaredFeeRwf: 150000,
  companyName: 'Umucyo Garden Guest House',
  streetAddress: 'KG 192 St',
  companyType: 'sole_trader' as const,
  ownership: 'rwandan_100' as const,
  businessActivity: 'Accommodation: Guest House',
  tradeDirection: 'none' as const,
  tradeCountries: [],
  contactRole: 'owner' as const,
  firstName: 'Innocent',
  lastName: 'Niyonsaba',
  gender: 'male' as const,
  phoneE164: '+250788000101',
  email: 'innocent@example.rw',
  idDocument: { documentType: 'national_id' as const, documentNumber: '1198480030001001' },
  dateOfBirth: '1984-03-09',
  consent: true as const,
};

const APPROVED = {
  id: APP,
  orgId: ORG,
  status: 'approved',
  requestedTierName: 'Indatwa, 100,000 to 199,999',
  approvedMembershipNumber: 'PSF/GAS/0042',
  approvedFeeRwf: 150000,
  paidAt: null,
};

function setup(env: Record<string, string> = {}): {
  repo: Record<string, Mock>;
  mail: Record<string, Mock>;
  payments: Record<string, Mock>;
  service: PsfMembershipService;
} {
  const repo = {
    orgFacts: vi.fn().mockResolvedValue(facts()),
    activeRole: vi.fn().mockResolvedValue('owner'),
    tier: vi.fn().mockResolvedValue(TIER),
    tiers: vi.fn().mockResolvedValue([TIER]),
    insertApplication: vi.fn().mockResolvedValue({ id: APP }),
    currentMembership: vi.fn().mockResolvedValue(null),
    applications: vi.fn().mockResolvedValue([]),
    personFacts: vi.fn().mockResolvedValue(null),
    withdraw: vi.fn().mockResolvedValue(true),
    applicationById: vi.fn().mockResolvedValue({ id: APP, orgId: ORG, status: 'submitted', requestedTierName: 'Indatwa' }),
    markQueued: vi.fn().mockResolvedValue([]),
    officerApplication: vi.fn().mockResolvedValue({
      id: APP,
      orgId: ORG,
      districtId: 103,
      status: 'submitted',
      officerHasStake: false,
      requestedTierName: 'Indatwa',
      quotedPriceKind: 'range',
      quotedFeeRwf: null,
      declaredFeeRwf: 150000,
    }),
    approve: vi.fn().mockResolvedValue({ orgId: ORG }),
    decline: vi.fn().mockResolvedValue({ orgId: ORG }),
    workspaceIdFor: vi.fn().mockResolvedValue(WS),
    recordPayment: vi.fn().mockResolvedValue({ tierCode: TIER.code, membershipNumber: 'PSF/GAS/0042' }),
    recordRemittance: vi.fn().mockResolvedValue(undefined),
    districtsByProvince: vi.fn().mockResolvedValue(new Map([[1, [101, 102, 103]]])),
    queuePage: vi.fn().mockResolvedValue({ rows: [], more: false }),
    endExpired: vi.fn().mockResolvedValue([]),
    claimExpiryReminders: vi.fn().mockResolvedValue([]),
    unstampedQueuedOrgs: vi.fn().mockResolvedValue([]),
  };
  const mail = {
    received: vi.fn().mockResolvedValue(undefined),
    queueEntered: vi.fn().mockResolvedValue(undefined),
    approved: vi.fn().mockResolvedValue(undefined),
    member: vi.fn().mockResolvedValue(undefined),
    declined: vi.fn().mockResolvedValue(undefined),
    expiring: vi.fn().mockResolvedValue(undefined),
    expired: vi.fn().mockResolvedValue(undefined),
  };
  const receipt = (over: Partial<PaymentReceipt> = {}): PaymentReceipt => ({
    adapterRef: 'mock_ref_1',
    mode: 'mock',
    replayed: false,
    amountRwf: 150000,
    currency: 'RWF',
    occurredAt: new Date('2026-10-15T08:00:00Z'),
    settlement: 'settled',
    ...over,
  });
  const payments = {
    chargeOneTimeFee: vi.fn().mockResolvedValue(receipt()),
    payout: vi.fn().mockResolvedValue(receipt({ adapterRef: 'mock_payout_1' })),
  };
  const service = new PsfMembershipService(
    repo as unknown as PsfMembershipRepository,
    mail as unknown as PsfMembershipMailer,
    { documentFor: vi.fn().mockResolvedValue(null) } as unknown as ProfileService,
    payments as unknown as PaymentPort,
    { get: (key: string) => env[key] } as unknown as ConfigService,
    { lastMembershipNumber: vi.fn().mockResolvedValue(0), membershipNumberTaken: vi.fn().mockResolvedValue(false) } as unknown as PsfReportRepository,
  );
  // A decided application is read back for the officer; its detail is not under test here.
  vi
    .spyOn(service as unknown as { decidedView: () => Promise<unknown> }, 'decidedView')
    .mockResolvedValue({});
  vi.spyOn(service, 'officerApplication').mockResolvedValue({} as never);
  return { repo, mail, payments, service };
}

describe('PsfMembershipService · who may act (AC-15, AC-17, AC-22)', () => {
  it('refuses a receptionist with 403', async () => {
    const { repo, service } = setup();
    repo.activeRole.mockResolvedValue('receptionist');
    await expect(service.overview(ORG, 'u-receptionist')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuses a residence with 422', async () => {
    const { repo, service } = setup();
    repo.orgFacts.mockResolvedValue(facts({ domain: 'residence' }));
    await expect(service.overview(ORG, 'u-owner')).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('lets the owner of a PSF business in, and shows PSF its code and sector', async () => {
    const { repo, service } = setup();
    repo.orgFacts.mockResolvedValue(WORKSHOP);
    const overview = await service.overview(ORG, 'u-owner');
    expect(overview.profile).toEqual(
      expect.objectContaining({ businessCode: 'KIC0001', clusterName: 'Industry', ownerGroups: ['women'] }),
    );
    expect(overview.canApply).toBe(true);
  });

  it('refuses the on behalf agent once the owner has claimed, though they are still an owner', async () => {
    const { repo, service } = setup();
    repo.orgFacts.mockResolvedValue(
      facts({ obo: { registrantUserId: 'u-agent', claimStatus: 'owner_claimed', intendedOwnerName: 'Owner', intendedOwnerNationalId: null, intendedOwnerEmail: null } }),
    );
    await expect(service.overview(ORG, 'u-agent')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('answers 404 for no such business', async () => {
    const { repo, service } = setup();
    repo.orgFacts.mockResolvedValue(null);
    await expect(service.overview(ORG, 'u-owner')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('PsfMembershipService · applying (AC-6, AC-8, AC-9, AC-16)', () => {
  it('past the TIN check, it is received AND stamped into the queue', async () => {
    const { repo, mail, service } = setup();
    repo.markQueued.mockResolvedValue([APP]);
    await service.apply(ORG, 'u-owner', FORM);
    expect(mail.received).toHaveBeenCalledWith(ORG, TIER.nameEn, true);
    expect(repo.markQueued).toHaveBeenCalledWith(ORG);
    expect(mail.queueEntered).toHaveBeenCalledTimes(1);
  });

  it('before the TIN check, it is received and NOT stamped', async () => {
    const { repo, mail, service } = setup();
    repo.orgFacts.mockResolvedValue(facts({ registrationStatus: 'submitted' }));
    await service.apply(ORG, 'u-owner', FORM);
    expect(mail.received).toHaveBeenCalledWith(ORG, TIER.nameEn, false);
    expect(repo.markQueued).not.toHaveBeenCalled();
  });

  it('a PSF business registered nowhere files with no number, and keeps its amount', async () => {
    const { repo, service } = setup();
    repo.orgFacts.mockResolvedValue(WORKSHOP);
    await service.apply(ORG, 'u-owner', FORM);
    const row = repo.insertApplication.mock.calls[0][0];
    expect(row.registrationType).toBe('none');
    expect(row.registrationNumber).toBeNull();
    expect(row.declaredFeeRwf).toBe(150000);
  });

  it('an amount outside the band is refused at its field, and nothing is filed', async () => {
    const { repo, service } = setup();
    const refusal = await service.apply(ORG, 'u-owner', { ...FORM, declaredFeeRwf: 90000 }).catch((e: unknown) => e);
    expect(refusal).toBeInstanceOf(UnprocessableEntityException);
    expect(JSON.stringify((refusal as UnprocessableEntityException).getResponse())).toContain('declaredFeeRwf');
    expect(repo.insertApplication).not.toHaveBeenCalled();
  });

  it('a second open application is a 409', async () => {
    const { repo, service } = setup();
    repo.insertApplication.mockRejectedValue(new OpenPsfApplicationExists());
    await expect(service.apply(ORG, 'u-owner', FORM)).rejects.toBeInstanceOf(ConflictException);
  });

  it('a retired tier is a 422', async () => {
    const { repo, service } = setup();
    repo.tier.mockResolvedValue({ ...TIER, active: false });
    await expect(service.apply(ORG, 'u-owner', FORM)).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('the agent applies on behalf while the claim is open', async () => {
    const { repo, service } = setup();
    repo.orgFacts.mockResolvedValue(
      facts({ obo: { registrantUserId: 'u-agent', claimStatus: 'registrant_held', intendedOwnerName: 'Owner', intendedOwnerNationalId: null, intendedOwnerEmail: null } }),
    );
    await service.apply(ORG, 'u-agent', FORM);
    expect(repo.insertApplication.mock.calls[0][0].submittedCapacity).toBe('on_behalf_of');
  });

  it('withdrawing what is no longer open is a 409, and a stranger’s id a 404', async () => {
    const { repo, service } = setup();
    repo.withdraw.mockResolvedValue(false);
    repo.applicationById.mockResolvedValue({ id: APP, orgId: ORG, status: 'declined' });
    await expect(service.withdraw(ORG, 'u-owner', APP)).rejects.toBeInstanceOf(ConflictException);
    repo.applicationById.mockResolvedValue({ id: APP, orgId: 'another-org', status: 'submitted' });
    await expect(service.withdraw(ORG, 'u-owner', APP)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('PsfMembershipService · deciding (AC-11 to AC-14, the PSF path)', () => {
  const country = [
    { assignmentId: '7a1f5b9e-2c4d-4e8f-9a1b-3c5d7e9f1a01', sectorId: null, cellId: null, villageId: null, oversightRole: 'psf_membership_officer' as const, governmentBodyCode: 'PSF', governmentTitle: null, scopeLevel: 'country' as const, provinceId: null, districtId: null },
  ];
  const kicukiro = [{ ...country[0], scopeLevel: 'district' as const, provinceId: 1, districtId: 103 }];

  it('only a District Manager of its district decides: a national, province or other district manager is refused 403', async () => {
    const { repo, service } = setup();
    const province = [{ ...country[0], scopeLevel: 'province' as const, provinceId: 1, districtId: null }];
    const gasabo = [{ ...country[0], scopeLevel: 'district' as const, provinceId: 1, districtId: 102 }];
    for (const grants of [country, province, gasabo]) {
      await expect(service.approve('u-officer', grants, APP, { membershipNumber: 'PSF/1' })).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.decline('u-officer', grants, APP, { reason: 'details_incomplete' })).rejects.toBeInstanceOf(ForbiddenException);
    }
    expect(repo.approve).not.toHaveBeenCalled();
    expect(repo.decline).not.toHaveBeenCalled();
  });

  it('an officer with a stake is refused 403 and nothing is written', async () => {
    const { repo, service } = setup();
    repo.officerApplication.mockResolvedValue({ id: APP, orgId: ORG, districtId: 103, status: 'submitted', officerHasStake: true });
    await expect(service.approve('u-officer', kicukiro, APP, { membershipNumber: 'PSF/1' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.approve).not.toHaveBeenCalled();
  });

  it('a decided application is a 409, not a 404', async () => {
    const { repo, service } = setup();
    repo.officerApplication.mockResolvedValue(null);
    repo.applicationById.mockResolvedValue({ id: APP, orgId: ORG, status: 'member' });
    await expect(service.approve('u-officer', kicukiro, APP, { membershipNumber: 'PSF/1' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('an approved application waits on the payment and is not decided again', async () => {
    const { repo, service } = setup();
    repo.officerApplication.mockResolvedValue({ id: APP, orgId: ORG, districtId: 103, status: 'approved', officerHasStake: false });
    repo.applicationById.mockResolvedValue({ id: APP, orgId: ORG, status: 'approved' });
    await expect(service.approve('u-officer', kicukiro, APP, { membershipNumber: 'PSF/1' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('approving charges what the business declared, and asks it to pay', async () => {
    const { repo, mail, service } = setup();
    await service.approve('u-officer', kicukiro, APP, { membershipNumber: 'PSF/GAS/0042' });
    expect(repo.approve.mock.calls[0][0]).toEqual(expect.objectContaining({ bodyCode: 'PSF', feeRwf: 150000, membershipNumber: 'PSF/GAS/0042' }));
    expect(mail.approved).toHaveBeenCalledWith(ORG, expect.objectContaining({ feeRwf: 150000 }));
    expect(mail.member).not.toHaveBeenCalled();
  });

  it('a paid application is approved straight to member, with no charge and no second ask', async () => {
    const { repo, mail, payments, service } = setup();
    repo.officerApplication.mockResolvedValue({
      id: APP, orgId: ORG, districtId: 103, status: 'submitted', officerHasStake: false, requestedTierName: 'Indatwa',
      quotedPriceKind: 'range', quotedFeeRwf: null, declaredFeeRwf: 150000, paidAt: new Date('2026-10-18T08:00:00Z'), paymentRef: 'mock_ref_paid',
    });
    repo.approvePaid = vi.fn().mockResolvedValue({ orgId: ORG, amountRwf: 150000 });
    await service.approve('u-officer', kicukiro, APP, { membershipNumber: 'PSF/GAS/0042' });
    expect(repo.approvePaid).toHaveBeenCalledWith(expect.objectContaining({ applicationId: APP, membershipNumber: 'PSF/GAS/0042' }));
    expect(repo.approve).not.toHaveBeenCalled();
    expect(payments.chargeOneTimeFee).not.toHaveBeenCalled();
    expect(mail.member).toHaveBeenCalledWith(ORG, expect.objectContaining({ membershipNumber: 'PSF/GAS/0042', annualFeeRwf: 150000, paymentReference: 'mock_ref_paid' }));
    expect(mail.approved).not.toHaveBeenCalled();
  });

  it('declining a paid application keeps its fee and passes it on to PSF: nothing is refunded', async () => {
    const { repo, mail, payments, service } = setup({ PSF_PAYOUT_DESTINATION: 'bank', PSF_PAYOUT_REF: '000400012345', PSF_PAYOUT_BANK_CODE: '040', PSF_PAYOUT_NAME: 'Private Sector Federation', PSF_PAYOUT_ID_NUMBER: '1198080012345678', PSF_PAYOUT_PHONE: '+250788000100' });
    repo.applicationById.mockResolvedValue({ id: APP, orgId: ORG, status: 'declined', paidAt: new Date(), paidAmountRwf: 150000 });
    await service.decline('u-officer', kicukiro, APP, { reason: 'details_incomplete' });
    expect(payments.payout).toHaveBeenCalledWith(expect.objectContaining({ amountRwf: 150000, memo: 'PSF membership fee' }));
    expect(mail.declined).toHaveBeenCalledWith(ORG, 'details_incomplete', null);
  });

  it('a tier PSF prices itself needs the officer’s amount', async () => {
    const { repo, service } = setup();
    repo.officerApplication.mockResolvedValue({
      id: APP, orgId: ORG, districtId: 103, status: 'submitted', officerHasStake: false, quotedPriceKind: 'set_by_psf', quotedFeeRwf: null, declaredFeeRwf: null,
    });
    await expect(service.approve('u-officer', kicukiro, APP, { membershipNumber: 'PSF/1' })).rejects.toBeInstanceOf(UnprocessableEntityException);
    await service.approve('u-officer', kicukiro, APP, { membershipNumber: 'PSF/1', feeRwf: 2_000_000 });
    expect(repo.approve.mock.calls[0][0].feeRwf).toBe(2_000_000);
  });

  it('losing the race is a 409, and no mail goes', async () => {
    const { repo, mail, service } = setup();
    repo.approve.mockResolvedValue(null);
    await expect(service.approve('u-officer', kicukiro, APP, { membershipNumber: 'PSF/1' })).rejects.toBeInstanceOf(ConflictException);
    expect(mail.approved).not.toHaveBeenCalled();
  });

  it('a decline mails the reason and the note', async () => {
    const { mail, service } = setup();
    await service.decline('u-officer', kicukiro, APP, { reason: 'other', note: 'Send the certificate.' });
    expect(mail.declined).toHaveBeenCalledWith(ORG, 'other', 'Send the certificate.');
  });

  it('a district officer reads their district only, and a country officer everything', async () => {
    const { repo, service } = setup();
    await service.queue('u-officer', kicukiro, { sort: 'newest' });
    expect(repo.queuePage.mock.calls[0][1]).toEqual([103]);
    await service.queue('u-officer', country, { sort: 'newest' });
    expect(repo.queuePage.mock.calls[1][1]).toBeNull();
  });
});

describe('PsfMembershipService · paying (the PSF path)', () => {
  const PHONE = { phoneE164: '+250788000101' };

  it('charges the approved amount once, keyed on the application, and makes it a member', async () => {
    const { repo, mail, payments, service } = setup();
    repo.applicationById.mockResolvedValue(APPROVED);
    await service.pay(ORG, 'u-owner', APP, PHONE);
    expect(payments.chargeOneTimeFee).toHaveBeenCalledWith(
      expect.objectContaining({ amountRwf: 150000, idempotencyKey: `${WS}:psf-membership:${APP}`, feeCode: 'psf_membership' }),
    );
    expect(repo.recordPayment.mock.calls[0][0]).toEqual(
      expect.objectContaining({ amountRwf: 150000, paymentRef: 'mock_ref_1', startsOn: '2026-10-15', expiresOn: '2027-10-14' }),
    );
    expect(mail.member).toHaveBeenCalledWith(ORG, expect.objectContaining({ paymentReference: 'mock_ref_1' }));
  });

  it('a prompt still on the handset is a 409 payment_pending, and nothing is recorded', async () => {
    const { repo, payments, service } = setup();
    repo.applicationById.mockResolvedValue(APPROVED);
    payments.chargeOneTimeFee.mockResolvedValue({ ...(await payments.chargeOneTimeFee()), settlement: 'pending' });
    const refusal = await service.pay(ORG, 'u-owner', APP, PHONE).catch((e: unknown) => e);
    expect(refusal).toBeInstanceOf(ConflictException);
    expect(JSON.stringify((refusal as ConflictException).getResponse())).toContain('payment_pending');
    expect(repo.recordPayment).not.toHaveBeenCalled();
  });

  it('an unreachable provider is a 503 that says nothing was taken', async () => {
    const { repo, payments, service } = setup();
    repo.applicationById.mockResolvedValue(APPROVED);
    payments.chargeOneTimeFee.mockRejectedValue(new PaymentUnavailableError('down', 'k'));
    await expect(service.pay(ORG, 'u-owner', APP, PHONE)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('an application not approved is not payable, and a paid one is not charged twice', async () => {
    const { repo, payments, service } = setup();
    repo.applicationById.mockResolvedValue({ ...APPROVED, status: 'submitted' });
    await expect(service.pay(ORG, 'u-owner', APP, PHONE)).rejects.toBeInstanceOf(ConflictException);
    repo.applicationById.mockResolvedValue({ ...APPROVED, status: 'member', paidAt: new Date() });
    await service.pay(ORG, 'u-owner', APP, PHONE);
    expect(payments.chargeOneTimeFee).not.toHaveBeenCalled();
  });

  it('passes the fee on to PSF when its account is configured, and holds it when not', async () => {
    const held = setup();
    held.repo.applicationById.mockResolvedValue(APPROVED);
    await held.service.pay(ORG, 'u-owner', APP, PHONE);
    expect(held.payments.payout).not.toHaveBeenCalled();

    const sent = setup({ PSF_PAYOUT_DESTINATION: 'bank', PSF_PAYOUT_REF: '000400012345', PSF_PAYOUT_BANK_CODE: '040', PSF_PAYOUT_NAME: 'Private Sector Federation', PSF_PAYOUT_ID_NUMBER: '1198080012345678', PSF_PAYOUT_PHONE: '+250788000100' });
    sent.repo.applicationById.mockResolvedValue(APPROVED);
    await sent.service.pay(ORG, 'u-owner', APP, PHONE);
    expect(sent.payments.payout).toHaveBeenCalledWith(expect.objectContaining({ payee: expect.objectContaining({ destination: { kind: 'bank', bankCode: '040', accountNumber: '000400012345' } }), amountRwf: 150000 }));
    expect(sent.repo.recordRemittance).toHaveBeenCalledWith(APP, 'mock_payout_1');
  });
});

describe('PsfMembershipService · the daily sweep (AC-18, AC-9)', () => {
  it('mails each ending once, reminds 30 days ahead, and catches up a missed stamp', async () => {
    const { repo, mail, service } = setup();
    repo.endExpired.mockResolvedValue([{ orgId: ORG, membershipNumber: 'PSF/OLD' }]);
    repo.claimExpiryReminders.mockResolvedValue([{ orgId: ORG, membershipNumber: 'PSF/SOON', expiresOn: '2026-10-20' }]);
    repo.unstampedQueuedOrgs.mockResolvedValue([ORG]);
    repo.markQueued.mockResolvedValue([APP]);

    const outcome = await service.sweep('2026-09-27');

    expect(repo.endExpired).toHaveBeenCalledWith('2026-09-27');
    expect(repo.claimExpiryReminders).toHaveBeenCalledWith('2026-09-27', '2026-10-27');
    expect(mail.expired).toHaveBeenCalledWith(ORG, 'PSF/OLD');
    expect(mail.expiring).toHaveBeenCalledWith(ORG, 'PSF/SOON', '2026-10-20');
    expect(mail.queueEntered).toHaveBeenCalledTimes(1);
    expect(outcome).toEqual({ ended: 1, reminded: 1, stamped: 1 });
  });

  it('crosses a month end and a year end in calendar days', async () => {
    const { repo, service } = setup();
    await service.sweep('2026-12-15');
    expect(repo.claimExpiryReminders).toHaveBeenCalledWith('2026-12-15', '2027-01-14');
  });
});

describe('buildPsfApplicationRow', () => {
  it('copies the price shown, files the registration it is given, and keeps the declared amount', () => {
    const row = buildPsfApplicationRow({
      submittedByUserId: 'u-owner',
      capacity: 'owner',
      registrationType: 'tin',
      registrationNumber: '999031001',
      tier: TIER,
      form: FORM,
      consentGivenAt: new Date('2026-09-27T08:00:00Z'),
      consentVersion: '2026-09-27',
    });
    expect(row.quotedFeeMinRwf).toBe(100000);
    expect(row.declaredFeeRwf).toBe(150000);
    expect(row.registrationType).toBe('tin');
    expect(row.registrationNumber).toBe('999031001');
    expect(row.tradeGoods).toBeNull();
    expect(row.tradeCountries).toEqual([]);
  });

  it('files no number for a business registered nowhere, and no amount for a tier PSF prices', () => {
    const row = buildPsfApplicationRow({
      submittedByUserId: 'u-owner',
      capacity: 'owner',
      registrationType: 'none',
      registrationNumber: 'ignored',
      tier: { ...TIER, priceKind: 'set_by_psf', annualFeeMinRwf: null, annualFeeMaxRwf: null },
      form: FORM,
      consentGivenAt: new Date('2026-09-27T08:00:00Z'),
      consentVersion: '2026-09-27',
    });
    expect(row.registrationNumber).toBeNull();
    expect(row.declaredFeeRwf).toBeNull();
  });
});

describe('membership claims (0121): a typed number is a claim until PSF confirms it', () => {
  const GASABO = 102;
  const grant = {
    assignmentId: '7a1f5b9e-2c4d-4e8f-9a1b-3c5d7e9f1a09',
    sectorId: null,
    cellId: null,
    villageId: null,
    oversightRole: 'psf_membership_officer' as const,
    governmentBodyCode: 'PSF',
    governmentTitle: null,
    scopeLevel: 'district' as const,
    provinceId: null,
    districtId: GASABO,
  };
  const OFFICER = 'b2c3d4e5-0000-4000-8000-000000000001';

  function claimsService(over: Record<string, unknown> = {}): ClaimsHarness {
    const repo = {
      districtsByProvince: vi.fn().mockResolvedValue(new Map()),
      claim: vi.fn().mockResolvedValue({ id: 'c1', orgId: 'o1', membershipNumber: 'PSF-123-456', status: 'claimed', districtId: GASABO }),
      tierCodes: vi.fn().mockResolvedValue(['indatwa_10k', 'golden_circle']),
      confirmClaim: vi.fn().mockResolvedValue(undefined),
      rejectClaim: vi.fn().mockResolvedValue(true),
      upsertMemberList: vi.fn().mockResolvedValue(undefined),
      claimsTheListConfirms: vi.fn().mockResolvedValue([]),
      ...over,
    };
    const mail = { claimConfirmed: vi.fn().mockResolvedValue(undefined), claimRejected: vi.fn().mockResolvedValue(undefined) };
    const service = new PsfMembershipService(
      repo as unknown as PsfMembershipRepository,
      mail as unknown as PsfMembershipMailer,
      {} as unknown as ProfileService,
      {} as unknown as PaymentPort,
      { get: () => undefined } as unknown as ConfigService,
      {} as unknown as PsfReportRepository,
    );
    return { service, repo, mail };
  }

  it('confirms a claim with the tier and dates PSF gives, as the officer, and tells the business', async () => {
    const { service, repo, mail } = claimsService();
    await service.confirmClaim(OFFICER, [grant], 'c1', { tierCode: 'indatwa_10k', startsOn: '2026-01-01', expiresOn: '2027-01-01' });
    expect(repo.confirmClaim).toHaveBeenCalledWith(
      expect.objectContaining({ claimId: 'c1', tierCode: 'indatwa_10k', decidedByUserId: OFFICER, matchedBy: 'officer' }),
    );
    expect(mail.claimConfirmed).toHaveBeenCalledWith('o1', 'PSF-123-456', '2027-01-01');
  });

  it('refuses a claim outside the officer\'s district, and a tier PSF does not have', async () => {
    const elsewhere = claimsService({
      claim: vi.fn().mockResolvedValue({ id: 'c1', orgId: 'o1', membershipNumber: 'X-12', status: 'claimed', districtId: 303 }),
    });
    await expect(
      elsewhere.service.confirmClaim(OFFICER, [grant], 'c1', { tierCode: 'indatwa_10k', startsOn: '2026-01-01', expiresOn: '2027-01-01' }),
    ).rejects.toThrow('not in your region');
    const { service, repo } = claimsService();
    await expect(
      service.confirmClaim(OFFICER, [grant], 'c1', { tierCode: 'made_up', startsOn: '2026-01-01', expiresOn: '2027-01-01' }),
    ).rejects.toThrow("not one of PSF's");
    expect(repo.confirmClaim).not.toHaveBeenCalled();
  });

  it('rejects with the reason the business is told; a decided claim is not decided twice', async () => {
    const { service, mail } = claimsService();
    await service.rejectClaim(OFFICER, [grant], 'c1', { reason: 'Not in our records' });
    expect(mail.claimRejected).toHaveBeenCalledWith('o1', 'PSF-123-456', 'Not in our records');
    const decided = claimsService({
      claim: vi.fn().mockResolvedValue({ id: 'c1', orgId: 'o1', membershipNumber: 'PSF-123-456', status: 'confirmed', districtId: GASABO }),
    });
    await expect(decided.service.rejectClaim(OFFICER, [grant], 'c1', { reason: 'Again' })).rejects.toThrow('already been decided');
  });

  it("an uploaded list keeps PSF's rows, skips what is not a number, and confirms the claims it matches", async () => {
    const { service, repo, mail } = claimsService({
      claimsTheListConfirms: vi.fn().mockResolvedValue([
        { claimId: 'c1', orgId: 'o1', membershipNumber: 'PSF-123-456', tierCode: 'indatwa_10k', startsOn: '2026-01-01', expiresOn: '2027-01-01', uploadedByUserId: OFFICER },
      ]),
    });
    const result = await service.uploadMemberList(OFFICER, {
      rows: [
        { membershipNumber: ' psf-123-456 ', tin: '192 837 465', tierCode: 'indatwa_10k', startsOn: '2026-01-01', expiresOn: '2027-01-01' },
        { membershipNumber: 'PSF-', tierCode: null },
        { membershipNumber: 'PSF-999-000', tierCode: 'unheard_of' },
      ],
    });
    expect(repo.upsertMemberList).toHaveBeenCalledWith(
      [
        expect.objectContaining({ membershipNumber: 'PSF-123-456', tin: '192837465', tierCode: 'indatwa_10k' }),
        expect.objectContaining({ membershipNumber: 'PSF-999-000', tierCode: null }),
      ],
      OFFICER,
    );
    expect(result.rows).toBe(2);
    expect(result.confirmedClaims).toBe(1);
    expect(result.skipped).toHaveLength(2);
    expect(mail.claimConfirmed).toHaveBeenCalledWith('o1', 'PSF-123-456', '2027-01-01');
  });
});
