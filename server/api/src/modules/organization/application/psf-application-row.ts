import { randomBytes } from 'node:crypto';

import { newPsfDocId, psfFamilyName } from '@injishi/contracts';
import type {
  PsfApplication,
  PsfApplicationInput,
  PsfIdDocument,
  PsfMembership,
  PsfSubmittedCapacity,
  PsfSubsector,
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
 * The registration is the business's own and never an input, which is what
 * makes AC-3's "not editable" true on the wire: a hotel's TIN, or whatever a
 * PSF business registered with (`tin`, `rca`, `rgb`, `other`, or `none` with
 * no number). The price is COPIED from the tier as it stands now, so a later
 * price edit never rewrites what the business saw when it applied, and the
 * amount the business declared rides beside it.
 */
/**
 * The form as a row is filed from (2026-11-03): every field PSF's form holds, the ID resolved. Injishi's
 * registration sends the business part alone; `PsfMembershipService.completeForm` fills the rest from
 * the registration and the person's profile.
 */
export type CompletePsfForm = PsfApplicationInput & { idDocument: PsfIdDocument } & Required<
    Pick<PsfApplicationInput, 'companyName' | 'streetAddress' | 'contactRole' | 'firstName' | 'lastName' | 'gender' | 'phoneE164' | 'email' | 'dateOfBirth'>
  >;

export function buildPsfApplicationRow(input: {
  /** Null from the public form, where nobody signs in. */
  submittedByUserId: string | null;
  /** Where news goes without an account (the public form). */
  applicantPhoneE164?: string | null;
  applicantEmail?: string | null;
  capacity: PsfSubmittedCapacity;
  registrationType: string;
  registrationNumber: string | null;
  tier: Pick<PsfTierRow, 'code' | 'priceKind' | 'annualFeeRwf' | 'annualFeeMinRwf' | 'annualFeeMaxRwf'>;
  /** The ID resolved: typed, or copied from the profile by the caller. */
  form: CompletePsfForm;
  consentGivenAt: Date;
  consentVersion: string;
  /** A card holder joining the new module (2026-11-02), or a new application (the default). */
  intake?: 'new' | 'card_holder';
}): Omit<NewPsfApplication, 'orgId'> {
  const { form, tier } = input;
  const trading = form.tradeDirection !== 'none';
  return {
    submittedByUserId: input.submittedByUserId,
    docId: newPsfDocId((n) => randomBytes(n)),
    applicantPhoneE164: input.applicantPhoneE164 ?? null,
    applicantEmail: input.applicantEmail ?? null,
    submittedCapacity: input.capacity,
    status: 'submitted',
    intake: input.intake ?? 'new',
    requestedTierCode: tier.code,
    quotedPriceKind: tier.priceKind,
    quotedFeeRwf: tier.annualFeeRwf,
    quotedFeeMinRwf: tier.annualFeeMinRwf,
    quotedFeeMaxRwf: tier.annualFeeMaxRwf,
    // A tier PSF prices itself takes no amount from the business.
    declaredFeeRwf: tier.priceKind === 'set_by_psf' ? null : (form.declaredFeeRwf ?? null),
    companyName: form.companyName,
    registrationType: input.registrationType,
    registrationNumber: input.registrationType === 'none' ? null : input.registrationNumber,
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
    declaredFeeRwf: row.declaredFeeRwf,
    submittedAt: row.createdAt.toISOString(),
    submittedCapacity: row.submittedCapacity,
    submittedByName: row.submittedByName,
    queuedAt: iso(row.queuedAt),
    decidedAt: iso(row.decidedAt),
    declineReason: row.declineReason,
    decisionNote: row.decisionNote,
    approvedMembershipNumber: row.approvedMembershipNumber,
    approvedFeeRwf: row.approvedFeeRwf,
    payment:
      row.paidAt && row.paidAmountRwf !== null && row.paymentRef
        ? {
            paidAt: row.paidAt.toISOString(),
            amountRwf: row.paidAmountRwf,
            reference: row.paymentRef,
            remittedAt: iso(row.remittedAt),
          }
        : null,
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

export function toPsfTierView(row: PsfTierRow & { familyName?: string; familyBlurb?: string | null }): PsfTier {
  return {
    code: row.code,
    family: row.family,
    familyName: row.familyName ?? psfFamilyName(row.family),
    familyBlurb: row.familyBlurb ?? '',
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

export function toSubsectorView(row: {
  id: string;
  clusterCode: string;
  nameEn: string;
  districtId: number | null;
  districtName: string | null;
  sortOrder: number;
  active: boolean;
  associationCodes: string[];
}): PsfSubsector {
  return {
    id: row.id,
    clusterCode: row.clusterCode,
    nameEn: row.nameEn,
    districtId: row.districtId,
    districtName: row.districtName,
    sortOrder: row.sortOrder,
    active: row.active,
    associationCodes: row.associationCodes,
  };
}
