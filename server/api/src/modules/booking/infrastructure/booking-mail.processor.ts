import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { and, eq, inArray, isNotNull } from 'drizzle-orm';

import {
  bookings,
  orgMemberships,
  properties,
  roomTypes,
  users,
  workspaces,
} from '../../../database/drizzle/schema';
import {
  DRIZZLE,
  type Database,
} from '../../../shared/database/database.module';
import { QUEUES } from '../../../shared/queues/queues.module';
import {
  BOOKING_MAIL_JOB,
  HOST_MAIL_EVENTS,
  type BookingMailJob,
} from '../domain/booking-mail';
import { BookingMailer } from './booking-mailer';
import { reportJobFailure } from '../../../shared/observability/report-job-failure';

/**
 * Sends the booking emails, in the worker (ADR-047).
 *
 * ## Why it reads the booking instead of trusting the job
 *
 * The job carries a booking id and an event name, and nothing else. Everything
 * the mail says is read HERE, at send time, which buys two things.
 *
 * No personal data goes into Redis. A queued job is a row in a second store
 * with its own retention and its own backups; the guest's address, the property
 * and the amount stay in Postgres where the rest of their record is.
 *
 * And a delayed job cannot deliver a stale fact. A "confirmed" mail that sat
 * through four retries while the host declined the booking reads the row as it
 * is now — which is why the send is skipped when the row no longer matches the
 * event, rather than cheerfully telling somebody their cancelled stay is
 * confirmed.
 *
 * ## A guest with no email address
 *
 * `bookings.guest_user_id` is nullable and a user may have signed in by phone
 * (ADR-039), so there may be no address to send to. That is not a failure and
 * must not be retried five times: it is logged once and the job completes. SMS
 * for those guests is owed work, not a bug to throw on.
 */
@Injectable()
@Processor(QUEUES.email)
export class BookingMailProcessor extends WorkerHost {
  private readonly log = new Logger(BookingMailProcessor.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly mailer: BookingMailer,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    // The Email queue is shared. Anything that is not ours is left alone
    // rather than failed — another processor may own it.
    if (job.name !== BOOKING_MAIL_JOB) return;

    const { bookingId, event } = job.data as BookingMailJob;

    const [row] = await this.db
      .select({
        reference: bookings.reference,
        status: bookings.status,
        checkIn: bookings.checkIn,
        checkOut: bookings.checkOut,
        guests: bookings.guestCount,
        grossRwf: bookings.grossRwf,
        nonRefundable: bookings.nonrefundable,
        approvalExpiresAt: bookings.approvalExpiresAt,
        cancelledBy: bookings.cancelledBy,
        refundRwf: bookings.refundRwf,
        workspaceId: bookings.workspaceId,
        guestEmail: users.email,
        guestName: users.name,
        propertyName: properties.name,
        roomTypeName: roomTypes.name,
      })
      .from(bookings)
      .innerJoin(roomTypes, eq(roomTypes.id, bookings.roomTypeId))
      .innerJoin(properties, eq(properties.id, roomTypes.propertyId))
      .leftJoin(users, eq(users.id, bookings.guestUserId))
      .where(eq(bookings.id, bookingId))
      .limit(1);

    if (!row) {
      // The booking is gone. Nothing to say and nobody to say it to; failing
      // would retry this five times against a row that will never exist.
      this.log.warn(`No booking ${bookingId}; dropping its "${event}" mail.`);
      return;
    }

    if (!stillTrue(event, row.status)) {
      this.log.warn(
        `Skipping the "${event}" mail for ${row.reference}: the booking is ` +
          `now "${row.status}", so that sentence is no longer true.`,
      );
      return;
    }

    const facts = {
      reference: row.reference,
      guestEmail: row.guestEmail ?? '',
      guestName: row.guestName ?? null,
      propertyName: row.propertyName,
      roomTypeName: row.roomTypeName,
      checkIn: row.checkIn,
      checkOut: row.checkOut,
      guests: row.guests,
      grossRwf: row.grossRwf ?? null,
      nonRefundable: row.nonRefundable,
      approvalExpiresAt: row.approvalExpiresAt ?? null,
      cancelledBy: row.cancelledBy ?? null,
      refundRwf: row.refundRwf ?? null,
    };

    /*
     * To the property (booking audit, 2026-09-13). Every active owner and
     * manager of the organisation that owns the booking's workspace, the same
     * roles that may approve it (F-B06). No manager with an address is logged,
     * not thrown: retrying cannot create one.
     */
    if (HOST_MAIL_EVENTS.has(event)) {
      const managers = await this.db
        .select({ email: users.email, name: users.name })
        .from(workspaces)
        .innerJoin(orgMemberships, eq(orgMemberships.orgId, workspaces.orgId))
        .innerJoin(users, eq(users.id, orgMemberships.userId))
        .where(
          and(
            eq(workspaces.id, row.workspaceId),
            eq(orgMemberships.status, 'active'),
            inArray(orgMemberships.orgRole, ['owner', 'manager']),
            isNotNull(users.email),
          ),
        );
      if (managers.length === 0) {
        this.log.warn(`No manager of ${row.reference}'s property has an email address; its "${event}" mail was not sent.`);
        return;
      }
      for (const manager of managers) {
        await this.mailer.send(event, facts, manager.email!, manager.name ?? null);
      }
      this.log.log(`Sent the "${event}" mail for ${row.reference} to ${managers.length} manager(s).`);
      return;
    }

    if (!row.guestEmail) {
      this.log.warn(
        `Booking ${row.reference} has no guest email address, so its ` +
          `"${event}" mail cannot be sent. (Phone-only guests need SMS.)`,
      );
      return;
    }

    await this.mailer.send(event, { ...facts, guestEmail: row.guestEmail });

    this.log.log(`Sent the "${event}" mail for ${row.reference}.`);
  }

  /** A job failing its last attempt is reported (ADR-063 AC-12). Earlier attempts are retries. */
  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, error: Error): void {
    reportJobFailure(QUEUES.email, job, error);
  }
}

/**
 * Does this event still describe the booking as it stands?
 *
 * The guard exists because a queued mail can outlive the fact it was queued
 * for. A `request_sent` that retries after the host has already answered would
 * tell the guest to wait for a decision that has been made; a `confirmed` that
 * retries after a cancellation would tell them a room is held that is not.
 *
 * The two refusal mails are exempt on purpose: `declined` and `expired` both
 * land on a `declined` row, and both are the one message a guest must receive
 * even if everything else about the record has moved on.
 */
function stillTrue(event: string, status: string): boolean {
  switch (event) {
    case 'confirmed':
    case 'approved':
      return status === 'confirmed';
    case 'request_sent':
    case 'host_request':
      return status === 'pending_approval';
    case 'cancelled':
    case 'host_guest_cancelled':
      return status === 'cancelled';
    case 'declined':
    case 'expired':
      return status === 'declined';
    default:
      return false;
  }
}
