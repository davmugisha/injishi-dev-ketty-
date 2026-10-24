import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PLATFORM, type Platform } from '../../shared/config/platform';
import { StorageModule } from '../storage/storage.module';
import { LeaseContractService } from './application/lease-contract.service';
import { LeaseDraftingService } from './application/lease-drafting.service';
import { LeaseReadsService } from './application/lease-reads.service';
import { PayoutAccountsService } from './application/payout-accounts.service';
import { RentalsProfileService } from './application/rentals-profile.service';
import { TenantsService } from './application/tenants.service';
import { UnitsService } from './application/units.service';
import { LeasesRepository } from './infrastructure/leases.repository';
import { PAYOUT_ACCOUNT_CIPHER, resolvePayoutAccountCipher } from './infrastructure/payout-account-cipher';
import { PayoutAccountsRepository } from './infrastructure/payout-accounts.repository';
import { RentalsContextRepository } from './infrastructure/rentals-context.repository';
import { LeaseEventsWriter, RentalsAuditWriter } from './infrastructure/rentals-writers';
import { TenantsRepository } from './infrastructure/tenants.repository';
import { UnitsRepository } from './infrastructure/units.repository';

/**
 * Rentals: the residence side of Injishi, rebuilt (blueprint 2.2).
 *
 * The landlord's profile and setup, getting paid, units and blocks, tenants,
 * and leases from draft to cancel (WP 1.4 and 1.5a); signing, the rent cycle,
 * payments, deposits, notices, faults, taxes, guests and brokers join it in
 * later packages. Every service refuses a business that is not a residence
 * (`assertResidence`, 404) before it reads anything.
 *
 * `DatabaseModule` is `@Global`, so `DRIZZLE` resolves without being named.
 * Files go through `StorageModule` and nowhere else. The payout account cipher
 * is resolved once, at boot: a production platform without
 * `PAYOUT_ACCOUNT_ENCRYPTION_KEY` refuses to start. The queues the rentals jobs
 * will use are named in `domain/rentals-queues.ts`; no processor runs yet.
 */
@Module({
  imports: [StorageModule],
  providers: [
    {
      provide: PAYOUT_ACCOUNT_CIPHER,
      inject: [ConfigService, PLATFORM],
      useFactory: (config: ConfigService, platform: Platform) =>
        resolvePayoutAccountCipher({
          nodeEnv: config.get<string>('NODE_ENV'),
          environment: platform.environment,
          key: config.get<string>('PAYOUT_ACCOUNT_ENCRYPTION_KEY'),
        }),
    },
    LeaseEventsWriter,
    RentalsAuditWriter,
    RentalsContextRepository,
    PayoutAccountsRepository,
    UnitsRepository,
    TenantsRepository,
    LeasesRepository,
    LeaseContractService,
    LeaseReadsService,
    LeaseDraftingService,
    RentalsProfileService,
    PayoutAccountsService,
    UnitsService,
    TenantsService,
  ],
  exports: [
    LeaseEventsWriter,
    RentalsAuditWriter,
    LeaseContractService,
    LeaseReadsService,
    LeaseDraftingService,
    RentalsProfileService,
    PayoutAccountsService,
    UnitsService,
    TenantsService,
  ],
})
export class RentalsModule {}
