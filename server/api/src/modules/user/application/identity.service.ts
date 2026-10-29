import {
  SCAN_ATTEMPTS_BEFORE_CONTINUE,
  mayElevate,
  type IdentityOnFile,
  type IdentityScanOutcome,
  type IdentityScanReason,
  type IdentityScanRequest,
  type IdentityScanResult,
  type IdentityStatus,
  type RegistrationConflictCode,
  type TypedIdentityRequest,
} from '@injishi/contracts';
import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';

import { maskIdentifier } from '../../../shared/identity/mask';
import { StorageService } from '../../storage/application/storage.service';
import {
  DOCUMENT_VERIFIER,
  type DocumentCheck,
  type DocumentVerifierPort,
} from '../domain/identity-ports';
import { IdentityRepository, type IdentityRow } from '../infrastructure/identity.repository';
import { DuplicateIdentityDocumentError } from '../infrastructure/profile.repository';
import { DEMO_OTP_CODE } from '@injishi/auth';
import { PLATFORM, type Platform } from '../../../shared/config/platform';
import {
  IDENTITY_REGISTRY,
  type IdentityRegistryPort,
  type RegistryLookup,
} from '../domain/identity-registry-port';

const DUPLICATE_MESSAGE =
  'That identity document is already registered to another account. Recover that account rather than creating a second one.';

/** Why a registration is refused for want of an identity, worded for the step that fixes it. */
export const SCAN_FIRST_MESSAGE = 'Scan your ID, then take a selfie, on the You step.';

/**
 * Identity (ADR-060, rebuilt by ADR-075 A1): the ID is scanned, front of the
 * card or the passport's photo page, then a selfie, through the one document
 * verifier seam. No code is sent to any phone (AC-4).
 *
 * EVERY ATTEMPT IS KEPT (D-n), photos and all, in every mode: where a checker
 * runs the photos are its evidence, and where none does (`off`, production
 * until a provider is signed, D-a) they are what the PSF officer compares by
 * eye before approving (O-6). The status reads "Checked" only after a machine
 * check passed (AC-6).
 *
 * After 3 refused tries on the draft, or at once where no checker runs, the
 * person types the details as printed and carries on (AC-5): the identity is
 * then `pending`, and approving with the ID tick is what verifies it (D-o).
 */
@Injectable()
export class IdentityService {
  private readonly log = new Logger(IdentityService.name);

  /** The fixed code is issued only on the demo, over a sample database (ADR-043). */
  private readonly isDemo: boolean;

  constructor(
    private readonly repo: IdentityRepository,
    @Inject(DOCUMENT_VERIFIER) private readonly documents: DocumentVerifierPort,
    private readonly storage: StorageService,
    // The public PSF form's register lookup (see `identity-registry-port.ts`).
    @Inject(IDENTITY_REGISTRY) private readonly registry: IdentityRegistryPort,
    @Inject(PLATFORM) platform: Platform,
  ) {
    this.isDemo = platform.environment === 'demo';
  }

  /**
   * The population register, asked directly, for the public PSF form
   * (2026-10-19), which binds the answer to the phone itself and records it
   * on the application rather than on an account. Never throws: an outage is
   * `unavailable`, like every lookup here.
   */
  lookupRegister(documentNumber: string): Promise<RegistryLookup> {
    return this.lookupSafely(documentNumber);
  }

  /** The fixed code the demo issues over a sample database, else null. */
  get demoCode(): string | null {
    return this.isDemo ? DEMO_OTP_CODE : null;
  }

  get registryMode(): string {
    return this.registry.mode;
  }

  private async lookupSafely(documentNumber: string): Promise<RegistryLookup> {
    try {
      return await this.registry.lookupNationalId(documentNumber);
    } catch (error) {
      this.log.warn(`Identity register failed: ${(error as Error).message}`);
      return { status: 'unavailable' as const };
    }
  }

  async status(userId: string): Promise<IdentityStatus> {
    const [row, scan, attempts] = await Promise.all([
      this.repo.find(userId),
      this.repo.latestScan(userId),
      this.repo.scanAttempts(userId),
    ]);
    return {
      kycStatus: row.kycStatus,
      method: row.method,
      onFile: this.onFile(row),
      scan: scan
        ? {
            outcome: scan.outcome,
            documentType: scan.documentType,
            attempts,
            mayContinue: mayContinue(scan.outcome, attempts),
          }
        : null,
      machineCheck: this.documents.mode !== 'off',
      mode: this.documents.mode,
    };
  }

