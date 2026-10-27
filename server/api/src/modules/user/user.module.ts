import { Module } from '@nestjs/common';

import { GeographyModule } from '../geography/geography.module';
import { StorageModule } from '../storage/storage.module';

import { IdentityService } from './application/identity.service';
import { MeContextService } from './application/me-context.service';
import { ProfileService } from './application/profile.service';
import { identityAdapterProviders } from './infrastructure/identity-adapters.provider';
import { IdentityRepository } from './infrastructure/identity.repository';
import { MeContextRepository } from './infrastructure/me-context.repository';
import { ProfileRepository } from './infrastructure/profile.repository';

/**
 * Identity capture — the person behind a login (architecture.md, `user`).
 *
 * Layering matches every other module: application/ (use cases) —
 * infrastructure/ (Drizzle). `ProfileService` and `IdentityService` are the
 * only exports, so nothing outside can write `identity_documents` around the
 * uniqueness rule that makes "one human, one account" true.
 */
@Module({
  // GeographyModule answers one question for Step 1: does the village on this
  // address sit under its sector (D24)? `villages` is that module's table.
  imports: [GeographyModule, StorageModule],
  // Identity verification (ADR-060, ADR-075): the document verifier seam, the
  // scan rows, and the service that finally moves `kyc_status`.
  // `IdentityService` is exported so registration can require a verified
  // identity; the repository stays private, like the profile's.
  providers: [
    ProfileRepository,
    ProfileService,
    IdentityRepository,
    IdentityService,
    ...identityAdapterProviders,
    // Who am I, in one call (blueprint 2.5): tenancies and the broker record.
    MeContextRepository,
    MeContextService,
  ],
  exports: [ProfileService, IdentityService, MeContextService],
})
export class UserModule {}
