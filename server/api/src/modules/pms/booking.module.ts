import { Module } from '@nestjs/common';

import { isWorkerProcess } from '../../shared/process/process-role';
import { EbmModule } from '../platform/fiscal/ebm.module';
import { GuestsModule } from '../guests/guests.module';
import { ListingModule } from '../listing/listing.module';
import { MailerModule } from '../mailer/mailer.module';
import { OperationsModule } from '../operations/operations.module';
import { OutletsModule } from '../outlets/outlets.module';
import { OrganizationModule } from '../organization/organization.module';
import { PaymentsModule } from '../pay/payments.module';
import { AvailabilityService } from './application/availability.service';
import { PaymentAttemptService } from './application/payment-attempt.service';
import { RegistrationFeePaymentService } from './application/registration-fee-payment.service';
import { REGISTRATION_FEES } from './domain/registration-fees';
import { RegistrationService } from '../organization/application/registration.service';
import { PaymentAttemptRepository } from './infrastructure/payment-attempt.repository';
import { BookingApprovalService } from './application/booking-approval.service';
import { BookingCancellationService } from './application/booking-cancellation.service';
import { BookingChangeService } from './application/booking-change.service';
import { DeskReservationService } from './application/desk-reservation.service';
import { DeskReservationRepository } from './infrastructure/desk-reservation.repository';
import { StayCompletionService } from './application/stay-completion.service';
import { BookingChangeRepository } from './infrastructure/booking-change.repository';
import { StayCompletionRepository } from './infrastructure/stay-completion.repository';
import { BookingDecisionService } from './application/booking-decision.service';
import { BookingLifecycleService } from './application/booking-lifecycle.service';
import { BookingNotificationsService } from './application/booking-notifications.service';
import { BookingService } from './application/booking.service';
import { BookingMailProcessor } from './infrastructure/booking-mail.processor';
import { BookingMailer } from './infrastructure/booking-mailer';
import { RefundMailer } from './infrastructure/refund-mailer';
import { RefundLedgerRepository } from './infrastructure/refund-ledger.repository';
import { BookingRefunds } from './application/booking-refunds';
import { RefundOutcomesHandler } from './application/refund-outcomes.handler';
import { CollectionOutcomesHandler } from './application/collection-outcomes.handler';
import { GuestTripsService } from './application/guest-trips.service';
import { GuestRefundsService } from './application/guest-refunds.service';
import { GuestRefundsRepository } from './infrastructure/guest-refunds.repository';
import { OperatorReservationsService } from './application/operator-reservations.service';
import { BookingLifecycleProcessor } from './infrastructure/booking-lifecycle.processor';
import { BookingRepository } from './infrastructure/booking.repository';
import { GuestTripsRepository } from './infrastructure/guest-trips.repository';
import { PaymentCompensationProcessor } from './infrastructure/payment-compensation.processor';
import { PayerNumberPurgeRepository } from './infrastructure/payer-number-purge.repository';
import { FolioService } from './application/folio.service';
import { FrontDeskBoardService } from './application/front-desk-board.service';
import { FrontDeskService } from './application/front-desk.service';
import { StaysOverviewService } from './application/stays-overview.service';
import { StaysOverviewRepository } from './infrastructure/stays-overview.repository';
import { HousekeepingBoardService } from './application/housekeeping-board.service';
import { HousekeepingService } from './application/housekeeping.service';
import { LostFoundService } from './application/lost-found.service';
import { NightAuditService } from './application/night-audit.service';
import { OffersService } from './application/offers.service';
import { RevenueService } from './application/revenue.service';
import { RoomAssignmentService } from './application/room-assignment.service';
import { SelfCheckInService } from './application/self-check-in.service';
import { StaffPhoneService } from './application/staff-phone.service';
import { StayClaimService } from './application/stay-claim.service';
import { StayRefundService } from './application/stay-refund.service';
import { TicketLifecycle } from './application/ticket-lifecycle';
import { WorkOrderTimeService } from './application/work-order-time.service';
import { WorkOrdersService } from './application/work-orders.service';
import { FolioRepository } from './infrastructure/folio.repository';
import { FrontDeskBoardRepository } from './infrastructure/front-desk-board.repository';
import { FrontDeskRepository } from './infrastructure/front-desk.repository';
import { HousekeepingBoardRepository } from './infrastructure/housekeeping-board.repository';
import { HousekeepingRepository } from './infrastructure/housekeeping.repository';
import { LostFoundRepository } from './infrastructure/lost-found.repository';
import { NightAuditProcessor } from './infrastructure/night-audit.processor';
import { OffersRepository } from './infrastructure/offers.repository';
import { PreArrivalIdentityRepository } from './infrastructure/pre-arrival-identity.repository';
import { RevenueRepository } from './infrastructure/revenue.repository';
import { RoomAssignmentRepository } from './infrastructure/room-assignment.repository';
import { StaffPhoneRepository } from './infrastructure/staff-phone.repository';
import { StayClaimRepository } from './infrastructure/stay-claim.repository';
import { StayInvitationMailer } from './infrastructure/stay-invitation.mailer';
import { StayRefundRepository } from './infrastructure/stay-refund.repository';
import { WorkOrdersRepository } from './infrastructure/work-orders.repository';

