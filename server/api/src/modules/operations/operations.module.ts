import { Module } from '@nestjs/common';

import { isWorkerProcess } from '../../shared/process/process-role';
import { AmenitiesService } from './application/amenities.service';
import { BrokerService } from './application/broker.service';
import { DepartmentsService } from './application/departments.service';
import { FolioService } from './application/folio.service';
import { FrontDeskService } from './application/front-desk.service';
import { FrontDeskBoardService } from './application/front-desk-board.service';
import { SelfCheckInService } from './application/self-check-in.service';
import { HousekeepingService } from './application/housekeeping.service';
// The new interface's operations floor (real-data 1.2.3).
import { HousekeepingBoardService } from './application/housekeeping-board.service';
import { LostFoundService } from './application/lost-found.service';
import { WorkOrdersService } from './application/work-orders.service';
// The one ticket lifecycle hotel work orders, the tickets board and rentals faults share (WP 4.1).
import { TicketLifecycle } from './application/ticket-lifecycle';
import { HousekeepingBoardRepository } from './infrastructure/housekeeping-board.repository';
import { LostFoundRepository } from './infrastructure/lost-found.repository';
import { WorkOrdersRepository } from './infrastructure/work-orders.repository';
// The staff phone (real-data 1.3.3).
import { StaffPhoneService } from './application/staff-phone.service';
import { WorkOrderTimeService } from './application/work-order-time.service';
import { StaffPhoneRepository } from './infrastructure/staff-phone.repository';
import { MessagingService } from './application/messaging.service';
import { NightAuditService } from './application/night-audit.service';
import { ResidenceService } from './application/residence.service';
import { RevenueService } from './application/revenue.service';
import { OwnerDashboardService } from './application/owner-dashboard.service';
import { RoomAssignmentService } from './application/room-assignment.service';
import { ServiceCatalogService } from './application/service-catalog.service';
import { GuestOrderingService } from './application/guest-ordering.service';
import { DeclarationPlanService } from './application/declaration-plan.service';
import { OrderPaymentService } from './application/order-payment.service';
import { OutletsService } from './application/outlets.service';
import { OffersService } from './application/offers.service';
import { StayClaimService } from './application/stay-claim.service';
import { StayRefundService } from './application/stay-refund.service';
import { AmenitiesRepository } from './infrastructure/amenities.repository';
import { BrokerOpsRepository } from './infrastructure/broker-ops.repository';
import { DepartmentsRepository } from './infrastructure/departments.repository';
import { FolioRepository } from './infrastructure/folio.repository';
import { FrontDeskRepository } from './infrastructure/front-desk.repository';
import { FrontDeskBoardRepository } from './infrastructure/front-desk-board.repository';
import { MessageTemplatesRepository } from './infrastructure/message-templates.repository';
import { HousekeepingRepository } from './infrastructure/housekeeping.repository';
import { MessagingRepository } from './infrastructure/messaging.repository';
import { NightAuditProcessor } from './infrastructure/night-audit.processor';
import { ResidenceRepository } from './infrastructure/residence.repository';
import { RevenueRepository } from './infrastructure/revenue.repository';
import { OwnerDashboardRepository } from './infrastructure/owner-dashboard.repository';
import { RoomAssignmentRepository } from './infrastructure/room-assignment.repository';
import { ServiceCatalogRepository } from './infrastructure/service-catalog.repository';
import { GuestOrderingRepository } from './infrastructure/guest-ordering.repository';
import { OutletsRepository } from './infrastructure/outlets.repository';
import { OffersRepository } from './infrastructure/offers.repository';
import { PreArrivalIdentityRepository } from './infrastructure/pre-arrival-identity.repository';
import { StayClaimRepository } from './infrastructure/stay-claim.repository';
import { StayInvitationMailer } from './infrastructure/stay-invitation.mailer';
import { StayRefundRepository } from './infrastructure/stay-refund.repository';
import { MailerModule } from '../mailer/mailer.module';
import { PaymentsModule } from '../payments/payments.module';

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
 * `DatabaseModule` is `@Global`, so `DRIZZLE` resolves without being named. The
 * two modules imported below (§6.8) are SEAMS — `MAILER_PORT` and
 * `PAYMENT_PORT` — and not another module's internals: no service here reaches
 * into a sibling's repository, which is still the rule.
 */
@Module({
  /*
   * §6.8 adds the first two imports this module has ever had, and both are
   * seams rather than internals:
   *
   * - `MailerModule` supplies `MAILER_PORT`, which `StayInvitationMailer`
   *   composes words over — the same arrangement `OtpMailer` and
   *   `BookingMailer` have. A guest registered at a desk has to be told how to
   *   reach their stay, and that means an email leaves the building.
   * - `PaymentsModule` supplies `PAYMENT_PORT`, because approving a refund on a
   *   prepaid booking instructs the provider that is holding the money. The
   *   alternative was for this module to record an approval and let some other
   *   module notice it later, which is how a guest ends up marked refunded on
   *   money nobody sent.
   */
  imports: [MailerModule, PaymentsModule],
  providers: [
    FrontDeskRepository,
    // The front desk's day in one read (interface real-data, frontdesk leaf).
    FrontDeskBoardRepository,
    FrontDeskBoardService,
    MessageTemplatesRepository,
    MessagingRepository,
    ResidenceRepository,
    BrokerOpsRepository,
    AmenitiesRepository,
    DepartmentsRepository,
    FolioRepository,
    RevenueRepository,
    // The owner's figures (dashboard, revenue by day, performance by branch):
    // sums over the folio, booking and payment rows this module writes.
    OwnerDashboardRepository,
    RoomAssignmentRepository,
    HousekeepingRepository,
    ServiceCatalogRepository,
    GuestOrderingRepository,
    OutletsRepository,
    OffersRepository,
    StayClaimRepository,
    StayRefundRepository,
    PreArrivalIdentityRepository,
    StayInvitationMailer,
    HousekeepingBoardRepository,
    WorkOrdersRepository,
    LostFoundRepository,
    HousekeepingBoardService,
    WorkOrdersService,
    TicketLifecycle,
    LostFoundService,
    StaffPhoneRepository,
    StaffPhoneService,
    WorkOrderTimeService,
    FrontDeskService,
    MessagingService,
    ResidenceService,
    BrokerService,
    AmenitiesService,
    DepartmentsService,
    FolioService,
    RevenueService,
    OwnerDashboardService,
    RoomAssignmentService,
    HousekeepingService,
    ServiceCatalogService,
    GuestOrderingService,
    DeclarationPlanService,
    OrderPaymentService,
    OutletsService,
    OffersService,
    StayClaimService,
    StayRefundService,
    SelfCheckInService,
    NightAuditService,
    ...(isWorkerProcess() ? [NightAuditProcessor] : []),
  ],
  exports: [
    // For OpsFrontDeskController and OpsMessageTemplatesController in PublicApiModule.
    FrontDeskBoardService,
    MessageTemplatesRepository,
    // Self check-in before arrival (ADR-060).
    SelfCheckInService,
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
    OffersService,
    StayClaimService,
    StayRefundService,
    NightAuditService,
    OwnerDashboardService,
    HousekeepingBoardService,
    WorkOrdersService,
    LostFoundService,
    StaffPhoneService,
    WorkOrderTimeService,
  ],
})
export class OperationsModule {}
