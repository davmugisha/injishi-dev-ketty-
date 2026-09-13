import { Module } from '@nestjs/common';

import { isWorkerProcess } from '../../shared/process/process-role';
import { MailerModule } from '../mailer/mailer.module';
import { UserModule } from '../user/user.module';

import { BrokerRegistrationService } from './application/broker-registration.service';
import { OwnerClaimService } from './application/owner-claim.service';
import { RegistrationService } from './application/registration.service';
import { TeamService } from './application/team.service';
import { BrokerRepository } from './infrastructure/broker.repository';
import { ClaimInvitationMailer } from './infrastructure/claim-invitation.mailer';
import { OrganizationRepository } from './infrastructure/organization.repository';
import { OwnerClaimRepository } from './infrastructure/owner-claim.repository';
import { TeamRepository } from './infrastructure/team.repository';
import { RegistrationTinRecheckProcessor } from './infrastructure/registration-tin-recheck.processor';
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
  // MailerModule for the owner claim invitation (ADR-049), mailed through the
  // same seam as every sign-in code.
  imports: [UserModule, MailerModule],
  providers: [
    OrganizationRepository,
    BrokerRepository,
    tinAdapterProvider(),
    RegistrationService,
    BrokerRegistrationService,
    // The owner claim (FL02, ADR-049). The mailer resolves `WEB_URL` when it is
    // built, which is what makes a production boot without it a refusal.
    OwnerClaimRepository,
    OwnerClaimService,
    ClaimInvitationMailer,
    // The staff roster (ADR-035 follow-up). It belongs here rather than in
    // `operations` because a membership is an ORG fact: who works at this
    // business, not what happened on the desk today.
    TeamRepository,
    TeamService,
    // The RRA TIN retry sweep (ADR-049, AC-R5). Worker only, like the night
    // audit, so an HTTP replica never consumes a job.
    ...(isWorkerProcess() ? [RegistrationTinRecheckProcessor] : []),
  ],
  exports: [
    RegistrationService,
    BrokerRegistrationService,
    OwnerClaimService,
    TeamService,
  ],
})
export class OrganizationModule {}
