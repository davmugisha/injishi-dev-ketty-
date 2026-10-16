import type { OperatorCertificateList } from '@injishi/contracts';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { CertificatesRepository } from '../infrastructure/certificates.repository';

/**
 * Licences and registrations on file (Compliance → Licences).
 *
 * A READ of what the business keeps. Whether a document is current, expiring
 * or expired is the screen's to say from `expiresOn` against today: storing it
 * would be a status that goes stale at midnight. Verification is a field
 * verifier's act at registration (`verifiedAt`), never the business's own.
 */
@Injectable()
export class CertificatesService {
  constructor(private readonly repo: CertificatesRepository) {}

  async list(ws: ScopedWorkspace): Promise<OperatorCertificateList> {
    if (!ws.orgId) throw new BadRequestException('Only a business workspace keeps licences.');
    const org = await this.repo.org(ws.orgId);
    if (!org) throw new NotFoundException('Business not found.');
    const rows = await this.repo.list(ws.orgId, ws.branchScope);
    return {
      legalName: org.legalName,
      tin: org.tin,
      chamberOfTourismMember: org.chamberOfTourismMember,
      certificates: rows.map((r) => ({
        id: r.id,
        kind: r.kind,
        kindOther: r.kindOther,
        propertyId: r.propertyId,
        propertyName: r.propertyName,
        certificateNumber: r.certificateNumber,
        issuedBy: r.issuedBy,
        issuedOn: r.issuedOn,
        expiresOn: r.expiresOn,
        status: r.status,
        followUp: r.followUp,
        // The key's last segment is the name it was stored under; the bytes
        // stay private and are opened through a short lived link elsewhere.
        fileName: r.objectKey ? (r.objectKey.split('/').pop() ?? null) : null,
        verifiedAt: r.verifiedAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }
}
