import { PSF_DECLINE_REASON_LABEL, isPsfApplicant, type PsfDeclineReason } from '@injishi/contracts';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { resolveAppUrl } from '../../../shared/config/app-url';
import { resolveWebUrl } from '../../../shared/config/web-url';
import { MAILER_PORT, type MailerPort } from '../../mailer/domain/mailer-port';
import {
  psfApplicationReceivedMail,
  psfApprovedMail,
  psfCertificateMail,
  psfDeclinedMail,
  psfClaimConfirmedMail,
  psfClaimRejectedMail,
  psfExpiredMail,
  psfRenewedMail,
  psfPaymentReminderMail,
  psfExpiringMail,
  psfMemberMail,
  psfMembershipLink,
  psfOfficerQueueMail,
  psfApplicationLink,
  psfTrackLink,
} from '../domain/psf-mail';
import { SMS_PORT, type SmsPort } from '../../sms/domain/sms-port';
import type { Addressee, RegistrationMail } from '../domain/registration-mail';
import { PsfMembershipRepository } from './psf-membership.repository';

/**
 * PSF membership mail (ADR-056). Every send is best effort: a failed or slow
 * transport is logged and the membership change that caused it stands, exactly
 * as registration mail behaves.
 *
 * The business's mail goes to the APPLICANTS, through `isPsfApplicant`, so an
 * on behalf agent stops receiving it at the owner's claim (AC-17), the same
 * moment they stop seeing the page.
 */
@Injectable()
export class PsfMembershipMailer {
  private static readonly SEND_TIMEOUT_MS = 8_000;

  private readonly logger = new Logger(PsfMembershipMailer.name);
  private readonly webUrl: string;
  private readonly appUrl: string;

  constructor(
    @Inject(MAILER_PORT) private readonly mailer: MailerPort,
    config: ConfigService,
    private readonly repo: PsfMembershipRepository,
    @Inject(SMS_PORT) private readonly sms: SmsPort,
  ) {
    this.webUrl = resolveWebUrl({
      webUrl: config.get<string>('WEB_URL'),
      nodeEnv: config.get<string>('NODE_ENV'),
    });
    this.appUrl = resolveAppUrl({ appUrl: config.get<string>('APP_URL'), nodeEnv: config.get<string>('NODE_ENV') });
  }

  received(orgId: string, tierName: string, withPsf: boolean): Promise<void> {
    return this.toApplicants(
      orgId,
      'application received',
      (to, legalName, link) => psfApplicationReceivedMail({ to, legalName, tierName, withPsf, link }),
      (legalName, docId, link) =>
        `PSF: we received the membership application for ${legalName}. Your docID is ${docId}. Track it at ${link}`,
    );
  }

  approved(orgId: string, d: { tierName: string; membershipNumber: string; feeRwf: number }): Promise<void> {
    return this.toApplicants(
      orgId,
      'approved',
      (to, legalName, link) => psfApprovedMail({ to, legalName, ...d, link }),
      (legalName, docId, link) =>
        `PSF approved ${legalName} (${docId}). Pay RWF ${d.feeRwf.toLocaleString('en-US')} to become a member: ${link}`,
    );
  }

  member(
    orgId: string,
    d: {
      tierName: string;
      membershipNumber: string;
      annualFeeRwf: number;
      startsOn: string;
      expiresOn: string;
      paymentReference: string | null;
    },
  ): Promise<void> {
    return this.toApplicants(
      orgId,
      'member',
      (to, legalName, link) => psfMemberMail({ to, legalName, ...d, link }),
      (legalName) =>
        `Welcome to PSF. ${legalName} is a member, number ${d.membershipNumber}, until ${d.expiresOn}.`,
    );
  }

  declined(orgId: string, reason: PsfDeclineReason, note: string | null): Promise<void> {
    return this.toApplicants(
      orgId,
      'declined',
      (to, legalName, link) =>
        psfDeclinedMail({ to, legalName, reasonLabel: PSF_DECLINE_REASON_LABEL[reason], note, link }),
      (legalName, docId, link) =>
        `PSF declined the application for ${legalName} (${docId}): ${PSF_DECLINE_REASON_LABEL[reason]}. See why: ${link}`,
    );
  }

