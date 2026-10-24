import { ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  LEASE_CONTRACT_TEMPLATE_VERSION,
  LeaseContract,
  buildLeaseContract,
  contractHash,
  type LeasePremises,
} from '@injishi/contracts';

import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { StorageService } from '../../storage/application/storage.service';
import { renderLeasePdf, type PdfSignature } from '../domain/lease-pdf';
import { assertBuildingInScope, assertResidence } from '../domain/residence';
import { LeasesRepository, type LeaseRecord, type VersionRow } from '../infrastructure/leases.repository';
import { RentalsContextRepository } from '../infrastructure/rentals-context.repository';
import type { DbOrTx } from '../infrastructure/rentals-writers';

/** The contract a lease's facts give today, its fingerprint, and what still has to be filled in. */
export interface BuiltContract {
  contract: LeaseContract;
  hash: string;
  /** In words; empty when the contract is ready to sign. */
  problems: string[];
}

export interface FrozenVersion {
  versionId: string;
  version: number;
  hash: string;
  /** A new version was written (the text changed). */
  created: boolean;
}

/**
 * The lease contract: built, frozen as versions, and printed (blueprint 1.2,
 * WP 1.5a).
 *
 * The text is contracts' `buildLeaseContract` (template 3) and its fingerprint
 * `contractHash`, so the API that freezes a version, this PDF and the screen
 * that shows it before signing all hold the same words and the same SHA-256.
 * The landlord is the business (its legal name and TIN) and the person who
 * signs for it (`landlord_profiles`); the home is the unit, its block and its
 * building down to the village; the tenant is the tenant record.
 *
 * A version is written whenever the text a lease's facts give differs from
 * its current version's: when it is drafted, when its terms or tenant are
 * edited, and when a draft's landlord, building, unit or tenant details change
 * (`refreshDrafts`). A version that has a signature is never rewritten; an
 * edit after the landlord signed voids that signature and writes the next one.
 */
@Injectable()
export class LeaseContractService {
  private readonly log = new Logger(LeaseContractService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly leases: LeasesRepository,
    private readonly context: RentalsContextRepository,
    private readonly storage: StorageService,
  ) {}

  /** The contract `record`'s facts give as of `now`. */
  async build(record: LeaseRecord, now: Date = new Date()): Promise<BuiltContract> {
    const { lease, tenant } = record;
    const workspace = { orgId: lease.orgId, workspaceId: lease.workspaceId };
    const [profile, org, owner, place] = await Promise.all([
      this.context.ensureProfile(workspace),
      this.context.org(lease.orgId),
      this.context.ownerContact(lease.orgId),
      this.context.buildingPlace(lease.propertyId),
    ]);
    const problems: string[] = [];

    const signatoryReady =
      profile.signatoryName && profile.signatoryIdNumber && profile.contactPhone && profile.contactEmail;
    if (!signatoryReady) {
      problems.push('Say who signs leases for the business, with their ID number, phone and email.');
    }
    const landlord = {
      legalName: org.legalName,
      signatoryName: profile.signatoryName ?? owner?.name ?? org.legalName,
      idNumber: profile.signatoryIdNumber ?? org.tin ?? '',
      phone: profile.contactPhone ?? '',
      email: profile.contactEmail ?? owner?.email ?? '',
    };

    const missing: string[] = [];
    if (!tenant.email) missing.push('email');
    if (!tenant.phone) missing.push('phone number');
    if (!tenant.idKind || !tenant.idNumber) missing.push('ID or passport number');
    if (!tenant.nationality) missing.push('nationality');
    if (missing.length > 0) problems.push(`Add the tenant's ${listWords(missing)}.`);
    const tenantParty = {
      fullName: tenant.fullName,
      idKind: tenant.idKind ?? 'national_id',
      idNumber: tenant.idNumber ?? '',
      nationality: tenant.nationality ?? '',
      phone: tenant.phone ?? '',
      email: tenant.email ?? '',
    } as const;

    if (!place?.village) problems.push("Add the village the building is in, so the contract names where the home is.");
    const premises: LeasePremises = {
      property: place?.name ?? record.propertyName,
      unit: record.unitLabel,
      block: record.blockCode,
      street: place?.addressText ?? null,
      village: place?.village ?? null,
      cell: place?.cell ?? null,
      sector: place?.sector ?? null,
      district: place?.district ?? null,
      province: place?.province ?? null,
    };

    const contract = buildLeaseContract(
      {
        landlord,
        tenant: tenantParty,
        premises,
        terms: {
          startDate: lease.startDate,
          endDate: lease.endDate,
          billingStartsOn: lease.billingStartsOn > lease.startDate ? lease.billingStartsOn : null,
          monthlyRentRwf: lease.monthlyRentRwf,
          depositRwf: lease.depositRwf,
          rentDueDay: lease.rentDueDay,
          graceDays: lease.graceDays,
          noticeDays: lease.noticeDays,
          occupants: [...lease.occupants],
          otherTerms: lease.otherTerms,
        },
      },
      now,
    );
    return { contract, hash: contractHash(contract), problems };
  }

  /**
   * Write the next version when the text `record` gives differs from its
   * current version's, and point the lease at it. Inside the caller's
   * transaction, with the lease row locked by the caller.
   */
  async freeze(tx: DbOrTx, record: LeaseRecord, userId: string | null): Promise<FrozenVersion> {
    const built = await this.build(record);
    const versions = await this.leases.versions(record.lease.id, tx);
    const current = versions.find((v) => v.id === record.lease.currentVersionId) ?? null;
    if (current && current.contentHash === built.hash) {
      return { versionId: current.id, version: current.version, hash: current.contentHash, created: false };
    }
    const version = (versions[0]?.version ?? 0) + 1;
    const versionId = await this.leases.insertVersion(tx, {
      leaseId: record.lease.id,
      version,
      templateVersion: LEASE_CONTRACT_TEMPLATE_VERSION,
      content: built.contract,
      contentHash: built.hash,
      createdByUserId: userId,
    });
    await this.leases.update(tx, record.lease.id, { currentVersionId: versionId });
    return { versionId, version, hash: built.hash, created: true };
  }

