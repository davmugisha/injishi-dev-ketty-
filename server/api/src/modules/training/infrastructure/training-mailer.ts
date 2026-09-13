import { Inject, Injectable } from '@nestjs/common';

import {
  MAILER_PORT,
  type MailAttachment,
  type MailerPort,
} from '../../mailer/domain/mailer-port';
import type { TrainingMailEvent } from '../domain/training-mail';

/**
 * What a training email SAYS (ADR-049 AC-20, AC-21).
 *
 * This class owns the words and nothing else. How a message leaves the building
 * is `MailerModule`'s business, exactly as it is for `OtpMailer` and
 * `BookingMailer`.
 *
 * ## The rules the copy follows
 *
 * **Where and when, before anything else.** Every one of these mails is about a
 * person being in a particular room on a particular morning. The date, the time
 * and the address are the message; the rest is context.
 *
 * **The times are Kigali times.** Printed in `Africa/Kigali` with the zone
 * named, because a learner reading this on a phone that is roaming must not
 * have to work out whose clock the mail meant.
 *
 * **It says attended, never qualified** (AC-31). No assessment took place. The
 * certificate mail, the PDF and the public verification page all use the same
 * word, and this file is one of the three places that promise is kept.
 *
 * **A change of plan leads with what it means for the reader.** A reschedule
 * mail opens with the new time, not with an apology, and a cancellation says
 * the session is off in the first line. The trainer's reason follows; it is
 * the explanation, not the news.
 *
 * **Money is printed as stored.** The fee comes off the registration row, where
 * it was copied at registration (AC-33), and is never recomputed from the
 * session — a mail that helpfully re-derived it would eventually disagree, in
 * writing, with what somebody was told when they signed up.
 */
export interface TrainingMailFacts {
  learnerEmail: string;
  learnerName: string | null;
  courseTitle: string;
  startsAt: Date;
  endsAt: Date;
  venueName: string;
  venueAddress: string;
  districtName: string;
  feeRwf: number | null;
  /** Certificate mail only. */
  serial?: string;
  verifyUrl?: string;
  pdf?: MailAttachment;
  /** Reschedule mail only: where the session used to be. */
  previousStartsAt?: Date;
  /** Reschedule and cancellation: the trainer's own sentence. */
  reason?: string;
  /**
   * Where to find other sessions. Built from the same origin the verification
   * link uses, so a demo mail sends people to the demo site rather than to
   * production, for the reason ADR-049 gives `TRAINING_VERIFY_BASE_URL`.
   */
  trainingUrl: string;
}

@Injectable()
export class TrainingMailer {
  constructor(@Inject(MAILER_PORT) private readonly mailer: MailerPort) {}

  async send(event: TrainingMailEvent, facts: TrainingMailFacts): Promise<void> {
    const { subject, body } = compose(event, facts);
    await this.mailer.send({
      to: facts.learnerEmail,
      subject,
      text: body,
      // Only the certificate mail carries one, and it carries it only when the
      // processor found the stored file. See `training-mail.processor.ts`.
      ...(facts.pdf ? { attachments: [facts.pdf] } : {}),
    });
  }
}

/** `45000` to `RWF 45,000`. The one place this mail formats money. */
function money(amountRwf: number | null): string {
  if (amountRwf === null || amountRwf === 0) return 'Free';
  return `RWF ${amountRwf.toLocaleString('en-RW')}`;
}

const KIGALI = 'Africa/Kigali';

/** `Sun 20 Sep 2026`, the way the training pages print a day. */
const LONG_DATE = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: KIGALI,
});

/** `09:30`. 24 hour, because a training day starts early and ends late. */
const TIME = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: KIGALI,
});

function day(at: Date): string {
  return LONG_DATE.format(at);
}

function when(startsAt: Date, endsAt: Date): string {
  return `${day(startsAt)}, ${TIME.format(startsAt)} to ${TIME.format(endsAt)} (Kigali time)`;
}

function greeting(name: string | null): string {
  return name ? `Hi ${name.split(' ')[0]},` : 'Hi,';
}