  expiring(orgId: string, membershipNumber: string, expiresOn: string): Promise<void> {
    return this.toApplicants(
      orgId,
      'membership expiring',
      (to, legalName, link) => psfExpiringMail({ to, legalName, membershipNumber, expiresOn, link }),
      (legalName) => `PSF: the membership of ${legalName} (${membershipNumber}) ends on ${expiresOn}.`,
    );
  }

  /** A claimed number PSF confirmed (0121). */
  claimConfirmed(orgId: string, membershipNumber: string, expiresOn: string, certificate?: Buffer): Promise<void> {
    return this.toApplicants(
      orgId,
      'membership claim confirmed',
      (to, legalName, link) => psfClaimConfirmedMail({ to, legalName, membershipNumber, expiresOn, link }),
      (legalName) => `PSF confirmed membership ${membershipNumber} for ${legalName}, until ${expiresOn}.`,
      // The member's certificate goes with the news (2026-11-02), as it does for a paid application.
      certificate ? [certificateAttachment(membershipNumber, certificate)] : undefined,
    );
  }

  /** A claimed number PSF could not confirm (0121), with the reason it gave. */
  claimRejected(orgId: string, membershipNumber: string, reason: string): Promise<void> {
    return this.toApplicants(
      orgId,
      'membership claim rejected',
      (to, legalName, link) => psfClaimRejectedMail({ to, legalName, membershipNumber, reason, link }),
      (legalName) => `PSF could not confirm membership ${membershipNumber} for ${legalName}: ${reason}`,
    );
  }

  /** An officer's reminder that an application still waits for its payment (2026-11-02), with the link to pay. */
  paymentReminder(orgId: string, amountRwf: number | null): Promise<void> {
    return this.toApplicants(
      orgId,
      'payment reminder',
      (to, legalName, link) => psfPaymentReminderMail({ to, legalName, amountRwf, link }),
      (legalName, docId, link) =>
        `PSF: the application for ${legalName} (${docId}) waits for its payment${amountRwf ? ` of RWF ${amountRwf.toLocaleString('en-US')}` : ''}. Pay here: ${link}`,
    );
  }

  /** A paid renewal (2026-11-02): the membership carries on, no decision needed. */
  renewed(
    orgId: string,
    d: { membershipNumber: string; tierName: string; amountRwf: number; startsOn: string; expiresOn: string; paymentReference: string },
  ): Promise<void> {
    return this.toApplicants(
      orgId,
      'membership renewed',
      (to, legalName, link) => psfRenewedMail({ to, legalName, link, ...d }),
      (legalName) => `PSF: ${legalName} (${d.membershipNumber}) is renewed until ${d.expiresOn}. Thank you.`,
    );
  }

  expired(orgId: string, membershipNumber: string): Promise<void> {
    return this.toApplicants(
      orgId,
      'membership expired',
      (to, legalName, link) => psfExpiredMail({ to, legalName, membershipNumber, link }),
      (legalName) => `PSF: the membership of ${legalName} (${membershipNumber}) has ended.`,
    );
  }

  /**
   * Every active PSF membership officer whose region covers the business, once
   * per application (AC-9). A district officer hears of their own district's
   * applications only, and a country officer of all of them.
   */
  queueEntered(orgId: string, applicationId: string, tierName: string, origin: 'psf_form' | 'registration'): Promise<void> {
    return this.guarded('queue entered', orgId, async () => {
      const facts = await this.repo.orgFacts(orgId);
      if (!facts) return;
      const emails = await this.repo.membershipOfficerEmails(facts.districtId);
      if (emails.length === 0) {
        this.logger.warn(
          `No PSF District Manager is appointed; nobody was mailed about the application of org ${orgId}.`,
        );
        return;
      }
      // The application itself, in the PSF console (2026-11-02): the queue on web was the wrong portal.
      const link = psfApplicationLink(this.appUrl, applicationId);
      for (const email of emails) {
        await this.deliver(
          email,
          psfOfficerQueueMail({
            to: { name: null },
            legalName: facts.legalName,
            districtName: facts.districtName,
            tierName,
            origin,
            link,
          }),
          'queue entered',
          orgId,
        );
      }
    });
  }

