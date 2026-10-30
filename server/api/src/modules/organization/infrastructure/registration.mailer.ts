import type { RegistrationRejectionReason } from '@injishi/contracts';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { resolveAppUrl } from '../../../shared/config/app-url';
import { resolveWebUrl } from '../../../shared/config/web-url';
import {
  MAILER_PORT,
  type MailerPort,
} from '../../mailer/domain/mailer-port';
import {
  fieldVerificationPassedMail,
  officerQueueMail,
  officersCoveringDistrict,
  oversightQueueLink,
  psfBusinessRegisteredMail,
  registrationApprovedMail,
  registrationLink,
  registrationReceivedMail,
  registrationRejectedMail,
  registrationSubmittedMail,
  setupWhileInReviewMail,
  workspaceSetupLink,
  type RegistrationMail,
  type RejectionGate,
} from '../domain/registration-mail';
import { psfMembershipLink } from '../domain/psf-mail';
import { OrganizationRepository } from './organization.repository';

type Recipient = { userId: string; email: string; name: string | null };
type OfficerRole = 'business_field_verifier' | 'business_approver' | 'psf_membership_officer';

/**
 * Mails the registrant, and the officers who review them, as a business moves
 * through registration (F-S03). The words are `domain/registration-mail.ts`;
 * this class resolves who and where, and owns delivery.
 *
 * Built on the same rules as `ClaimInvitationMailer`:
 *
 * - `WEB_URL` is resolved in the constructor, so a production boot without it
 *   is a refusal rather than a mail full of `localhost` links.
 * - **Nothing here throws.** Every method runs after the state change it
 *   describes has committed, and a registration that moved must not be reported
 *   as failed because a relay was slow or a recipient read failed. A failure is
 *   logged and the next recipient is still tried.
 * - Each send is capped at the ceiling `OtpMailer` uses. Recipients are mailed
 *   one after another, so a slow relay costs time, never a duplicate.
 * - The log names the org and the address, never a mail body.
 */
@Injectable()
export class RegistrationMailer {
  /** The same ceiling `OtpMailer` puts on a foreground send. */
  private static readonly SEND_TIMEOUT_MS = 8_000;

  private readonly logger = new Logger(RegistrationMailer.name);
  private readonly webUrl: string;
  /** The operator app, where setup and the officer console live. */
  private readonly appUrl: string;

  constructor(
    @Inject(MAILER_PORT) private readonly mailer: MailerPort,
    config: ConfigService,
    private readonly orgs: OrganizationRepository,
  ) {
    this.webUrl = resolveWebUrl({
      webUrl: config.get<string>('WEB_URL'),
      nodeEnv: config.get<string>('NODE_ENV'),
    });
    this.appUrl = resolveAppUrl({
      appUrl: config.get<string>('APP_URL'),
      nodeEnv: config.get<string>('NODE_ENV'),
    });
  }

  /** Created at `pending_payment`: pay the fee. */
  received(orgId: string, amountDueRwf: number | null): Promise<void> {
    return this.toOwners(orgId, 'registration received', (to, facts) =>
      registrationReceivedMail({
        to,
        legalName: facts.legalName,
        amountDueRwf,
        link: registrationLink(this.webUrl),
      }),
    );
  }

  /**
   * Paid, or corrected and resubmitted.
   *
   * A hotel, lodge, venue or any other hospitality business paying for the
   * first time is told to set up its listing now (`canSetUpDuringReview`): the
   * workspace already holds `listing.manage`, and only Publish waits for
   * approval. Everyone else (a resubmission, a residence, an OBO registration
   * whose owner has not claimed it) is told it is in the pipeline.
   */
  async submitted(orgId: string, resubmitted: boolean): Promise<void> {
    const invite =
      !resubmitted && !(await this.awaitingClaim(orgId));
    return this.toOwners(orgId, 'registration submitted', (to, facts) =>
      invite && facts.domain === 'hospitality' && facts.workspaceId
        ? setupWhileInReviewMail({
            to,
            legalName: facts.legalName,
            hasTin: facts.tin !== null,
            setupLink: workspaceSetupLink(this.appUrl, facts.workspaceId, facts.domain),
          })
        : registrationSubmittedMail({
            to,
            legalName: facts.legalName,
            hasTin: facts.tin !== null,
            resubmitted,
            link: registrationLink(this.webUrl),
          }),
    );
  }

  /** An unclaimed OBO registration; a failed read counts as one, so no setup link goes out on a guess. */
  private async awaitingClaim(orgId: string): Promise<boolean> {
    try {
      return await this.orgs.isAwaitingOwnerClaim(orgId);
    } catch {
      return true;
    }
  }

  /** THE PSF PATH: registered, with its code. The next step is membership. */
  registeredForPsf(orgId: string): Promise<void> {
    return this.toOwners(orgId, 'registered for PSF', (to, facts) =>
      psfBusinessRegisteredMail({
        to,
        legalName: facts.legalName,
        businessCode: facts.businessCode,
        districtName: facts.districtName,
        link: psfMembershipLink(this.webUrl, facts.workspaceId),
      }),
    );
  }

  /** Refused, by RRA or at a human gate. */
  rejected(
    orgId: string,
    input: {
      gate: RejectionGate;
      reasonCode: RegistrationRejectionReason | null;
      notes: string | null;
    },
  ): Promise<void> {
    return this.toOwners(orgId, 'registration rejected', (to, facts) =>
      registrationRejectedMail({
        to,
        legalName: facts.legalName,
        gate: input.gate,
        reasonCode: input.reasonCode,
        notes: input.notes,
        link: registrationLink(this.webUrl),
      }),
    );
  }