/**
 * `EbmModule` is imported here and nowhere else, and that is the whole of what
 * puts `EbmReceiptService` in the graph.
 *
 * The module was written, exported and never imported by anything, so the
 * service it provides was unreachable at runtime — which is why
 * `GET /bookings/:reference/receipt` could not be mounted until now. It is
 * `@Global`, so importing it once here makes the receipt service resolvable in
 * `PublicApiModule` (where `BookingsController` lives) without that module
 * having to restate the import, and without this module re-providing the
 * service and giving the process a second VSDC seam.
 *
 * The booking module is the right single importer because a receipt is issued
 * FOR a booking: the EBM repository reads the booking row, and every other
 * surface that will print one (the operator desk, oversight) reaches it through
 * a booking too.
 */
@Module({
  imports: [
    ListingModule,
    OperationsModule,
    // Guest ordering and order payment: a payment attempt settles a pay now order (ADR-074 stage 5).
    OutletsModule,
    PaymentsModule,
    EbmModule,
    /*
     * A registration fee is a payment attempt like a booking's, and settling it
     * settles the registration (073-gtbank-payments AC-16). Organization imports
     * nothing that reaches back here, so this adds no cycle, and the worker's
     * sweep can settle a fee nobody is polling.
     */
    OrganizationModule,
    /*
     * `BookingMailer` composes words over `MAILER_PORT`, and the port lives on
     * the mailer seam — the one wiring point for mail in this service
     * (AGENTS.md § Infrastructure). Without this import the whole API refuses to
     * BOOT: `Nest can't resolve dependencies of the BookingMailer (?)`, which is
     * a start-up failure rather than a failing route, so every endpoint is down
     * until it is here. `AuthModule` imports it the same way for `OtpMailer`.
     */
    MailerModule,
    // Check-in files the guests in the guest register (0115): `HotelGuestFilingService`.
    GuestsModule,
  ],
  providers: [
    BookingRepository,
    BookingService,
    // What is left to sell, per night. It depends on ListingService for the
    // room type, which is why the visibility rule (active room, published
    // listing) is enforced without this service restating it.
    AvailabilityService,
    // The one implementation of approve/decline (review 1.1); both the guest
    // and the operator services delegate to it.
    BookingDecisionService,
    BookingApprovalService,
    BookingCancellationService,
    BookingLifecycleService,
    OperatorReservationsService,
    // The desk's changes to a confirmed reservation: dates, room type, party (0120).
    BookingChangeRepository,
    BookingChangeService,
    DeskReservationService,
    DeskReservationRepository,
    // The guest's own read of their own bookings. Its own repository, so the
    // 34 KB write-path one does not grow a thirteenth concern.
    GuestTripsRepository,
    GuestTripsService,
    // The payer's own refunds and the payee form (073-gtbank-payments AC-12).
    GuestRefundsRepository,
    GuestRefundsService,
    /*
     * Telling the guest what happened to their booking (ADR-047).
     *
     * `BookingNotificationsService` is provided in BOTH processes because the
     * HTTP one raises the jobs; `BookingMailProcessor` is worker-only, like
     * every other processor here, so the API never consumes a queue. The
     * `BookingMailer` itself is provided in both: it is a pure composer of
     * words over `MAILER_PORT` and costs nothing where it is unused, and
     * splitting it would put the words behind a process check.
     */
    BookingNotificationsService,
    BookingMailer,
    RefundMailer,
    /*
     * Cancel now, refund owed (073-gtbank-payments AC-13). The planner writes
     * a refund owed inside a booking's own transaction; the handler hears the
     * bank's answer from the payments module, in BOTH processes, because
     * whichever process applied the verdict applies its consequences.
     */
    BookingRefunds,
    RefundLedgerRepository,
    RefundOutcomesHandler,
    // What two people decided about a collection: received after all, or a
    // reversal that cancels what it paid for (073 AC-20, AC-21).
    CollectionOutcomesHandler,
    /*
     * The wait between "we asked" and "they paid" (ADR-047 D-j).
     *
     * Provided in BOTH processes, unlike the processors: the HTTP one begins an
     * attempt when a capture comes back pending and answers the guest's poll,
     * and the worker one expires the prompts nobody answered.
     */
    PaymentAttemptRepository,
    PaymentAttemptService,
    RegistrationFeePaymentService,
    // The attempt service completes a fee through this narrow port (073 AC-16).
    { provide: REGISTRATION_FEES, useExisting: RegistrationService },
    /*
     * The desk, the stay, the bill and the rooms (ADR-074 stage 4): PMS's
     * services that sat in OperationsModule until then. They use departments
     * through OperationsModule's exports and the pay now settlement through
     * OutletsModule's, and other products reach the folio only through
     * FolioModule's port.
     */
    FrontDeskRepository,
    FrontDeskService,
    // A stay business's overview: the week's arrivals, stays and money (2026-10-29).
    StaysOverviewService,
    StaysOverviewRepository,
    // Check out settles the stay: the host's payout and any credit left on the bill (0117, 0121).
    StayCompletionRepository,
    StayCompletionService,
    // The front desk's day in one read (interface real-data, frontdesk leaf).
    FrontDeskBoardRepository,
    FrontDeskBoardService,
    // Self check-in before arrival (ADR-060).
    PreArrivalIdentityRepository,
    SelfCheckInService,
    RoomAssignmentRepository,
    RoomAssignmentService,
    FolioRepository,
    FolioService,
    NightAuditService,
    HousekeepingRepository,
    HousekeepingService,
    // The operations floor (real-data 1.2.3).
    HousekeepingBoardRepository,
    HousekeepingBoardService,
    OffersRepository,
    OffersService,
    StayClaimRepository,
    StayInvitationMailer,
    StayClaimService,
    StayRefundRepository,
    StayRefundService,
    RevenueRepository,
    RevenueService,
    // The one ticket lifecycle hotel work orders, the tickets board and rentals faults share (WP 4.1).
    TicketLifecycle,
    WorkOrdersRepository,
    WorkOrdersService,
    LostFoundRepository,
    LostFoundService,
    // The staff phone (real-data 1.3.3).
    StaffPhoneRepository,
    StaffPhoneService,
    WorkOrderTimeService,
    ...(isWorkerProcess()
      ? [
          // The night audit posts room charges in the worker only, never as a side effect of a request.
          NightAuditProcessor,
          BookingLifecycleProcessor,
          PaymentCompensationProcessor,
          PayerNumberPurgeRepository,
          BookingMailProcessor,
        ]
      : []),
  ],
  exports: [
    BookingService,
    // Exported for `AvailabilityController` in `PublicApiModule`.
    AvailabilityService,
    // Exported for `BookingsController`, which serves the guest's poll.
    PaymentAttemptService,
    // Exported for `RegistrationsController`'s pay and poll (073 AC-16).
    RegistrationFeePaymentService,
    BookingApprovalService,
    BookingCancellationService,
    OperatorReservationsService,
    // Exported for `OperatorReservationsController`'s change routes (0120).
    BookingChangeService,
    DeskReservationService,
    // Exported for the stay's completion, which refunds a change's unspent credit at check out.
    BookingChangeRepository,
    // Exported for `MeController`, which is the only caller and lives in
    // `PublicApiModule`.
    GuestTripsService,
    GuestRefundsService,
    // For the ops and me controllers in PublicApiModule, and the assistant's tools.
    FrontDeskBoardService,
    SelfCheckInService,
    FrontDeskService,
    StaysOverviewService,
    FolioService,
    RevenueService,
    RoomAssignmentService,
    HousekeepingService,
    OffersService,
    StayClaimService,
    StayRefundService,
    NightAuditService,
    HousekeepingBoardService,
    WorkOrdersService,
    LostFoundService,
    StaffPhoneService,
    WorkOrderTimeService,
  ],
})
export class BookingModule {}
