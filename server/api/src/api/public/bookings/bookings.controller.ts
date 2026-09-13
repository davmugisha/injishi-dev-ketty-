import {
  CreateBookingInput,
  CreateBookingOutcome,
  type PaymentAttemptStatus,
  type EbmReceipt,
} from '@injishi/contracts';
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { BookingService } from '../../../modules/booking/application/booking.service';
import { PaymentAttemptService } from '../../../modules/booking/application/payment-attempt.service';
import { EbmReceiptService } from '../../../modules/ebm/application/ebm-receipt.service';
import {
  CurrentUser,
  SessionGuard,
  type SessionUser,
} from '../../../shared/auth/session.guard';
import { UserThrottlerGuard } from '../../../shared/http/user-throttler.guard';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';

/**
 * The guest's side of a stay (F-B05, F-B06, C9).
 *
 * `create` is a real charge every time it runs with a fresh attempt token, so
 * it is the one route on this controller with a per-person ceiling (review
 * 2.2): five attempts a minute is more than any checkout needs and less than
 * any abusive or looping client can spend.
 */
@Controller({ path: 'bookings', version: '1' })
@UseGuards(SessionGuard, UserThrottlerGuard)
export class BookingsController {
  constructor(
    private readonly bookings: BookingService,
    private readonly receipts: EbmReceiptService,
    private readonly attempts: PaymentAttemptService,
  ) {}

  @Post()
  @Throttle({ money: { limit: 5, ttl: 60_000 } })
  create(
    @Body(new ZodValidationPipe(CreateBookingInput))
    body: CreateBookingInput,
    @CurrentUser() user: SessionUser,
  ): Promise<CreateBookingOutcome> {
    return this.bookings.create(body, user.id);
  }

  /**
   * The RRA EBM receipt for one of the CALLER'S OWN bookings (C9).
   *
   * `user.id` from `@CurrentUser()` is the whole security control on this
   * route, and it is not interchangeable with anything else. The path segment
   * is the human-facing `BK-XXXX-XXXX` code — eight characters printed on a
   * confirmation email — so a handler that looked the booking up by reference
   * alone, or that took an owner id from the query string, would hand any
   * signed-in person any other guest's fiscal receipt: their dates, the
   * property they stayed at, and the seller's TIN. `receiptForGuest` takes the
   * guest id as its second argument for exactly this reason, and answers a
   * booking that belongs to somebody else with the same 404 as one that does
   * not exist, so the route cannot be used to enumerate stays either.
   *
   * No `ParseUUIDPipe` here, deliberately: a reference is not a uuid, and the
   * service owns what a well-formed one looks like — it upper-cases, shape
   * checks, and answers a malformed reference with the SAME `NotFoundException`
   * as an unknown one. A 400 from a pipe would leak the difference.
   *
   * It inherits the class's `UserThrottlerGuard` rather than opting out. A read
   * of a document keyed by a short, guessable code is precisely the thing that
   * should not be callable in a tight loop, and no guest reloads their own
   * receipt faster than the per-person ceiling allows.
   */
  /**
   * Where did my payment get to? (ADR-047 D-j)
   *
   * The guest's own poll while a mobile money prompt sits on their handset.
   * Scoped by `@CurrentUser()` in the repository, so an attempt token guessed
   * by a stranger finds nothing — the same control the receipt route below
   * relies on, and for the same reason.
   *
   * It is a GET and it is safe to call in a loop: a settled attempt answers
   * from its own row rather than re-asking the provider, and completing one is
   * idempotent through the escrow constraint underneath it. It keeps the
   * class's `UserThrottlerGuard`, so a client polling far too fast is slowed
   * rather than allowed to hammer a payment provider through us.
   */
  @Get('attempts/:attemptToken')
  attempt(
    @Param('attemptToken') attemptToken: string,
    @CurrentUser() user: SessionUser,
  ): Promise<PaymentAttemptStatus> {
    return this.attempts.poll(attemptToken, user.id);
  }

  @Get(':reference/receipt')
  receipt(
    @Param('reference') reference: string,
    @CurrentUser() user: SessionUser,
  ): Promise<EbmReceipt> {
    return this.receipts.receiptForGuest(reference, user.id);
  }

  // The host's approve and decline moved to `BookingDecisionsController`
  // (ADR-049, AC-A5): they act for a business, so they run `WorkspaceGuard`,
  // which this guest controller cannot.
}
