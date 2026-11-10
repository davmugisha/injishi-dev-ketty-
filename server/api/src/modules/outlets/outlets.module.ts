import { Module } from '@nestjs/common';

import { OperationsModule } from '../operations/operations.module';
import { PaymentsModule } from '../pay/payments.module';
import { FolioModule } from '../pms/folio.module';
import { GuestOrderingService } from './application/guest-ordering.service';
import { OrderPaymentService } from './application/order-payment.service';
import { OutletsService } from './application/outlets.service';
import { ServiceCatalogService } from './application/service-catalog.service';
import { GuestOrderingRepository } from './infrastructure/guest-ordering.repository';
import { OutletsRepository } from './infrastructure/outlets.repository';
import { ServiceCatalogRepository } from './infrastructure/service-catalog.repository';
import { EntitlementCheck } from '../../shared/entitlements/entitlement-check';

/**
 * Outlets on the server (ADR-074 stage 5): the places a business sells from,
 * their menu and its order board, the guest's ordering to a table or a room, and
 * the pay now settlement of an order. It was part of `OperationsModule` until
 * then.
 *
 * - `FolioModule` is PMS's folio port: an order reaching `delivered` posts its
 *   bill line through it, in the order's own transaction, and the menu prices a
 *   dish at the tax rates and under the revenue department it reads.
 * - `PaymentsModule` supplies the `PaymentSeam` a pay now order's mobile money
 *   goes through.
 * - `OperationsModule` supplies `MessagingService`: an order's events are lines
 *   in the guest's thread. It imports nothing back.
 *
 * Order payment is here although ADR-074 gives it to POS: it settles an outlet
 * order's money, the catalog injects it and it reads the catalog's repository,
 * so the two move together until POS's stage gives it a port. `BookingModule`
 * imports this module for guest ordering and order payment, which a booking's
 * payment attempt settles. `EbmModule` and `DatabaseModule` are global, so the
 * fiscal declaration plan, the sale trigger and `DRIZZLE` need no import.
 */
@Module({
  imports: [FolioModule, PaymentsModule, OperationsModule],
  providers: [
    // A guest's order is refused, and the orderable list leaves an outlet out,
    // where its business has Outlets off (ADR-076 G10). Shared, like the guards.
    EntitlementCheck,
    OutletsRepository,
    OutletsService,
    ServiceCatalogRepository,
    ServiceCatalogService,
    GuestOrderingRepository,
    GuestOrderingService,
    OrderPaymentService,
  ],
  exports: [
    // For the ops outlets, outlet parties and service catalog controllers, and the me controller.
    OutletsService,
    ServiceCatalogService,
    GuestOrderingService,
    // The booking module settles a pay now order's mobile money through it and guest ordering.
    OrderPaymentService,
  ],
})
export class OutletsModule {}
