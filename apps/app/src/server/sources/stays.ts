/**
 * Live sources for the stays area, presented as the stays fixture document types:
 *
 *   - the stay record and its bill (`/stays/[id]`): the stay from the desk's day (`GET /ops/front-desk`),
 *     its lines and payments from `GET /ops/folios/:id`, the departments a desk charge can earn for
 *     from `GET /ops/departments`;
 *   - checkout (`/check-out`): the next guest due out, their bill and its evidence;
 *   - the desk's guest conversations (`GET /ops/threads` and each conversation's messages) and the
 *     business's reply templates (`GET /ops/message-templates`).
 *
 * The stay page reads its collections whole and keeps the documents of its stay, so these sources
 * serve the stay IN VIEW: the one the page opened by id (`stays.stays` get), else the next guest due
 * out, which is also the stay Checkout opens on.
 *
 * What is not here stays on fixtures, each with its reason in the data map: the stay's history, keys
 * and documents, late-checkout fees, payments in flight (MoMo prompts, unmatched transfers), the
 * company ledger and fiscal receipt list of checkout, guest profiles and the offline desk.
 */
import type {
  ChargeDepartment,
  CheckoutCase,
  CheckoutLedgerLine,
  FolioDepartment,
  FolioLine,
  FolioPayment,
  MessageTemplate,
  MessageThread,
  Stay,
  StayRecord,
  ThreadMessage,
  Tone,
} from "@injishi/data/fixtures/stays";
import { ApiError } from "../api";
import { clock, dayMonth, kigaliDate, rwf } from "../format";
import {
  type ApiBoard,
  type ApiBooking,
  type ApiStay,
  channelOf,
  daysBetween,
  deskBoard,
  forgetDeskBoard,
  initialsOf,
  nameOf,
  nextDeparture,
  plural,
  span,
} from "./frontdesk";
import { defineSources, type SourceContext } from "./types";

// ── The bill (OperatorFolioDetail and OperatorDepartment in @injishi/contracts) ─────────────────

export interface ApiCharge {
  id: string;
  chargeType:
    | "room"
    | "service_order"
    | "pos"
    | "tax"
    | "service_charge"
    | "adjustment"
    | "discount"
    | "deposit"
    | "payment"
    | "refund";
  description: string | null;
  departmentId: string | null;
  departmentName: string | null;
  quantity: number;
  unitPriceRwf: number | null;
  /** Signed and tax exclusive; the tax is its own line. */
  amountRwf: number;
  taxCode: string | null;
  taxRate: number | null;
  taxAmountRwf: number | null;
  /** `manual`, `night_audit`, `service_order`, `external_pos`, `void`, `tax`, `booking`. */
  sourceRefType: string | null;
  sourceRefId: string | null;
  voidedByChargeId: string | null;
  postedByUserId: string | null;
  businessDate: string | null;
  postedAt: string;
}

export interface ApiFolioDetail {
  id: string;
  folioNumber: string;
  status: "open" | "settled" | "closed" | "disputed";
  guestStayId: string | null;
  balanceRwf: number;
  lockedAt: string | null;
  openedAt: string;
  closedAt: string | null;
  charges: ApiCharge[];
}

export interface ApiDepartment {
  id: string;
  propertyId: string | null;
  name: string;
  departmentCategory: string;
  isRevenueCenter: boolean;
  sortOrder: number;
  status: "active" | "archived" | string;
}

// ── The stay in view ─────────────────────────────────────────────────────────

const inView = new WeakMap<SourceContext, string>();
const folioReads = new WeakMap<SourceContext, Map<string, Promise<ApiFolioDetail>>>();

/** A stay of the desk's day, by its reference ("ST-8812") or its id. */
export function findStay(board: ApiBoard, ref: string): ApiStay | undefined {
  return board.stays.find((s) => s.reference === ref || s.id === ref);
}

/** The stay a page opened, else the next guest due out (the stay Checkout opens on). */
async function stayInView(ctx: SourceContext): Promise<{ board: ApiBoard; stay: ApiStay } | null> {
  const board = await deskBoard(ctx);
  const named = inView.get(ctx);
  const stay = (named ? board.stays.find((s) => s.id === named) : undefined) ?? nextDeparture(board);
  return stay ? { board, stay } : null;
}