  /**
   * Refuse a business registration from someone with no identity on file
   * (ADR-060, every mode since ADR-075). Verified passes; so does an identity
   * typed after a scan, which waits for PSF with the scan's photos beside it.
   * Typed details with no scan behind them do not: there would be nothing for
   * the officer to hold them against.
   */
  async assertMayRegister(userId: string): Promise<void> {
    const facts = await this.repo.elevationFacts(userId);
    if (mayElevate(facts)) return;
    if (facts.kycStatus === 'pending' && facts.activeDocumentCount > 0 && (await this.repo.latestScan(userId))) {
      return;
    }
    throw new ForbiddenException({
      code: 'identity_not_verified' satisfies RegistrationConflictCode,
      message: SCAN_FIRST_MESSAGE,
    });
  }

  /** One try: the two photos, what the checker made of them, and the row that keeps them. */
  async scan(userId: string, input: IdentityScanRequest): Promise<IdentityScanResult> {
    const current = await this.repo.find(userId);
    if (current.kycStatus === 'verified') {
      throw new ConflictException('Your ID is already checked. There is nothing to scan again.');
    }
    const [front, selfie] = await Promise.all([
      this.ownPhoto(userId, input.frontKey, 'frontKey'),
      this.ownPhoto(userId, input.selfieKey, 'selfieKey'),
    ]);

    let check: DocumentCheck;
    if (input.frontKey === input.selfieKey) {
      check = { status: 'rejected', reason: 'face_mismatch' };
    } else if (this.documents.mode === 'off') {
      check = { status: 'unavailable' };
    } else {
      try {
        check = await this.documents.verifyDocument({ documentType: input.documentType, front, selfie });
      } catch (error) {
        this.log.warn(`Document verifier failed: ${(error as Error).message}`);
        check = { status: 'unavailable' };
      }
    }
    if (check.status === 'verified' && check.holder.expiresOn && check.holder.expiresOn <= today()) {
      check = { status: 'rejected', reason: 'expired' };
    }
    // One human, one account: a document another account holds is refused
    // before anything is kept, because it is not this person's try at their own.
    if (
      check.status === 'verified' &&
      (await this.repo.heldByAnother(userId, {
        documentType: input.documentType,
        documentNumber: check.holder.documentNumber,
        issuingCountry: check.holder.issuingCountry,
      }))
    ) {
      throw new ConflictException(DUPLICATE_MESSAGE);
    }

    const outcome: IdentityScanOutcome =
      this.documents.mode === 'off' && input.frontKey !== input.selfieKey
        ? 'manual_needed'
        : check.status === 'verified'
          ? 'machine_passed'
          : 'machine_failed';
    const reason: IdentityScanReason | null =
      outcome !== 'machine_failed' ? null : check.status === 'rejected' ? check.reason : 'unavailable';
    const attempt = await this.repo.recordScan({
      userId,
      documentType: input.documentType,
      frontObjectKey: input.frontKey,
      selfieObjectKey: input.selfieKey,
      outcome,
      reason,
      adapterMode: this.documents.mode,
    });

    if (check.status === 'verified') {
      await this.recordOrRefuse(userId, {
        fullName: check.holder.fullName,
        dateOfBirth: check.holder.dateOfBirth,
        gender: check.holder.gender,
        phoneE164: null,
        documentType: input.documentType,
        documentNumber: check.holder.documentNumber,
        issuingCountry: check.holder.issuingCountry,
        method: 'document_scan',
      });
      return {
        outcome,
        reason: null,
        message: null,
        fields: {
          fullName: check.holder.fullName,
          dateOfBirth: check.holder.dateOfBirth,
          gender: check.holder.gender,
          documentType: input.documentType,
          documentNumberMasked: maskIdentifier(check.holder.documentNumber),
          issuingCountry: check.holder.issuingCountry,
          generated: check.generated,
          checked: true,
        },
        attempt,
        mayContinue: false,
      };
    }
    return {
      outcome,
      reason,
      message:
        outcome === 'manual_needed'
          ? 'Your photos are saved. Now type your details as they are printed on your ID, and PSF will check them against the photos.'
          : failureMessage(reason!, input.documentType),
      fields: null,
      attempt,
      mayContinue: mayContinue(outcome, attempt),
    };
  }

