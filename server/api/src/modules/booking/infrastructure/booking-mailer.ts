import { TOURISM_TAX_LABEL, tourismTaxIncludedRwf } from '@injishi/contracts';
import { Inject, Injectable } from '@nestjs/common';

import {
  MAILER_PORT,
  type MailerPort,
} from '../../mailer/domain/mailer-port';
import type { BookingMailEvent } from '../domain/booking-mail';

/**
 * What a booking email SAYS (ADR-047).
 *
 * This class owns the words and nothing else — how a message leaves the
 * building is `MailerModule`'s business, exactly as it is for `OtpMailer`.
 *
 * ## The rules the copy follows
 *
 * **The reference is in the subject line.** It is the key to the guest's own
 * fiscal receipt and the thing they read out at a front desk, so it has to
 * survive being skimmed in a notification and found later by search. It was
 * previously shown on one screen, once, and never written down anywhere.
 *
 * **Money is never re-derived here.** The amount comes off the booking row as
 * stored, because it was locked at sale (D8). An email that helpfully
 * recomputed a total would eventually disagree with the charge, in writing.
 *
 * **A refusal says what happens to the money, first.** "The host could not take
 * your booking" is not the question a person has when they read that sentence.
 * Every declined and expired mail leads with the refund.
 *
 * **Nothing here claims a payment landed.** The subject of a confirmation is
 * that the room is held and the money is in escrow — which is what escrow
 * means, and is true whatever the provider does next.
 */
export interface BookingMailFacts {
  reference: string;
  guestEmail: string;
  guestName: string | null;
  propertyName: string;
  roomTypeName: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  grossRwf: number | null;
  nonRefundable: boolean;
  /** When a `request_to_book` auto-declines, for the request mail. */
  approvalExpiresAt: Date | null;
  /** On a cancelled booking: who cancelled, and what went back. */
  cancelledBy?: string | null;
  refundRwf?: number | null;
}

@Injectable()
export class BookingMailer {
  constructor(@Inject(MAILER_PORT) private readonly mailer: MailerPort) {}

  /**
   * `to` is the guest unless given. A `host_*` event is sent once per manager
   * of the property, each with their own address, and never copies the guest's.
   */
  async send(
    event: BookingMailEvent,
    facts: BookingMailFacts,
    to: string = facts.guestEmail,
    recipientName: string | null = facts.guestName,
  ): Promise<void> {
    const { subject, body } = compose(event, { ...facts, guestName: recipientName }, facts.guestName);
    await this.mailer.send({
      to,
      subject,
      text: body,
    });
  }
}

/** `189000` → `RWF 189,000`. The one place this mail formats money. */
function money(amountRwf: number | null): string {
  if (amountRwf === null) return 'the amount you paid';
  return `RWF ${amountRwf.toLocaleString('en-RW')}`;
}

/**
 * The tourism tax inside a stay's price (2026-10-30): 3%, included, never added. Said after the amount
 * the guest paid, so the receipt-like line reads whole; nothing when there is no amount.
 */
function taxLine(grossRwf: number | null): string {
  const tax = grossRwf === null ? 0 : tourismTaxIncludedRwf(grossRwf);
  return tax > 0 ? ` It includes ${money(tax)} ${TOURISM_TAX_LABEL}.` : '';
}

/** `2026-09-20` → `Sun 20 Sep 2026`, the way the confirmation screen prints it. */
const LONG_DATE = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

function day(iso: string): string {
  return LONG_DATE.format(new Date(`${iso}T00:00:00Z`));
}

function greeting(name: string | null): string {
  return name ? `Hi ${name.split(' ')[0]},` : 'Hi,';
}

/** The stay, in the three lines every one of these mails repeats. */
function stayBlock(f: BookingMailFacts): string {
  return [
    `  Reference   ${f.reference}`,
    `  Property    ${f.propertyName}`,
    `  Room        ${f.roomTypeName}`,
    `  Dates       ${day(f.checkIn)} to ${day(f.checkOut)}`,
    `  Guests      ${f.guests}`,
  ].join('\n');
}

