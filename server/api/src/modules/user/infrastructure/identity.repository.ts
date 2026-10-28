import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, ne, sql, type SQL } from 'drizzle-orm';

import {
  identityDocuments,
  identityScans,
  registrationDrafts,
  userProfiles,
  users,
  verifiedIdentities,
} from '../../../database/drizzle/schema';
import {
  DRIZZLE,
  type Database,
} from '../../../shared/database/database.module';
import { DuplicateIdentityDocumentError } from './profile.repository';

/** Where a person's identity stands, read in one place for the status route. */
export interface IdentityRow {
  kycStatus: 'unverified' | 'pending' | 'verified' | 'rejected';
  method: string | null;
  legalFullName: string | null;
  dateOfBirth: string | null;
  gender: 'female' | 'male' | 'other' | 'prefer_not_to_say' | null;
  document: {
    documentType: 'national_id' | 'passport';
    documentNumber: string;
    issuingCountry: string;
  } | null;
}

export interface VerifiedIdentityInput {
  fullName: string;
  dateOfBirth: string;
  gender: 'female' | 'male' | null;
  /** Written to the profile only when the profile holds no phone yet. */
  phoneE164: string | null;
  documentType: 'national_id' | 'passport';
  documentNumber: string;
  issuingCountry: string;
  /** `document_scan` (ADR-060) or `psf_review` (ADR-075 D-o); free text on the column. */
  method: string;
}

/**
 * Identity verification's rows (ADR-060, ADR-075): every scan attempt, the try
 * count on the draft, and the identity a scan or typed details produce.
 *
 * Writing a verified identity touches the same three places a profile save
 * does (`verified_identities`, `identity_documents`, `user_profiles`), in one
 * transaction, and keeps the same "one human, one account" rule: a document
 * held by another account is refused before anything is written.
 */
