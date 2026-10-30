import { UnprocessableEntityException } from '@nestjs/common';

/** An offline write older than this is refused: a missed punch fix puts it right instead. */
export const MAX_REPORTED_AGE_DAYS = 7;

/** A punch that arrives later than this after its tap is flagged `late_sync` for a person to confirm. */
export const LATE_SYNC_FLAG_MINUTES = 30;

const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;

/** The reported time pair a write may carry (`ReportedTime` in `@injishi/contracts`). */
export interface ReportedTimeInput {
  occurredAt?: string;
  deviceSentAt?: string;
}

export interface ResolvedTime {
  /** The time the write takes effect at: the corrected tap, or `receivedAt` without a pair. */
  at: Date;
  /** The server's clock when the request arrived. */
  receivedAt: Date;
  /** The `occurredAt` the phone sent, kept beside the corrected time for HR; null without a pair. */
  deviceAt: Date | null;
  /** Arrived more than `LATE_SYNC_FLAG_MINUTES` after the corrected tap. */
  lateSync: boolean;
}

/**
 * The one rule for when an offline write happened (mobile spec 0003, cross
 * child contract 1).
 *
 * The phone sends its tap (`occurredAt`) and its clock at the moment of this
 * attempt (`deviceSentAt`). Their difference is how long ago the tap was, on
 * the phone's own clock, so a phone clock that is wrong by hours still gives
 * the right instant: `corrected = occurredAt + (receivedAt - deviceSentAt)`. It
 * is capped at `receivedAt`, because nothing happened in the future. Older than
 * `MAX_REPORTED_AGE_DAYS` is `422 reported_time_too_old`. A request with
 * neither time takes effect at `receivedAt`, exactly as before the rule.
 *
 * Every time rule is a coded `422` here or a clamp, so no reported time can
 * reach a database check.
 */
export function resolveReportedTime(input: ReportedTimeInput, receivedAt: Date): ResolvedTime {
  if (input.occurredAt === undefined || input.deviceSentAt === undefined) {
    return { at: receivedAt, receivedAt, deviceAt: null, lateSync: false };
  }
  const occurred = Date.parse(input.occurredAt);
  const sent = Date.parse(input.deviceSentAt);
  if (Number.isNaN(occurred) || Number.isNaN(sent)) {
    throw new UnprocessableEntityException({ code: 'reported_time_invalid', message: 'That time is not a real instant.' });
  }
  const received = receivedAt.getTime();
  // The tap can never be after the attempt that carries it; a phone that says
  // so is treated as having tapped at the send (the cap at `receivedAt`).
  const corrected = received - Math.max(0, sent - occurred);
  if (received - corrected > MAX_REPORTED_AGE_DAYS * DAY_MS) {
    throw new UnprocessableEntityException({
      code: 'reported_time_too_old',
      message: `This happened more than ${MAX_REPORTED_AGE_DAYS} days ago, so it can't be sent. Ask your manager for a missed punch fix.`,
    });
  }
  return {
    at: new Date(corrected),
    receivedAt,
    deviceAt: new Date(occurred),
    lateSync: received - corrected > LATE_SYNC_FLAG_MINUTES * MINUTE_MS,
  };
}
