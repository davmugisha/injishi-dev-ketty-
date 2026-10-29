import { describe, expect, it } from 'vitest';

import type { MailMessage, MailerPort } from '../../mailer/domain/mailer-port';
import { BOOKING_MAIL_EVENTS, bookingMailJobId } from '../domain/booking-mail';
import { BookingMailer, type BookingMailFacts } from './booking-mailer';

/**
 * What a guest is actually told (ADR-047).
 *
 * These are not spelling tests. Each one pins a promise the product makes in
 * writing, in an email a person keeps, at a moment when they are deciding
 * whether to trust us with money — which is why the copy is asserted rather
 * than left to whoever edits the template next.
 */
describe('BookingMailer', () => {
  function recorder(): MailerPort & { sent: MailMessage[] } {
    const sent: MailMessage[] = [];
    return {
      sent,
      send: async (message) => {
        sent.push(message);
      },
    };
  }

  const facts: BookingMailFacts = {
    reference: 'BK-7Q2M-4XKD',
    guestEmail: 'guest@example.com',
    guestName: 'Aline Uwase',
    propertyName: 'Umurage Guesthouse',
    roomTypeName: 'Standard Room',
    checkIn: '2026-10-02',
    checkOut: '2026-10-05',
    guests: 2,
    grossRwf: 189_000,
    nonRefundable: false,
    approvalExpiresAt: new Date('2026-09-13T09:00:00Z'),
  };

  it.each(BOOKING_MAIL_EVENTS)(
    'puts the booking reference in the subject line of the "%s" mail',
    async (event) => {
      const mailer = recorder();
      await new BookingMailer(mailer).send(event, facts);

      // The reference is the key to the guest's own fiscal receipt and the
      // thing they read out at a front desk. It has to survive being skimmed
      // in a notification and found later by searching a mailbox.
      expect(mailer.sent[0].subject).toContain('BK-7Q2M-4XKD');
      expect(mailer.sent[0].to).toBe('guest@example.com');
    },
  );

  it.each(BOOKING_MAIL_EVENTS)(
    'never sends the "%s" mail with an empty body',
    async (event) => {
      const mailer = recorder();
      await new BookingMailer(mailer).send(event, facts);
      expect(mailer.sent[0].text.trim().length).toBeGreaterThan(80);
    },
  );

  it.each(['declined', 'expired'] as const)(
    'leads the "%s" mail with the refund, not with the refusal',
    async (event) => {
      const mailer = recorder();
      await new BookingMailer(mailer).send(event, facts);

      const body = mailer.sent[0].text;
      const refundAt = body.indexOf('refunded to you in full');
      const refusalAt = Math.max(
        body.indexOf('not able to take'),
        body.indexOf('did not answer'),
      );

      // "We could not take your booking" is not the question a person has when
      // they read that sentence. Where their money went is.
      expect(refundAt).toBeGreaterThan(-1);
      expect(refundAt).toBeLessThan(refusalAt);
      expect(mailer.sent[0].subject).toContain('Refunded in full');
    },
  );

  it('tells a request-to-book guest the money is held and NOT paid out', async () => {
    const mailer = recorder();
    await new BookingMailer(mailer).send('request_sent', facts);

    const body = mailer.sent[0].text;
    expect(body).toContain('held in escrow');
    expect(body).toContain('NOT paid to anyone yet');
    // The whole anxiety of a pending request is "have I lost my money".
    expect(body).toContain('comes back to you in full');
  });

  it('states the non-refundable terms only when that rate was chosen', async () => {
    const mailer = recorder();
    await new BookingMailer(mailer).send('confirmed', {
      ...facts,
      nonRefundable: true,
    });
    expect(mailer.sent[0].text).toContain('non-refundable rate');

    const other = recorder();
    await new BookingMailer(other).send('confirmed', facts);
    expect(other.sent[0].text).not.toContain('non-refundable rate');
  });

  it('formats money the way the rest of the product does, and never invents it', async () => {
    const mailer = recorder();
    await new BookingMailer(mailer).send('confirmed', facts);
    expect(mailer.sent[0].text).toContain('RWF 189,000');

    // A row with no locked total must not become "RWF 0" in writing.
    const unpriced = recorder();
    await new BookingMailer(unpriced).send('confirmed', { ...facts, grossRwf: null });
    expect(unpriced.sent[0].text).not.toContain('RWF 0');
    expect(unpriced.sent[0].text).toContain('the amount you paid');
  });

  it('greets a guest with no name on file without an empty gap', async () => {
    const mailer = recorder();
    await new BookingMailer(mailer).send('confirmed', { ...facts, guestName: null });
    expect(mailer.sent[0].text.startsWith('Hi,')).toBe(true);
  });
});

describe('bookingMailJobId', () => {
  it('is stable per booking and event, so one booking sends one mail', () => {
    const a = bookingMailJobId({ bookingId: 'b1', event: 'confirmed' });
    const b = bookingMailJobId({ bookingId: 'b1', event: 'confirmed' });
    expect(a).toBe(b);
  });

  it('separates the events, so a decline is not swallowed by a confirmation', () => {
    expect(bookingMailJobId({ bookingId: 'b1', event: 'confirmed' })).not.toBe(
      bookingMailJobId({ bookingId: 'b1', event: 'declined' }),
    );
  });
});
