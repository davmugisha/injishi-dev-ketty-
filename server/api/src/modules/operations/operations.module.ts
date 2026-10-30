import { Module } from '@nestjs/common';

import { PaymentsModule } from '../payments/payments.module';
import { FolioModule } from '../pms/folio.module';
import { TicketLifecycle } from '../pms/application/ticket-lifecycle';
import { DepartmentsService } from './application/departments.service';
import { GuestOrderingService } from '../outlets/application/guest-ordering.service';
import { MessagingService } from './application/messaging.service';
import { OrderPaymentService } from '../outlets/application/order-payment.service';
import { OutletsService } from '../outlets/application/outlets.service';
import { OwnerDashboardService } from './application/owner-dashboard.service';
import { ResidenceService } from './application/residence.service';
import { ServiceCatalogService } from '../outlets/application/service-catalog.service';
import { DepartmentsRepository } from './infrastructure/departments.repository';
import { GuestOrderingRepository } from '../outlets/infrastructure/guest-ordering.repository';
import { MessageTemplatesRepository } from './infrastructure/message-templates.repository';
import { MessagingRepository } from './infrastructure/messaging.repository';
import { OutletsRepository } from '../outlets/infrastructure/outlets.repository';
import { OwnerDashboardRepository } from './infrastructure/owner-dashboard.repository';
import { ResidenceRepository } from './infrastructure/residence.repository';
import { ServiceCatalogRepository } from '../outlets/infrastructure/service-catalog.repository';

/**
 * What is left of the operator command surface behind `/api/v1/ops/*` once PMS
 * has left it (ADR-074 stage 4), each part waiting for its own product's stage:
 *
 * - Outlets (stage 5): outlets, the service catalog and its order board, guest
 *   ordering, and order payment (POS's, stage 5 too).
 * - Account (stage 7): departments, where revenue is reported. PMS's night
 *   audit and Outlets' charges read them.
 * - Residence (stage 7): tenancies.
 * - Communications (a platform capability): guest messaging and its templates.
 * - Finance (stage 6): the owner's dashboard.
 *
 * Until ADR-074 stage 4 this module also held PMS's front desk, folio, night
 * audit, housekeeping, work orders, stay claims and refunds, revenue, the staff
 * phone and lost and found; they are `BookingModule`'s now, in `modules/pms`.
 * The direction between the two is one way: `BookingModule` imports this module
 * (departments for the night audit, guest ordering and order payment for the
 * pay now settlement), and this module reaches PMS only through `FolioModule`'s
 * port, which is all Outlets needs of the folio: the tax rates, a department,
 * and the posting its own transaction runs. No service here reaches into a
 * sibling's repository, which is still the rule.
 *
 * `TicketLifecycle` is PMS's (the one lifecycle hotel work orders, the tickets
 * board and rentals' faults share). It holds no state, so tenancies' service
 * gets its own instance here, as `RentalsModule` does, rather than importing
 * PMS's module.
 *
 * `DatabaseModule` is `@Global`, so `DRIZZLE` resolves without being named, and
 * `EbmModule` is too, so the fiscal declaration plan order payment reads needs no
 * import either.
 */
@Module({
  /*
   * `FolioModule` is the folio's port, above. `PaymentsModule` supplies the
   * `PaymentSeam`, which guest ordering (a pay now order's mobile money) and the
   * owner's dashboard read; it was imported for the refunds PMS took with it,
   * and stays for these two.
   */
  imports: [FolioModule, PaymentsModule],
  providers: [
    MessageTemplatesRepository,
    MessagingRepository,
    MessagingService,
    ResidenceRepository,
    ResidenceService,
    TicketLifecycle,
    DepartmentsRepository,
    DepartmentsService,
    // The owner's figures (dashboard, revenue by day, performance by branch):
    // sums over the folio, booking and payment rows the products write.
    OwnerDashboardRepository,
    OwnerDashboardService,
    ServiceCatalogRepository,
    ServiceCatalogService,
    GuestOrderingRepository,
    GuestOrderingService,
    OrderPaymentService,
    OutletsRepository,
    OutletsService,
  ],
  exports: [
    // For OpsMessageTemplatesController in PublicApiModule.
    MessageTemplatesRepository,
    // The booking module settles a pay now order's mobile money through these two.
    OrderPaymentService,
    GuestOrderingService,
    MessagingService,
    ResidenceService,
    // The night audit (PMS) reads departments.
    DepartmentsService,
    ServiceCatalogService,
    OutletsService,
    OwnerDashboardService,
  ],
})
export class OperationsModule {}