function compose(
  event: BookingMailEvent,
  f: BookingMailFacts,
  guestName: string | null = f.guestName,
): { subject: string; body: string } {
  const hi = greeting(f.guestName);
  const stay = stayBlock(f);
  const receipt =
    'Your receipt, including the RRA e-invoice issued under the host\'s TIN, ' +
    `opens from your booking reference ${f.reference} in Trips on Injishi.`;

  switch (event) {
    case 'confirmed':
      return {
        subject: `You're booked at ${f.propertyName} — ${f.reference}`,
        body: [
          hi,
          '',
          `Your room is held. ${money(f.grossRwf)} is in escrow and stays there until you check in — the host is paid after your stay, not before.${taxLine(f.grossRwf)}`,
          '',
          stay,
          '',
          f.nonRefundable
            ? 'You chose the non-refundable rate, so this booking is not refundable if you cancel.'
            : 'Your cancellation terms are on the booking in Trips.',
          '',
          receipt,
          '',
          'Keep the reference handy for the front desk.',
        ].join('\n'),
      };

    case 'request_sent':
      return {
        subject: `Request sent to ${f.propertyName} — ${f.reference}`,
        body: [
          hi,
          '',
          `Your request is with the host. ${money(f.grossRwf)} has been taken and is held in escrow — it is NOT paid to anyone yet, and it comes back to you in full if the host declines or does not answer in time.${taxLine(f.grossRwf)}`,
          '',
          stay,
          '',
          f.approvalExpiresAt
            ? `The host has until ${day(f.approvalExpiresAt.toISOString().slice(0, 10))} to answer. After that the request is declined automatically and you are refunded in full.`
            : 'If the host does not answer in time, the request is declined automatically and you are refunded in full.',
          '',
          'We will email you either way. You do not need to do anything.',
        ].join('\n'),
      };

    case 'approved':
      return {
        subject: `${f.propertyName} confirmed your stay — ${f.reference}`,
        body: [
          hi,
          '',
          'The host has confirmed your booking. Your room is held.',
          '',
          stay,
          '',
          `${money(f.grossRwf)} stays in escrow until you check in.`,
          '',
          receipt,
        ].join('\n'),
      };

    case 'declined':
      return {
        subject: `Refunded in full — ${f.reference}`,
        body: [
          hi,
          '',
          `${money(f.grossRwf)} is being refunded to you in full. Nothing has been kept and there is no fee.`,
          '',
          `${f.propertyName} was not able to take this booking.`,
          '',
          stay,
          '',
          'Refunds reach a mobile money account within a few minutes and a card within a few working days, depending on your bank.',
          '',
          'Those dates may still be available elsewhere — you can search again on Injishi.',
        ].join('\n'),
      };

    case 'expired':
      return {
        subject: `Refunded in full — ${f.reference}`,
        body: [
          hi,
          '',
          `${money(f.grossRwf)} is being refunded to you in full. Nothing has been kept and there is no fee.`,
          '',
          `${f.propertyName} did not answer your request inside the time they have to answer it, so the request was declined automatically. This is on the property, not on you or your payment.`,
          '',
          stay,
          '',
          'Refunds reach a mobile money account within a few minutes and a card within a few working days, depending on your bank.',
          '',
          'Those dates may still be available elsewhere — you can search again on Injishi.',
        ].join('\n'),
      };

    case 'cancelled': {
      const refunded = f.refundRwf ?? 0;
      const byHost = f.cancelledBy === 'host';
      return {
        subject: `${byHost ? `${f.propertyName} cancelled your booking` : 'Booking cancelled'} — ${f.reference}`,
        body: [
          hi,
          '',
          refunded > 0
            ? `${money(refunded)} is being refunded to you${f.grossRwf !== null && refunded >= f.grossRwf ? ' in full' : ''}.`
            : 'No refund is due under the cancellation terms of this booking.',
          f.grossRwf !== null && refunded < f.grossRwf
            ? `${money(f.grossRwf - refunded)} is kept under the terms you booked on.`
            : '',
          '',
          byHost
            ? `${f.propertyName} cancelled this booking. When the property cancels, you are always refunded in full.`
            : 'You cancelled this booking.',
          '',
          stay,
          '',
          refunded > 0
            ? 'Refunds reach a mobile money account within a few minutes and a card within a few working days, depending on your bank.'
            : '',
        ]
          .filter((line, i, all) => line !== '' || (all[i - 1] ?? '') !== '')
          .join('\n'),
      };
    }

    case 'host_request':
      return {
        subject: `New booking request to answer — ${f.reference}`,
        body: [
          hi,
          '',
          `${guestName ?? 'A guest'} has asked to stay at ${f.propertyName}. ${money(f.grossRwf)} is already held in escrow.`,
          '',
          stay,
          '',
          f.approvalExpiresAt
            ? `Accept or decline it by ${day(f.approvalExpiresAt.toISOString().slice(0, 10))}. If nobody answers by then, the request is declined automatically and the guest is refunded in full.`
            : 'If nobody answers in time, the request is declined automatically and the guest is refunded in full.',
          '',
          'Answer it from Reservations in the Injishi operator app.',
        ].join('\n'),
      };

    case 'host_confirmed':
      return {
        subject: `New booking at ${f.propertyName} — ${f.reference}`,
        body: [
          hi,
          '',
          `${guestName ?? 'A guest'} has booked ${f.propertyName}. The booking is confirmed and ${money(f.grossRwf)} is held in escrow until the stay.`,
          '',
          stay,
          '',
          'It is on Reservations in the Injishi operator app. The money is paid out to your payout account after the guest checks out.',
        ].join('\n'),
      };

    case 'host_guest_cancelled':
      return {
        subject: `A guest cancelled — ${f.reference}`,
        body: [
          hi,
          '',
          `${guestName ?? 'The guest'} cancelled their booking at ${f.propertyName}. The room is available again for those dates.`,
          '',
          stay,
          '',
          f.grossRwf !== null && (f.refundRwf ?? 0) < f.grossRwf
            ? `Under the booking's cancellation terms, ${money(f.grossRwf - (f.refundRwf ?? 0))} stays in escrow for the property.`
            : 'The guest is being refunded in full under the booking\'s cancellation terms.',
        ].join('\n'),
      };

    case 'host_payment_reversed':
      return {
        subject: `Payment reversed, booking cancelled — ${f.reference}`,
        body: [
          hi,
          '',
          `The bank reversed ${guestName ? `${guestName}'s` : 'the guest\'s'} payment for this booking at ${f.propertyName}, so the booking is cancelled. The room is available again for those dates.`,
          '',
          stay,
          '',
          'Nothing is paid out to the property for this booking, and nothing is refunded: the guest already has the money back through the reversal.',
        ].join('\n'),
      };
  }
}
