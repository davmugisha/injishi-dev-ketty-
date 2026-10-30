import {
  SCAN_ATTEMPTS_BEFORE_CONTINUE,
  mayElevate,
  type IdentityOnFile,
  type IdentityScanOutcome,
  type IdentityScanReason,
  type IdentityScanRequest,
  type IdentityScanResult,
  type IdentityStatus,
  type NationalIdCheckRequest,
  type RegistrationConflictCode,
  type TypedIdentityRequest,
} from '@injishi/contracts';
import { randomUUID } from 'node:crypto';
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
  NATIONAL_ID_REGISTRY,
  type DocumentCheck,
  type DocumentVerifierPort,
  type IdentityAdapterMode,
  type NationalIdCheck,
  type NationalIdRegistryPort,
} from '../domain/identity-ports';
import { IdentityRepository, type IdentityRow } from '../infrastructure/identity.repository';
import { DuplicateIdentityDocumentError } from '../infrastructure/profile.repository';

const DUPLICATE_MESSAGE =
  'That identity document is already registered to another account. Recover that account rather than creating a second one.';

/** Why a registration is refused for want of an identity, worded for the step that fixes it. */
export const SCAN_FIRST_MESSAGE = 'Check your ID on the You step: your National ID number and a selfie, or your passport.';