/** One bill with its lines, read once per request context. */
export function folioDetail(ctx: SourceContext, folioId: string): Promise<ApiFolioDetail> {
  let reads = folioReads.get(ctx);
  if (!reads) {
    reads = new Map();
    folioReads.set(ctx, reads);
  }
  let read = reads.get(folioId);
  if (!read) {
    read = ctx.ops().get<ApiFolioDetail>(`/api/v1/ops/folios/${encodeURIComponent(folioId)}`);
    reads.set(folioId, read);
    read.catch(() => reads?.delete(folioId));
  }
  return read;
}

/** Forget the day and every bill read through this context, after a write. */
export function forgetStays(ctx: SourceContext): void {
  forgetDeskBoard(ctx);
  folioReads.delete(ctx);
}

/** The stay a command names, from the desk's day; another branch's or an invented one is a 404. */
export async function stayOf(ctx: SourceContext, ref: string): Promise<{ board: ApiBoard; stay: ApiStay }> {
  const board = await deskBoard(ctx);
  const stay = findStay(board, ref);
  if (!stay) throw new ApiError(404, "not_found", `Stay ${ref} is not on this desk.`, null);
  return { board, stay };
}

/** The bill of a stay a command names; a stay with no bill cannot take money. */
export async function stayFolio(
  ctx: SourceContext,
  ref: string,
): Promise<{ board: ApiBoard; stay: ApiStay; folio: ApiFolioDetail }> {
  const { board, stay } = await stayOf(ctx, ref);
  if (!stay.folio) throw new ApiError(409, "no_folio", `Stay ${ref} has no bill to post to.`, null);
  return { board, stay, folio: await folioDetail(ctx, stay.folio.id) };
}

// ── Presenting the stay ──────────────────────────────────────────────────────

const DEPT_HINT: Record<string, string> = {
  fnb: "Restaurant, bar, room service",
  spa_recreation: "Spa and recreation",
  other_operated: "Laundry, transport and other services",
  misc_income: "Other income",
};

/** The document id the stay page keys its records by: the stay reference, else its id. */
const docId = (s: ApiStay) => s.reference ?? s.id;
const dayOf = (iso: string) => Number(kigaliDate(iso).slice(8, 10));
const leavesToday = (s: ApiStay, today: string) =>
  s.lifecycle === "open" && !!s.plannedExitAt && kigaliDate(s.plannedExitAt) <= today;

function bookingOfStay(board: ApiBoard, stay: ApiStay): ApiBooking | undefined {
  return stay.bookingId ? board.bookings.find((b) => b.id === stay.bookingId) : undefined;
}

/** The night the guest leaves on (YYYY-MM-DD), or null for an open-ended walk-in. */
function departureDay(stay: ApiStay): string | null {
  if (stay.checkOut) return stay.checkOut;
  return stay.plannedExitAt ? kigaliDate(stay.plannedExitAt) : null;
}

/** "today 11:00", "22 Oct 11:00", "open-ended"; for a stay that has left, when it left. */
function dueOutLabel(stay: ApiStay, today: string): string {
  if (stay.lifecycle === "closed") {
    return stay.actualExitAt ? `${dayMonth(stay.actualExitAt)} ${clock(stay.actualExitAt)}` : "";
  }
  if (!stay.plannedExitAt) return "open-ended";
  const day = kigaliDate(stay.plannedExitAt);
  return `${day === today ? "today" : dayMonth(day)} ${clock(stay.plannedExitAt)}`;
}

/** The next booking held in this stay's room after the guest leaves: how far the stay could run on. */
function roomAfter(board: ApiBoard, stay: ApiStay) {
  const leaves = departureDay(stay) ?? board.today;
  const next = board.bookings
    .filter((b) => b.id !== stay.bookingId && b.state !== "cancelled" && b.state !== "declined")
    .flatMap((b) => b.holds.filter((h) => h.roomId === stay.roomId && h.from >= leaves).map((h) => ({ b, h })))
    .sort((x, y) => x.h.from.localeCompare(y.h.from))[0];
  if (!next) return { freeNights: 30, freeUntil: "", nextBooking: "" };
  return {
    freeNights: daysBetween(leaves, next.h.from),
    freeUntil: dayMonth(next.h.from),
    nextBooking: next.b.reference,
  };
}

