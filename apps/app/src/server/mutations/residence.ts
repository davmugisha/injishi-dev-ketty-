/**
 * Writes for the residence area, through the API (`/api/v1/ops/residence`). Plain functions: the server
 * actions in features/residence and the verify flows both call them.
 *
 * The screens name records the way people do (unit "B-07", repair "WO-345", lease "L-KC-014"); the
 * API's routes take ids, so the human name is looked up in the building's read model first. Anything
 * the screen typed as prose (a visit window, a date) is read here into the form the API takes, and a
 * line that cannot be read is refused in words before the API is called.
 */
import { readFrancs } from "../../lib/francs";
import { forgetResidence, readResidence } from "../sources/residence";
import type { SourceContext } from "../sources/types";

/** A request the screen can word for the person, refused before it reaches the API. */
export class ResidenceInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResidenceInputError";
  }
}

/** What every residence command answers (ResidenceWriteResult in @injishi/contracts). */
export interface ResidenceWrite {
  id: string;
  reference: string | null;
  code: string | null;
}

export type RepairCategory =
  | "plumbing"
  | "electrical"
  | "hvac"
  | "appliance"
  | "furniture"
  | "it_tech"
  | "safety"
  | "other"
  | "doors_windows"
  | "decoration";

export type PaymentMethod = "mtn_momo" | "airtel_money" | "bank_transfer" | "cash";

/** The labels the screens offer, in the API's codes. */
export const PAYMENT_METHOD: Record<string, PaymentMethod> = {
  "MTN MoMo": "mtn_momo",
  "Airtel Money": "airtel_money",
  "Bank transfer": "bank_transfer",
  "Cash at the office": "cash",
};
export const REPAIR_CATEGORY: Record<string, RepairCategory> = {
  Plumbing: "plumbing",
  Electrical: "electrical",
  "Doors and locks": "doors_windows",
  "Doors and windows": "doors_windows",
  Appliances: "appliance",
  Decoration: "decoration",
  Other: "other",
  "Something else": "other",
};
const NOTICE_CHANNEL: Record<string, "app" | "letter" | "email" | "in_person"> = {
  Letter: "letter",
  "Resident app": "app",
  Email: "email",
  "In person": "in_person",
};

// ── Reading what people typed ──────────────────────────────────────────────────────────────────────

