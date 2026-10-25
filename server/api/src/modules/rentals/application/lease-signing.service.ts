import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  LeaseContract,
  SIGNING_CODE_MAX_ATTEMPTS,
  SIGNING_CODE_RESEND_SECONDS,
  SIGNING_CODE_TTL_SECONDS,
  depositCharge,
  kigaliDateOf,
  leaseFilingDueOn,
  emailTypoMessage,
  suggestEmailFix,
  typedNameProblem,
  type LeaseDetail,
  type LeaseSignerRole,
  type LeaseSigningMethod,
  type SignLeaseRequest,
  type SigningCodeSent,
  type TenancyDetail,
} from '@injishi/contracts';

import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { maskEmail } from '../../../shared/identity/mask';
import { StorageService } from '../../storage/application/storage.service';
import { homeWords } from '../domain/rentals-mail';
import { assertBuildingInScope, assertResidence, leaseStateConflict } from '../domain/residence';
import { codeMatches, newSigningCode, sha256Hex } from '../domain/signing-secrets';
import { LeaseChargesRepository } from '../infrastructure/lease-charges.repository';
import { LeaseDocumentsQueue } from '../infrastructure/lease-documents.queue';
import { LeasesRepository, type LeaseRecord, type VersionRow } from '../infrastructure/leases.repository';
import { LeaseEventsWriter, RentalsAuditWriter } from '../infrastructure/rentals-writers';
import { RentalsMailer } from '../infrastructure/rentals.mailer';
import { SignerPasswordVerifier } from '../infrastructure/signer-password';
import { SigningRepository } from '../infrastructure/signing.repository';
import { LeaseContractService } from './lease-contract.service';
import { LeaseInvitationsService, type PendingMail } from './lease-invitations.service';
import { LeaseReadsService } from './lease-reads.service';
import { TenanciesService, type TenancyRef } from './tenancies.service';

/** The person signing: the session's account. */
export interface Signer {
  id: string;
  email: string;
}

/** Where a signature was given from, as the request shows it. */
export interface SigningContext {
  ip: string | null;
  userAgent: string | null;
}

/** How the signer proved it was them, and the code to use up. */
interface Proof {
  method: Extract<LeaseSigningMethod, 'email_code' | 'password'>;
  codeId: string | null;
}

/**
 * Signing a lease electronically (blueprint 2.3 and 2.4, WP 1.5b), under Law
 * No. 18/2010. One flow for both sides:
 *
 * 1. The signer asks for a code (`requestCode`): 6 digits, emailed to the
 *    signed in address, good for 10 minutes and 5 tries, one live code per
 *    signer per lease, another only after 60 seconds.
 * 2. The signer signs (`signAsLandlord`, `signAsTenant`) with their full name
 *    as the contract states it, an optional drawn signature they uploaded,
 *    the code (or their password, once tenants have one), and the SHA-256 of
 *    the contract they read. A contract that changed since is refused.
 * 3. The signature is recorded with its evidence (IP, browser, method, when
 *    the code was checked) and the drawing is put under legal hold.
 *
 * The landlord's signature moves a draft out for signature and sends the
 * invitation (the email goes after the answer, so a slow relay never holds
 * the landlord's screen). The tenant's makes the lease signed, raises the
 * deposit (due on the start date), and queues the signed copy.
 */
@Injectable()
export class LeaseSigningService {
  private readonly log = new Logger(LeaseSigningService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly leases: LeasesRepository,
    private readonly signing: SigningRepository,
    private readonly charges: LeaseChargesRepository,
    private readonly contracts: LeaseContractService,
    private readonly events: LeaseEventsWriter,
    private readonly audit: RentalsAuditWriter,
    private readonly reads: LeaseReadsService,
    private readonly tenancies: TenanciesService,
    private readonly invitations: LeaseInvitationsService,
    private readonly storage: StorageService,
    private readonly passwords: SignerPasswordVerifier,
    private readonly mailer: RentalsMailer,
    private readonly documents: LeaseDocumentsQueue,
  ) {}

  /** The clock, as a method so a test can pin it. */
  protected now(): Date {
    return new Date();
  }

  // --- Codes ------------------------------------------------------------------------