  /**
   * The business's people: its owners through the applicant rule, or, for a
   * business that came through the public form and so has no owner account,
   * the applicant its newest application names, by mail when they gave an
   * address and always by text message, each carrying the docID's link.
   */
  private toApplicants(
    orgId: string,
    what: string,
    build: (to: Addressee, legalName: string, link: string) => RegistrationMail,
    text?: (legalName: string, docId: string, link: string) => string,
    attachments?: MailAttachment[],
  ): Promise<void> {
    return this.guarded(what, orgId, async () => {
      const facts = await this.repo.orgFacts(orgId);
      if (!facts) return;
      const owners = await this.repo.activeOwners(orgId);
      const recipients = owners.filter((o) =>
        isPsfApplicant({ userId: o.userId, domain: facts.domain, orgRole: 'owner', obo: facts.obo }),
      );
      if (recipients.length > 0) {
        const link = psfMembershipLink(this.webUrl, await this.repo.workspaceIdFor(orgId));
        for (const r of recipients) {
          await this.deliver(r.email, build({ name: r.name }, facts.legalName, link), what, orgId, attachments);
        }
        return;
      }
      const applicant = await this.repo.publicApplicant(orgId);
      if (!applicant) {
        this.logger.warn(`Org ${orgId} has nobody to tell about its PSF membership (${what}).`);
        return;
      }
      const link = psfTrackLink(this.webUrl, applicant.docId);
      if (applicant.email) {
        await this.deliver(applicant.email, build({ name: applicant.name }, facts.legalName, link), what, orgId, attachments);
      }
      if (applicant.phoneE164 && text) {
        try {
          await this.sms.send({ toE164: applicant.phoneE164, body: text(facts.legalName, applicant.docId, link) });
          this.logger.log(`PSF text (${what}) for org ${orgId} sent`);
        } catch (cause) {
          this.logger.error(
            `PSF text (${what}) for org ${orgId} was not sent: ${
              cause instanceof Error ? cause.message : 'SMS failed'
            }. The membership change stands.`,
          );
        }
      }
    });
  }

  /** The tracking page for a docID, as every PSF mail and text links it. */
  trackLink(docId: string): string {
    return psfTrackLink(this.webUrl, docId);
  }

  /**
   * Mail the certificate PDF to one address. Unlike the status mail this is
   * asked for by a person waiting on the answer, so a failure throws.
   */
  async certificate(
    to: string,
    d: { name: string; legalName: string; tierName: string; membershipNumber: string; expiresOn: string | null; docId: string },
    pdf: Buffer,
  ): Promise<void> {
    const mail = psfCertificateMail({ to: { name: d.name }, ...d, link: this.trackLink(d.docId) });
    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        this.mailer.send({
          to,
          ...mail,
          attachments: [certificateAttachment(d.membershipNumber, pdf)],
        }),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => reject(new Error('mail transport did not respond')), PsfMembershipMailer.SEND_TIMEOUT_MS);
        }),
      ]);
      this.logger.log(`PSF certificate ${d.membershipNumber} mailed to ${to}`);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private async guarded(what: string, orgId: string, run: () => Promise<void>): Promise<void> {
    try {
      await run();
    } catch (cause) {
      this.logger.error(
        `PSF mail (${what}) for org ${orgId} was not sent: ${
          cause instanceof Error ? cause.message : 'unknown failure'
        }. The membership change stands.`,
      );
    }
  }

  private async deliver(to: string, mail: RegistrationMail, what: string, orgId: string, attachments?: MailAttachment[]): Promise<void> {
    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        this.mailer.send({ to, ...mail, ...(attachments ? { attachments } : {}) }),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(
            () => reject(new Error(`mail transport did not respond within ${PsfMembershipMailer.SEND_TIMEOUT_MS}ms`)),
            PsfMembershipMailer.SEND_TIMEOUT_MS,
          );
        }),
      ]);
      this.logger.log(`PSF mail (${what}) for org ${orgId} mailed to ${to}`);
    } catch (cause) {
      this.logger.error(
        `PSF mail (${what}) for org ${orgId} was not mailed to ${to}: ${
          cause instanceof Error ? cause.message : 'mail transport failed'
        }. The membership change stands.`,
      );
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}

type MailAttachment = { filename: string; content: Buffer; contentType: string };

/** The certificate as every PSF mail attaches it. */
export function certificateAttachment(membershipNumber: string, pdf: Buffer): MailAttachment {
  return { filename: psfCertificateFilename(membershipNumber), content: pdf, contentType: 'application/pdf' };
}

export function psfCertificateFilename(membershipNumber: string): string {
  return `PSF-certificate-${membershipNumber.replace(/[^A-Za-z0-9-]+/g, '-')}.pdf`;
}
