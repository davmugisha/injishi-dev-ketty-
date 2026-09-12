import { Module } from '@nestjs/common';

import { UserModule } from '../user/user.module';

import { BrokerRegistrationService } from './application/broker-registration.service';
import { RegistrationService } from './application/registration.service';
import { TeamService } from './application/team.service';
import { BrokerRepository } from './infrastructure/broker.repository';
import { OrganizationRepository } from './infrastructure/organization.repository';
import { TeamRepository } from './infrastructure/team.repository';
import { RraTinAdapter } from './infrastructure/rra-tin.adapter';

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
  imports: [UserModule],
  providers: [
    OrganizationRepository,
    BrokerRepository,
    RraTinAdapter,
    RegistrationService,
    BrokerRegistrationService,
    // The staff roster (ADR-035 follow-up). It belongs here rather than in
    // `operations` because a membership is an ORG fact: who works at this
    // business, not what happened on the desk today.
    TeamRepository,
    TeamService,
  ],
  exports: [RegistrationService, BrokerRegistrationService, TeamService],
})
export class OrganizationModule {}