  /** Email the landlord's signer a code for a draft that is ready to sign. */
  async landlordCode(ws: ScopedWorkspace, user: Signer, leaseId: string): Promise<SigningCodeSent> {
    const record = await this.owned(ws, leaseId);
    if (record.lease.status !== 'draft') {
      throw leaseStateConflict(record.lease.status, 'Only a draft waits for your signature.');
    }
    const built = await this.contracts.build(record);
    if (built.problems.length > 0) throw notReady(built.problems);
    if (!record.lease.currentVersionId) throw notReady(['The contract is still being written. Try again in a moment.']);
    return this.sendCode(record, 'landlord', user, record.lease.currentVersionId);
  }

  /** Email the tenant a code for the lease waiting for their signature. */
  async tenantCode(ref: TenancyRef, user: Signer): Promise<SigningCodeSent> {
    const record = await this.tenancies.record(ref);
    const version = await this.tenantVersion(record);
    return this.sendCode(record, 'tenant', user, version.id);
  }

  private async sendCode(record: LeaseRecord, role: LeaseSignerRole, user: Signer, versionId: string): Promise<SigningCodeSent> {
    const email = user.email?.trim().toLowerCase();
    if (!email) throw new BadRequestException('Your account has no email address to send a code to.');
    const now = this.now();
    const live = await this.signing.liveCode(record.lease.id, role, user.id);
    if (live && live.expiresAt > now) {
      const age = (now.getTime() - live.createdAt.getTime()) / 1000;
      if (age < SIGNING_CODE_RESEND_SECONDS) {
        return {
          sentTo: maskEmail(live.email),
          sent: false,
          expiresInSeconds: Math.max(0, Math.round((live.expiresAt.getTime() - now.getTime()) / 1000)),
          resendInSeconds: Math.ceil(SIGNING_CODE_RESEND_SECONDS - age),
        };
      }
    }
    const code = newSigningCode();
    const codeId = await this.db.transaction((tx) =>
      this.signing.replaceCode(tx, {
        leaseId: record.lease.id,
        versionId,
        signerRole: role,
        userId: user.id,
        email,
        codeHash: sha256Hex(code),
        expiresAt: new Date(now.getTime() + SIGNING_CODE_TTL_SECONDS * 1000),
      }),
    );
    const sent = await this.mailer.signingCode(
      email,
      code,
      homeWords({ unitLabel: record.unitLabel, propertyName: record.propertyName }),
      SIGNING_CODE_TTL_SECONDS / 60,
    );
    if (!sent) {
      // A code nobody received must not block the next ask for a minute.
      await this.signing.deleteCode(codeId);
      throw new ServiceUnavailableException("We couldn't send your code just now. Try again in a minute.");
    }
    return {
      sentTo: maskEmail(email),
      sent: true,
      expiresInSeconds: SIGNING_CODE_TTL_SECONDS,
      resendInSeconds: SIGNING_CODE_RESEND_SECONDS,
    };
  }

  // --- The landlord signs -------------------------------------------------------------