  /**
   * The details as printed, typed after a scan that read nothing or after the
   * tries ran out (ADR-075 S4). Stored `pending`, never verified: PSF compares
   * them with the photos before approving (D-o).
   */
  async putTyped(userId: string, input: TypedIdentityRequest): Promise<IdentityStatus> {
    const current = await this.repo.find(userId);
    if (current.kycStatus === 'verified') {
      throw new UnprocessableEntityException({
        message: 'Your ID is checked, so its details cannot be typed over.',
        issues: [{ code: 'custom', path: ['document', 'documentNumber'], message: 'Your ID is already checked.' }],
      });
    }
    const [scan, attempts] = await Promise.all([this.repo.latestScan(userId), this.repo.scanAttempts(userId)]);
    if (!scan || !mayContinue(scan.outcome, attempts)) {
      throw new ConflictException('Scan your ID first. You can type your details once the scan has saved your photos.');
    }
    try {
      await this.repo.recordTyped(userId, {
        fullName: input.fullName,
        dateOfBirth: input.dateOfBirth,
        documentType: input.document.documentType,
        documentNumber: input.document.documentNumber,
        issuingCountry: input.document.issuingCountry,
      });
    } catch (error) {
      if (error instanceof DuplicateIdentityDocumentError) {
        throw new ConflictException(DUPLICATE_MESSAGE);
      }
      throw error;
    }
    return this.status(userId);
  }

  /** The identity on file, scanned or typed, or null when there is none to show. */
  private onFile(row: IdentityRow): IdentityOnFile | null {
    if (row.kycStatus !== 'verified' && row.kycStatus !== 'pending') return null;
    if (!row.legalFullName || !row.dateOfBirth || !row.document) return null;
    return {
      fullName: row.legalFullName,
      dateOfBirth: row.dateOfBirth,
      gender: row.gender,
      documentType: row.document.documentType,
      documentNumberMasked: maskIdentifier(row.document.documentNumber),
      issuingCountry: row.document.issuingCountry,
      generated: this.documents.mode === 'mock' && row.method === 'document_scan',
      checked: row.kycStatus === 'verified',
    };
  }

  /** An `id_photo` the caller uploaded, as bytes, or a refusal naming the field. */
  private async ownPhoto(
    userId: string,
    objectKey: string,
    field: 'frontKey' | 'selfieKey',
  ): Promise<{ mime: string | null; bytes: Buffer }> {
    const described = await this.storage.describe(objectKey);
    if (!described || described.kind !== 'id_photo' || described.uploadedByUserId !== userId) {
      throw new UnprocessableEntityException({
        message: 'Validation failed',
        issues: [{ code: 'custom', path: [field], message: 'Upload that photo again.' }],
      });
    }
    return { mime: described.mime, bytes: await this.storage.readBytes(objectKey) };
  }

  private async recordOrRefuse(
    userId: string,
    input: Parameters<IdentityRepository['recordVerified']>[1],
  ): Promise<void> {
    try {
      await this.repo.recordVerified(userId, input);
    } catch (error) {
      if (error instanceof DuplicateIdentityDocumentError) {
        throw new ConflictException(DUPLICATE_MESSAGE);
      }
      throw error;
    }
  }
}

/** Whether the person may type their details and carry on (AC-5). */
function mayContinue(outcome: IdentityScanOutcome, attempts: number): boolean {
  return outcome === 'manual_needed' || (outcome === 'machine_failed' && attempts >= SCAN_ATTEMPTS_BEFORE_CONTINUE);
}

/** What went wrong, and how to fix it (S4). */
function failureMessage(reason: IdentityScanReason, documentType: 'national_id' | 'passport'): string {
  const frame = documentType === 'passport' ? 'the whole photo page' : 'the whole card';
  switch (reason) {
    case 'unreadable':
      return `We could not read that photo. More light, no glare, and fit ${frame} in the frame.`;
    case 'face_mismatch':
      return 'The selfie does not match the photo on your ID. Take a new selfie facing the camera, in good light.';
    case 'not_authentic':
      return 'That ID did not pass the check. Scan the original, not a photocopy or a screen.';
    case 'expired':
      return 'That ID has expired. Scan one that is still valid.';
    case 'unavailable':
      return 'We could not check your ID just now. Try again in a few minutes.';
  }
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
