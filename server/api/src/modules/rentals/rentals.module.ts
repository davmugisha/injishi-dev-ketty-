import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PLATFORM, type Platform } from '../../shared/config/platform';
import { isWorkerProcess } from '../../shared/process/process-role';
import { MailerModule } from '../mailer/mailer.module';
import { StorageModule } from '../storage/storage.module';
import { LeaseContractService } from './application/lease-contract.service';
import { LeaseDocumentsService } from './application/lease-documents.service';
import { LeaseDraftingService } from './application/lease-drafting.service';
import { LeaseInvitationsService } from './application/lease-invitations.service';
import { LeaseLifecycleService } from './application/lease-lifecycle.service';
import { LeaseReadsService } from './application/lease-reads.service';
import { LeaseSigningService } from './application/lease-signing.service';
import { PayoutAccountsService } from './application/payout-accounts.service';
import { RentalsProfileService } from './application/rentals-profile.service';
import { TenanciesService } from './application/tenancies.service';
import { TenantsService } from './application/tenants.service';
import { UnitsService } from './application/units.service';
// The broker on a lease: placement, fee record, ratings (2026-10-25).
import { LeaseBrokersService } from './application/lease-brokers.service';
import { LeaseBrokersRepository } from './infrastructure/lease-brokers.repository';
import { LeaseChargesRepository } from './infrastructure/lease-charges.repository';
import { LeaseDocumentsProcessor } from './infrastructure/lease-documents.processor';
import { LeaseDocumentsQueue } from './infrastructure/lease-documents.queue';
import { LeaseDocumentsRepository } from './infrastructure/lease-documents.repository';
import { LeasesRepository } from './infrastructure/leases.repository';
import { PAYOUT_ACCOUNT_CIPHER, resolvePayoutAccountCipher } from './infrastructure/payout-account-cipher';
import { PayoutAccountsRepository } from './infrastructure/payout-accounts.repository';
import { RentalsContextRepository } from './infrastructure/rentals-context.repository';
import { LeaseEventsWriter, RentalsAuditWriter } from './infrastructure/rentals-writers';
import { RentalsMailer } from './infrastructure/rentals.mailer';
import { SignerPasswordVerifier } from './infrastructure/signer-password';
import { SigningRepository } from './infrastructure/signing.repository';
import { TenanciesRepository } from './infrastructure/tenancies.repository';
import { TenantsRepository } from './infrastructure/tenants.repository';
import { UnitsRepository } from './infrastructure/units.repository';
// The landlord's home, buildings and unit media (WP 2.2, 2.3).
import { PropertiesService } from './application/properties.service';
import { RentalsOverviewService } from './application/rentals-overview.service';
import { UnitMediaService } from './application/unit-media.service';
import { PropertiesRepository } from './infrastructure/properties.repository';
import { RentalsOverviewRepository } from './infrastructure/rentals-overview.repository';
import { UnitMediaRepository } from './infrastructure/unit-media.repository';
// The rent cycle, reminders, payments and payouts (WP 1.6a, 1.6b).
import { PaymentsModule } from '../payments/payments.module';
import { PaymentReceiptsService } from './application/payment-receipts.service';
import { PaymentSettlementService } from './application/payment-settlement.service';
import { PayoutsService } from './application/payouts.service';
import { RentCycleService } from './application/rent-cycle.service';
import { RentPaymentsService } from './application/rent-payments.service';
import { RentReadsService } from './application/rent-reads.service';
import { RentRemindersService } from './application/rent-reminders.service';
import { TenantPaymentsService } from './application/tenant-payments.service';
import { LeasePaymentsRepository } from './infrastructure/lease-payments.repository';
import { LeaseRemindersRepository } from './infrastructure/lease-reminders.repository';
import { PaymentSettlementProcessor } from './infrastructure/payment-settlement.processor';
import { PayoutsProcessor } from './infrastructure/payouts.processor';
import { PayoutsRepository } from './infrastructure/payouts.repository';
import { RentCycleProcessor } from './infrastructure/rent-cycle.processor';
import { RentCycleRepository } from './infrastructure/rent-cycle.repository';
import { RentRemindersProcessor } from './infrastructure/rent-reminders.processor';
import { RentRollRepository } from './infrastructure/rent-roll.repository';
import { RentalsMoneyQueue } from './infrastructure/rentals-money.queue';
// Faults (WP 4.1): the shared ticket lifecycle, the landlord's and the tenant's sides.
import { TicketLifecycle } from '../operations/application/ticket-lifecycle';
import { FaultNotices } from './application/fault-notices';
import { FaultsService } from './application/faults.service';
import { TenantFaultsService } from './application/tenant-faults.service';
import { FaultsRepository } from './infrastructure/faults.repository';
// Expenses and paying the fixer (WP 4.3).
import { ExpensesService } from './application/expenses.service';
import { FaultPaymentsService } from './application/fault-payments.service';
import { ExpensesRepository } from './infrastructure/expenses.repository';
import { FaultPayoutsRepository } from './infrastructure/fault-payouts.repository';
// Rental income tax, lease filings and the housekeeping job (WP 4.4).
import { FilingsService } from './application/filings.service';
import { RentalsHousekeepingService } from './application/rentals-housekeeping.service';
import { TaxesService } from './application/taxes.service';
import { RentalsHousekeepingProcessor } from './infrastructure/rentals-housekeeping.processor';
import { TaxesRepository } from './infrastructure/taxes.repository';
// Messages between a landlord and a tenant (P3.4).
import { LeaseMessagesService } from './application/lease-messages.service';
import { MessageDigestsService } from './application/message-digests.service';
import { MessageEvents } from './application/message-events';
import { LeaseMessagesRepository } from './infrastructure/lease-messages.repository';
import { MessageDigestsProcessor } from './infrastructure/message-digests.processor';
// Moving out: notices, the moved-out day, deposit settlement (WP 1.7).
import { DepositsService } from './application/deposits.service';
import { MoveOutsService } from './application/move-outs.service';
import { MoveOutsRepository } from './infrastructure/move-outs.repository';