  /**
   * The landlord signs a draft: the contract is frozen as it stands, the
   * signature recorded, the lease goes out for signature, and the tenant is
   * invited, in one transaction. Signing again a lease already out is
   * answered with the lease.
   */
  async signAsLandlord(ws: ScopedWorkspace, user: Signer, leaseId: string, body: SignLeaseRequest, ctx: SigningContext): Promise<LeaseDetail> {
    const record = await this.owned(ws, leaseId);
    const { lease, tenant } = record;
    if (lease.status === 'pending_signature' && lease.currentVersionId) {
      const standing = await this.signing.liveSignatures(lease.currentVersionId);
      if (standing.some((s) => s.signerRole === 'landlord')) return this.reads.detail(ws, leaseId);
    }
    if (lease.status !== 'draft') throw leaseStateConflict(lease.status, 'Only a draft waits for your signature.');

    // The invitation goes to this address: one more look for a slip.
    const fix = tenant.email && !body.confirmEmail ? suggestEmailFix(tenant.email) : null;
    if (fix) throw fieldError(['tenant', 'email'], emailTypoMessage(fix));

    const built = await this.contracts.build(record);
    if (built.problems.length > 0) throw notReady(built.problems);
    if (built.hash !== body.documentHash) {
      // The text moved on (the signatory, the unit, the tenant changed): show the new one before anyone signs.
      await this.contracts.refreshDrafts([leaseId], user.id);
      throw contractChanged();
    }
    const nameProblem = typedNameProblem(body.typedName, built.contract, 'landlord');
    if (nameProblem) throw fieldError(['typedName'], nameProblem);
    const drawing = await this.drawingOf(body.signatureObjectKey, user.id);
    const proof = await this.confirm(lease.id, 'landlord', user, body);

    const now = this.now();
    let mail: PendingMail | null = null;
    await this.db
      .transaction(async (tx) => {
        const row = await this.leases.lock(tx, lease.id);
        if (!row || row.status !== 'draft') throw changedWhileSigning();
        const fresh = await this.leases.find(lease.id, tx);
        if (!fresh) throw changedWhileSigning();
        const frozen = await this.contracts.freeze(tx, fresh, user.id);
        if (frozen.hash !== body.documentHash) throw contractChanged();
        if (proof.codeId && !(await this.signing.consumeCode(tx, proof.codeId))) throw codeUsed();
        const signatureId = await this.signing.insertSignature(tx, {
          leaseId: lease.id,
          versionId: frozen.versionId,
          signerRole: 'landlord',
          signerUserId: user.id,
          signerEmail: user.email.trim().toLowerCase(),
          typedName: tidyName(body.typedName),
          signatureObjectId: drawing?.id ?? null,
          documentHash: frozen.hash,
          method: proof.method,
          verifiedAt: now,
          ipAddress: ctx.ip,
          userAgent: ctx.userAgent?.slice(0, 500) ?? null,
          signedAt: now,
        });
        await this.leases.update(tx, lease.id, { status: 'pending_signature', currentVersionId: frozen.versionId });
        await this.events.write(tx, {
          leaseId: lease.id,
          workspaceId: lease.workspaceId,
          kind: 'landlord_signed',
          actorUserId: user.id,
          actorRole: 'landlord',
          visibleToTenant: true,
          payload: { signatureId, version: frozen.version, method: proof.method },
        });
        await this.audit.write(tx, {
          actorUserId: user.id,
          subjectType: 'lease',
          subjectId: lease.id,
          eventType: 'lease.signed',
          diff: { role: 'landlord', signatureId, version: frozen.version, documentHash: frozen.hash, method: proof.method, from: 'draft', to: 'pending_signature' },
        });
        const current = (await this.leases.find(lease.id, tx)) as LeaseRecord;
        mail = await this.invitations.issue(tx, current, user.id);
      })
      .catch((cause: unknown) => {
        throw mapSigningConstraint(cause);
      });

    if (drawing) await this.hold(drawing.id, lease.workspaceId);
    const send = mail as PendingMail | null;
    if (send) void send();
    return this.reads.detail(ws, leaseId);
  }

  // --- The tenant signs ---------------------------------------------------------------