function presentStay(ctx: SourceContext, board: ApiBoard, stay: ApiStay): Stay {
  const booking = bookingOfStay(board, stay);
  const name = nameOf(stay.guestName);
  const leaves = departureDay(stay);
  const arrived = kigaliDate(stay.entryAt);
  const nights =
    stay.checkIn && stay.checkOut
      ? daysBetween(stay.checkIn, stay.checkOut)
      : leaves
        ? daysBetween(arrived, leaves)
        : 1;
  let entity = board.property.name;
  try {
    entity = ctx.ops().workspace.orgName ?? entity;
  } catch {
    // No business workspace: the board could not have been read either.
  }
  return {
    id: docId(stay),
    guest: name,
    guestFirstName: name.split(" ")[0] ?? name,
    // Guest profiles per business do not exist yet (stays.directory is deferred).
    guestId: "",
    room: stay.roomLabel ?? "",
    roomType: stay.roomTypeName,
    bookingId: stay.bookingReference ?? "Walk-in",
    folioId: stay.folio?.folioNumber ?? "",
    // Booking parties (the contracting company, its billing letter) are not recorded.
    company: "",
    entity,
    // The business's TIN is not on any read the desk holds.
    entityTin: "",
    arrivalDay: dayOf(stay.entryAt),
    departureDay: leaves ? Number(leaves.slice(8, 10)) : dayOf(stay.entryAt),
    nights: Math.max(1, nights),
    dueOut: dueOutLabel(stay, board.today),
    rate: stay.priceRwf ?? booking?.lockedNightlyRateRwf ?? 0,
    ...roomAfter(board, stay),
    adults: booking?.adults ?? booking?.guestCount ?? 1,
    inHouseSince: `${dayMonth(stay.entryAt)} ${clock(stay.entryAt)}`,
    payerPhone: booking?.guestPhone ?? "",
  };
}

function presentRecords(board: ApiBoard, stay: ApiStay, folio: ApiFolioDetail | null): StayRecord[] {
  const booking = bookingOfStay(board, stay);
  const id = docId(stay);
  const closed = stay.lifecycle === "closed";
  const adults = booking?.adults ?? booking?.guestCount ?? 1;
  const balance = folio?.balanceRwf ?? stay.folio?.balanceRwf ?? 0;
  const folioStatus = folio?.status ?? stay.folio?.status ?? "open";
  return [
    {
      id: `${id}-booking`,
      stayId: id,
      kind: "Booking",
      title: booking?.reference ?? "Walk-in",
      icon: "Calendar",
      steps: ["Requested", "Confirmed", "Completed"],
      current: closed ? 2 : 1,
      desc: booking
        ? `Made ${dayMonth(booking.createdAt)} · ${channelOf(booking.channel)}`
        : "No booking · checked in at the desk",
      board: booking ? "ReservationDetail" : null,
      anchor: null,
    },
    {
      id: `${id}-stay`,
      stayId: id,
      kind: "Stay",
      title: id,
      icon: "House",
      steps: ["Expected", "In-house", "Due out", "Checked out"],
      current: closed ? 3 : leavesToday(stay, board.today) ? 2 : 1,
      desc: closed
        ? `Checked out ${dueOutLabel(stay, board.today)}`
        : `In-house since ${dayMonth(stay.entryAt)} ${clock(stay.entryAt)} · ${plural(adults, "adult")}`,
      board: null,
      anchor: "folio",
    },
    {
      id: `${id}-folio`,
      stayId: id,
      kind: "Folio",
      title: stay.folio?.folioNumber ?? "No bill",
      icon: "Receipt",
      steps: ["Open", "Settled", "Closed"],
      current: folioStatus === "closed" ? 2 : folioStatus === "settled" ? 1 : 0,
      desc: `Balance ${rwf(balance)}`,
      board: null,
      anchor: "folio",
    },
    {
      id: `${id}-fiscal`,
      stayId: id,
      kind: "Fiscal receipt",
      title: folioStatus === "closed" ? "Bill closed" : "Not issued",
      icon: "FileCheck",
      steps: ["Draft", "Pending at VSDC", "Issued"],
      current: 0,
      desc:
        folioStatus === "closed"
          ? "The bill is closed. This screen does not list its fiscal receipt yet"
          : "Requested from the VSDC when the bill closes at checkout",
      board: null,
      anchor: "docs",
    },
  ];
}

const SOURCE_LABEL: Record<string, string> = {
  manual: "Desk charge",
  external_pos: "Outlet order",
  service_order: "Order to the room",
  night_audit: "Night audit",
};

/** "Void: Lake Bar, 2 drinks (Posted to wrong room)" → "Posted to wrong room". */
function voidReason(description: string | null): string {
  return description?.match(/\(([^()]*)\)\s*$/)?.[1] ?? "Voided";
}