/**
 * Rentals: the residence side of Injishi, rebuilt (blueprint 2.2).
 *
 * The landlord's profile and setup, getting paid, units and blocks, tenants,
 * and leases from draft to cancel (WP 1.4 and 1.5a); signing on both sides,
 * the tenant's invitation, the tenant's own tenancies, the signed copy, and
 * starting a tenancy (WP 1.5b). The rent cycle, payments, deposits, notices,
 * faults, taxes, guests and brokers join it in later packages. Every landlord
 * service refuses a business that is not a residence (`assertResidence`, 404)
 * before it reads anything; the tenant's side is scoped by the tenant record
 * the caller's account is linked to.
 *
 * `DatabaseModule` is `@Global`, so `DRIZZLE` resolves without being named;
 * so is the queues module, so the LeaseDocuments queue is injected anywhere.
 * Files go through `StorageModule` and nowhere else, mail through
 * `MailerModule` (`RentalsMailer`, which resolves `APP_URL` at boot). The
 * payout account cipher is resolved once, at boot: a production platform
 * without `PAYOUT_ACCOUNT_ENCRYPTION_KEY` refuses to start. The LeaseDocuments
 * processor runs in the worker process only; the other queues are named in
 * `domain/rentals-queues.ts` for their packages.
 */
@Module({
  imports: [StorageModule, MailerModule, PaymentsModule],
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
    SigningRepository,
    LeaseChargesRepository,
    LeaseDocumentsRepository,
    TenanciesRepository,
    RentalsMailer,
    SignerPasswordVerifier,
    LeaseDocumentsQueue,
    LeaseContractService,
    LeaseReadsService,
    LeaseDraftingService,
    TenanciesService,
    LeaseInvitationsService,
    LeaseSigningService,
    LeaseLifecycleService,
    LeaseDocumentsService,
    RentalsProfileService,
    PayoutAccountsService,
    UnitsService,
    TenantsService,
    LeaseBrokersRepository,
    LeaseBrokersService,
    RentalsOverviewRepository,
    PropertiesRepository,
    UnitMediaRepository,
    RentalsOverviewService,
    PropertiesService,
    UnitMediaService,
    LeasePaymentsRepository,
    LeaseRemindersRepository,
    PayoutsRepository,
    RentCycleRepository,
    RentRollRepository,
    RentalsMoneyQueue,
    PaymentReceiptsService,
    PayoutsService,
    PaymentSettlementService,
    RentCycleService,
    RentRemindersService,
    RentPaymentsService,
    RentReadsService,
    TenantPaymentsService,
    TicketLifecycle,
    FaultsRepository,
    FaultNotices,
    FaultsService,
    TenantFaultsService,
    ExpensesRepository,
    FaultPayoutsRepository,
    FaultPaymentsService,
    ExpensesService,
    TaxesRepository,
    FilingsService,
    TaxesService,
    RentalsHousekeepingService,
    LeaseMessagesRepository,
    MessageEvents,
    LeaseMessagesService,
    MessageDigestsService,
    MoveOutsRepository,
    MoveOutsService,
    DepositsService,
    ...(isWorkerProcess() ? [MessageDigestsProcessor] : []),
    ...(isWorkerProcess() ? [LeaseDocumentsProcessor, RentCycleProcessor, RentRemindersProcessor, PaymentSettlementProcessor, PayoutsProcessor, RentalsHousekeepingProcessor] : []),
  ],
  exports: [
    LeaseEventsWriter,
    RentalsAuditWriter,
    LeaseContractService,
    LeaseReadsService,
    LeaseDraftingService,
    TenanciesService,
    LeaseInvitationsService,
    LeaseSigningService,
    LeaseLifecycleService,
    LeaseDocumentsService,
    RentalsProfileService,
    PayoutAccountsService,
    UnitsService,
    TenantsService,
    LeaseBrokersService,
    RentalsOverviewService,
    PropertiesService,
    UnitMediaService,
    RentalsMoneyQueue,
    PaymentSettlementService,
    PayoutsService,
    RentCycleService,
    RentRemindersService,
    RentPaymentsService,
    RentReadsService,
    TenantPaymentsService,
    FaultsService,
    TenantFaultsService,
    FaultPaymentsService,
    ExpensesService,
    FilingsService,
    TaxesService,
    RentalsHousekeepingService,
    MessageEvents,
    LeaseMessagesService,
    MoveOutsService,
    DepositsService,
  ],
})
export class RentalsModule {}