  /**
   * The tenant signs the version the landlord signed: the lease is signed,
   * the deposit charge is raised (due on the start date), and the signed copy
   * is queued. Signing twice is answered with the tenancy.
   */
  async signAsTenant(ref: TenancyRef, user: Signer, body: SignLeaseRequest, ctx: SigningContext): Promise<TenancyDetail> {
    const record = await this.tenancies.record(ref);
    const { lease } = record;
    if (lease.status !== 'pending_signature' && lease.currentVersionId) {
      const standing = await this.signing.liveSignatures(lease.currentVersionId);
      if (standing.some((s) => s.signerRole === 'tenant' && s.signerUserId === user.id)) return this.tenancies.detail(ref);
    }
    const version = await this.tenantVersion(record);
    if (version.contentHash !== body.documentHash) throw contractChanged();
    const parsed = LeaseContract.safeParse(version.content);
    if (!parsed.success) throw new ConflictException('This contract cannot be signed on Injishi. Ask your landlord to send it again.');
    const nameProblem = typedNameProblem(body.typedName, parsed.data, 'tenant');
    if (nameProblem) throw fieldError(['typedName'], nameProblem);
    const drawing = await this.drawingOf(body.signatureObjectKey, user.id);
    const proof = await this.confirm(lease.id, 'tenant', user, body);

    const now = this.now();
    await this.db
      .transaction(async (tx) => {
        const row = await this.leases.lock(tx, lease.id);
        if (!row || row.status !== 'pending_signature' || row.currentVersionId !== version.id) throw changedWhileSigning();
        if (proof.codeId && !(await this.signing.consumeCode(tx, proof.codeId))) throw codeUsed();
        const signatureId = await this.signing.insertSignature(tx, {
          leaseId: lease.id,
          versionId: version.id,
          signerRole: 'tenant',
          signerUserId: user.id,
          signerEmail: user.email.trim().toLowerCase(),
          typedName: tidyName(body.typedName),
          signatureObjectId: drawing?.id ?? null,
          documentHash: version.contentHash,
          method: proof.method,
          verifiedAt: now,
          ipAddress: ctx.ip,
          userAgent: ctx.userAgent?.slice(0, 500) ?? null,
          signedAt: now,
        });
        await this.leases.update(tx, lease.id, { status: 'signed', signedAt: now });
        await this.events.write(tx, {
          leaseId: lease.id,
          workspaceId: lease.workspaceId,
          kind: 'tenant_signed',
          actorUserId: user.id,
          actorRole: 'tenant',
          visibleToTenant: true,
          payload: { signatureId, version: version.version, method: proof.method },
        });
        await this.audit.write(tx, {
          actorUserId: user.id,
          subjectType: 'lease',
          subjectId: lease.id,
          eventType: 'lease.signed',
          diff: { role: 'tenant', signatureId, version: version.version, documentHash: version.contentHash, method: proof.method, from: 'pending_signature', to: 'signed' },
        });
        // The deposit: raised when the tenant signs, due on the start date (blueprint 1.4).
        const due = depositCharge({ startDate: row.startDate, depositRwf: row.depositRwf });
        if (due) {
          const raised = await this.charges.raiseDeposit(tx, {
            leaseId: lease.id,
            workspaceId: lease.workspaceId,
            dueOn: due.dueOn,
            amountRwf: due.amountRwf,
          });
          if (raised) {
            await this.events.write(tx, {
              leaseId: lease.id,
              workspaceId: lease.workspaceId,
              kind: 'charge_raised',
              actorUserId: null,
              actorRole: 'system',
              visibleToTenant: true,
              payload: { chargeId: raised.id, kind: 'deposit', amountRwf: raised.amountRwf, dueOn: raised.dueOn },
            });
          }
        }
        // Signed by both: the landlord owes RRA a copy within 15 days of the Kigali day (Art. 41; WP 4.4).
        const filingDueOn = leaseFilingDueOn('new_lease', kigaliDateOf(now));
        const filingId = await this.signing.openNewLeaseFiling(tx, { leaseId: lease.id, dueOn: filingDueOn });
        if (filingId) {
          await this.events.write(tx, {
            leaseId: lease.id,
            workspaceId: lease.workspaceId,
            kind: 'filing_due',
            actorUserId: null,
            actorRole: 'system',
            visibleToTenant: false,
            payload: { filingId, kind: 'new_lease', dueOn: filingDueOn },
          });
        }
      })
      .catch((cause: unknown) => {
        throw mapSigningConstraint(cause);
      });

    if (drawing) await this.hold(drawing.id, lease.workspaceId);
    await this.documents.signedCopy({ leaseId: lease.id, versionId: version.id });
    return this.tenancies.detail(ref);
  }

  // --- Helpers ----------------------------------------------------------------------------

  private async owned(ws: ScopedWorkspace, leaseId: string): Promise<LeaseRecord> {
    const r = assertResidence(ws);
    const record = await this.leases.find(leaseId);
    if (!record || record.lease.workspaceId !== r.workspaceId) throw new NotFoundException('Lease not found.');
    assertBuildingInScope(ws, record.lease.propertyId, 'Lease');
    return record;
  }

  /** The version the tenant signs: out for signature, signed by the landlord, not by them yet. */
  private async tenantVersion(record: LeaseRecord): Promise<VersionRow> {
    const { lease } = record;
    if (lease.status !== 'pending_signature') {
      throw leaseStateConflict(
        lease.status,
        lease.status === 'signed' || lease.status === 'active' || lease.status === 'ending' ? 'It is signed already.' : 'It cannot be signed now.',
      );
    }
    const version = lease.currentVersionId ? await this.leases.version(lease.currentVersionId) : null;
    if (!version) throw new ConflictException('This lease has no contract to sign yet.');
    const standing = await this.signing.liveSignatures(version.id);
    if (!standing.some((s) => s.signerRole === 'landlord')) {
      throw new ConflictException('Your landlord has not signed this version yet. You can sign once they have.');
    }
    if (standing.some((s) => s.signerRole === 'tenant')) throw new ConflictException('You have signed this lease already.');
    return version;
  }

