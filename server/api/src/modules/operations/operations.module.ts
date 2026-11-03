import { Module } from '@nestjs/common';

import { TicketLifecycle } from '../pms/application/ticket-lifecycle';
import { DepartmentsService } from './application/departments.service';
import { MessagingService } from './application/messaging.service';
import { ResidenceService } from './application/residence.service';
import { DepartmentsRepository } from './infrastructure/departments.repository';
import { MessageTemplatesRepository } from './infrastructure/message-templates.repository';
import { MessagingRepository } from './infrastructure/messaging.repository';
import { ResidenceRepository } from './infrastructure/residence.repository';

/**
 * What is left of the operator command surface behind `/api/v1/ops/*` once PMS
 * (ADR-074 stage 4), Outlets (stage 5) and Finance (stage 6) have left it, each
 * part waiting for its own product's stage:
 *
 * - Account (stage 7): departments, where revenue is reported. PMS's night
 *   audit and Outlets' charges read them.
 * - Residence (stage 7): tenancies.
 * - Communications (a platform capability): guest messaging and its templates.
 *
 * Until stage 4 this module also held PMS's front desk, folio, night audit,
 * housekeeping, work orders, stay claims and refunds, revenue, the staff phone
 * and lost and found (`BookingModule`'s now, in `modules/pms`); until stage 5
 * Outlets' outlets, service catalog and order board, guest ordering and order
 * payment (`OutletsModule`'s, in `modules/outlets`); and until stage 6 the
 * owner's dashboard (`FinanceModule`'s, in `modules/finance`), for which alone
 * it imported `PaymentsModule`. PMS and Outlets import this module, for
 * departments, and Outlets for messaging; this module imports no module, and no
 * service here reaches into a sibling's repository.
 *
 * `TicketLifecycle` is PMS's (the one lifecycle hotel work orders, the tickets
 * board and rentals' faults share). It holds no state, so tenancies' service
 * gets its own instance here, as `RentalsModule` does, rather than importing
 * PMS's module.
 *
 * `DatabaseModule` is `@Global`, so `DRIZZLE` resolves without being named.
 */
@Module({
  providers: [
    MessageTemplatesRepository,
    MessagingRepository,
    MessagingService,
    ResidenceRepository,
    ResidenceService,
    TicketLifecycle,
    DepartmentsRepository,
    DepartmentsService,
  ],
  exports: [
    // For OpsMessageTemplatesController in PublicApiModule.
    MessageTemplatesRepository,
    // Guest ordering (Outlets) posts its order events to the guest's thread.
    MessagingService,
    ResidenceService,
    // The night audit (PMS) reads departments.
    DepartmentsService,
  ],
})
export class OperationsModule {}
