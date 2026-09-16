import { Module } from '@nestjs/common';

import { isWorkerProcess } from '../../shared/process/process-role';
import { AmenitiesService } from './application/amenities.service';
import { BrokerService } from './application/broker.service';
import { DepartmentsService } from './application/departments.service';
import { FolioService } from './application/folio.service';
import { FrontDeskService } from './application/front-desk.service';
import { HousekeepingService } from './application/housekeeping.service';
import { MessagingService } from './application/messaging.service';
import { NightAuditService } from './application/night-audit.service';
import { ResidenceService } from './application/residence.service';
import { RevenueService } from './application/revenue.service';
import { RoomAssignmentService } from './application/room-assignment.service';
import { ServiceCatalogService } from './application/service-catalog.service';
import { GuestOrderingService } from './application/guest-ordering.service';
import { DeclarationPlanService } from './application/declaration-plan.service';
import { OrderPaymentService } from './application/order-payment.service';
import { OutletsService } from './application/outlets.service';
import { AmenitiesRepository } from './infrastructure/amenities.repository';
import { BrokerOpsRepository } from './infrastructure/broker-ops.repository';
import { DepartmentsRepository } from './infrastructure/departments.repository';
import { FolioRepository } from './infrastructure/folio.repository';
import { FrontDeskRepository } from './infrastructure/front-desk.repository';
import { HousekeepingRepository } from './infrastructure/housekeeping.repository';
import { MessagingRepository } from './infrastructure/messaging.repository';
import { NightAuditProcessor } from './infrastructure/night-audit.processor';
import { ResidenceRepository } from './infrastructure/residence.repository';
import { RevenueRepository } from './infrastructure/revenue.repository';
import { RoomAssignmentRepository } from './infrastructure/room-assignment.repository';
import { ServiceCatalogRepository } from './infrastructure/service-catalog.repository';
import { GuestOrderingRepository } from './infrastructure/guest-ordering.repository';
import { OutletsRepository } from './infrastructure/outlets.repository';

/**
 * The operator command surface behind `/api/v1/ops/*` (ADR-012 steps 4 and 5).
 *
 * Everything a front desk or a landlord's office DOES, as opposed to what a
 * guest can see. Four services because there are four genuinely different
 * subjects — rooms and stays, conversations, tenancies, and what a property
 * offers — and one service per subject keeps each one small enough to read.
 *
 * Reservations are NOT here: they live in `BookingModule` beside the booking
 * transitions they share, because approve and decline move the same escrow the
 * public path does and one of those two had to own it.
 *
 * ADR-016 added five more subjects, and the split is the same rule: one service
 * per thing an operator thinks about. Departments (where revenue is reported),
 * the folio (what a guest owes), room assignment (which room they get), the
 * cleaning queue, and the menu with its orders.
 *
 * The night audit processor runs ONLY in the worker process, so the HTTP
 * process never posts a room charge as a side effect of serving a request.
 *
 * Imports nothing. `DatabaseModule` is `@Global`, so `DRIZZLE` resolves without
 * being named, and no service here reaches into another module's internals.
 */
@Module({
  providers: [
    FrontDeskRepository,
    MessagingRepository,
    ResidenceRepository,
    BrokerOpsRepository,
    AmenitiesRepository,
    DepartmentsRepository,
    FolioRepository,
    RevenueRepository,
    RoomAssignmentRepository,
    HousekeepingRepository,
    ServiceCatalogRepository,
    GuestOrderingRepository,
    OutletsRepository,
    FrontDeskService,
    MessagingService,
    ResidenceService,
    BrokerService,
    AmenitiesService,
    DepartmentsService,
    FolioService,
    RevenueService,
    RoomAssignmentService,
    HousekeepingService,
    ServiceCatalogService,
    GuestOrderingService,
    DeclarationPlanService,
    OrderPaymentService,
    OutletsService,
    NightAuditService,
    ...(isWorkerProcess() ? [NightAuditProcessor] : []),
  ],
  exports: [
    // The booking module settles a pay now order's mobile money through it.
    OrderPaymentService,
    FrontDeskService,
    MessagingService,
    ResidenceService,
    BrokerService,
    AmenitiesService,
    DepartmentsService,
    FolioService,
    RevenueService,
    RoomAssignmentService,
    HousekeepingService,
    ServiceCatalogService,
    GuestOrderingService,
    OutletsService,
    NightAuditService,
  ],
})
export class OperationsModule {}
