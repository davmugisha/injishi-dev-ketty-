import type {
  PsfApplication,
  PsfApplicationInput,
  PsfMembership,
  PsfSubmittedCapacity,
  PsfTier,
} from '@injishi/contracts';

import type {
  NewPsfApplication,
  PsfApplicationWithNames,
  PsfMembershipRow,
  PsfTierRow,
} from '../infrastructure/psf-membership.repository';

/**
 * The filed row for one PSF application (ADR-056), built the same way for the
 * registration wizard and the workspace. Pure, so both doors file the same
 * form and a test can pin it.
 *
 * The business id is the caller's to add: the wizard's business does not
 * exist until the create transaction writes it.
 *
 * The registration number is the business's TIN and never an input, which is
 * what makes AC-3's "not editable" true on the wire. The price is COPIED from
 * the tier as it stands now, so a later price edit never rewrites what the
 * business saw when it applied.
 */
export function buildPsfApplicationRow(input: {
  submittedByUserId: string;
  capacity: PsfSubmittedCapacity;
  registrationNumber: string;
  tier: Pick<PsfTierRow, 'code' | 'priceKind' | 'annualFeeRwf' | 'annualFeeMinRwf' | 'annualFeeMaxRwf'>;
  form: PsfApplicationInput;
  consentGivenAt: Date;
  consentVersion: string;
}): Omit<NewPsfApplication, 'orgId'> {
  const { form, tier } = input;
  const trading = form.tradeDirection !== 'none';
  return {
    submittedByUserId: input.submittedByUserId,
    submittedCapacity: input.capacity,
    status: 'submitted',
    requestedTierCode: tier.code,
    quotedPriceKind: tier.priceKind,
    quotedFeeRwf: tier.annualFeeRwf,
    quotedFeeMinRwf: tier.annualFeeMinRwf,
    quotedFeeMaxRwf: tier.annualFeeMaxRwf,
    companyName: form.companyName,
    registrationType: 'tin',
    registrationNumber: input.registrationNumber,
    website: form.website ?? null,
    streetAddress: form.streetAddress,
    companyType: form.companyType,
    ownership: form.ownership,
    ownershipOther: form.ownership === 'other' ? (form.ownershipOther ?? null) : null,
    businessActivity: form.businessActivity,
    tradeDirection: form.tradeDirection,
    tradeGoods: trading ? (form.tradeGoods ?? null) : null,
    tradeCountries: trading ? form.tradeCountries : [],
    contactRole: form.contactRole,
    firstName: form.firstName,
    lastName: form.lastName,
    gender: form.gender,
    phoneE164: form.phoneE164,
    email: form.email,
    idDocumentType: form.idDocument.documentType,
    idDocumentNumber: form.idDocument.documentNumber,
    dateOfBirth: form.dateOfBirth,
    consentGivenAt: input.consentGivenAt,
    consentVersion: input.consentVersion,
  };
}

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);

export function toPsfApplicationView(row: PsfApplicationWithNames): PsfApplication {
  return {
    id: row.id,
    status: row.status,
    requestedTierCode: row.requestedTierCode,
    requestedTierName: row.requestedTierName,
    quotedPriceKind: row.quotedPriceKind,
    quotedFeeRwf: row.quotedFeeRwf,
    quotedFeeMinRwf: row.quotedFeeMinRwf,
    quotedFeeMaxRwf: row.quotedFeeMaxRwf,
    submittedAt: row.createdAt.toISOString(),
    submittedCapacity: row.submittedCapacity,
    submittedByName: row.submittedByName,
    queuedAt: iso(row.queuedAt),
    decidedAt: iso(row.decidedAt),
    declineReason: row.declineReason,
    decisionNote: row.decisionNote,
    withdrawnAt: iso(row.withdrawnAt),
    form: {
      companyName: row.companyName,
      registrationType: row.registrationType,
      registrationNumber: row.registrationNumber,
      website: row.website,
      streetAddress: row.streetAddress,
      companyType: row.companyType,
      ownership: row.ownership,
      ownershipOther: row.ownershipOther,
      businessActivity: row.businessActivity,
      tradeDirection: row.tradeDirection,
      tradeGoods: row.tradeGoods,
      tradeCountries: row.tradeCountries,
      contactRole: row.contactRole,
      firstName: row.firstName,
      lastName: row.lastName,
      // The row's CHECK holds these to PSF's two values.
      gender: row.gender === 'female' ? 'female' : 'male',
      phoneE164: row.phoneE164,
      email: row.email,
      idDocumentType: row.idDocumentType === 'passport' ? 'passport' : 'national_id',
      idDocumentNumber: row.idDocumentNumber,
      dateOfBirth: row.dateOfBirth,
    },
  };
}

export function toPsfMembershipView(row: PsfMembershipRow & { tierName: string | null }): PsfMembership {
  return {
    id: row.id,
    source: row.source,
    tierCode: row.tierCode,
    tierName: row.tierName,
    membershipNumber: row.membershipNumber,
    annualFeeRwf: row.annualFeeRwf,
    startsOn: row.startsOn,
    expiresOn: row.expiresOn,
    endedAt: iso(row.endedAt),
  };
}

export function toPsfTierView(row: PsfTierRow): PsfTier {
  return {
    code: row.code,
    family: row.family,
    nameEn: row.nameEn,
    nameRw: row.nameRw,
    priceKind: row.priceKind,
    annualFeeRwf: row.annualFeeRwf,
    annualFeeMinRwf: row.annualFeeMinRwf,
    annualFeeMaxRwf: row.annualFeeMaxRwf,
    benefitsEn: row.benefitsEn,
    benefitsRw: row.benefitsRw,
    sortOrder: row.sortOrder,
    active: row.active,
  };
}
