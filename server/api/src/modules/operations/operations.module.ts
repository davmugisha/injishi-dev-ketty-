import { Module } from '@nestjs/common';

import { isWorkerProcess } from '../../shared/process/process-role';
import { DepartmentsService } from './application/departments.service';
import { FolioService } from '../pms/application/folio.service';
import { FrontDeskService } from '../pms/application/front-desk.service';
import { FrontDeskBoardService } from '../pms/application/front-desk-board.service';
import { SelfCheckInService } from '../pms/application/self-check-in.service';
import { HousekeepingService } from '../pms/application/housekeeping.service';
// The new interface's operations floor (real-data 1.2.3).
import { HousekeepingBoardService } from '../pms/application/housekeeping-board.service';
import { LostFoundService } from '../pms/application/lost-found.service';
import { WorkOrdersService } from '../pms/application/work-orders.service';
// The one ticket lifecycle hotel work orders, the tickets board and rentals faults share (WP 4.1).
import { TicketLifecycle } from '../pms/application/ticket-lifecycle';
import { HousekeepingBoardRepository } from '../pms/infrastructure/housekeeping-board.repository';
import { LostFoundRepository } from '../pms/infrastructure/lost-found.repository';
import { WorkOrdersRepository } from '../pms/infrastructure/work-orders.repository';
// The staff phone (real-data 1.3.3).
import { StaffPhoneService } from '../pms/application/staff-phone.service';
import { WorkOrderTimeService } from '../pms/application/work-order-time.service';
import { StaffPhoneRepository } from '../pms/infrastructure/staff-phone.repository';
import { MessagingService } from './application/messaging.service';
import { NightAuditService } from '../pms/application/night-audit.service';
import { ResidenceService } from './application/residence.service';
import { RevenueService } from '../pms/application/revenue.service';
import { OwnerDashboardService } from './application/owner-dashboard.service';
import { RoomAssignmentService } from '../pms/application/room-assignment.service';
import { ServiceCatalogService } from './application/service-catalog.service';
import { GuestOrderingService } from './application/guest-ordering.service';
import { OrderPaymentService } from './application/order-payment.service';
import { OutletsService } from './application/outlets.service';
import { OffersService } from '../pms/application/offers.service';
import { StayClaimService } from '../pms/application/stay-claim.service';
import { StayRefundService } from '../pms/application/stay-refund.service';
import { DepartmentsRepository } from './infrastructure/departments.repository';
import { FolioRepository } from '../pms/infrastructure/folio.repository';
import { FrontDeskRepository } from '../pms/infrastructure/front-desk.repository';
import { FrontDeskBoardRepository } from '../pms/infrastructure/front-desk-board.repository';
import { MessageTemplatesRepository } from './infrastructure/message-templates.repository';
import { HousekeepingRepository } from '../pms/infrastructure/housekeeping.repository';
import { MessagingRepository } from './infrastructure/messaging.repository';
import { NightAuditProcessor } from '../pms/infrastructure/night-audit.processor';
import { ResidenceRepository } from './infrastructure/residence.repository';
import { RevenueRepository } from '../pms/infrastructure/revenue.repository';
import { OwnerDashboardRepository } from './infrastructure/owner-dashboard.repository';
import { RoomAssignmentRepository } from '../pms/infrastructure/room-assignment.repository';
import { ServiceCatalogRepository } from './infrastructure/service-catalog.repository';
import { GuestOrderingRepository } from './infrastructure/guest-ordering.repository';
import { OutletsRepository } from './infrastructure/outlets.repository';
import { OffersRepository } from '../pms/infrastructure/offers.repository';
import { PreArrivalIdentityRepository } from '../pms/infrastructure/pre-arrival-identity.repository';
import { StayClaimRepository } from '../pms/infrastructure/stay-claim.repository';
import { StayInvitationMailer } from '../pms/infrastructure/stay-invitation.mailer';
import { StayRefundRepository } from '../pms/infrastructure/stay-refund.repository';
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
    DepartmentsService,
    FolioService,
    RevenueService,
    OwnerDashboardService,
    RoomAssignmentService,
    HousekeepingService,
    ServiceCatalogService,
    GuestOrderingService,
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
