import { Module } from '@nestjs/common';

import { isWorkerProcess } from '../../shared/process/process-role';
import { EbmModule } from '../ebm/ebm.module';
import { ListingModule } from '../listing/listing.module';
import { MailerModule } from '../mailer/mailer.module';
import { OperationsModule } from '../operations/operations.module';
import { OrganizationModule } from '../organization/organization.module';
import { PaymentsModule } from '../payments/payments.module';
import { AvailabilityService } from './application/availability.service';
import { PaymentAttemptService } from './application/payment-attempt.service';
import { RegistrationFeePaymentService } from './application/registration-fee-payment.service';
import { REGISTRATION_FEES } from './domain/registration-fees';
import { RegistrationService } from '../organization/application/registration.service';
import { PaymentAttemptRepository } from './infrastructure/payment-attempt.repository';
import { BookingApprovalService } from './application/booking-approval.service';
import { BookingCancellationService } from './application/booking-cancellation.service';
import { BookingChangeService } from './application/booking-change.service';
import { BookingChangeRepository } from './infrastructure/booking-change.repository';
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
    ...(isWorkerProcess()
      ? [
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
    // Exported for the stay's completion, which refunds a change's unspent credit at check out.
    BookingChangeRepository,
    // Exported for `MeController`, which is the only caller and lives in
    // `PublicApiModule`.
    GuestTripsService,
    GuestRefundsService,
  ],
})
export class BookingModule {}