/** Who posted a line, in the desk's words: the signed-in person by name, anyone else by role. */
function postedBy(c: ApiCharge, me: { id: string; name: string } | null): string {
  if (c.sourceRefType === "night_audit") return "Night audit";
  if (me && c.postedByUserId === me.id) return me.name;
  if (c.sourceRefType === "external_pos") return "Outlet till";
  return c.postedByUserId ? "A colleague" : "System";
}

const PAYMENT_TYPES = new Set<ApiCharge["chargeType"]>(["payment", "deposit"]);

/**
 * The bill's charges as the screen lists them: one line per charge with its VAT folded in (the
 * guest pays the two together, and the tax line is never voided apart from its charge), payments
 * and deposits left to the payment list. Lines sum, with the payments, to the bill's balance.
 */
function presentLines(
  stayDoc: string,
  stay: ApiStay,
  folio: ApiFolioDetail,
  me: { id: string; name: string } | null,
): FolioLine[] {
  const byId = new Map(folio.charges.map((c) => [c.id, c]));
  const taxOf = (parentId: string) =>
    folio.charges.find((t) => t.chargeType === "tax" && t.sourceRefType === "tax" && t.sourceRefId === parentId);
  const target = (c: ApiCharge) => (c.sourceRefId ? byId.get(c.sourceRefId) : undefined);
  const lines: FolioLine[] = [];
  for (const c of folio.charges) {
    if (PAYMENT_TYPES.has(c.chargeType)) continue;
    const of = c.sourceRefType === "void" ? target(c) : undefined;
    // A payment's reversal belongs to the payments; a tax line's goes with its charge's reversal.
    if (of && (PAYMENT_TYPES.has(of.chargeType) || of.chargeType === "tax")) continue;
    // A tax line is folded into its charge (unless the charge is not on this bill).
    if (c.chargeType === "tax" && c.sourceRefType === "tax" && c.sourceRefId && byId.has(c.sourceRefId)) continue;
    let tax = c.sourceRefType === "void" ? undefined : taxOf(c.id);
    if (of) {
      const taxLine = taxOf(of.id);
      tax = taxLine ? folio.charges.find((v) => v.sourceRefType === "void" && v.sourceRefId === taxLine.id) : undefined;
    }
    const amount = c.amountRwf + (tax?.amountRwf ?? 0);
    const day = c.businessDate ?? kigaliDate(c.postedAt);
    const night = c.sourceRefType === "night_audit";
    const reversal = c.sourceRefType === "void";
    const dept = (c.departmentName ?? of?.departmentName ?? "Other") as FolioDepartment;
    const room = `${stay.roomLabel ?? ""} ${stay.roomTypeName}`.trim();
    const title = night
      ? `Room night · ${room}`
      : reversal
        ? `Reversal of ${of?.description ?? "a charge"}`
        : (c.description ?? c.chargeType.replace(/_/g, " "));
    const vat = tax?.amountRwf ? ` · VAT ${rwf(Math.abs(tax.amountRwf))} included` : "";
    const src = night
      ? `Night audit ${dayMonth(day)}`
      : reversal
        ? `Void · ${voidReason(c.description)}`
        : `${SOURCE_LABEL[c.sourceRefType ?? ""] ?? "Posted to the bill"}${vat}`;
    lines.push({
      id: c.id,
      stayId: stayDoc,
      date: dayMonth(day),
      title,
      src,
      dept,
      by: postedBy(c, me),
      amount,
      ...(night ? { night: true, room, audit: `Night audit ${dayMonth(day)}` } : {}),
      ...(c.voidedByChargeId ? { voided: true } : {}),
      ...(reversal ? { reversal: true } : {}),
      ...(me && c.postedByUserId === me.id && c.sourceRefType === "manual" ? { mine: true } : {}),
    });
  }
  return lines.sort((a, b) => {
    const x = folio.charges.find((c) => c.id === a.id);
    const y = folio.charges.find((c) => c.id === b.id);
    return (x?.businessDate ?? x?.postedAt ?? "").localeCompare(y?.businessDate ?? y?.postedAt ?? "");
  });
}

/** "Payment (cash) Check-in BK-20431" → "cash". */
function methodOf(c: ApiCharge): "cash" | "mobile_money" | "card" | null {
  const m = c.description?.match(/\((cash|mobile_money|card)\)/)?.[1];
  return (m as "cash" | "mobile_money" | "card" | undefined) ?? null;
}

const TENDER: Record<string, { label: string; icon: string }> = {
  cash: { label: "Cash", icon: "Wallet" },
  mobile_money: { label: "Mobile money", icon: "Smartphone" },
  card: { label: "Card", icon: "CreditCard" },
};

