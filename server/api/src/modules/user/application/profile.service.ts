import type { MyProfile, PersonalDetails } from '@injishi/contracts';
import { ConflictException, Injectable } from '@nestjs/common';

import { maskIdentifier } from '../../../shared/identity/mask';
import {
  DuplicateIdentityDocumentError,
  ProfileRepository,
  type ProfileRow,
} from '../infrastructure/profile.repository';

/**
 * A person's own identity capture — Step 1 of registration (FL01 §1).
 *
 * USER MODULE's only outward-facing surface. Other modules compose this
 * service, never the repository: `OrganizationModule` needs Step 1 saved and
 * needs to know whether it is complete, and it gets both from here.
 *
 * This is identity CAPTURE, not identity VERIFICATION. Nothing written here
 * moves `kyc_status`. Elevation still asks `verified_identities` for a verified
 * status, and answering a form is not that.
 */
@Injectable()
export class ProfileService {
  constructor(private readonly profiles: ProfileRepository) {}

  /** Save Step 1, refusing a document that already anchors another account. */
  async save(userId: string, details: PersonalDetails): Promise<MyProfile> {
    try {
      await this.profiles.save(userId, details);
    } catch (err) {
      if (err instanceof DuplicateIdentityDocumentError) {
        throw new ConflictException(err.message);
      }
      throw err;
    }
    return this.read(userId);
  }

  /** What the wizard renders for a returning registrant. */
  async read(userId: string): Promise<MyProfile> {
    const row = await this.profiles.findByUserId(userId);
    if (!row) {
      return {
        fullName: null,
        gender: null,
        dateOfBirth: null,
        phoneE164: null,
        document: null,
        address: null,
        complete: false,
      };
    }
    return {
      fullName: row.fullName,
      gender: row.gender,
      dateOfBirth: row.dateOfBirth,
      phoneE164: row.phoneE164,
      document: row.document
        ? {
            documentType: row.document.documentType,
            documentNumberMasked: maskIdentifier(row.document.documentNumber),
            issuingCountry: row.document.issuingCountry,
          }
        : null,
      address: toAddress(row),
      complete: isComplete(row),
    };
  }

  /**
   * Is Step 1 answered well enough to register a business?
   *
   * The one definition. `RegistrationService` asks this rather than carrying
   * its own copy, so the wizard's "you still owe us details" and the server's
   * refusal can never disagree about which details.
   */
  async isComplete(userId: string): Promise<boolean> {
    const row = await this.profiles.findByUserId(userId);
    return row !== null && isComplete(row);
  }

  /**
   * The caller's own National ID in full, or null when they hold none.
   *
   * The ONE unmasked read of a document number, and it is narrow on purpose.
   * `read` masks (§10) because a full number sent back on every page load is a
   * full number in every log and cache; broker registration is the one caller
   * that needs the real value, because `brokers.national_id` IS the broker's
   * identity and `brokers_national_id_uk` is what stops one person registering
   * twice. It returns null for a passport rather than the passport number: a
   * passport is a valid account document and is not a valid broker identity.
   */
  async nationalIdFor(userId: string): Promise<string | null> {
    const row = await this.profiles.findByUserId(userId);
    if (!row?.document) return null;
    return row.document.documentType === 'national_id'
      ? row.document.documentNumber
      : null;
  }
}

/**
 * Completeness, judged on a row rather than written as a WHERE clause.
 *
 * The rule differs by country — a Rwandan profile owes its district and sector,
 * an international one owes a written address instead — and SQL that encodes
 * that is harder to read than the sentence it replaces.
 */
function isComplete(row: ProfileRow): boolean {
  if (!row.fullName || !row.dateOfBirth || !row.phoneE164) return false;
  if (!row.document) return false;
  if (row.country === 'RW') {
    return row.districtId !== null && row.sectorId !== null;
  }
  return row.addressText !== null && row.addressText.length > 0;
}

/**
 * Rebuild the wire address from the columns, or null when it is not there yet.
 *
 * A Rwandan address needs its province, which comes from the sector join. If
 * that join found nothing the address is not renderable, and null is the honest
 * answer — better than a half address the picker cannot open.
 */
function toAddress(row: ProfileRow): MyProfile['address'] {
  if (row.country === 'RW') {
    if (row.provinceId === null || row.districtId === null || row.sectorId === null) {
      return null;
    }
    return {
      country: 'RW',
      provinceId: row.provinceId,
      districtId: row.districtId,
      sectorId: row.sectorId,
      ...(row.addressText ? { street: row.addressText } : {}),
    };
  }
  if (!row.addressText) return null;
  return { country: row.country, addressText: row.addressText };
}

// The masking rule this file used to own now lives in
// `shared/identity/mask.ts`, because the admin console needs the same one and
// a module-private copy cannot be imported. Two copies of a disclosure rule is
// one copy waiting to be loosened.
