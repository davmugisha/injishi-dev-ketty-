import { Inject, Injectable, Logger } from '@nestjs/common';

import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { signedCopyLandlordMail, signedCopyTenantMail, type SignedCopyMailInput } from '../domain/rentals-mail';
import { LeaseDocumentsRepository, type SignedCopyRecipient } from '../infrastructure/lease-documents.repository';
import { LeasesRepository } from '../infrastructure/leases.repository';
import { RentalsContextRepository } from '../infrastructure/rentals-context.repository';
import { RentalsMailer } from '../infrastructure/rentals.mailer';
import { SigningRepository } from '../infrastructure/signing.repository';
import { LeaseContractService } from './lease-contract.service';

/** What one run did with a version's signed copy. */
export type SignedCopyOutcome = 'sent' | 'already_sent' | 'not_signed' | 'missing';

/** How many lost versions one sweep picks up. */
const SWEEP_BATCH = 25;

/**
 * The signed copy of a lease (blueprint 2.6, LeaseDocuments): after the second
 * signature, the PDF with its audit trail page is made once, kept under legal
 * hold on the version (`signed_pdf_object_id`), and emailed to both sides with
 * the PDF attached.
 *
 * Idempotent per version. The copy's key is derived from the version, so a
 * second print lands on the same file; the version's `signed_copy_ready`
 * timeline row is written once, under a lock on the version, and lists who
 * was sent the copy, so a repeated run sends nothing twice. An email that did
 * not go fails the run, and the queue tries again for the ones still missing.
 */
@Injectable()
export class LeaseDocumentsService {
  private readonly log = new Logger(LeaseDocumentsService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly leases: LeasesRepository,
    private readonly signing: SigningRepository,
    private readonly documents: LeaseDocumentsRepository,
    private readonly context: RentalsContextRepository,
    private readonly contracts: LeaseContractService,
    private readonly mailer: RentalsMailer,
  ) {}

  async deliverSignedCopy(versionId: string): Promise<SignedCopyOutcome> {
    const version = await this.leases.version(versionId);
    const record = version ? await this.leases.find(version.leaseId) : null;
    if (!version || !record) return 'missing';
    const copy = await this.contracts.signedCopy(record, version);
    if (!copy) return 'not_signed';

    const { lease, tenant } = record;
    const claim = await this.db.transaction((tx) =>
      this.documents.claim(tx, {
        leaseId: lease.id,
        workspaceId: lease.workspaceId,
        versionId: version.id,
        version: version.version,
        storedObjectId: copy.objectId,
      }),
    );

    const [signatures, profile, org] = await Promise.all([
      this.signing.liveSignatures(version.id),
      this.context.ensureProfile({ orgId: lease.orgId, workspaceId: lease.workspaceId }),
      this.context.org(lease.orgId),
    ]);
    const landlordSigner = signatures.find((s) => s.signerRole === 'landlord')?.signerEmail ?? null;
    const tenantSigner = signatures.find((s) => s.signerRole === 'tenant')?.signerEmail ?? tenant.email;
    const contact = profile.contactEmail && profile.contactEmail !== landlordSigner ? profile.contactEmail : null;

    const input: SignedCopyMailInput = {
      appUrl: this.mailer.appUrl,
      leaseId: lease.id,
      reference: lease.reference,
      tenantName: tenant.fullName,
      landlordName: org.legalName,
      home: { unitLabel: record.unitLabel, propertyName: record.propertyName },
      startDate: lease.startDate,
      depositRwf: lease.depositRwf,
      autoStart: profile.autoStartLeases,
    };
    const attachment = [{ filename: copy.filename, content: copy.body, contentType: 'application/pdf' }];
    const sends: { to: SignedCopyRecipient; email: string | null; mail: () => ReturnType<typeof signedCopyTenantMail> }[] = [
      { to: 'tenant', email: tenantSigner, mail: () => signedCopyTenantMail(input) },
      { to: 'landlord', email: landlordSigner, mail: () => signedCopyLandlordMail(input) },
      { to: 'landlord_contact', email: contact, mail: () => signedCopyLandlordMail(input) },
    ];

    let failed = 0;
    let sent = 0;
    for (const s of sends) {
      if (!s.email || claim.mailed.includes(s.to)) continue;
      const ok = await this.mailer.send(`lease ${lease.id} signed copy`, s.email, s.mail(), attachment);
      if (ok) {
        await this.documents.markMailed(claim.eventId, s.to);
        sent += 1;
      } else {
        failed += 1;
      }
    }
    if (failed > 0) {
      // The queue tries again; the copies that went are not sent twice.
      throw new Error(`${failed} signed copy email(s) for lease ${lease.reference} were not sent`);
    }
    return sent > 0 ? 'sent' : 'already_sent';
  }

  /** Make and send the copies a lost job left behind. Answers how many versions it handled. */
  async sweep(): Promise<number> {
    const versionIds = await this.documents.unsentSignedVersions(SWEEP_BATCH);
    let handled = 0;
    for (const id of versionIds) {
      try {
        await this.deliverSignedCopy(id);
        handled += 1;
      } catch (cause) {
        this.log.error(`signed copy of lease version ${id} failed in the sweep: ${String(cause)}`);
      }
    }
    return handled;
  }
}