@Injectable()
export class IdentityRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async find(userId: string): Promise<IdentityRow> {
    const [identity] = await this.db
      .select({
        kycStatus: verifiedIdentities.kycStatus,
        method: verifiedIdentities.verifiedMethod,
        legalFullName: verifiedIdentities.legalFullName,
        dateOfBirth: verifiedIdentities.dob,
      })
      .from(verifiedIdentities)
      .where(eq(verifiedIdentities.userId, userId))
      .limit(1);
    const [profile] = await this.db
      .select({ gender: userProfiles.gender })
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .limit(1);
    const [document] = await this.db
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
      kycStatus: identity?.kycStatus ?? 'unverified',
      method: identity?.method ?? null,
      legalFullName: identity?.legalFullName ?? null,
      dateOfBirth: identity?.dateOfBirth ?? null,
      gender: profile?.gender ?? null,
      document: document
        ? {
            documentType: document.documentType === 'passport' ? 'passport' : 'national_id',
            documentNumber: document.documentNumber,
            issuingCountry: document.issuingCountry,
          }
        : null,
    };
  }

  /** The inputs `mayElevate` in `@injishi/contracts` decides on. */
  async elevationFacts(
    userId: string,
  ): Promise<{ kycStatus: string; activeDocumentCount: number }> {
    const [identity] = await this.db
      .select({ kycStatus: verifiedIdentities.kycStatus })
      .from(verifiedIdentities)
      .where(eq(verifiedIdentities.userId, userId));
    const [counted] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(identityDocuments)
      .where(
        and(
          eq(identityDocuments.identityId, userId),
          eq(identityDocuments.status, 'active'),
        ),
      );
    return {
      kycStatus: identity?.kycStatus ?? 'unverified',
      activeDocumentCount: counted?.n ?? 0,
    };
  }

  /** True when another account already holds this document. */
  async heldByAnother(
    userId: string,
    document: { documentType: 'national_id' | 'passport'; documentNumber: string; issuingCountry: string },
  ): Promise<boolean> {
    const [held] = await this.db
      .select({ identityId: identityDocuments.identityId })
      .from(identityDocuments)
      .where(
        and(
          eq(identityDocuments.documentType, document.documentType),
          eq(identityDocuments.documentNumber, document.documentNumber),
          eq(identityDocuments.issuingCountry, document.issuingCountry),
        ),
      )
      .limit(1);
    return Boolean(held && held.identityId !== userId);
  }

  /**
   * Write one scan attempt (ADR-075 D-n) and count it on the draft (D-m), in one
   * transaction, so the try count and the rows can never disagree. The draft row
   * is created when there is none yet, holding only its `checks`; the client's
   * `payload` is left exactly as it was. Answers this try's number.
   */
  async recordScan(input: {
    userId: string;
    documentType: 'national_id' | 'passport';
    frontObjectKey: string;
    selfieObjectKey: string;
    outcome: 'machine_passed' | 'machine_failed' | 'manual_needed';
    reason: string | null;
    adapterMode: 'mock' | 'live' | 'off';
  }): Promise<number> {
    return this.db.transaction(async (tx) => {
      await tx.insert(identityScans).values(input);
      const scan = (attempts: SQL): SQL =>
        sql`jsonb_build_object('attempts', ${attempts}, 'documentType', ${input.documentType}::text, 'outcome', ${input.outcome}::text)`;
      const [row] = await tx
        .insert(registrationDrafts)
        .values({ userId: input.userId, checks: sql`jsonb_build_object('scan', ${scan(sql`1`)})` })
        .onConflictDoUpdate({
          target: registrationDrafts.userId,
          set: {
            checks: sql`jsonb_set(${registrationDrafts.checks}, '{scan}', ${scan(
              sql`coalesce((${registrationDrafts.checks} #>> '{scan,attempts}')::int, 0) + 1`,
            )})`,
          },
        })
        .returning({ attempts: sql<number>`(${registrationDrafts.checks} #>> '{scan,attempts}')::int` });
      return row!.attempts;
    });
  }

  /** The caller's latest scan, on any draft, or null when they never scanned. */
  async latestScan(userId: string): Promise<{
    outcome: 'machine_passed' | 'machine_failed' | 'manual_needed';
    documentType: 'national_id' | 'passport';
  } | null> {
    const [row] = await this.db
      .select({ outcome: identityScans.outcome, documentType: identityScans.documentType })
      .from(identityScans)
      .where(eq(identityScans.userId, userId))
      .orderBy(desc(identityScans.createdAt))
      .limit(1);
    if (!row) return null;
    return { outcome: row.outcome, documentType: row.documentType === 'passport' ? 'passport' : 'national_id' };
  }

  /** Tries on the current draft (`checks.scan.attempts`), 0 with no draft. */
  async scanAttempts(userId: string): Promise<number> {
    const [row] = await this.db
      .select({ attempts: sql<number | null>`(${registrationDrafts.checks} #>> '{scan,attempts}')::int` })
      .from(registrationDrafts)
      .where(eq(registrationDrafts.userId, userId))
      .limit(1);
    return row?.attempts ?? 0;
  }

  /**
   * Record details typed as printed, after a scan that read nothing (ADR-075
   * S4): the KYC row at `pending`, for PSF to hold against the photos, the
   * document as the active primary one and unverified, and the profile's name,
   * birth date and ID mirror, in one transaction. The same "one human, one
   * account" refusal as every other write of a document.
   */
  async recordTyped(
    userId: string,
    input: {
      fullName: string;
      dateOfBirth: string;
      documentType: 'national_id' | 'passport';
      documentNumber: string;
      issuingCountry: string;
    },
  ): Promise<void> {
    const now = new Date();
    await this.db.transaction(async (tx) => {
      const [held] = await tx
        .select({ identityId: identityDocuments.identityId })
        .from(identityDocuments)
        .where(
          and(
            eq(identityDocuments.documentType, input.documentType),
            eq(identityDocuments.documentNumber, input.documentNumber),
            eq(identityDocuments.issuingCountry, input.issuingCountry),
          ),
        )
        .limit(1);
      if (held && held.identityId !== userId) {
        throw new DuplicateIdentityDocumentError();
      }

      const identity = {
        kycStatus: 'pending' as const,
        legalFullName: input.fullName,
        dob: input.dateOfBirth,
        verifiedMethod: null,
        verifiedAt: null,
      };
      await tx
        .insert(verifiedIdentities)
        .values({ userId, ...identity })
        .onConflictDoUpdate({
          target: verifiedIdentities.userId,
          set: { ...identity, verifiedByUserId: null, updatedAt: now },
        });

      await tx
        .update(identityDocuments)
        .set({ isPrimary: false, status: 'superseded', updatedAt: now })
        .where(
          and(
            eq(identityDocuments.identityId, userId),
            eq(identityDocuments.isPrimary, true),
            ne(identityDocuments.documentNumber, input.documentNumber),
          ),
        );
      if (held) {
        await tx
          .update(identityDocuments)
          .set({ isPrimary: true, status: 'active', verifiedAt: null, updatedAt: now })
          .where(
            and(
              eq(identityDocuments.documentType, input.documentType),
              eq(identityDocuments.documentNumber, input.documentNumber),
              eq(identityDocuments.issuingCountry, input.issuingCountry),
            ),
          );
      } else {
        await tx.insert(identityDocuments).values({
          identityId: userId,
          documentType: input.documentType,
          documentNumber: input.documentNumber,
          issuingCountry: input.issuingCountry,
          status: 'active',
          isPrimary: true,
        });
      }

      const nationalId = input.documentType === 'national_id' ? input.documentNumber : null;
      await tx
        .insert(userProfiles)
        .values({ userId, displayName: input.fullName, dob: input.dateOfBirth, nationalId })
        .onConflictDoUpdate({
          target: userProfiles.userId,
          set: { displayName: input.fullName, dob: input.dateOfBirth, nationalId, updatedAt: now },
        });
    });
  }

  /**
   * Record a verified identity: the KYC row at `verified`, the document as the
   * active primary one, and the profile's name, birth date, gender and ID
   * mirror, all in one transaction.
   */
  async recordVerified(userId: string, input: VerifiedIdentityInput): Promise<void> {
    const now = new Date();
    await this.db.transaction(async (tx) => {
      const [held] = await tx
        .select({ identityId: identityDocuments.identityId })
        .from(identityDocuments)
        .where(
          and(
            eq(identityDocuments.documentType, input.documentType),
            eq(identityDocuments.documentNumber, input.documentNumber),
            eq(identityDocuments.issuingCountry, input.issuingCountry),
          ),
        )
        .limit(1);
      if (held && held.identityId !== userId) {
        throw new DuplicateIdentityDocumentError();
      }

      const identity = {
        kycStatus: 'verified' as const,
        legalFullName: input.fullName,
        dob: input.dateOfBirth,
        verifiedMethod: input.method,
        verifiedAt: now,
      };
      await tx
        .insert(verifiedIdentities)
        .values({ userId, ...identity })
        .onConflictDoUpdate({
          target: verifiedIdentities.userId,
          set: { ...identity, verifiedByUserId: null, updatedAt: now },
        });

      // A nameless account takes the verified legal name, so it is greeted and shown by name, not by email.
      await tx
        .update(users)
        .set({ name: input.fullName, updatedAt: now })
        .where(and(eq(users.id, userId), sql`coalesce(btrim(${users.name}), '') = ''`));

      await tx
        .update(identityDocuments)
        .set({ isPrimary: false, status: 'superseded', updatedAt: now })
        .where(
          and(
            eq(identityDocuments.identityId, userId),
            eq(identityDocuments.isPrimary, true),
            ne(identityDocuments.documentNumber, input.documentNumber),
          ),
        );
      if (held) {
        await tx
          .update(identityDocuments)
          .set({ isPrimary: true, status: 'active', verifiedAt: now, updatedAt: now })
          .where(
            and(
              eq(identityDocuments.documentType, input.documentType),
              eq(identityDocuments.documentNumber, input.documentNumber),
              eq(identityDocuments.issuingCountry, input.issuingCountry),
            ),
          );
      } else {
        await tx.insert(identityDocuments).values({
          identityId: userId,
          documentType: input.documentType,
          documentNumber: input.documentNumber,
          issuingCountry: input.issuingCountry,
          status: 'active',
          isPrimary: true,
          verifiedAt: now,
        });
      }

      const nationalId = input.documentType === 'national_id' ? input.documentNumber : null;
      await tx
        .insert(userProfiles)
        .values({
          userId,
          displayName: input.fullName,
          dob: input.dateOfBirth,
          gender: input.gender,
          nationalId,
          phoneE164: input.phoneE164,
        })
        .onConflictDoUpdate({
          target: userProfiles.userId,
          set: {
            displayName: input.fullName,
            dob: input.dateOfBirth,
            // A register that does not know the gender does not erase the one given.
            ...(input.gender ? { gender: input.gender } : {}),
            nationalId,
            // A phone the person already gave stays; the register's only fills a gap.
            phoneE164: sql`coalesce(${userProfiles.phoneE164}, ${input.phoneE164})`,
            updatedAt: now,
          },
        });
    });
  }
}