  /** The documents were checked: tell the registrant. */
  fieldVerified(orgId: string): Promise<void> {
    return this.toOwners(orgId, 'documents checked', (to, facts) =>
      fieldVerificationPassedMail({
        to,
        legalName: facts.legalName,
        link: registrationLink(this.webUrl),
      }),
    );
  }

  /** Approved: set up the workspace, or wait for the owner's claim (OBO). */
  approved(orgId: string, awaitingClaim: boolean): Promise<void> {
    return this.toOwners(orgId, 'registration approved', (to, facts) =>
      awaitingClaim
        ? registrationApprovedMail({
            to,
            legalName: facts.legalName,
            awaitingClaim: true,
            statusLink: registrationLink(this.webUrl),
          })
        : registrationApprovedMail({
            to,
            legalName: facts.legalName,
            awaitingClaim: false,
            // Every registration is created with its workspace, in the same
            // transaction; the fallback only keeps a link in the mail.
            setupLink: facts.workspaceId
              ? workspaceSetupLink(this.appUrl, facts.workspaceId, facts.domain)
              : registrationLink(this.webUrl),
          }),
    );
  }

  /**
   * A business entered a queue: mail every officer holding that function whose
   * region covers the business's district.
   *
   * Two people are never mailed, whatever their region: anyone holding a role in
   * the business itself (the conflict of interest the gate refuses, ADR-053
   * AC-G3), and — for the approval queue — the officer who field verified it,
   * whom separation of duties bars from approving it.
   */
  queueEntered(orgId: string, role: OfficerRole): Promise<void> {
    const what = `${role} queue`;
    return this.guarded(what, orgId, async () => {
      const facts = await this.orgs.registrationMailFacts(orgId);
      if (!facts) return;

      const rows = await this.orgs.activeOversightAssignments(role);
      const provinceIds = [
        ...new Set(
          rows
            .filter((r) => r.scopeLevel === 'province' && r.provinceId !== null)
            .map((r) => r.provinceId as number),
        ),
      ];
      const provinces = await this.orgs.districtsByProvince(provinceIds);
      const covering = officersCoveringDistrict(rows, provinces, facts.districtId);

      const verifierId =
        role === 'business_approver'
          ? await this.orgs.latestFieldVerifierId(orgId)
          : null;

      const link = oversightQueueLink(this.appUrl);
      let mailed = 0;
      for (const officer of covering) {
        if (officer.userId === verifierId) continue;
        if (await this.orgs.holdsOrgRole(orgId, officer.userId)) continue;
        const mail = officerQueueMail({
          to: officer,
          role,
          legalName: facts.legalName,
          districtName: facts.districtName,
          sectorName: facts.sectorName,
          tin: facts.tin,
          link,
        });
        if (await this.deliver(officer.email, mail, what, orgId)) mailed += 1;
      }
      if (covering.length === 0) {
        this.logger.warn(
          `No active ${role} covers the district of org ${orgId}; nobody was mailed about its queue.`,
        );
      } else {
        this.logger.log(`${what} for org ${orgId}: ${mailed} officer(s) mailed.`);
      }
    });
  }

  /** One mail per live owner of the business. */
  private toOwners(
    orgId: string,
    what: string,
    build: (
      to: Recipient,
      facts: NonNullable<
        Awaited<ReturnType<OrganizationRepository['registrationMailFacts']>>
      >,
    ) => RegistrationMail,
  ): Promise<void> {
    return this.guarded(what, orgId, async () => {
      const facts = await this.orgs.registrationMailFacts(orgId);
      if (!facts) return;
      const owners = await this.orgs.activeOwnerRecipients(orgId);
      if (owners.length === 0) {
        this.logger.warn(`Org ${orgId} has no active owner to mail (${what}).`);
      }
      for (const owner of owners) {
        await this.deliver(owner.email, build(owner, facts), what, orgId);
      }
    });
  }

  /** Run a whole notification, and log rather than throw whatever it hits. */
  private async guarded(
    what: string,
    orgId: string,
    run: () => Promise<void>,
  ): Promise<void> {
    try {
      await run();
    } catch (cause) {
      this.logger.error(
        `Registration mail (${what}) for org ${orgId} was not sent: ${
          cause instanceof Error ? cause.message : 'unknown failure'
        }. The registration change stands.`,
      );
    }
  }

  /** One send, capped in time. Resolves false on any failure. */
  private async deliver(
    to: string,
    mail: RegistrationMail,
    what: string,
    orgId: string,
  ): Promise<boolean> {
    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        this.mailer.send({ to, ...mail }),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(
            () =>
              reject(
                new Error(
                  `mail transport did not respond within ${RegistrationMailer.SEND_TIMEOUT_MS}ms`,
                ),
              ),
            RegistrationMailer.SEND_TIMEOUT_MS,
          );
        }),
      ]);
      this.logger.log(`Registration mail (${what}) for org ${orgId} mailed to ${to}`);
      return true;
    } catch (cause) {
      this.logger.error(
        `Registration mail (${what}) for org ${orgId} was not mailed to ${to}: ${
          cause instanceof Error ? cause.message : 'mail transport failed'
        }. The registration change stands.`,
      );
      return false;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