/**
 * Money on the bill: the online prepayment credited at check in and every payment the desk recorded.
 * Only confirmed money is ever on a bill (the API records nothing in flight), so each one counts,
 * unless it was voided, when its reversal takes it out again.
 */
function presentPayments(
  stayDoc: string,
  folio: ApiFolioDetail,
  me: { id: string; name: string } | null,
  booking?: Pick<ApiBooking, "paymentStatus">,
) {
  // Where the online payment is now, as the booking's payment status says: held by Injishi until the
  // stay, or already paid out to the business. Never assumed held.
  const paidOut = booking?.paymentStatus === "paid_out";
  const out: FolioPayment[] = [];
  for (const c of folio.charges) {
    if (!PAYMENT_TYPES.has(c.chargeType) || c.sourceRefType === "void") continue;
    const voided = !!c.voidedByChargeId;
    const online = c.chargeType === "deposit";
    const tender = online
      ? { label: paidOut ? "Paid online · paid out" : "Paid online · held by Injishi", icon: "Vault" }
      : TENDER[methodOf(c) ?? "cash"];
    const at = `${dayMonth(c.postedAt)} ${clock(c.postedAt)}`;
    const reference = (c.description ?? "").replace(/^Payment \([a-z_]+\)\s*/, "").trim();
    out.push({
      id: c.id,
      stayId: stayDoc,
      tender: tender.label,
      icon: tender.icon as FolioPayment["icon"],
      amount: -c.amountRwf,
      state: voided ? "Voided" : online ? (paidOut ? "Paid out" : "Held in escrow") : "Recorded",
      tone: (voided ? "danger" : "success") as Tone,
      line1: online ? (c.description ?? "Paid online when booked") : `${reference || tender.label} · ${at}`,
      line2: voided
        ? "Reversed on the bill · not counted"
        : online
          ? `Credited to ${folio.folioNumber} at check in · counted`
          : `Recorded by ${postedBy(c, me)} · allocated to ${folio.folioNumber}`,
      counted: !voided,
    });
  }
  return out;
}