const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const addDays = (day: string, n: number) =>
  new Date(Date.parse(`${day}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/**
 * A calendar day as people write it: "Today", "Tomorrow", "14 Nov 2026", "Saturday 14 November 2026",
 * "Sat 17 Oct" (no year: the next such day from today). Null when it is not a date.
 */
export function readDay(text: string, today: string): string | null {
  const t = text.trim().toLowerCase();
  if (t === "today") return today;
  if (t === "tomorrow") return addDays(today, 1);
  const m = t.match(/^(?:[a-z]+,?\s+)?(\d{1,2})\s+([a-z]{3})[a-z]*\.?(?:,?\s+(\d{4}))?$/);
  if (!m || !MONTHS[m[2]]) return null;
  const day = Number(m[1]);
  const month = MONTHS[m[2]];
  let year = m[3] ? Number(m[3]) : Number(today.slice(0, 4));
  let out = iso(year, month, day);
  // A day with no year that has already gone this year is next year's (a visit is never in the past).
  if (!m[3] && out < addDays(today, -1)) {
    year += 1;
    out = iso(year, month, day);
  }
  const check = new Date(`${out}T12:00:00Z`);
  if (check.getUTCMonth() + 1 !== month || check.getUTCDate() !== day) return null;
  return out;
}

/**
 * A visit window: "Today 14:00–20:00", "Tue 13 Oct 09:30–12:30", or a day and a time range typed in two
 * fields. An end before the start runs past midnight. Kigali time (UTC+2, no daylight saving).
 */
export function readWindow(text: string, today: string, dayText?: string): { validFrom: string; validTo: string } {
  const times = [...text.matchAll(/(\d{1,2})[:.h](\d{2})/g)].map((m) => `${m[1].padStart(2, "0")}:${m[2]}`);
  if (times.length < 2) throw new ResidenceInputError("Give the visit as a start and an end time, like 14:00–20:00.");
  const head = (dayText ?? text.slice(0, text.search(/\d{1,2}[:.h]\d{2}/))).replace(/[·,]/g, " ").trim();
  const day = head ? readDay(head, today) : today;
  if (!day) throw new ResidenceInputError(`"${head}" is not a day: write it like "Sat 17 Oct" or "Today".`);
  const end = times[1] <= times[0] ? addDays(day, 1) : day;
  return { validFrom: `${day}T${times[0]}:00+02:00`, validTo: `${end}T${times[1]}:00+02:00` };
}

/**
 * A whole number of francs from "1,050,000" or "RWF 950 000". A decimal part ("450,000.00") is refused with the
 * reason, never folded into the digits: stripping every non-digit read it as 45,000,000 (lib/francs).
 */
export function readAmount(text: string): number {
  const { amount, error } = readFrancs(text);
  if (error) throw new ResidenceInputError(error);
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new ResidenceInputError("Enter an amount in whole francs.");
  return amount;
}

// ── Lookups ────────────────────────────────────────────────────────────────────────────────────────

async function ticketByRef(ctx: SourceContext, ref: string) {
  const v = await readResidence(ctx);
  const ticket = v.tickets.find((t) => t.reference === ref || t.id === ref);
  if (!ticket) throw new ResidenceInputError(`There is no repair ${ref} here.`);
  return ticket;
}

async function offerOfLease(ctx: SourceContext, leaseRef: string) {
  const v = await readResidence(ctx);
  const lease = v.leases.find((l) => l.reference === leaseRef || l.id === leaseRef);
  if (!lease) throw new ResidenceInputError(`There is no lease ${leaseRef} here.`);
  const offer = v.offers.find((o) => o.leaseId === lease.id && o.status === "open");
  if (!offer) throw new ResidenceInputError(`Lease ${leaseRef} has no renewal offer waiting for an answer.`);
  return offer;
}

const ops = (ctx: SourceContext) => ctx.ops("residence");

async function write<T>(ctx: SourceContext, call: Promise<T>): Promise<T> {
  const out = await call;
  forgetResidence(ctx);
  return out;
}

// ── Repairs ────────────────────────────────────────────────────────────────────────────────────────

/** New maintenance ticket: a unit ("B-07") or a block's common area ("Block B"). Answers its WO number. */
export async function raiseRepair(
  ctx: SourceContext,
  input: { unit: string; title: string; category: RepairCategory; staffMayEnter: boolean | null; description?: string },
): Promise<ResidenceWrite> {
  if (!input.title.trim()) throw new ResidenceInputError("Say what needs fixing.");
  return write(ctx, ops(ctx).post<ResidenceWrite>("/api/v1/ops/residence/repairs", input));
}

/** Move a repair on the board: Assigned, In progress, Fulfilled. */
export async function moveRepair(
  ctx: SourceContext,
  ref: string,
  to: "assigned" | "in_progress" | "resolved",
): Promise<ResidenceWrite> {
  const ticket = await ticketByRef(ctx, ref);
  return write(ctx, ops(ctx).post<ResidenceWrite>(`/api/v1/ops/residence/repairs/${ticket.id}/move`, { to }));
}

/** Reply to the resident on a repair, or leave an internal note staff alone see. */
export async function writeOnRepair(
  ctx: SourceContext,
  ref: string,
  text: string,
  internal: boolean,
): Promise<ResidenceWrite> {
  const ticket = await ticketByRef(ctx, ref);
  return write(
    ctx,
    ops(ctx).post<ResidenceWrite>(`/api/v1/ops/residence/repairs/${ticket.id}/messages`, { text, internal }),
  );
}

// ── The gate ───────────────────────────────────────────────────────────────────────────────────────

/** Pre-register a visitor: management's code is approved as it is issued. Answers the code. */
export async function preregisterVisitor(
  ctx: SourceContext,
  input: { unit: string; visitorName: string; window: string; kind?: "guest" | "contractor" },
): Promise<ResidenceWrite> {
  const { validFrom, validTo } = readWindow(input.window, ctx.today.iso);
  const overnight = validTo.slice(0, 10) !== validFrom.slice(0, 10);
  return write(
    ctx,
    ops(ctx).post<ResidenceWrite>("/api/v1/ops/residence/visitor-passes", {
      unit: input.unit,
      visitorName: input.visitorName,
      validFrom,
      validTo,
      overnight,
      kind: input.kind ?? "guest",
    }),
  );
}

export async function decideAccessRequest(
  ctx: SourceContext,
  id: string,
  decision: "approved" | "declined",
): Promise<ResidenceWrite> {
  return write(
    ctx,
    ops(ctx).post<ResidenceWrite>(`/api/v1/ops/residence/access-requests/${encodeURIComponent(id)}/decision`, {
      decision,
    }),
  );
}

// ── Rent ───────────────────────────────────────────────────────────────────────────────────────────

/**
 * Save a payment received outside the app, as pending. `idempotencyKey` is minted once per press at
 * the call site, so a retried request is the same payment.
 */
export async function recordRentPayment(
  ctx: SourceContext,
  input: { unit: string; amountRwf: number; method: PaymentMethod; providerRef: string },
  idempotencyKey: string,
): Promise<ResidenceWrite> {
  return write(ctx, ops(ctx).post<ResidenceWrite>("/api/v1/ops/residence/rent-payments", input, { idempotencyKey }));
}

export async function remindResidents(ctx: SourceContext, units: string[], message: string): Promise<ResidenceWrite[]> {
  if (!units.length) throw new ResidenceInputError("Choose at least one resident to remind.");
  return write(ctx, ops(ctx).post<ResidenceWrite[]>("/api/v1/ops/residence/rent-reminders", { units, message }));
}

// ── Leases, renewals and notices ───────────────────────────────────────────────────────────────────

/** Record a move-out notice that came by letter, email or in person (Move-outs → Record a notice). */
export async function recordNotice(
  ctx: SourceContext,
  input: { unit: string; received: string; movesOut: string; channel: string },
): Promise<ResidenceWrite> {
  const receivedOn = readDay(input.received, ctx.today.iso);
  if (!receivedOn) throw new ResidenceInputError(`"${input.received}" is not a date: write it like "12 Oct 2026".`);
  const moveOutDate = readDay(input.movesOut, ctx.today.iso);
  if (!moveOutDate) throw new ResidenceInputError(`"${input.movesOut}" is not a date: write it like "11 Nov 2026".`);
  const channel = NOTICE_CHANNEL[input.channel];
  if (!channel) throw new ResidenceInputError(`"${input.channel}" is not a way a notice arrives.`);
  return write(
    ctx,
    ops(ctx).post<ResidenceWrite>("/api/v1/ops/residence/notices", {
      unit: input.unit,
      receivedOn,
      moveOutDate,
      channel,
    }),
  );
}

export async function withdrawOffer(ctx: SourceContext, leaseRef: string): Promise<ResidenceWrite> {
  const offer = await offerOfLease(ctx, leaseRef);
  return write(ctx, ops(ctx).post<ResidenceWrite>(`/api/v1/ops/residence/offers/${offer.id}/withdraw`, {}));
}

export async function remindAboutOffer(ctx: SourceContext, leaseRef: string): Promise<ResidenceWrite> {
  const offer = await offerOfLease(ctx, leaseRef);
  return write(ctx, ops(ctx).post<ResidenceWrite>(`/api/v1/ops/residence/offers/${offer.id}/remind`, {}));
}

// ── Applicants ─────────────────────────────────────────────────────────────────────────────────────

const SCREENING = ["identity", "income", "employment", "reference", "balance", "rules"] as const;

/** Record the manual screening checks, as the whole set of ticks in the screen's order. */
export async function recordScreening(
  ctx: SourceContext,
  applicationId: string,
  checks: boolean[],
): Promise<ResidenceWrite> {
  const done = SCREENING.filter((_, i) => checks[i]);
  return write(
    ctx,
    ops(ctx).put<ResidenceWrite>(`/api/v1/ops/residence/applications/${encodeURIComponent(applicationId)}/screening`, {
      done,
    }),
  );
}

/** Decline an open application. The reason is kept with the application; nothing is sent to the applicant. */
export async function declineApplication(
  ctx: SourceContext,
  applicationId: string,
  reason: string,
): Promise<ResidenceWrite> {
  if (reason.trim().length < 3) throw new ResidenceInputError("Write the reason for declining.");
  return write(
    ctx,
    ops(ctx).post<ResidenceWrite>(`/api/v1/ops/residence/applications/${encodeURIComponent(applicationId)}/decline`, {
      reason: reason.trim(),
    }),
  );
}

/** Turn a ready application into a lease draft. Answers the draft's lease number. */
export async function convertToLeaseDraft(
  ctx: SourceContext,
  applicationId: string,
  input: { start: string; term: string; rent: string; deposit: string; notice: string },
): Promise<ResidenceWrite> {
  const startDate = readDay(input.start, ctx.today.iso);
  if (!startDate) throw new ResidenceInputError(`"${input.start}" is not a date: write it like "1 Nov 2026".`);
  const termMonths = Number(input.term.match(/\d+/)?.[0] ?? Number.NaN);
  if (!Number.isInteger(termMonths) || termMonths < 1)
    throw new ResidenceInputError("Give the term in months, like 12 months.");
  const noticePeriodDays = Number(input.notice.match(/\d+/)?.[0] ?? Number.NaN);
  if (!Number.isInteger(noticePeriodDays))
    throw new ResidenceInputError("Give the notice period in days, like 30 days.");
  return write(
    ctx,
    ops(ctx).post<ResidenceWrite>(`/api/v1/ops/residence/applications/${encodeURIComponent(applicationId)}/convert`, {
      startDate,
      termMonths,
      monthlyRentRwf: readAmount(input.rent),
      cautionRwf: readAmount(input.deposit),
      noticePeriodDays,
      // The draft's terms say "Due on the 1st of each month".
      rentDueDay: 1,
    }),
  );
}