/** Where an identity on file came from, by the method its KYC row carries. */
const REGISTRY_METHOD = 'national_id_registry';

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

  constructor(
    private readonly repo: IdentityRepository,
    @Inject(DOCUMENT_VERIFIER) private readonly documents: DocumentVerifierPort,
    private readonly storage: StorageService,
    /**
     * The population register (NIDA, through GTBank): a National ID checked by
     * its number and a selfie. Where it is `off`, a National ID is scanned
     * through the document verifier as before.
     */
    @Inject(NATIONAL_ID_REGISTRY) private readonly registry: NationalIdRegistryPort,
  ) {}

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
      nationalIdMode: this.registry.mode,
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
        check = await this.documents.verifyDocument({
          documentType: input.documentType,
          front,
          selfie,
          issuingCountry: input.documentType === 'passport' ? (input.issuingCountry ?? null) : 'RW',
        });
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
          source: 'document',
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
   * A Rwandan National ID checked by its NUMBER against the population
   * register (NIDA, through GTBank), with a selfie (2026-10-30). One try, kept
   * like a scan (D-n): the selfie is what the PSF officer compares wherever the
   * register returned the record but compared no face.
   *
   * - The register found the number and matched the selfie: verified, as a
   *   machine checked scan is ("Checked", AC-6).
   * - It found the number and compared no face: the register's details are
   *   held `pending`, and PSF compares the selfie before approving (D-o).
   * - It refused (not found, cancelled card, a face that is not the holder's,
   *   an unreadable selfie) or could not be reached: a failed try with its
   *   own fix; after 3 tries the person types their details and carries on (AC-5).
   */
  async checkNationalId(userId: string, input: NationalIdCheckRequest): Promise<IdentityScanResult> {
    const current = await this.repo.find(userId);
    if (current.kycStatus === 'verified') {
      throw new ConflictException('Your ID is already checked. There is nothing to check again.');
    }
    if (this.registry.mode === 'off') {
      throw new ConflictException('National IDs are checked by scanning the card here. Scan the front of your card.');
    }
    const selfie = await this.ownPhoto(userId, input.selfieKey, 'selfieKey');

    let check: NationalIdCheck;
    try {
      check = await this.registry.verify({ documentNumber: input.documentNumber, selfie, reference: randomUUID() });
    } catch (error) {
      this.log.warn(`National ID registry failed: ${(error as Error).message}`);
      check = { status: 'unavailable' };
    }
    if (
      check.status === 'verified' &&
      (await this.repo.heldByAnother(userId, {
        documentType: 'national_id',
        documentNumber: check.holder.documentNumber,
        issuingCountry: 'RW',
      }))
    ) {
      throw new ConflictException(DUPLICATE_MESSAGE);
    }

    const outcome: IdentityScanOutcome =
      check.status !== 'verified' ? 'machine_failed' : check.face === 'match' ? 'machine_passed' : 'manual_needed';
    const reason: IdentityScanReason | null =
      outcome !== 'machine_failed' ? null : check.status === 'rejected' ? check.reason : 'unavailable';
    const attempt = await this.repo.recordScan({
      userId,
      documentType: 'national_id',
      checkKind: 'national_id_registry',
      frontObjectKey: null,
      selfieObjectKey: input.selfieKey,
      outcome,
      reason,
      adapterMode: this.registry.mode,
    });

    if (check.status === 'verified') {
      const holder = check.holder;
      if (check.face === 'match') {
        await this.recordOrRefuse(userId, {
          fullName: holder.fullName,
          dateOfBirth: holder.dateOfBirth,
          gender: holder.gender,
          phoneE164: null,
          documentType: 'national_id',
          documentNumber: holder.documentNumber,
          issuingCountry: 'RW',
          method: REGISTRY_METHOD,
        });
      } else {
        try {
          await this.repo.recordTyped(userId, {
            fullName: holder.fullName,
            dateOfBirth: holder.dateOfBirth,
            documentType: 'national_id',
            documentNumber: holder.documentNumber,
            issuingCountry: 'RW',
            method: REGISTRY_METHOD,
          });
        } catch (error) {
          if (error instanceof DuplicateIdentityDocumentError) throw new ConflictException(DUPLICATE_MESSAGE);
          throw error;
        }
      }
      return {
        outcome,
        reason: null,
        message:
          check.face === 'match'
            ? null
            : 'NIDA found your National ID. Your selfie is saved, and PSF compares it with your ID photo before approving.',
        fields: {
          fullName: holder.fullName,
          dateOfBirth: holder.dateOfBirth,
          gender: holder.gender,
          documentType: 'national_id',
          documentNumberMasked: maskIdentifier(holder.documentNumber),
          issuingCountry: 'RW',
          generated: check.generated,
          checked: check.face === 'match',
          source: 'registry',
        },
        attempt,
        mayContinue: false,
      };
    }
    return {
      outcome,
      reason,
      message: failureMessage(reason!, 'national_id', 'registry'),
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
      generated:
        (row.method === 'document_scan' && invented(this.documents.mode)) ||
        (row.method === REGISTRY_METHOD && invented(this.registry.mode)),
      checked: row.kycStatus === 'verified',
      source: row.method === 'document_scan' ? 'document' : row.method === REGISTRY_METHOD ? 'registry' : 'typed',
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

/** Whether a seam's answers are about invented people: the mock's, and Injishi Mock APIs'. */
function invented(mode: IdentityAdapterMode): boolean {
  return mode === 'mock' || mode === 'sandbox';
}

/** What went wrong, and how to fix it (S4). */
function failureMessage(
  reason: IdentityScanReason,
  documentType: 'national_id' | 'passport',
  checkedBy: 'document' | 'registry' = 'document',
): string {
  const frame = documentType === 'passport' ? 'the whole photo page' : 'the whole card';
  switch (reason) {
    case 'unreadable':
      return checkedBy === 'registry'
        ? 'We could not read your selfie. Face the camera in good light, with nothing covering your face.'
        : `We could not read that photo. More light, no glare, and fit ${frame} in the frame.`;
    case 'face_mismatch':
      return checkedBy === 'registry'
        ? 'Your selfie does not match the photo NIDA holds for this National ID. Check the number is yours, then take a new selfie facing the camera, in good light.'
        : 'The selfie does not match the photo on your ID. Take a new selfie facing the camera, in good light.';
    case 'not_authentic':
      return 'That ID did not pass the check. Scan the original, not a photocopy or a screen.';
    case 'expired':
      return 'That ID has expired. Scan one that is still valid.';
    case 'not_found':
      return 'NIDA has no one registered under this National ID. Check the 16 digits against your card.';
    case 'revoked':
      return 'NIDA says this ID card was cancelled. Use your current card, or contact NIDA.';
    case 'unavailable':
      return checkedBy === 'registry'
        ? 'We could not reach NIDA just now. Try again in a few minutes.'
        : 'We could not check your ID just now. Try again in a few minutes.';
  }
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