  /**
   * Rebuild the contracts of draft leases after something they name changed
   * (the signatory, a unit, a block, a tenant record). Each lease in its own
   * transaction; a lease that stopped being a draft meanwhile is left alone.
   * Returns how many got a new version.
   */
  async refreshDrafts(leaseIds: readonly string[], userId: string | null): Promise<number> {
    let written = 0;
    for (const id of new Set(leaseIds)) {
      try {
        const created = await this.db.transaction(async (tx) => {
          const locked = await this.leases.lock(tx, id);
          if (!locked || locked.status !== 'draft') return false;
          const record = await this.leases.find(id, tx);
          if (!record) return false;
          return (await this.freeze(tx, record, userId)).created;
        });
        if (created) written += 1;
      } catch (cause) {
        // A draft whose contract could not be rebuilt keeps its last version;
        // the next edit or the signing step rebuilds it again.
        this.log.error(`refreshing the contract of draft lease ${id} failed: ${String(cause)}`);
      }
    }
    return written;
  }

  /**
   * The lease as a PDF: the current version, or `versionNumber`.
   *
   * A version nobody has signed is printed once and kept (`pdf_object_id`,
   * kind lease_contract); one both sides signed is kept as the signed copy
   * under legal hold (`signed_pdf_object_id`); one signed by the landlord only
   * is printed fresh each time, since the copy changes when the tenant signs.
   */
  async pdf(ws: ScopedWorkspace, leaseId: string, versionNumber?: number): Promise<{ body: Buffer; filename: string }> {
    const r = assertResidence(ws);
    const record = await this.leases.find(leaseId);
    if (!record || record.lease.workspaceId !== r.workspaceId) throw new NotFoundException('Lease not found.');
    assertBuildingInScope(ws, record.lease.propertyId, 'Lease');
    const versions = await this.leases.versions(leaseId);
    const version =
      versionNumber !== undefined
        ? versions.find((v) => v.version === versionNumber)
        : (versions.find((v) => v.id === record.lease.currentVersionId) ?? versions[0]);
    if (!version) throw new NotFoundException(versionNumber !== undefined ? 'That version of the contract was not found.' : 'This lease has no contract yet.');
    const parsed = LeaseContract.safeParse(version.content);
    if (version.templateVersion !== LEASE_CONTRACT_TEMPLATE_VERSION || !parsed.success) {
      throw new ConflictException(
        'This version was carried over from before contracts were kept as text, so there is no PDF of it.',
      );
    }
    const signatures = (await this.leases.signatures(leaseId)).filter((s) => s.versionId === version.id && !s.voidedAt);
    const signed = signatures.some((s) => s.signerRole === 'landlord') && signatures.some((s) => s.signerRole === 'tenant');
    const filename = `${record.lease.reference}-v${version.version}${signed ? '-signed' : ''}.pdf`;

    const kept = signed ? version.signedPdfObjectId : signatures.length === 0 ? version.pdfObjectId : null;
    if (kept) {
      const key = await this.leases.storedObjectKey(kept);
      if (key) {
        try {
          return { body: await this.storage.readBytes(key), filename };
        } catch (cause) {
          this.log.warn(`stored lease PDF ${key} could not be read, printing it again: ${String(cause)}`);
        }
      }
    }

    const body = await renderLeasePdf({
      reference: record.lease.reference,
      leaseId,
      version: version.version,
      contract: parsed.data,
      documentHash: version.contentHash,
      signatures: await Promise.all(
        signatures.map(async (s): Promise<PdfSignature> => ({
          role: s.signerRole,
          typedName: s.typedName,
          email: s.signerEmail,
          ip: s.ipAddress,
          userAgent: s.userAgent,
          signedAt: s.signedAt,
          verifiedAt: s.verifiedAt,
          method: s.method,
          drawing: await this.drawing(s.signatureObjectId),
        })),
      ),
      signed,
      generatedAt: new Date(),
    });

    if (signed || signatures.length === 0) {
      await this.keep(version, body, filename, record, signed);
    }
    return { body, filename };
  }

  private async keep(version: VersionRow, body: Buffer, filename: string, record: LeaseRecord, signed: boolean): Promise<void> {
    try {
      const stored = await this.storage.putLeaseContract({
        body,
        filename,
        keyHint: `lease-${version.id}${signed ? '-signed' : ''}`,
        workspaceId: record.lease.workspaceId,
        createdByUserId: null,
        legalHold: signed,
      });
      await this.leases.setVersionPdf(version.id, signed ? 'signedPdfObjectId' : 'pdfObjectId', stored.id);
    } catch (cause) {
      // The reader still gets the PDF; keeping a copy is retried next time.
      this.log.error(`keeping the PDF of lease version ${version.id} failed: ${String(cause)}`);
    }
  }

  private async drawing(objectId: string | null): Promise<Buffer | null> {
    if (!objectId) return null;
    const key = await this.leases.storedObjectKey(objectId);
    if (!key) return null;
    try {
      return await this.storage.readBytes(key);
    } catch {
      return null;
    }
  }
}

/** "A", "A and B", "A, B and C". */
function listWords(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}
