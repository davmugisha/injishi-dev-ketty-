import { Module } from '@nestjs/common';

import { isWorkerProcess } from '../../shared/process/process-role';
import { GeographyModule } from '../geography/geography.module';
import { MailerModule } from '../mailer/mailer.module';
import { UserModule } from '../user/user.module';

import { BrokerRegistrationService } from './application/broker-registration.service';
import { OwnerClaimService } from './application/owner-claim.service';
import { PsfMembershipService } from './application/psf-membership.service';
import { RegistrationDraftService } from './application/registration-draft.service';
import { RegistrationService } from './application/registration.service';
import { RolePermissionsService } from './application/role-permissions.service';
import { StaffInvitationService } from './application/staff-invitation.service';
import { TeamService } from './application/team.service';
import { BrokerRepository } from './infrastructure/broker.repository';
import { ClaimInvitationMailer } from './infrastructure/claim-invitation.mailer';
import { OrganizationRepository } from './infrastructure/organization.repository';
import { OwnerClaimRepository } from './infrastructure/owner-claim.repository';
import { PsfMembershipMailer } from './infrastructure/psf-membership.mailer';
import { PsfMembershipRepository } from './infrastructure/psf-membership.repository';
import { RegistrationDraftRepository } from './infrastructure/registration-draft.repository';
import { RegistrationMailer } from './infrastructure/registration.mailer';
import { RolePermissionsRepository } from './infrastructure/role-permissions.repository';
import { StaffInvitationMailer } from './infrastructure/staff-invitation.mailer';
import { StaffInvitationRepository } from './infrastructure/staff-invitation.repository';
import { TeamRepository } from './infrastructure/team.repository';
import { RegistrationTinRecheckProcessor } from './infrastructure/registration-tin-recheck.processor';
import { PsfMembershipSweepProcessor } from './infrastructure/psf-membership-sweep.processor';
import { tinAdapterProvider } from './infrastructure/tin-adapter.provider';

/**
 * Business registration and the org lifecycle (F-S03).
 *
 * Layering matches every other module: domain/ (the state machine) -
 * application/ (use cases) - infrastructure/ (Drizzle, the RRA adapter).
 * The two registration services are the only exports, so nothing outside can
 * reach a repository or drive a transition around the state machine.
 * `BrokerRegistrationService` sits here rather than in a module of its own
 * because it shares Step 1 with `RegistrationService` and shares nothing with
 * anything else (F-R09, ADR-026).
 */
@Module({
  // Step 1 of registration is a USER fact, not an ORG fact. This module
  // composes the user application service rather than writing `user_profiles`
  // itself, so the uniqueness rule on `identity_documents` has one owner.
  // MailerModule for the owner claim invitation (ADR-053), mailed through the
  // same seam as every sign-in code.
  // GeographyModule for one question only: whether the village on a
  // registration's address sits under its sector (D24). `villages` is that
  // module's table, so the join lives there and this module composes it.
  imports: [UserModule, MailerModule, GeographyModule],
  providers: [
    OrganizationRepository,
    BrokerRepository,
    RegistrationDraftRepository,
    RegistrationDraftService,
    tinAdapterProvider(),
    RegistrationService,
    BrokerRegistrationService,
    // The owner claim (FL02, ADR-053). The mailer resolves `WEB_URL` when it is
    // built, which is what makes a production boot without it a refusal.
    OwnerClaimRepository,
    OwnerClaimService,
    ClaimInvitationMailer,
    // Registration mail to the registrant and the covering officers (F-S03).
    RegistrationMailer,
    // The staff roster (ADR-035 follow-up). It belongs here rather than in
    // `operations` because a membership is an ORG fact: who works at this
    // business, not what happened on the desk today.
    TeamRepository,
    TeamService,
    // What each staff role may do at THIS business (ADR-055). An ORG fact like
    // the roster beside it: who works here, and what the business decided that
    // means. `WorkspaceService` reads it through the service, which is why the
    // service is exported and the repository is not.
    RolePermissionsRepository,
    RolePermissionsService,
    // Staff invitations: how an approved owner puts people on the business
    // (setup after approval, 2026-09-13). Mailed through the same seam.
    StaffInvitationRepository,
    StaffInvitationMailer,
    StaffInvitationService,
    // PSF membership (ADR-056): a business applies, a PSF membership officer
    // decides. The registration create writes an application through the
    // repository's shared insert, so both doors file the same row.
    PsfMembershipRepository,
    PsfMembershipMailer,
    PsfMembershipService,
    // The RRA TIN retry sweep (ADR-053, AC-R5). Worker only, like the night
    // audit, so an HTTP replica never consumes a job.
    ...(isWorkerProcess() ? [RegistrationTinRecheckProcessor] : []),
    // The daily PSF membership sweep (ADR-056 AC-18). Worker only, likewise.
    ...(isWorkerProcess() ? [PsfMembershipSweepProcessor] : []),
  ],
  exports: [
    RegistrationService,
    RegistrationDraftService,
    BrokerRegistrationService,
    OwnerClaimService,
    TeamService,
    RolePermissionsService,
    StaffInvitationService,
    PsfMembershipService,
  ],
})
export class OrganizationModule {}
