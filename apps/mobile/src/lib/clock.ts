// The server's clock, as the phone learns it (mobile spec 0003, D-ai). A housekeeper's phone may be
// wrong by hours, or reset by the network the moment signal returns, so the phone's "today" and "Sent
// today" use the API's `date` header instead: `clock_offset_ms` is that header minus the phone's clock,
// learned on every answer and kept in `outbox_meta`. It never goes to the server.

import { readMeta, writeMeta } from "@/data/db";

const KEY = "clock_offset_ms";

/** The `date` header has whole seconds; on average the server's clock is half a second past it. */
const HALF_SECOND = 500;

/** A change smaller than this is the header's rounding, not a clock change, and is not written. */
const WRITE_THRESHOLD_MS = 2_000;

let offsetMs: number | null = null;

/** The server's clock minus the phone's, in milliseconds; 0 until an answer has said otherwise. */
export function clockOffsetMs(): number {
  if (offsetMs === null) {
    const kept = Number(readMeta(KEY));
    offsetMs = Number.isFinite(kept) ? kept : 0;
  }
  return offsetMs;
}

/** Now, on the server's clock as far as the phone knows it. */
export function serverNow(): number {
  return Date.now() + clockOffsetMs();
}

/** Learn the offset from an answer's `date` header. */
export function learnServerDate(date: string | undefined): void {
  if (!date) return;
  const server = Date.parse(date);
  if (Number.isNaN(server)) return;
  const learned = server + HALF_SECOND - Date.now();
  const previous = clockOffsetMs();
  offsetMs = learned;
  if (Math.abs(learned - previous) >= WRITE_THRESHOLD_MS) writeMeta(KEY, String(Math.round(learned)));
}
