import { PSF_FAMILY_LABEL } from '@injishi/contracts';
import { Injectable, NotFoundException } from '@nestjs/common';

import { StorageService } from '../../storage/application/storage.service';
import { renderPsfCertificate } from '../infrastructure/psf-certificate.renderer';
import { PsfMembershipMailer, psfCertificateFilename } from '../infrastructure/psf-membership.mailer';
import { PsfMembershipRepository } from '../infrastructure/psf-membership.repository';

/**
 * A member's certificate, from its current membership (2026-11-02). A business PSF confirmed from its
 * card has no application and so no docID; it still gets the same paper, and it goes with the mail
 * that tells it so.
 */
@Injectable()
export class PsfCertificatesService {
  constructor(
    private readonly repo: PsfMembershipRepository,
    private readonly mail: PsfMembershipMailer,
    private readonly storage: StorageService,
  ) {}

  async forOrg(orgId: string): Promise<{ filename: string; content: Buffer }> {
    const f = await this.repo.memberCertificateFacts(orgId);
    if (!f) throw new NotFoundException('This business is not a PSF member, so it has no certificate.');
    const content = await renderPsfCertificate({
      businessName: f.legalName,
      businessCode: f.businessCode,
      districtName: f.districtName,
      levelName: PSF_FAMILY_LABEL[f.tierFamily],
      membershipNumber: f.membershipNumber,
      startsOn: f.startsOn ?? '',
      expiresOn: f.expiresOn ?? '',
      docId: f.docId,
      issuedBy: f.districtName ? `PSF ${f.districtName} district office` : 'PSF',
      trackUrl: f.docId ? this.mail.trackLink(f.docId) : this.mail.trackLink('').replace(/\/$/, ''),
      businessLogo: await this.logo(f.logoObjectKey),
    });
    return { filename: psfCertificateFilename(f.membershipNumber), content };
  }

  /** The PDF alone, or null when it cannot be made: a mail goes without it rather than not at all. */
  async pdfOrNull(orgId: string): Promise<Buffer | null> {
    try {
      return (await this.forOrg(orgId)).content;
    } catch {
      return null;
    }
  }

  private async logo(key: string | null): Promise<{ bytes: Buffer; mime: 'image/png' | 'image/jpeg' } | null> {
    if (!key) return null;
    try {
      const mime = (await this.storage.describe(key))?.mime ?? 'image/png';
      if (mime !== 'image/png' && mime !== 'image/jpeg') return null;
      return { bytes: await this.storage.readBytes(key), mime };
    } catch {
      return null;
    }
  }
}