  /**
   * The password, or the code, is right. A wrong code is counted on its own,
   * outside the signing transaction, so the count stands though the signing
   * is refused.
   */
  private async confirm(leaseId: string, role: LeaseSignerRole, user: Signer, body: SignLeaseRequest): Promise<Proof> {
    if (body.password) {
      const hash = await this.signing.passwordHash(user.id);
      if (!hash) throw fieldError(['password'], 'Your account has no password. Use the code we email you.');
      if (!(await this.passwords.verify(hash, body.password))) {
        throw fieldError(['password'], "That password isn't right. Try again, or use a code from your email.");
      }
      return { method: 'password', codeId: null };
    }
    const row = await this.signing.liveCode(leaseId, role, user.id);
    if (!row) throw fieldError(['code'], 'Ask for a code first. We email it to you.');
    if (row.expiresAt <= this.now()) throw fieldError(['code'], 'That code has expired. Send a new one.');
    if (row.attempts >= SIGNING_CODE_MAX_ATTEMPTS) throw fieldError(['code'], 'Too many wrong tries. Send a new code.');
    if (!codeMatches(body.code ?? '', row.codeHash)) {
      const tries = await this.signing.countWrongTry(row.id);
      const left = SIGNING_CODE_MAX_ATTEMPTS - tries;
      throw fieldError(
        ['code'],
        left > 0 ? `That code isn't right. ${left} ${left === 1 ? 'try' : 'tries'} left.` : 'Too many wrong tries. Send a new code.',
      );
    }
    return { method: 'email_code', codeId: row.id };
  }

  /** A drawing is optional; one that is named must be a signature this signer uploaded. */
  private async drawingOf(objectKey: string | undefined, userId: string): Promise<{ id: string } | null> {
    if (!objectKey) return null;
    const object = await this.storage.describe(objectKey);
    if (!object || object.kind !== 'lease_signature' || object.uploadedByUserId !== userId) {
      throw fieldError(['signatureObjectKey'], 'Draw your signature again, then sign.');
    }
    return { id: object.id };
  }

  /** The drawing is evidence now: under legal hold. A failure here never undoes the signature. */
  private async hold(objectId: string, workspaceId: string): Promise<void> {
    try {
      await this.storage.holdObject(objectId, workspaceId);
    } catch (cause) {
      this.log.error(`legal hold on signature drawing ${objectId} failed: ${String(cause)}`);
    }
  }
}

// --- Words and errors -----------------------------------------------------------------

/** Spacing tidied, as the signature is kept. */
function tidyName(typed: string): string {
  return typed.trim().replace(/\s+/g, ' ');
}

/** A 400 shaped like the validation pipe's, so a form puts it under the right field. */
function fieldError(path: (string | number)[], message: string): BadRequestException {
  return new BadRequestException({ message: 'Validation failed', issues: [{ code: 'custom', path, message }] });
}

function contractChanged(): ConflictException {
  return new ConflictException({
    code: 'contract_changed',
    message: 'The contract changed since you opened it. Read it again, then sign.',
  });
}

function notReady(problems: string[]): ConflictException {
  return new ConflictException({
    code: 'contract_not_ready',
    problems,
    message: `The contract is not ready to sign. ${problems.join(' ')}`,
  });
}

function changedWhileSigning(): ConflictException {
  return new ConflictException('This lease changed while you were signing. Refresh and try again.');
}

function codeUsed(): ConflictException {
  return new ConflictException('That code was just used. Ask for a new one.');
}

interface PgError {
  code?: string;
  constraint?: string;
  cause?: PgError;
}

/** Two signatures racing for one version: the second is told the lease changed. */
function mapSigningConstraint(cause: unknown): unknown {
  let e = cause as PgError | undefined;
  while (e && typeof e === 'object') {
    if (e.code === '23505' && e.constraint === 'lease_signatures_live_uk') return changedWhileSigning();
    if (e.code) break;
    e = e.cause;
  }
  return cause;
}
