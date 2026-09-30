import type { Address, IdentityDocumentInput, PersonalDetails } from '@injishi/contracts';
import { isRwandanAddress } from '@injishi/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { and, eq, ne } from 'drizzle-orm';

import {
  districts,
  identityDocuments,
  sectors,
  userProfiles,
  verifiedIdentities,
  villages,
} from '../../../database/drizzle/schema';
import {
  DRIZZLE,
  type Database,
} from '../../../shared/database/database.module';

/**
 * That document already anchors another account (Decision A).
 *
 * A hard refusal, never a second identity. `identity_documents` carries the
 * unique key that makes "one human, one account" true; this is that key
 * surfacing as a sentence the wizard can show, alongside the route out —
 * account recovery, not a second signup.
 */
export class DuplicateIdentityDocumentError extends Error {
  constructor() {
    super(
      'That identity document is already registered to another account. Recover that account rather than creating a second one.',
    );
  }
}

/** The stored profile, shaped for the read route. Nulls are a real state. */
export interface ProfileRow {
  fullName: string | null;
  gender: 'female' | 'male' | 'other' | 'prefer_not_to_say' | null;
  dateOfBirth: string | null;
  phoneE164: string | null;
  country: string;
  provinceId: number | null;
  districtId: number | null;
  sectorId: number | null;
  /** Joined up from the village, never stored: `villages` resolves to its cell. */
  cellId: number | null;
  villageId: number | null;
  addressText: string | null;
  document: {
    documentType: 'national_id' | 'passport';
    documentNumber: string;
    issuingCountry: string;
  } | null;
}

/**
 * The only place that touches Drizzle for a person's own profile.
 *
 * Step 1 of registration writes THREE tables — `user_profiles` (the display
 * copy), `verified_identities` (the KYC'd human a privilege attaches to) and
 * `identity_documents` (the uniqueness anchor). They describe one act, so they
 * are written in one transaction: a profile with no identity row would be a
 * person the elevation gate can never let through.
 */

/**
 * The address columns a profile write sets.
 *
 * Every column on both branches, `villageId` included. It used to be optional
 * on the Rwandan branch so a write would leave an existing village alone, which
 * was right while nothing collected one; now that Step 1 asks for it, the form
 * is the whole answer, and a person who clears their village has to be able to
 * clear it. Leaving it alone would make the pickers and the row disagree.
 */
interface AddressColumns {
  country: string;
  districtId: number | null;
  sectorId: number | null;
  villageId: number | null;
  addressText: string | null;
}

