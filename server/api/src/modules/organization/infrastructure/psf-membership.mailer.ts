import { PSF_DECLINE_REASON_LABEL, isPsfApplicant, type PsfDeclineReason } from '@injishi/contracts';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { resolveWebUrl } from '../../../shared/config/web-url';
import { MAILER_PORT, type MailerPort } from '../../mailer/domain/mailer-port';
import {
  psfApplicationReceivedMail,
  psfDeclinedMail,
  psfExpiredMail,
  psfExpiringMail,
  psfMemberMail,
  psfMembershipLink,
  psfOfficerQueueMail,
  psfQueueLink,
} from '../domain/psf-mail';
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

  constructor(
    @Inject(MAILER_PORT) private readonly mailer: MailerPort,
    config: ConfigService,
    private readonly repo: PsfMembershipRepository,
  ) {
    this.webUrl = resolveWebUrl({
      webUrl: config.get<string>('WEB_URL'),
      nodeEnv: config.get<string>('NODE_ENV'),
    });
  }

  received(orgId: string, tierName: string, withPsf: boolean): Promise<void> {
    return this.toApplicants(orgId, 'application received', (to, legalName, link) =>
      psfApplicationReceivedMail({ to, legalName, tierName, withPsf, link }),
    );
  }

  member(
    orgId: string,
    d: { tierName: string; membershipNumber: string; annualFeeRwf: number; startsOn: string; expiresOn: string },
  ): Promise<void> {
    return this.toApplicants(orgId, 'member', (to, legalName, link) =>
      psfMemberMail({ to, legalName, ...d, link }),
    );
  }

  declined(orgId: string, reason: PsfDeclineReason, note: string | null): Promise<void> {
    return this.toApplicants(orgId, 'declined', (to, legalName, link) =>
      psfDeclinedMail({ to, legalName, reasonLabel: PSF_DECLINE_REASON_LABEL[reason], note, link }),
    );
  }

  expiring(orgId: string, membershipNumber: string, expiresOn: string): Promise<void> {
    return this.toApplicants(orgId, 'membership expiring', (to, legalName, link) =>
      psfExpiringMail({ to, legalName, membershipNumber, expiresOn, link }),
    );
  }

  expired(orgId: string, membershipNumber: string): Promise<void> {
    return this.toApplicants(orgId, 'membership expired', (to, legalName, link) =>
      psfExpiredMail({ to, legalName, membershipNumber, link }),
    );
  }

  /** Every active PSF membership officer, once per application (AC-9). */
  queueEntered(orgId: string, tierName: string): Promise<void> {
    return this.guarded('queue entered', orgId, async () => {
      const facts = await this.repo.orgFacts(orgId);
      if (!facts) return;
      const emails = await this.repo.membershipOfficerEmails();
      if (emails.length === 0) {
        this.logger.warn(
          `No PSF membership officer is appointed; nobody was mailed about the application of org ${orgId}.`,
        );
        return;
      }
      const link = psfQueueLink(this.webUrl);
      for (const email of emails) {
        await this.deliver(
          email,
          psfOfficerQueueMail({
            to: { name: null },
            legalName: facts.legalName,
            districtName: facts.districtName,
            tierName,
            link,
          }),
          'queue entered',
          orgId,
        );
      }
    });
  }

  private toApplicants(
    orgId: string,
    what: string,
    build: (to: Addressee, legalName: string, link: string) => RegistrationMail,
  ): Promise<void> {
    return this.guarded(what, orgId, async () => {
      const facts = await this.repo.orgFacts(orgId);
      if (!facts) return;
      const owners = await this.repo.activeOwners(orgId);
      const recipients = owners.filter((o) =>
        isPsfApplicant({ userId: o.userId, domain: facts.domain, orgRole: 'owner', obo: facts.obo }),
      );
      if (recipients.length === 0) {
        this.logger.warn(`Org ${orgId} has nobody to mail about its PSF membership (${what}).`);
        return;
      }
      const link = psfMembershipLink(this.webUrl, await this.repo.workspaceIdFor(orgId));
      for (const r of recipients) {
        await this.deliver(r.email, build({ name: r.name }, facts.legalName, link), what, orgId);
      }
    });
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

  private async deliver(to: string, mail: RegistrationMail, what: string, orgId: string): Promise<void> {
    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        this.mailer.send({ to, ...mail }),
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