/** The departments a desk charge may earn for at this property, in the property's order. */
export function chargeDepartmentsOf(departments: ApiDepartment[], propertyId: string): ApiDepartment[] {
  return departments
    .filter(
      (d) =>
        d.isRevenueCenter &&
        d.status === "active" &&
        d.departmentCategory !== "rooms" &&
        (d.propertyId === null || d.propertyId === propertyId),
    )
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

/** What is left to pay, by department ("Food and Beverage RWF 76,000 · …"), for the checkout card. */
function owedDetail(lines: FolioLine[]): string {
  const by = new Map<string, number>();
  for (const l of lines) if (!l.night) by.set(l.dept, (by.get(l.dept) ?? 0) + l.amount);
  const parts = [...by].filter(([, v]) => v !== 0).map(([d, v]) => `${d} ${rwf(v)}`);
  return parts.length ? parts.join(" · ") : "Room nights only";
}

function meOf(ctx: SourceContext): { id: string; name: string } | null {
  return ctx.account ? { id: ctx.account.user.id, name: ctx.account.persona?.name ?? ctx.account.user.name } : null;
}

async function checkoutOf(ctx: SourceContext) {
  const board = await deskBoard(ctx);
  const stay = nextDeparture(board);
  if (!stay) return null;
  const folio = stay.folio ? await folioDetail(ctx, stay.folio.id) : null;
  return { board, stay, folio };
}

function presentCheckout(
  board: ApiBoard,
  stay: ApiStay,
  folio: ApiFolioDetail | null,
  lines: FolioLine[],
): CheckoutCase {
  const booking = bookingOfStay(board, stay);
  const balance = folio?.balanceRwf ?? stay.folio?.balanceRwf ?? 0;
  return {
    id: docId(stay),
    stayId: docId(stay),
    guest: nameOf(stay.guestName),
    room: stay.roomLabel ?? "",
    folioId: stay.folio?.folioNumber ?? "",
    dueOut: dueOutLabel(stay, board.today),
    guestShare: Math.max(0, balance),
    guestShareDetail:
      balance > 0 ? owedDetail(lines) : balance < 0 ? `In credit ${rwf(-balance)}` : "Nothing left to pay",
    // Company accounts and the city ledger do not exist (stays.checkouts' deferred half).
    companyShare: 0,
    unmatched: 0,
    momoPhone: booking?.guestPhone ?? "",
    bookingId: stay.bookingReference ?? "Walk-in",
    housekeeper: "",
    company: "",
    companyTin: "",
    cityLedger: "",
    transfer: [],
    invoice: { number: "", due: "" },
  };
}

/** The evidence behind the balance: charges per department, then each payment. */
function presentLedger(lines: FolioLine[], payments: FolioPayment[]): CheckoutLedgerLine[] {
  const depts = [...new Set(lines.map((l) => l.dept))];
  const out: CheckoutLedgerLine[] = depts.map((dept) => {
    const of = lines.filter((l) => l.dept === dept);
    const voids = of.filter((l) => l.voided).length;
    const posted = of.filter((l) => !l.reversal).length;
    return {
      id: `charges-${dept}`,
      item: `Charges · ${dept}`,
      evidence: `${plural(posted, "line")}${voids ? ` · ${voids} voided and reversed` : ""}`,
      state: "Posted",
      tone: "default",
      amount: of.reduce((n, l) => n + l.amount, 0),
      afterGuestPaid: false,
    };
  });
  for (const p of payments) {
    out.push({
      id: p.id,
      item: p.tender,
      evidence: p.line1,
      state: p.state,
      tone: p.tone,
      amount: p.counted ? -p.amount : null,
      afterGuestPaid: false,
    });
  }
  return out;
}

/** GET /api/v1/ops/message-templates (DeskMessageTemplate in @injishi/contracts). */
interface ApiTemplate {
  id: string;
  key: string;
  label: string;
  bodies: { en: string; rw: string | null; fr: string | null };
}

/** GET /api/v1/ops/threads (OperatorThread in @injishi/contracts). */
interface ApiThread {
  id: string;
  scope: "booking" | "stay" | "lease";
  subjectId: string;
  counterpartName: string | null;
  departmentName: string | null;
  status: "active" | "archived";
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  messageCount: number;
}

/** GET /api/v1/ops/threads/:id/messages (OperatorMessage). */
interface ApiMessage {
  id: string;
  threadId: string;
  senderUserId: string | null;
  senderName: string | null;
  fromUs: boolean;
  bodyType: "text" | "image" | "voice" | "system";
  body: string | null;
  serviceOrderId: string | null;
  createdAt: string;
}

const WEEKDAY_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** "Today", "Yesterday", "Sunday 11 October". */
function dayHeading(day: string, today: string): string {
  const back = daysBetween(day, today);
  if (back === 0) return "Today";
  if (back === 1) return "Yesterday";
  const d = new Date(`${day}T12:00:00Z`);
  return `${WEEKDAY_LONG[d.getUTCDay()]} ${d.getUTCDate()} ${MONTH_LONG[d.getUTCMonth()]}`;
}

/** "10:20" today, "Sat" earlier this week, "4 Oct" before that. */
function listTime(at: string | null, today: string): string {
  if (!at) return "";
  const day = kigaliDate(at);
  const back = daysBetween(day, today);
  if (back === 0) return clock(at);
  if (back < 7) return WEEKDAY_SHORT[new Date(`${day}T12:00:00Z`).getUTCDay()];
  return dayMonth(day);
}

/** "18 min", "2 h", "3 days". */
function age(from: string, now: number): string {
  const min = Math.max(0, Math.round((now - Date.parse(from)) / 60_000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return h < 48 ? `${h} h` : `${Math.floor(h / 24)} days`;
}

/** What the conversation is about, in the desk's terms. */
function context(booking: ApiBooking | undefined, stay: ApiStay | undefined, board: ApiBoard) {
  const today = board.today;
  if (stay && stay.lifecycle === "closed") {
    return {
      ctx: `Checked out ${stay.actualExitAt ? dayMonth(stay.actualExitAt) : ""} · ${stay.reference ?? ""}`.trim(),
      who: "Thread read-only after checkout",
    };
  }
  if (stay) {
    return {
      ctx: `Room ${stay.roomLabel ?? ""} · Stay ${stay.reference ?? ""}`.trim(),
      who: `In-house · ${stay.roomTypeName}`,
    };
  }
  if (booking) {
    const when = booking.checkIn === today ? "arrives today" : dayMonth(booking.checkIn);
    return {
      ctx: `Pre-arrival · ${booking.reference} · ${when}`,
      who: `${channelOf(booking.channel)} booking · ${booking.nights} ${booking.nights === 1 ? "night" : "nights"}`,
    };
  }
  return { ctx: "Conversation", who: "" };
}

function facts(booking: ApiBooking | undefined, stay: ApiStay | undefined): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = [];
  if (booking)
    out.push({ label: "Booking", value: `${booking.reference} · ${span(booking.checkIn, booking.checkOut)}` });
  if (stay) {
    out.push({ label: "Stay", value: `${stay.reference ?? "Stay"} · room ${stay.roomLabel ?? ""}`.trim() });
    if (stay.plannedExitAt && stay.lifecycle === "open") {
      out.push({ label: "Due out", value: `${dayMonth(stay.plannedExitAt)} ${clock(stay.plannedExitAt)}` });
    }
    if (stay.folio) {
      out.push({
        label: "Folio",
        value:
          stay.folio.balanceRwf === null
            ? stay.folio.folioNumber
            : `${stay.folio.folioNumber} · ${rwf(stay.folio.balanceRwf)} ${stay.folio.balanceRwf > 0 ? "due" : "balance"}`,
      });
    }
  }
  return out;
}

function presentMessages(lines: ApiMessage[], today: string): ThreadMessage[] {
  const out: ThreadMessage[] = [];
  let day = "";
  for (const m of [...lines].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    // A system line (an order's status) and media have no rendering of their own here yet.
    if (m.bodyType !== "text" || !m.body) continue;
    const d = kigaliDate(m.createdAt);
    if (d !== day) {
      out.push({ t: "day", text: dayHeading(d, today) });
      day = d;
    }
    out.push(
      m.fromUs
        ? {
            t: "staff",
            text: m.body,
            meta: `${clock(m.createdAt)} · ${m.senderName ?? "Front desk"} · guest app`,
            delivery: [],
          }
        : { t: "guest", text: m.body, meta: `${clock(m.createdAt)} · guest app` },
    );
  }
  return out;
}

async function presentThread(ctx: SourceContext, t: ApiThread, board: ApiBoard, now: number): Promise<MessageThread> {
  const booking =
    t.scope === "booking"
      ? board.bookings.find((b) => b.id === t.subjectId)
      : t.scope === "stay"
        ? board.bookings.find((b) => b.stay?.id === t.subjectId)
        : undefined;
  const stay =
    t.scope === "stay"
      ? board.stays.find((s) => s.id === t.subjectId)
      : booking?.stay
        ? board.stays.find((s) => s.id === booking.stay?.id)
        : undefined;
  const { messages: lines } = await ctx
    .ops()
    .get<{ messages: ApiMessage[] }>(`/api/v1/ops/threads/${encodeURIComponent(t.id)}/messages`);
  const messages = presentMessages(lines, board.today);
  const text = lines
    .filter((m) => m.bodyType === "text" && m.body)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const last = text.at(-1);
  const closed = t.status === "archived";
  const name = nameOf(t.counterpartName ?? booking?.guestName ?? stay?.guestName);
  const waitingOnUs = !!last && !last.fromUs;
  const { ctx: where, who } = context(booking, stay, board);
  return {
    id: t.id,
    name,
    initials: initialsOf(name),
    ctx: where,
    who,
    dept: t.departmentName ?? "Front desk",
    channels: ["app"],
    // Threads carry no assignee, SLA or escalation yet: an unassigned conversation, as stored.
    assignee: "",
    assigneeFull: "",
    unread: 0,
    time: listTime(t.lastMessageAt ?? last?.createdAt ?? null, board.today),
    status: closed ? "Closed" : waitingOnUs ? "Open" : "Waiting on guest",
    sla: closed ? "" : waitingOnUs && last ? `guest waiting ${age(last.createdAt, now)}` : "waiting on the guest",
    escalated: null,
    closed,
    facts: facts(booking, stay),
    links: [
      ...(stay ? [{ label: "Stay and folio", board: "StayFolio" as const }] : []),
      { label: "Reservations", board: "Reservations" as const },
    ],
    consent: [],
    messages,
  };
}

/** The stay in view with its bill, read once for every collection of the stay page. */
async function inViewWithFolio(ctx: SourceContext) {
  const view = await stayInView(ctx);
  if (!view) return null;
  const folio = view.stay.folio ? await folioDetail(ctx, view.stay.folio.id) : null;
  return { ...view, folio };
}

export const sources = defineSources({
  // The stay record. A stay is opened by its reference or id; the list is the one stay the desk
  // deals with next (the next guest due out). Parity on shape: the prototype's stay ST-8812 is a
  // guest the desk boards also show arriving today, so the seeded day keeps its bill on the next
  // departure instead (seed-interface/frontdesk.mjs).
  "stays.stays": {
    parity: "shape",
    async list(ctx): Promise<Stay[]> {
      const view = await stayInView(ctx);
      return view ? [presentStay(ctx, view.board, view.stay)] : [];
    },
    async get(ctx, id): Promise<Stay | undefined> {
      const board = await deskBoard(ctx);
      const stay = findStay(board, id);
      if (!stay) return undefined;
      // Every other collection of the stay page now serves this stay.
      inView.set(ctx, stay.id);
      return presentStay(ctx, board, stay);
    },
  },
  "stays.stayRecords": {
    parity: "shape",
    async list(ctx): Promise<StayRecord[]> {
      const view = await inViewWithFolio(ctx);
      return view ? presentRecords(view.board, view.stay, view.folio) : [];
    },
  },
  "stays.folioLines": {
    parity: "shape",
    async list(ctx): Promise<FolioLine[]> {
      const view = await inViewWithFolio(ctx);
      return view?.folio ? presentLines(docId(view.stay), view.stay, view.folio, meOf(ctx)) : [];
    },
  },
  "stays.folioPayments": {
    parity: "shape",
    async list(ctx): Promise<FolioPayment[]> {
      const view = await inViewWithFolio(ctx);
      return view?.folio
        ? presentPayments(docId(view.stay), view.folio, meOf(ctx), bookingOfStay(view.board, view.stay))
        : [];
    },
  },
  // What a desk charge can earn for: the property's active revenue centres, room nights excepted
  // (the night audit posts them). The prototype drew outlets (Isangano Terrace, Lake Bar), which the
  // world does not have; a charge must name a revenue department, so these are what it can name.
  "stays.chargeDepartments": {
    parity: "shape",
    async list(ctx): Promise<ChargeDepartment[]> {
      const [board, { departments }] = await Promise.all([
        deskBoard(ctx),
        ctx.ops().get<{ departments: ApiDepartment[] }>("/api/v1/ops/departments"),
      ]);
      return chargeDepartmentsOf(departments, board.property.id).map((d) => ({
        id: d.name as FolioDepartment,
        hint: DEPT_HINT[d.departmentCategory] ?? "Revenue",
      }));
    },
  },
  // Checkout opens on the next guest due out; with nobody left today, the next one due.
  "stays.checkouts": {
    parity: "shape",
    async list(ctx): Promise<CheckoutCase[]> {
      const view = await checkoutOf(ctx);
      if (!view) return [];
      const lines = view.folio ? presentLines(docId(view.stay), view.stay, view.folio, meOf(ctx)) : [];
      return [presentCheckout(view.board, view.stay, view.folio, lines)];
    },
  },
  "stays.checkoutLedger": {
    parity: "shape",
    async list(ctx): Promise<CheckoutLedgerLine[]> {
      const view = await checkoutOf(ctx);
      if (!view?.folio) return [];
      const id = docId(view.stay);
      return presentLedger(
        presentLines(id, view.stay, view.folio, meOf(ctx)),
        presentPayments(id, view.folio, meOf(ctx), bookingOfStay(view.board, view.stay)),
      );
    },
  },
  "stays.messageTemplates": {
    async list(ctx): Promise<MessageTemplate[]> {
      const { templates } = await ctx.ops().get<{ templates: ApiTemplate[] }>("/api/v1/ops/message-templates");
      // A language the business has not written falls back to English rather than an empty reply.
      return templates.map((t) => ({
        id: t.key,
        label: t.label,
        EN: t.bodies.en,
        RW: t.bodies.rw ?? t.bodies.en,
        FR: t.bodies.fr ?? t.bodies.en,
      }));
    },
  },
  "stays.threads": {
    naturalKey: "name",
    async list(ctx): Promise<MessageThread[]> {
      const [board, { threads }] = await Promise.all([
        deskBoard(ctx),
        ctx.ops().get<{ threads: ApiThread[] }>("/api/v1/ops/threads"),
      ]);
      // A request to book is answered from Reservations → Requests, where its question is shown beside the
      // decision; its conversation joins the inbox once the booking is confirmed.
      const pending = new Set(board.bookings.filter((b) => b.state === "pending").map((b) => b.id));
      const shown = threads
        .filter((t) => t.scope !== "lease" && !(t.scope === "booking" && pending.has(t.subjectId)))
        .sort((a, b) => (b.lastMessageAt ?? "").localeCompare(a.lastMessageAt ?? ""));
      const now = Date.parse(board.generatedAt);
      return Promise.all(shown.map((t) => presentThread(ctx, t, board, now)));
    },
  },
});