/** The session, in the block every one of these mails repeats. */
function sessionBlock(f: TrainingMailFacts): string {
  return [
    `  Course      ${f.courseTitle}`,
    `  When        ${when(f.startsAt, f.endsAt)}`,
    `  Where       ${f.venueName}, ${f.venueAddress}`,
    `  District    ${f.districtName}`,
    `  Fee         ${money(f.feeRwf)}`,
  ].join('\n');
}

const SIGN_OFF = ['', 'Injishi Training', 'injishi.rw'].join('\n');

/**
 * One event to one subject line and one body.
 *
 * A `switch` returning both halves together, so a subject can never drift from
 * the body it announces. The same shape `booking-mailer.ts` uses.
 */
function compose(
  event: TrainingMailEvent,
  f: TrainingMailFacts,
): { subject: string; body: string } {
  switch (event) {
    case 'registered':
      return {
        subject: `You are registered: ${f.courseTitle}, ${day(f.startsAt)}`,
        body: [
          greeting(f.learnerName),
          '',
          'Your place on this training session is booked.',
          '',
          sessionBlock(f),
          '',
          'Come on the day and the trainer will tick you off the roster.',
          'Attending is the only thing that issues your certificate, so being',
          'in the room is what matters.',
          '',
          'We will send you a reminder the day before.',
          SIGN_OFF,
        ].join('\n'),
      };

    case 'reminder':
      return {
        subject: `Tomorrow: ${f.courseTitle}, ${TIME.format(f.startsAt)}`,
        body: [
          greeting(f.learnerName),
          '',
          'Your training session is tomorrow.',
          '',
          sessionBlock(f),
          '',
          'Give yourself time to find the place. The trainer marks the roster',
          'on the day, and your certificate follows from that mark.',
          SIGN_OFF,
        ].join('\n'),
      };

    case 'certificate_issued':
      return {
        subject: `Your certificate: ${f.courseTitle} (${f.serial ?? ''})`.trim(),
        body: [
          greeting(f.learnerName),
          '',
          `You attended ${f.courseTitle} on ${day(f.startsAt)}, and your`,
          'certificate is attached to this email.',
          '',
          `  Serial      ${f.serial ?? ''}`,
          `  Verify at   ${f.verifyUrl ?? ''}`,
          '',
          'Anybody you show it to can scan the code on it, or open that link,',
          'and see that it is genuine. They do not need an account to do it.',
          '',
          'Keep the serial. It is short enough to read down a phone line if',
          'somebody needs to check the certificate and cannot scan it.',
          SIGN_OFF,
        ].join('\n'),
      };

    case 'rescheduled':
      return {
        subject: `Moved: ${f.courseTitle} is now ${day(f.startsAt)}`,
        body: [
          greeting(f.learnerName),
          '',
          'Your training session has been moved. The new time is:',
          '',
          sessionBlock(f),
          '',
          ...(f.previousStartsAt
            ? [`It was ${day(f.previousStartsAt)}, ${TIME.format(f.previousStartsAt)}.`, '']
            : []),
          ...(f.reason ? [`The trainer says: ${f.reason}`, ''] : []),
          'Your place is still booked. You do not need to register again.',
          'If the new time does not work for you, you can withdraw from the',
          'session and register for another one.',
          SIGN_OFF,
        ].join('\n'),
      };

    case 'cancelled':
      return {
        subject: `Cancelled: ${f.courseTitle}, ${day(f.startsAt)}`,
        body: [
          greeting(f.learnerName),
          '',
          'This training session has been cancelled and will not run.',
          '',
          sessionBlock(f),
          '',
          ...(f.reason ? [`The reason given: ${f.reason}`, ''] : []),
          'Your place has been released, so there is nothing for you to do.',
          'Other sessions of this course are listed here, and registering for',
          'one takes a minute:',
          '',
          `  ${f.trainingUrl}`,
          '',
          'If you were already marked as having attended an earlier part of',
          'this session, that still stands and your certificate is unaffected.',
          SIGN_OFF,
        ].join('\n'),
      };
  }
}
