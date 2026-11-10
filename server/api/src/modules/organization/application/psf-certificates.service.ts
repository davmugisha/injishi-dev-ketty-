import { psfFamilyName, normalizeBusinessCode, type PsfMemberCard } from '@injishi/contracts';
import { Injectable, NotFoundException } from '@nestjs/common';

import { StorageService } from '../../storage/application/storage.service';
import { renderPsfCard, renderPsfCertificate, type PsfCertificateFacts } from '../infrastructure/psf-certificate.renderer';
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
    const f = await this.factsOf(orgId);
    return { filename: psfCertificateFilename(f.membershipNumber), content: await renderPsfCertificate(f) };
  }

  /** The membership card as a PDF (2026-11-05), with the same facts as the certificate. */
  async cardForOrg(orgId: string): Promise<{ filename: string; content: Buffer }> {
    const f = await this.factsOf(orgId);
    return { filename: psfCertificateFilename(f.membershipNumber).replace('certificate', 'card'), content: await renderPsfCard(f) };
  }

  private async factsOf(orgId: string): Promise<PsfCertificateFacts> {
    const f = await this.repo.memberCertificateFacts(orgId);
    if (!f) throw new NotFoundException('This business is not a PSF member, so it has no certificate.');
    return {
      businessName: f.legalName,
      businessCode: f.businessCode,
      districtName: f.districtName,
      sectorName: f.sectorName,
      levelName: await this.levelName(f.tierFamily),
      levelCode: f.tierFamily,
      badge: f.cardBadge,
      ownerName: f.ownerName,
      membershipNumber: f.membershipNumber,
      startsOn: f.startsOn ?? '',
      expiresOn: f.expiresOn ?? '',
      docId: f.docId,
      issuedBy: f.districtName ? `PSF ${f.districtName} district office` : 'PSF',
      // The QR opens the member's card (2026-11-02), which anyone may check.
      trackUrl: this.mail.cardLink(f.membershipNumber),
      businessLogo: await this.image(f.logoObjectKey),
      ownerPhoto: await this.image(f.ownerPhotoKey),
    };
  }

  /** The owner's photo as stored (2026-11-05), or null. */
  async photo(key: string | null): Promise<{ bytes: Buffer; mime: string } | null> {
    if (!key) return null;
    try {
      const described = await this.storage.describe(key);
      return { bytes: await this.storage.readBytes(key), mime: described?.mime ?? 'image/jpeg' };
    } catch {
      return null;
    }
  }

  /** The owner's photo for a business, or for the membership number on its card. */
  async photoOfOrg(orgId: string): Promise<{ bytes: Buffer; mime: string } | null> {
    return this.photo(await this.repo.ownerPhotoKey(orgId));
  }

  async photoOfNumber(membershipNumber: string): Promise<{ bytes: Buffer; mime: string } | null> {
    const f = await this.repo.memberCardByNumber(membershipNumber.trim(), normalizeBusinessCode(membershipNumber));
    return f ? this.photo(f.ownerPhotoKey) : null;
  }

  /** The card a certificate's QR code opens: by number, the latest membership that carries it. */
  async card(membershipNumber: string): Promise<PsfMemberCard> {
    const f = await this.repo.memberCardByNumber(membershipNumber.trim(), normalizeBusinessCode(membershipNumber));
    if (!f) return { status: 'not_found', card: null };
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kigali' }).format(new Date());
    const valid = f.endedAt === null && (f.expiresOn === null || f.expiresOn >= today);
    return {
      status: valid ? 'valid' : 'lapsed',
      card: {
        businessName: f.legalName,
        businessCode: f.businessCode,
        districtName: f.districtName,
        levelName: await this.levelName(f.tierFamily),
        tierName: f.tierName,
        membershipNumber: f.membershipNumber,
        startsOn: f.startsOn,
        expiresOn: f.expiresOn,
        hasPhoto: f.ownerPhotoKey !== null,
      },
    };
  }

  /** The PDF alone, or null when it cannot be made: a mail goes without it rather than not at all. */
  async pdfOrNull(orgId: string): Promise<Buffer | null> {
    try {
      return (await this.forOrg(orgId)).content;
    } catch {
      return null;
    }
  }

  /** The card to attach beside the certificate: a mail still goes without it. */
  async pdfOfCardOrNull(orgId: string): Promise<Buffer | null> {
    try {
      return (await this.cardForOrg(orgId)).content;
    } catch {
      return null;
    }
  }

  private async levelName(code: string): Promise<string> {
    return (await this.repo.levels()).find((l) => l.code === code)?.nameEn ?? psfFamilyName(code);
  }

  private async image(key: string | null): Promise<{ bytes: Buffer; mime: 'image/png' | 'image/jpeg' } | null> {
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