@Injectable()
export class ProfileRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /**
   * Save Step 1, replacing whatever was there.
   *
   * An upsert rather than an insert because this is also the edit path: a
   * registrant who mistyped a phone number and came back should not be told
   * their profile already exists.
   */
  async save(
    userId: string,
    // The service resolves the document first (a verified person may omit it).
    details: PersonalDetails & { document: IdentityDocumentInput },
  ): Promise<void> {
    const address = this.addressColumns(details.address);
    const doc = details.document;
    // §4.2: `user_profiles.national_id` is a display MIRROR of the primary
    // document, never the anchor. A passport holder has no national id, and
    // writing a passport number into that column would make the mirror lie.
    const nationalIdMirror =
      doc.documentType === 'national_id' ? doc.documentNumber : null;

    await this.db.transaction(async (tx) => {
      // The document is claimed FIRST, so a clash aborts before anything else
      // is written. Claiming it last would leave a profile behind for a signup
      // that was refused.
      const [held] = await tx
        .select({ identityId: identityDocuments.identityId })
        .from(identityDocuments)
        .where(
          and(
            eq(identityDocuments.documentType, doc.documentType),
            eq(identityDocuments.documentNumber, doc.documentNumber),
            eq(identityDocuments.issuingCountry, doc.issuingCountry),
          ),
        )
        .limit(1);
      if (held && held.identityId !== userId) {
        throw new DuplicateIdentityDocumentError();
      }

      await tx
        .insert(verifiedIdentities)
        .values({
          userId,
          legalFullName: details.fullName,
          dob: details.dateOfBirth,
        })
        .onConflictDoUpdate({
          target: verifiedIdentities.userId,
          // `kyc_status` is deliberately absent: telling us your name is not
          // being verified, and this write must never move the KYC needle.
          set: {
            legalFullName: details.fullName,
            dob: details.dateOfBirth,
            updatedAt: new Date(),
          },
        });

      // At most one primary document per identity (a partial unique index), so
      // demote the old one before promoting the new.
      await tx
        .update(identityDocuments)
        .set({ isPrimary: false, status: 'superseded', updatedAt: new Date() })
        .where(
          and(
            eq(identityDocuments.identityId, userId),
            eq(identityDocuments.isPrimary, true),
            ne(identityDocuments.documentNumber, doc.documentNumber),
          ),
        );

      if (held) {
        await tx
          .update(identityDocuments)
          .set({ isPrimary: true, status: 'active', updatedAt: new Date() })
          .where(
            and(
              eq(identityDocuments.documentType, doc.documentType),
              eq(identityDocuments.documentNumber, doc.documentNumber),
              eq(identityDocuments.issuingCountry, doc.issuingCountry),
            ),
          );
      } else {
        await tx.insert(identityDocuments).values({
          identityId: userId,
          documentType: doc.documentType,
          documentNumber: doc.documentNumber,
          issuingCountry: doc.issuingCountry,
          status: 'active',
          isPrimary: true,
        });
      }

      await tx
        .insert(userProfiles)
        .values({
          userId,
          displayName: details.fullName,
          phoneE164: details.phoneE164,
          nationalId: nationalIdMirror,
          dob: details.dateOfBirth,
          gender: details.gender ?? null,
          ...address,
        })
        .onConflictDoUpdate({
          target: userProfiles.userId,
          set: {
            displayName: details.fullName,
            phoneE164: details.phoneE164,
            nationalId: nationalIdMirror,
            dob: details.dateOfBirth,
            gender: details.gender ?? null,
            ...address,
            updatedAt: new Date(),
          },
        });
    });
  }

  /**
   * Map an address onto columns, including the ones it must CLEAR.
   *
   * `village_id` is nulled explicitly on the international branch rather than
   * left alone: `user_profiles_address_country_shape` refuses a non-Rwandan row
   * that still holds a Rwandan id, so a person who moved abroad would otherwise
   * be blocked by their own old answer.
   */
  private addressColumns(address: Address): AddressColumns {
    if (isRwandanAddress(address)) {
      return {
        country: 'RW',
        districtId: address.districtId,
        sectorId: address.sectorId,
        // Optional (D24). The cell above it is not stored: `villages` resolves
        // upward to its cell exactly as `sectors` does to its district.
        villageId: address.villageId ?? null,
        addressText: address.street ?? null,
      };
    }
    return {
      country: address.country,
      districtId: null,
      sectorId: null,
      villageId: null,
      addressText: address.addressText,
    };
  }

  /**
   * The stored profile, with the province resolved from the sector and the cell
   * from the village.
   *
   * Neither is stored (D24): `sectors` already resolves upward to its district
   * and province, `villages` to its cell, and another copy of the same fact is
   * another chance to disagree. Both joins are LEFT joins, because a profile
   * may hold no sector yet and will often hold no village.
   */
  async findByUserId(userId: string): Promise<ProfileRow | null> {
    const [row] = await this.db
      .select({
        fullName: userProfiles.displayName,
        gender: userProfiles.gender,
        dateOfBirth: userProfiles.dob,
        phoneE164: userProfiles.phoneE164,
        country: userProfiles.country,
        districtId: userProfiles.districtId,
        sectorId: userProfiles.sectorId,
        villageId: userProfiles.villageId,
        addressText: userProfiles.addressText,
        provinceId: districts.provinceId,
        cellId: villages.cellId,
      })
      .from(userProfiles)
      .leftJoin(sectors, eq(sectors.id, userProfiles.sectorId))
      .leftJoin(districts, eq(districts.id, sectors.districtId))
      .leftJoin(villages, eq(villages.id, userProfiles.villageId))
      .where(eq(userProfiles.userId, userId))
      .limit(1);
    if (!row) return null;

    const [doc] = await this.db
      .select({
        documentType: identityDocuments.documentType,
        documentNumber: identityDocuments.documentNumber,
        issuingCountry: identityDocuments.issuingCountry,
      })
      .from(identityDocuments)
      .where(
        and(
          eq(identityDocuments.identityId, userId),
          eq(identityDocuments.isPrimary, true),
          eq(identityDocuments.status, 'active'),
        ),
      )
      .limit(1);

    return {
      ...row,
      document:
        doc && doc.documentType !== 'other'
          ? {
              documentType: doc.documentType,
              documentNumber: doc.documentNumber,
              issuingCountry: doc.issuingCountry,
            }
          : null,
    };
  }
}
