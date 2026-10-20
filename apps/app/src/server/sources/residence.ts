/**
 * Live sources for the residence area: Kacyiru Court as the residence manager's screens read it, from
 * `GET /api/v1/ops/residence` (one read model for the landlord's buildings, ResidenceView in
 * @injishi/contracts), presented as the residence fixture documents.
 *
 * Everything here is derived from rows: a unit's tile colour from its lease, this month's charge and
 * the payment in flight; the KPIs from the charges; a lease's status chip from its notice, offer and
 * filing. "This month" and "today" are Kigali's (`ctx.today`).
 */
import type * as R from "@injishi/data/fixtures/residence";
import { stock } from "@injishi/data/media";
import { workspaceFor } from "../auth";
import { clock, dayMonth, dayMonthYear, kigaliDate, rwf } from "../format";
import { defineSources, type SourceContext } from "./types";

/**
 * What the API holds about a lease that the prototype's Lease document has no field for: the landlord the
 * lease is with (the org's legal name and TIN), the caution deposit, grace and notice days, the term, and when
 * each side signed. The Leases, home and move-out screens show these instead of the prototype's fixed
 * "Amahoro Residences Ltd · TIN 102 345 990", "Solange Uwimana", two months' rent and "12 months". Optional on
 * the type so a fixture document (which never had it) still type-checks; a screen reads a missing value as
 * "not on file".
 */
export interface LeaseRecord {
  /** The landlord's legal name, "" when the API has none. */
  landlord: string;
  /** "TIN 999 100 001" (or "UPI …"), "" when neither is on file. */
  landlordId: string;
  /** The caution deposit the lease holds, whole francs; null when not recorded. */
  deposit: number | null;
  graceDays: number | null;
  noticeDays: number | null;
  /** Whole months from start to end; null while either date is missing. */
  termMonths: number | null;
  /** "3 Mar 2026", "" while that side has not signed. */
  tenantSignedOn: string;
  landlordSignedOn: string;
  /**
   * The lease's filing row is sample data (a seeded `mock` row, or one whose mode the caller cannot read), so the
   * Filings tab labels it sample and claims no stage. Nothing in the API files a lease or writes a filing row.
   */
  filingSample: boolean;
}
export type LiveLease = R.Lease & { record?: LeaseRecord };

/**
 * The building(s) the signed-in manager's residence workspace covers, as the session lists them, else the
 * business's name; "" when neither is known. The screens' headers used to say "Kacyiru Court Residences"
 * whatever the business was.
 */
export function residenceBuilding(ctx: SourceContext): string {
  const ws = ctx.account ? workspaceFor(ctx.account, "residence") : null;
  const names = ((ws?.branches ?? []) as { name?: string }[]).map((b) => b.name).filter((n): n is string => !!n);
  return names.join(" · ") || ws?.orgName || "";
}

// ── The read model (ResidenceView in @injishi/contracts) ───────────────────────────────────────────

export interface ApiLease {
  id: string;
  reference: string | null;
  roomId: string;
  unitLabel: string;
  status: "draft" | "pending_signature" | "active" | "ending" | "ended" | "cancelled";
  tenantUserId: string | null;
  tenantName: string | null;
  monthlyRentRwf: number | null;
  cautionRwf: number | null;
  startDate: string | null;
  endDate: string | null;
  rentDueDay: number | null;
  graceDays: number | null;
  noticePeriodDays: number | null;
  occupants: string | null;
  landlordSignedAt: string | null;
  tenantSignedAt: string | null;
}
export interface ApiCharge {
  id: string;
  leaseId: string;
  periodMonth: string;
  amountRwf: number;
  paidAmountRwf: number;
  status: "paid" | "due" | "overdue";
  dueDate: string | null;
  paidAt: string | null;
}
export interface ApiPayment {
  id: string;
  leaseId: string;
  rentChargeId: string;
  amountRwf: number;
  method: "mtn_momo" | "airtel_money" | "bank_transfer" | "cash";
  providerRef: string;
  status: "pending" | "verified" | "unknown" | "failed";
  receivedAt: string;
  verifiedAt: string | null;
  recordedByName: string | null;
}
export interface ApiOffer {
  id: string;
  leaseId: string;
  status: "open" | "accepted" | "declined" | "withdrawn" | "signed";
  offeredRentRwf: number;
  termMonths: number;
  startsOn: string;
  endsOn: string;
  answerBy: string;
  depositTopupRwf: number;
  otherTerms: string | null;
  sentAt: string;
  sentByName: string | null;
  openedAt: string | null;
  remindedAt: string | null;
  answeredAt: string | null;
  signedAt: string | null;
}
export interface ApiNotice {
  id: string;
  leaseId: string;
  moveOutDate: string;
  reasonCode: string | null;
  message: string | null;
  filedVia: "app" | "letter" | "email" | "in_person" | null;
  filedAt: string;
  noticeGivenDays: number | null;
  isShortNotice: boolean;
}
export interface ApiTicket {
  id: string;
  reference: string | null;
  leaseId: string | null;
  roomId: string | null;
  unitLabel: string | null;
  spaceName: string | null;
  title: string;
  description: string | null;
  category: string | null;
  status: "open" | "assigned" | "in_progress" | "resolved" | "closed" | "cancelled";
  staffMayEnter: boolean | null;
  assignedContractor: string | null;
  assignedToName: string | null;
  scheduledFor: string | null;
  visitWindow: string | null;
  costBearer: "landlord" | "tenant" | "to_be_decided" | null;
  costNote: string | null;
  raisedVia: string | null;
  raisedByName: string | null;
  raisedByRole: "guest" | "tenant" | "staff" | "housekeeper" | null;
  photos: { key: string; caption: string }[];
  createdAt: string;
  resolvedAt: string | null;
  threadId: string | null;
}
export interface ApiPass {
  id: string;
  roomId: string;
  unitLabel: string;
  leaseId: string | null;
  kind: "guest" | "contractor";
  visitorName: string;
  code: string;
  validFrom: string;
  validTo: string;
  overnight: boolean;
  status: "expected" | "approved" | "used" | "expired" | "revoked";
  createdByName: string | null;
  byTenant: boolean;
  usedAt: string | null;
  leftAt: string | null;
}
export interface ApiResidenceView {
  property: { id: string; name: string; landlord: string; upi: string | null; tin: string | null } | null;
  blocks: { id: string; code: string; name: string; kind: string }[];
  units: {
    roomId: string;
    label: string;
    block: string;
    type: string;
    askingRentRwf: number;
    vacantSince: string | null;
    note: string | null;
  }[];
  leases: ApiLease[];
  charges: ApiCharge[];
  payments: ApiPayment[];
  reminders: {
    id: string;
    leaseId: string;
    channel: "in_app" | "in_app_email" | "email" | "call" | "letter";
    note: string;
    sentAt: string;
    readAt: string | null;
    sentByName: string | null;
  }[];
  notices: ApiNotice[];
  offers: ApiOffer[];
  filings: {
    leaseId: string;
    status: "pending" | "filed" | "failed";
    dueBy: string | null;
    clockStartAt: string | null;
    /**
     * Not on `/ops/residence`: merged in from `GET /api/v1/ops/filings` by `readResidence`. Nothing in the API
     * writes a filing, so every row today is a seeded `mock` one; null when the filings read is not open to the
     * caller. Only a `live` row is shown as a filing.
     */
    adapterMode?: "mock" | "live" | null;
  }[];
  deposits: {
    id: string;
    leaseId: string;
    amountRwf: number;
    status: "held" | "refunded" | "forfeited";
    heldAt: string;
    refundedRwf: number | null;
    forfeitedRwf: number | null;
    settledAt: string | null;
  }[];
  tickets: ApiTicket[];
  ticketNotes: { id: string; ticketId: string; authorName: string | null; note: string; createdAt: string }[];
  ticketMessages: {
    id: string;
    ticketId: string;
    fromTenant: boolean;
    senderName: string | null;
    body: string;
    createdAt: string;
  }[];
  passes: ApiPass[];
  accessRequests: {
    id: string;
    leaseId: string;
    kind: "overnight" | "delivery" | "gate_entry";
    visitorName: string | null;
    reason: string | null;
    forDate: string | null;
    toDate: string | null;
    status: "open" | "approved" | "declined";
    requestedAt: string;
  }[];
  visitorLog: {
    id: string;
    visitorName: string;
    visitorPhone: string | null;
    roomId: string | null;
    unitLabel: string | null;
    leaseId: string | null;
    place: string | null;
    admittedHow: string | null;
    recordedBy: string | null;
    arrivalAt: string | null;
    departureAt: string | null;
  }[];
  clauses: { code: string; title: string; note: string; needsReview: boolean }[];
  applications: {
    id: string;
    roomId: string;
    unitLabel: string;
    name: string;
    email: string | null;
    phone: string | null;
    stage: "invited" | "screening" | "ready" | "declined" | "converted";
    source: string;
    broker: { name: string; referredAt: string; feeRwf: number; terms: string } | null;
    desiredMoveIn: string | null;
    termMonths: number | null;
    occupants: string | null;
    offeredRentRwf: number | null;
    depositRwf: number | null;
    screening: string[];
    documents: { name: string; note: string; state: "requested" | "waiting" | "uploaded" | "checked" }[];
    createdAt: string;
    leaseId: string | null;
  }[];
  payouts: {
    id: string;
    periodMonth: string | null;
    amountRwf: number;
    status: "scheduled" | "queued" | "paid" | "held";
    destination: "momo" | "bank" | null;
    destinationRef: string | null;
    scheduledReleaseAt: string | null;
    settledAt: string | null;
  }[];
  notifications: {
    id: string;
    title: string;
    body: string | null;
    category: string;
    createdAt: string;
    readAt: string | null;
  }[];
}

/** One read of the building per request: every collection of a page reads the same rows. */
const reads = new WeakMap<SourceContext, Promise<ApiResidenceView>>();

export function readResidence(ctx: SourceContext): Promise<ApiResidenceView> {
  let read = reads.get(ctx);
  if (!read) {
    read = Promise.all([ctx.ops("residence").get<ApiResidenceView>("/api/v1/ops/residence"), filingModes(ctx)]).then(
      ([v, modes]) => ({
        ...v,
        filings: v.filings.map((f) => ({ ...f, adapterMode: modes.get(f.leaseId) ?? null })),
      }),
    );
    reads.set(ctx, read);
  }
  return read;
}

/**
 * Whether each lease's filing row is a real one or a seeded `mock` one, from `GET /api/v1/ops/filings` (the only
 * route that carries the row's adapter mode). Read only when the caller's grant opens it (`lease.advance` or
 * `money.view`), so a repairs-only persona never fires a refused read; a failed read leaves every row unknown,
 * which the screens treat as not a filing.
 */
async function filingModes(ctx: SourceContext): Promise<Map<string, "mock" | "live">> {
  const ws = ctx.account ? workspaceFor(ctx.account, "residence") : null;
  if (!ws?.permissions.some((p) => p === "lease.advance" || p === "money.view")) return new Map();
  try {
    const { filings } = await ctx
      .ops("residence")
      .get<{ filings: { leaseId: string; adapterMode: "mock" | "live" | null }[] }>("/api/v1/ops/filings");
    return new Map(
      filings.flatMap((f) => (f.adapterMode ? [[f.leaseId, f.adapterMode] as [string, "mock" | "live"]] : [])),
    );
  } catch {
    return new Map();
  }
}

/** After a write: the next read in this request goes back to the API. */
export function forgetResidence(ctx: SourceContext): void {
  reads.delete(ctx);
}

// ── Shared vocabulary ──────────────────────────────────────────────────────────────────────────────

const DAY_MS = 86_400_000;
const MONTH_NAMES = [
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
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** "October" for a YYYY-MM-DD. */
export const monthName = (iso: string) => MONTH_NAMES[Number(iso.slice(5, 7)) - 1];
/** "Thursday" for a calendar day. */
export const weekday = (iso: string) => WEEKDAYS[new Date(`${iso}T12:00:00Z`).getUTCDay()];
/** "Thu" for a calendar day. */
export const weekdayShort = (iso: string) => weekday(iso).slice(0, 3);
/** "15th". */
export function ordinal(n: number): string {
  const tens = n % 100;
  const suffix =
    tens >= 11 && tens <= 13 ? "th" : n % 10 === 1 ? "st" : n % 10 === 2 ? "nd" : n % 10 === 3 ? "rd" : "th";
  return `${n}${suffix}`;
}
/** Whole days from `from` to `to` (calendar days). */
export const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / DAY_MS);
export const addDays = (iso: string, n: number) =>
  new Date(Date.parse(`${iso}T12:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
export const firstName = (name: string | null | undefined) => (name ?? "").split(" ")[0] ?? "";
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");
}
/** "the first day of this month" in Kigali. */
const monthOf = (iso: string) => `${iso.slice(0, 7)}-01`;
function shiftMonth(month: string, delta: number): string {
  const d = new Date(`${month}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + delta);
  return d.toISOString().slice(0, 10);
}

export const METHOD_LABEL: Record<ApiPayment["method"], string> = {
  mtn_momo: "MTN MoMo",
  airtel_money: "Airtel Money",
  bank_transfer: "Bank transfer",
  cash: "Cash at the office",
};
const CATEGORY_LABEL: Record<string, string> = {
  plumbing: "Plumbing",
  electrical: "Electrical",
  doors_windows: "Doors and locks",
  decoration: "Decoration",
  appliance: "Appliances",
  furniture: "Furniture",
  hvac: "Heating and cooling",
  it_tech: "Internet and TV",
  safety: "Safety",
  other: "Other",
};
const COST_BEARER: Record<NonNullable<ApiTicket["costBearer"]>, string> = {
  landlord: "Landlord",
  tenant: "Resident",
  to_be_decided: "To be decided",
};
const isCurrent = (l: ApiLease) => l.status === "active" || l.status === "ending";
const outstanding = (c: ApiCharge) => Math.max(0, c.amountRwf - c.paidAmountRwf);
const isStock = (key: string): key is R.StockKey => key in stock;

/** The tile and roll status a month of rent reads as. */
function monthState(b: Building, charge: ApiCharge | undefined, lease: ApiLease): R.RentMonth {
  if (!charge) return "none";
  if (outstanding(charge) === 0) {
    if (!charge.paidAt || !charge.dueDate) return "paid";
    const lateAfter = addDays(charge.dueDate, lease.graceDays ?? 0);
    return kigaliDate(charge.paidAt) > lateAfter ? "late" : "paid";
  }
  const flight = b.inFlight(charge.id);
  if (flight.some((p) => p.status === "unknown")) return "unknown";
  if (flight.length) return "pending";
  return "unpaid";
}

// ── The building, indexed once per read ────────────────────────────────────────────────────────────

/** The read model with the joins every screen makes, computed once per response. */
export class Building {
  readonly today: string;
  readonly month: string;
  readonly leaseById: Map<string, ApiLease>;
  /** The tenancy someone lives in now, by room. */
  readonly currentByRoom = new Map<string, ApiLease>();
  readonly unitByRoom: Map<string, ApiResidenceView["units"][number]>;
  private readonly chargesByLease = new Map<string, ApiCharge[]>();
  private readonly paymentsByCharge = new Map<string, ApiPayment[]>();

  constructor(
    readonly v: ApiResidenceView,
    today: string,
  ) {
    this.today = today;
    this.month = monthOf(today);
    this.leaseById = new Map(v.leases.map((l) => [l.id, l]));
    this.unitByRoom = new Map(v.units.map((u) => [u.roomId, u]));
    for (const l of v.leases) if (isCurrent(l)) this.currentByRoom.set(l.roomId, l);
    for (const c of v.charges) this.chargesByLease.set(c.leaseId, [...(this.chargesByLease.get(c.leaseId) ?? []), c]);
    for (const p of v.payments)
      this.paymentsByCharge.set(p.rentChargeId, [...(this.paymentsByCharge.get(p.rentChargeId) ?? []), p]);
  }

  /** Tenancies in force, in unit order. */
  get current(): ApiLease[] {
    return this.v.leases.filter(isCurrent);
  }
  charges(leaseId: string): ApiCharge[] {
    return this.chargesByLease.get(leaseId) ?? [];
  }
  charge(leaseId: string, month: string): ApiCharge | undefined {
    return this.charges(leaseId).find((c) => c.periodMonth === month);
  }
  payments(chargeId: string): ApiPayment[] {
    return this.paymentsByCharge.get(chargeId) ?? [];
  }
  /** Payments on a charge still waiting for the provider or Payments: never collected money. */
  inFlight(chargeId: string): ApiPayment[] {
    return this.payments(chargeId).filter((p) => p.status === "pending" || p.status === "unknown");
  }
  /** Open charges that fell due before today. */
  overdueCharges(leaseId: string): ApiCharge[] {
    return this.charges(leaseId).filter((c) => outstanding(c) > 0 && c.dueDate !== null && c.dueDate < this.today);
  }
  overdue(leaseId: string): number {
    return this.overdueCharges(leaseId).reduce((n, c) => n + outstanding(c), 0);
  }
  /** Days the oldest overdue charge has been owed. */
  oldestOverdueDays(leaseId: string): number {
    const oldest = this.overdueCharges(leaseId)[0];
    return oldest?.dueDate ? daysBetween(oldest.dueDate, this.today) : 0;
  }
  notice(leaseId: string): ApiNotice | undefined {
    return this.v.notices.find((n) => n.leaseId === leaseId);
  }
  offer(leaseId: string): ApiOffer | undefined {
    const offers = this.v.offers.filter((o) => o.leaseId === leaseId);
    return offers.find((o) => o.status === "open") ?? offers.find((o) => o.status === "accepted") ?? offers.at(-1);
  }
  unitLabel(leaseId: string | null): string {
    return (leaseId && this.leaseById.get(leaseId)?.unitLabel) || "";
  }
  /** This month's charges of the tenancies in force. */
  get monthCharges(): ApiCharge[] {
    return this.current.flatMap((l) => this.charge(l.id, this.month) ?? []);
  }
  /** Units with no tenancy in force. */
  get vacant(): ApiResidenceView["units"] {
    return this.v.units.filter((u) => !this.currentByRoom.has(u.roomId));
  }
  vacantDays(u: ApiResidenceView["units"][number]): number {
    return u.vacantSince ? Math.max(0, daysBetween(u.vacantSince, this.today)) : 0;
  }
  openTickets(roomId: string): ApiTicket[] {
    return this.v.tickets.filter((t) => t.roomId === roomId && !["resolved", "closed", "cancelled"].includes(t.status));
  }
  /** What the business's tenancies owe and have paid this month. */
  figures() {
    const charges = this.monthCharges;
    const flight = charges.flatMap((c) => this.inFlight(c.id));
    const scheduled = charges.reduce((n, c) => n + c.amountRwf, 0);
    const verified = charges.reduce((n, c) => n + c.paidAmountRwf, 0);
    const pending = flight.reduce((n, p) => n + p.amountRwf, 0);
    const inArrears = this.current.filter((l) => this.overdue(l.id) > 0);
    return {
      charges,
      flight,
      scheduled,
      verified,
      pending,
      unpaid: Math.max(0, scheduled - verified - pending),
      closed: charges.filter((c) => outstanding(c) === 0).length,
      unpaidCount: charges.filter((c) => outstanding(c) > 0 && this.inFlight(c.id).length === 0).length,
      arrears: inArrears.reduce((n, l) => n + this.overdue(l.id), 0),
      inArrears,
    };
  }
}

const buildings = new WeakMap<ApiResidenceView, Building>();
export function building(v: ApiResidenceView, ctx: SourceContext): Building {
  let b = buildings.get(v);
  if (!b) {
    b = new Building(v, ctx.today.iso);
    buildings.set(v, b);
  }
  return b;
}
async function read(ctx: SourceContext): Promise<Building> {
  return building(await readResidence(ctx), ctx);
}

// ── Units, blocks and the home ─────────────────────────────────────────────────────────────────────

function unitStatus(b: Building, lease: ApiLease | undefined): R.UnitStatus {
  if (!lease) return "vacant";
  if (b.notice(lease.id)) return "notice";
  if (b.overdue(lease.id) > 0) return "arrears";
  const state = monthState(b, b.charge(lease.id, b.month), lease);
  if (state === "unknown") return "unknown";
  if (state === "paid" || state === "late" || state === "none") return "paid";
  return "pending";
}

/** The one line the tile and the unit panel say about a unit, most pressing first. */
function unitNote(b: Building, u: ApiResidenceView["units"][number], lease: ApiLease | undefined): string {
  if (!lease) {
    const days = b.vacantDays(u);
    return [`Vacant ${days} ${days === 1 ? "day" : "days"}.`, u.note].filter(Boolean).join(" ");
  }
  const notice = b.notice(lease.id);
  if (notice) return `Notice received ${dayMonth(notice.filedAt)}. Moves out ${dayMonth(notice.moveOutDate)}.`;
  const overdue = b.overdue(lease.id);
  if (overdue > 0) {
    const age = b.oldestOverdueDays(lease.id);
    const partPaid = b.overdueCharges(lease.id).find((c) => c.paidAmountRwf > 0);
    const reminders = b.v.reminders.filter((r) => r.leaseId === lease.id).length;
    return [
      `${rwf(overdue)} overdue${age > 30 ? `, oldest ${age} days` : ""}.`,
      partPaid ? `${monthName(partPaid.periodMonth)} was part-paid (${rwf(partPaid.paidAmountRwf)}).` : "",
      reminders ? `${reminders} ${reminders === 1 ? "reminder" : "reminders"} sent.` : "",
    ]
      .filter(Boolean)
      .join(" ");
  }
  const charge = b.charge(lease.id, b.month);
  const flight = charge ? b.inFlight(charge.id) : [];
  const offer = b.offer(lease.id);
  if (flight.some((p) => p.status === "unknown")) {
    const p = flight.find((x) => x.status === "unknown") as ApiPayment;
    // Nothing tells the resident anything here: the note says what the manager should do, not what was sent.
    return `${METHOD_LABEL[p.method]} result unknown. Do not ask the resident to pay again until it is resolved.`;
  }
  if (flight.length) {
    const p = flight[0];
    const answer = offer?.status === "open" ? ` Renewal answer due ${dayMonth(offer.answerBy)}.` : "";
    return `${METHOD_LABEL[p.method]} payment of ${rwf(p.amountRwf)} pending.${answer}`;
  }
  if (charge && outstanding(charge) > 0 && charge.dueDate) {
    return `${monthName(charge.periodMonth)} rent due ${dayMonth(charge.dueDate)}.`;
  }
  const request = b.v.accessRequests.find((r) => r.leaseId === lease.id && r.status === "open");
  if (request)
    return `${request.kind === "overnight" ? "Overnight visitor request" : "Gate request"} waiting for your approval.`;
  const ticket = b.openTickets(lease.roomId)[0];
  if (ticket)
    return `${ticket.title} ticket ${ticket.status === "in_progress" ? "in progress" : ticket.status === "open" ? "reported" : "assigned"}.`;
  if (offer?.status === "accepted") {
    // Nothing sends an amendment: e-signature is not built, so no signature is awaited from anyone.
    return `Renewal accepted ${dayMonth(offer.answeredAt ?? offer.sentAt)}. No amendment sent: e-signature is not available yet.`;
  }
  // Only a real filing row says anything about filing; a seeded `mock` row is sample data (filingModes).
  const filing = b.v.filings.find((f) => f.leaseId === lease.id && f.adapterMode === "live");
  if (filing?.status === "pending" && filing.dueBy && kigaliDate(filing.dueBy) < b.today) {
    return `Lease filing deadline passed ${dayMonth(filing.dueBy)}, not recorded as filed.`;
  }
  if (lease.endDate && daysBetween(b.today, lease.endDate) <= 90) {
    return `Lease ends ${dayMonth(lease.endDate)}. Prepare a renewal offer by ${dayMonth(addDays(lease.endDate, -60))}.`;
  }
  if (filing?.status === "pending")
    return lease.landlordSignedAt
      ? `New lease signed ${dayMonth(lease.landlordSignedAt)}. Filing still in draft.`
      : "New lease awaiting the landlord's signature. Filing still in draft.";
  if (charge?.paidAt) return `${monthName(charge.periodMonth)} rent verified on ${dayMonth(charge.paidAt)}.`;
  return "Rent up to date.";
}

export function unitsOf(b: Building): R.ResidenceUnit[] {
  return b.v.units.map((u) => {
    const lease = b.currentByRoom.get(u.roomId);
    return {
      id: u.label,
      block: u.block,
      type: u.type,
      resident: lease?.tenantName ?? "",
      lease: lease?.reference ?? "",
      rent: lease?.monthlyRentRwf ?? u.askingRentRwf,
      status: unitStatus(b, lease),
      note: unitNote(b, u, lease),
    };
  });
}

const COMPACT_RWF = { style: "currency", currency: "RWF", notation: "compact", maximumFractionDigits: 2 } as const;
const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

function homeKpis(b: Building): R.HomeKpi[] {
  const f = b.figures();
  const leased = b.current.length;
  const units = b.v.units.length;
  const vacant = b.vacant;
  const oldest = [...f.inArrears].sort((x, y) => b.oldestOverdueDays(y.id) - b.oldestOverdueDays(x.id))[0];
  const month = monthName(b.month);
  const monthCharges = new Set(f.charges.map((c) => c.id));
  const verifiedMethods = [
    ...new Set(
      b.v.payments
        .filter((p) => p.status === "verified" && monthCharges.has(p.rentChargeId))
        .map((p) => METHOD_LABEL[p.method]),
    ),
  ];
  return [
    {
      id: "leased",
      label: "Leased units",
      value: leased,
      total: units,
      trend: `${pct(leased, units)}%`,
      trendTone: "default",
      trendIcon: "FolderHouse",
      foot: vacant.length
        ? `Vacant: ${vacant.map((u) => `${u.label} for ${b.vacantDays(u)} days`).join(", ")}`
        : "Every unit is let",
      board: "Applicants",
    },
    {
      id: "due",
      label: `Rent due in ${month}`,
      value: f.scheduled,
      format: COMPACT_RWF,
      trend: `${f.charges.length} charges`,
      trendTone: "default",
      trendIcon: "Calendar",
      foot: "Scheduled receivables from active leases",
      board: "RentRoll",
    },
    {
      id: "collected",
      label: "Collected, verified",
      value: f.verified,
      format: COMPACT_RWF,
      trend: `${pct(f.verified, f.scheduled)}%`,
      trendTone: "success",
      trendIcon: "Check",
      // How the month's verified payments were recorded, as the payment rows say, never a list of providers that
      // confirmed them: cash counted at the office is verified too, and no provider confirms anything yet.
      foot: verifiedMethods.length
        ? `Verified payments: ${verifiedMethods.join(", ")}`
        : f.verified > 0
          ? "Paid amounts recorded on the charges"
          : "No payment verified yet this month",
      board: "RentRoll",
    },
    {
      id: "pending",
      label: "Pending verification",
      value: f.pending,
      format: COMPACT_RWF,
      trend: `${f.flight.length} ${f.flight.length === 1 ? "payment" : "payments"}`,
      trendTone: "default",
      trendIcon: "Clock",
      foot: "Not counted as collected yet",
      board: "RentRoll",
    },
    {
      id: "arrears",
      label: "Arrears",
      value: f.arrears,
      format: COMPACT_RWF,
      trend: `${f.inArrears.length} ${f.inArrears.length === 1 ? "resident" : "residents"}`,
      trendTone: "danger",
      trendIcon: "TriangleExclamation",
      foot: oldest ? `Oldest ${b.oldestOverdueDays(oldest.id)} days · ${oldest.unitLabel}` : "Nothing overdue",
      board: "RentRoll",
    },
  ];
}

function rentBuckets(b: Building): R.RentBucket[] {
  const f = b.figures();
  return [
    { id: "scheduled", label: `Scheduled · ${f.charges.length} charges`, amount: f.scheduled },
    { id: "verified", label: `Verified collected · ${f.closed}`, amount: f.verified },
    { id: "pending", label: `Pending verification · ${f.flight.length}`, amount: f.pending },
    { id: "unpaid", label: `Not paid · ${f.unpaidCount}`, amount: f.unpaid },
  ];
}

const AGING = [
  { id: "1-30", label: "1 to 30 days", min: 1, max: 30 },
  { id: "31-60", label: "31 to 60 days", min: 31, max: 60 },
  { id: "61-90", label: "61 to 90 days", min: 61, max: 90 },
  { id: "90+", label: "Over 90 days", min: 91, max: Number.POSITIVE_INFINITY },
];

function arrearsAging(b: Building): R.ArrearsBucket[] {
  const owed = b.current.flatMap((l) =>
    b.overdueCharges(l.id).map((c) => ({ c, unit: l.unitLabel, age: daysBetween(c.dueDate as string, b.today) })),
  );
  return AGING.map((bucket) => {
    const rows = owed.filter((o) => o.age >= bucket.min && o.age <= bucket.max);
    const months = new Set(rows.map((r) => r.c.periodMonth));
    const who = !rows.length
      ? "None"
      : months.size === 1 && rows.every((r) => r.c.paidAmountRwf === 0)
        ? `${rows.map((r) => r.unit).join(", ")} · ${monthName(rows[0].c.periodMonth)} rent`
        : rows
            .map((r) => `${r.unit} ${monthName(r.c.periodMonth)}${r.c.paidAmountRwf > 0 ? " balance" : ""}`)
            .join(", ");
    return { id: bucket.id, label: bucket.label, amount: rows.reduce((n, r) => n + outstanding(r.c), 0), who };
  });
}

function applicantsLine(b: Building, roomId: string): string {
  const open = b.v.applications.filter(
    (a) => a.roomId === roomId && ["invited", "screening", "ready"].includes(a.stage),
  );
  if (!open.length) return "no applicants yet";
  if (open.length === 1) {
    const a = open[0];
    const stage = a.stage === "ready" ? "screening complete" : a.stage === "invited" ? "invited" : "in screening";
    return `1 applicant ${stage}${a.broker ? ", referred by a broker" : ""}`;
  }
  const ready = open.filter((a) => a.stage === "ready").length;
  return `${open.length} applicants${ready ? `, ${ready === 1 ? "one" : ready} screening complete` : ""}`;
}

function vacanciesOf(b: Building): R.Vacancy[] {
  return b.vacant.map((u) => {
    const work = b.openTickets(u.roomId)[0];
    const parts = [
      u.vacantSince ? `Since ${dayMonth(u.vacantSince)}` : "Not let yet",
      work
        ? `${work.title.toLowerCase()}${work.scheduledFor ? ` booked ${dayMonth(work.scheduledFor)}` : ""}`
        : "ready to let",
      applicantsLine(b, u.roomId),
    ];
    return {
      id: u.label,
      unit: u.label,
      type: u.type,
      rent: u.askingRentRwf,
      days: b.vacantDays(u),
      note: parts.join(" · "),
    };
  });
}

function renewalsOf(b: Building): R.RenewalNotice[] {
  const items: (R.RenewalNotice & { rank: number })[] = [];
  for (const l of b.current) {
    const head = `${l.unitLabel} · ${l.tenantName ?? ""}`;
    const notice = b.notice(l.id);
    const offer = b.offer(l.id);
    const id = l.reference ?? l.id;
    if (notice) {
      items.push({
        rank: 1,
        id,
        unit: l.unitLabel,
        icon: "ArrowRightFromSquare",
        title: head,
        desc: `Notice received ${dayMonth(notice.filedAt)} · moves out ${dayMonth(notice.moveOutDate)}`,
        chip: "Move-out",
        chipTone: "info",
        board: "MoveOuts",
      });
    } else if (offer?.status === "open") {
      const days = daysBetween(b.today, offer.answerBy);
      items.push({
        rank: 0,
        id,
        unit: l.unitLabel,
        icon: "ArrowsRotateRight",
        title: head,
        desc: `Renewal offer sent ${dayMonth(offer.sentAt)} at ${rwf(offer.offeredRentRwf)} · answer due ${dayMonth(offer.answerBy)}`,
        chip: days <= 0 ? "Today" : days === 1 ? "1 day" : `${days} days`,
        chipTone: "warning",
        board: "Leases",
      });
    } else if (offer?.status === "accepted") {
      items.push({
        rank: 2,
        id,
        unit: l.unitLabel,
        icon: "Pencil",
        title: head,
        desc: `Renewal accepted ${dayMonth(offer.answeredAt ?? offer.sentAt)} · no amendment sent, e-signature is not available yet`,
        chip: "Not signed",
        chipTone: "default",
        board: "Leases",
      });
    } else if (l.endDate && daysBetween(b.today, l.endDate) <= 90 && offer?.status !== "signed") {
      const days = daysBetween(b.today, l.endDate);
      items.push({
        rank: 3,
        id,
        unit: l.unitLabel,
        icon: "Calendar",
        title: head,
        desc: `Lease ends ${dayMonth(l.endDate)} · prepare an offer by ${dayMonth(addDays(l.endDate, -60))}`,
        chip: `${days} days`,
        chipTone: "default",
        board: "Leases",
      });
    }
  }
  return items.sort((x, y) => x.rank - y.rank).map(({ rank: _, ...item }) => item);
}

// ── Repairs ────────────────────────────────────────────────────────────────────────────────────────

/** A ticket's place: its unit, or the common area it is about. */
const placeOf = (t: ApiTicket) => t.spaceName ?? t.unitLabel ?? "";
const assigneeOf = (t: ApiTicket) => t.assignedToName ?? t.assignedContractor ?? null;
/** "after 17:00" → minutes, for ordering visits on the same day. */
function windowMinutes(w: string | null): number {
  const m = w?.match(/(\d{2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : 24 * 60;
}

function visitOf(b: Building, t: ApiTicket): string {
  if (t.status === "resolved" || t.status === "closed") return t.resolvedAt ? `Done ${dayMonth(t.resolvedAt)}` : "Done";
  if (!t.scheduledFor) return "Not booked";
  const pass = b.v.passes.find(
    (p) =>
      p.kind === "contractor" &&
      p.roomId === t.roomId &&
      (p.status === "approved" || p.status === "expected") &&
      kigaliDate(p.validFrom) === t.scheduledFor,
  );
  const when = `${weekdayShort(t.scheduledFor)} ${dayMonth(t.scheduledFor)}${t.visitWindow ? `, ${t.visitWindow}` : ""}`;
  return pass ? `${when} · access code ${pass.code}` : when;
}

function whoOf(b: Building, t: ApiTicket): string {
  if (t.status === "resolved" || t.status === "closed")
    return t.resolvedAt ? `Fixed ${dayMonth(t.resolvedAt)}` : "Fixed";
  const assignee = assigneeOf(t);
  if (!assignee) {
    const reporter = b.unitLabel(t.leaseId);
    return t.spaceName && reporter ? `Not assigned · from ${reporter}` : "Not assigned";
  }
  if (t.status === "in_progress") return `${assignee} · in progress`;
  if (!t.scheduledFor) return assignee;
  const day = t.scheduledFor === b.today ? "today" : weekdayShort(t.scheduledFor);
  return `${assignee} · ${day}${t.visitWindow ? ` ${t.visitWindow}` : ""}`;
}

function residentOf(b: Building, t: ApiTicket): string {
  const lease = t.leaseId ? b.leaseById.get(t.leaseId) : undefined;
  if (lease?.tenantName) return lease.tenantName;
  return t.spaceName ? "no one (common area)" : "no one (vacant)";
}

function reportedOf(b: Building, t: ApiTicket): string {
  const when = `${dayMonth(t.createdAt)} ${clock(t.createdAt)}`;
  if (t.raisedByRole === "tenant") {
    const reporterUnit = b.unitLabel(t.leaseId);
    const away = reporterUnit && reporterUnit !== placeOf(t) ? ` (${reporterUnit})` : "";
    const via = t.raisedVia ? ` in the ${t.raisedVia}` : "";
    return `Reported by ${t.raisedByName ?? "the resident"}${away}${via} · ${when}`;
  }
  const after = t.raisedVia && t.raisedVia !== "management" ? ` after the ${t.raisedVia}` : "";
  return `Created by ${t.raisedByName ?? "management"}${after} · ${dayMonth(t.createdAt)}`;
}

function entryOf(t: ApiTicket): string {
  if (t.spaceName) return "Not needed · common area";
  if (!t.leaseId) return "Vacant unit · caretaker opens";
  if (t.staffMayEnter === true) return "Yes, if nobody is home";
  if (t.staffMayEnter === false) return "Only when home";
  return "Not asked";
}

function categoryOf(t: ApiTicket): string {
  const label = CATEGORY_LABEL[t.category ?? "other"] ?? "Other";
  if (t.spaceName) return `${label} · common area`;
  if (!t.leaseId) return `${label} · vacant unit`;
  return label;
}

const BOARD_STATUS: Record<string, R.TicketStatus> = {
  open: "new",
  assigned: "assigned",
  in_progress: "progress",
  resolved: "done",
  closed: "done",
};

/** The board: every open repair, and those fixed in the last week ("Fulfilled this week"). */
export function ticketsOf(b: Building): R.ServiceTicket[] {
  const weekAgo = addDays(b.today, -7);
  return b.v.tickets
    .filter(
      (t) =>
        ["open", "assigned", "in_progress"].includes(t.status) ||
        (t.status === "resolved" && t.resolvedAt !== null && kigaliDate(t.resolvedAt) >= weekAgo),
    )
    .map((t) => {
      const tenant = t.leaseId ? b.leaseById.get(t.leaseId)?.tenantName : null;
      const shared = b.v.ticketMessages
        .filter((m) => m.ticketId === t.id)
        .map((m) => ({
          at: m.createdAt,
          from: (m.fromTenant ? "resident" : "manager") as "resident" | "manager",
          text: m.body,
          meta: `${firstName(m.senderName ?? (m.fromTenant ? tenant : "Management"))} · ${dayMonth(m.createdAt)} ${clock(m.createdAt)}`,
        }));
      const notes = b.v.ticketNotes
        .filter((n) => n.ticketId === t.id)
        .map((n) => ({
          at: n.createdAt,
          from: "note" as const,
          text: n.note,
          meta: `Internal note · ${firstName(n.authorName ?? "Management")} · ${dayMonth(n.createdAt)} ${clock(n.createdAt)}`,
        }));
      const thread = [...shared, ...notes].sort((x, y) => x.at.localeCompare(y.at)).map(({ at: _, ...m }) => m);
      const costNote = t.costNote ? (t.costNote.startsWith("unless") ? ` ${t.costNote}` : ` · ${t.costNote}`) : "";
      return {
        id: t.reference ?? t.id,
        unit: placeOf(t),
        title: t.title,
        who: whoOf(b, t),
        status: BOARD_STATUS[t.status] ?? "new",
        category: categoryOf(t),
        resident: residentOf(b, t),
        reported: reportedOf(b, t),
        entry: entryOf(t),
        assignee: assigneeOf(t) ?? "Not assigned",
        visit: visitOf(b, t),
        // Who pays is the API's to say; with none recorded the screen says so, never "Landlord".
        cost: `${t.costBearer ? COST_BEARER[t.costBearer] : "Who pays is not decided yet"}${costNote}`,
        photos: t.photos.flatMap((p) => {
          const key = p.key.startsWith("stock:") ? p.key.slice(6) : "";
          return isStock(key) ? [{ key, alt: p.caption }] : [];
        }),
        thread,
      };
    });
}

/** The home's short list: unassigned work first, then the next visits. */
function homeTicketsOf(b: Building): R.HomeTicket[] {
  const open = b.v.tickets.filter((t) => ["open", "assigned", "in_progress"].includes(t.status));
  const order = (t: ApiTicket) => [
    t.status === "open" ? 0 : 1,
    t.scheduledFor ?? "9999-12-31",
    windowMinutes(t.visitWindow),
    t.createdAt,
  ];
  const sorted = [...open].sort((x, y) => {
    const a = order(x);
    const c = order(y);
    for (let i = 0; i < a.length; i++) if (a[i] !== c[i]) return a[i] < c[i] ? -1 : 1;
    return 0;
  });
  return sorted.slice(0, 4).map((t) => {
    const assignee = assigneeOf(t);
    const vacantUnit = !t.leaseId && !t.spaceName;
    const desc = t.spaceName
      ? `Common area · reported by ${b.unitLabel(t.leaseId) || "management"}`
      : vacantUnit
        ? `Vacant unit${t.scheduledFor ? ` · booked ${dayMonth(t.scheduledFor)}` : ""}`
        : t.status === "in_progress"
          ? `${assignee ?? "Not assigned"} · day ${Math.max(1, daysBetween(kigaliDate(t.createdAt), b.today) + 1)}`
          : `${assignee ?? "Not assigned"}${t.scheduledFor ? ` · ${weekdayShort(t.scheduledFor)} ${dayMonth(t.scheduledFor)}${t.visitWindow ? ` ${t.visitWindow}` : ""}` : ""}`;
    const chip =
      t.status === "open"
        ? { chip: "Not assigned", chipTone: "warning" as const }
        : t.status === "in_progress"
          ? { chip: "In progress", chipTone: "info" as const }
          : vacantUnit
            ? { chip: "Scheduled", chipTone: "default" as const }
            : { chip: "Assigned", chipTone: "info" as const };
    return { id: t.reference ?? t.id, title: `${placeOf(t)} · ${t.title}`, desc, ...chip };
  });
}

// ── Leases ─────────────────────────────────────────────────────────────────────────────────────────

/**
 * A lease's filing row is sample data unless the API marks it `live`. Nothing in the API writes
 * `contract_filings`: every row today is a seeded `mock` one, and a row whose mode the caller cannot read is not
 * shown as a filing either.
 */
function filingIsSample(b: Building, l: ApiLease): boolean {
  const filing = b.v.filings.find((f) => f.leaseId === l.id);
  return !!filing && filing.adapterMode !== "live";
}

function filingOf(b: Building, l: ApiLease): R.Lease["filing"] {
  const filing = b.v.filings.find((f) => f.leaseId === l.id);
  if (!filing) {
    const signed = !!(l.landlordSignedAt && l.tenantSignedAt);
    return {
      stage: "none",
      deadline: "Counts from the last signature",
      delivery: signed ? "Lease filing is not available yet" : "Not applicable until signed",
    };
  }
  // A sample row claims no stage: no step, no "sent", no acknowledgement (record.filingSample labels it).
  if (filing.adapterMode !== "live") {
    return {
      stage: "none",
      deadline: "Not tracked (sample record)",
      delivery: "Sample record · nothing was filed or sent",
    };
  }
  const due = filing.dueBy ? kigaliDate(filing.dueBy) : null;
  // Filed is what the row records; no acknowledgement is stored, so none is claimed.
  if (filing.status === "filed") {
    return {
      stage: "ack",
      deadline: due ? dayMonthYear(due) : "Not set",
      delivery: "Recorded as filed · no acknowledgement on file",
    };
  }
  if (filing.status === "failed") {
    return {
      stage: "followup",
      deadline: due ? dayMonthYear(due) : "Not set",
      delivery: "The filing was refused · try again",
    };
  }
  // Pending means not filed: past its deadline it is overdue, never "sent".
  if (due && due < b.today) {
    return { stage: "followup", deadline: `${dayMonthYear(due)} · passed`, delivery: "Not recorded as filed" };
  }
  return { stage: "draft", deadline: due ? `${dayMonthYear(due)} (configured)` : "Not set", delivery: "Not sent yet" };
}

function offerOf(l: ApiLease, o: ApiOffer): R.RenewalOffer {
  const change = l.monthlyRentRwf ? ((o.offeredRentRwf - l.monthlyRentRwf) / l.monthlyRentRwf) * 100 : 0;
  const events: R.RenewalOffer["events"] = [
    {
      title: "Offer approved and sent",
      when: `${dayMonth(o.sentAt)} · by ${o.sentByName ?? "management"}`,
      status: "success",
    },
  ];
  if (o.openedAt) {
    events.push({
      title: `Opened by ${firstName(l.tenantName)} in the resident app`,
      when: `${dayMonth(o.openedAt)} ${clock(o.openedAt)}`,
      status: "success",
    });
  }
  if (o.status === "open" && o.remindedAt) {
    events.push({ title: "Reminder sent", when: `${dayMonth(o.remindedAt)} · in-app`, status: "current" });
  }
  if (o.answeredAt && o.status !== "open") {
    const word = o.status === "withdrawn" ? "Withdrawn" : o.status === "declined" ? "Declined" : "Accepted";
    events.push({
      title: `${word}${o.status === "withdrawn" ? " by management" : ` by ${l.tenantName ?? "the resident"}`}`,
      when: `${dayMonth(o.answeredAt)} ${clock(o.answeredAt)}`,
      status: "success",
    });
  }
  if (o.status === "accepted")
    events.push({ title: "Amendment to sign", when: "Not sent: e-signature is not available yet", status: "current" });
  const state =
    o.status === "open"
      ? { state: "Waiting for resident", tone: "warning" as const }
      : o.status === "accepted"
        ? { state: "Accepted · to sign", tone: "info" as const }
        : o.status === "signed"
          ? { state: "Signed by both", tone: "success" as const }
          : { state: o.status === "withdrawn" ? "Withdrawn" : "Declined", tone: "default" as const };
  return {
    ...state,
    term: `${dayMonthYear(o.startsOn)} – ${dayMonthYear(o.endsOn)} · ${o.termMonths} months`,
    rent: `${rwf(o.offeredRentRwf)} a month (${change >= 0 ? "+" : ""}${change.toFixed(1)}%)`,
    topup: o.depositTopupRwf ? rwf(o.depositTopupRwf) : "None",
    by:
      o.status === "open"
        ? `${weekday(o.answerBy)} ${dayMonthYear(o.answerBy)}`
        : `Answered ${dayMonth(o.answeredAt ?? o.sentAt)}`,
    note:
      o.status === "open"
        ? `If ${firstName(l.tenantName)} declines or gives notice, the move-out flow starts and the lease ends on ${dayMonth(l.endDate ?? o.startsOn)}. An accepted offer needs an amendment signed by both parties; e-signature is not available yet.`
        : o.status === "accepted"
          ? "No amendment has been sent: e-signature is not available yet, so Injishi has asked nobody to sign."
          : "",
    events,
  };
}

/** Verified rent of this calendar year on a lease. */
function incomeOf(b: Building, l: ApiLease): string {
  if (l.status === "draft" || l.status === "pending_signature") return "RWF 0 (not started)";
  const year = b.today.slice(0, 4);
  const total = b
    .charges(l.id)
    .filter((c) => c.periodMonth.startsWith(year))
    .reduce((n, c) => n + c.paidAmountRwf, 0);
  if (total === 0 && l.startDate && monthOf(l.startDate) === b.month) {
    return `RWF 0 (lease started in ${monthName(b.month)})`;
  }
  return rwf(total);
}

const spaced = (tin: string) => tin.replace(/\D/g, "").replace(/(\d{3})(?=\d)/g, "$1 ");

/** Whole months a term runs, from its first to its last day (1 Nov 2025 – 31 Oct 2026 is 12). */
function termMonthsOf(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const days = Math.round((Date.parse(`${end}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`)) / 86_400_000) + 1;
  return days > 0 ? Math.max(1, Math.round(days / 30.44)) : null;
}

function leaseRecordOf(b: Building, l: ApiLease): LeaseRecord {
  const p = b.v.property;
  return {
    landlord: p?.landlord ?? "",
    landlordId: p?.tin ? `TIN ${spaced(p.tin)}` : p?.upi ? `UPI ${p.upi}` : "",
    deposit: l.cautionRwf,
    graceDays: l.graceDays,
    noticeDays: l.noticePeriodDays,
    termMonths: termMonthsOf(l.startDate, l.endDate),
    tenantSignedOn: l.tenantSignedAt ? dayMonthYear(l.tenantSignedAt) : "",
    landlordSignedOn: l.landlordSignedAt ? dayMonthYear(l.landlordSignedAt) : "",
    filingSample: filingIsSample(b, l),
  };
}

function leasesOf(b: Building): LiveLease[] {
  const units = new Map(b.v.units.map((u) => [u.roomId, u]));
  return b.v.leases
    .filter((l) => !["ended", "cancelled"].includes(l.status))
    .map((l): LiveLease => {
      const notice = b.notice(l.id);
      const offer = b.offer(l.id);
      const filing = filingOf(b, l);
      const status = notice
        ? { status: "Notice given", statusTone: "accent" as const }
        : offer?.status === "open"
          ? { status: "Renewal offered", statusTone: "warning" as const }
          : offer?.status === "accepted"
            ? { status: "Renewal accepted", statusTone: "info" as const }
            : l.status === "draft"
              ? { status: "Draft", statusTone: "default" as const }
              : l.status === "pending_signature"
                ? { status: "Out for signature", statusTone: "info" as const }
                : filing.stage === "draft"
                  ? { status: "Filing draft", statusTone: "warning" as const }
                  : { status: "Active", statusTone: "success" as const };
      const signed = [l.tenantSignedAt, l.landlordSignedAt]
        .filter((s): s is string => !!s)
        .sort()
        .at(-1);
      const charge = b.charge(l.id, b.month);
      const state = isCurrent(l) ? monthState(b, charge, l) : "none";
      const owing = b.overdue(l.id);
      const rentChip =
        owing > 0
          ? { label: "In arrears", tone: "danger" as const }
          : state === "pending"
            ? { label: "Payment pending", tone: "info" as const }
            : state === "unknown"
              ? { label: "Result unknown", tone: "warning" as const }
              : undefined;
      const open = b.openTickets(l.roomId);
      const occupant = l.occupants?.split(",")[0]?.trim();
      return {
        id: l.reference ?? l.id,
        unit: l.unitLabel,
        type: units.get(l.roomId)?.type ?? "",
        resident: l.tenantName ?? "",
        ...status,
        start: l.startDate ? dayMonthYear(l.startDate) : "",
        end: l.endDate ? dayMonthYear(l.endDate) : "",
        rent: l.monthlyRentRwf ?? 0,
        dueDay: ordinal(l.rentDueDay ?? 1),
        signedOn: l.status === "draft" || !signed ? "" : dayMonthYear(signed),
        filing,
        income: incomeOf(b, l),
        record: leaseRecordOf(b, l),
        ...(occupant
          ? { occupant: { name: occupant, initials: initials(occupant), sub: "Named occupant · not a signatory" } }
          : {}),
        ...(rentChip ? { rentChip } : {}),
        ...(open.length
          ? {
              maintenance: {
                desc: `${open[0].title} · ${whoOf(b, open[0])}`,
                chip: `${open.length} open`,
                tone: "info" as const,
              },
            }
          : {}),
        ...(offer && (offer.status === "open" || offer.status === "accepted") ? { offer: offerOf(l, offer) } : {}),
        ...(notice
          ? {
              renewalNote: `${firstName(l.tenantName)} gave notice on ${dayMonth(notice.filedAt)}. The move-out is tracked in Move-outs.`,
            }
          : {}),
      };
    });
}

function acceptedRenewalsOf(b: Building): R.AcceptedRenewal[] {
  return b.v.offers
    .filter((o) => o.status === "accepted" || o.status === "signed")
    .flatMap((o) => {
      const l = b.leaseById.get(o.leaseId);
      if (!l) return [];
      const answered = dayMonth(o.answeredAt ?? o.sentAt);
      return [
        {
          id: l.unitLabel,
          title: `${l.unitLabel} · ${l.tenantName ?? ""}`,
          desc:
            o.status === "signed"
              ? `Accepted ${answered} · amendment signed by both ${dayMonth(o.signedAt ?? o.answeredAt ?? o.sentAt)}`
              : // Nothing sends an amendment (offerOf: "Not sent: e-signature is not available yet").
                `Accepted ${answered} · no amendment sent, e-signature is not available yet`,
          chip: o.status === "signed" ? "Signed" : "Not signed",
          chipTone: o.status === "signed" ? ("success" as const) : ("warning" as const),
        },
      ];
    });
}

// ── Rent ───────────────────────────────────────────────────────────────────────────────────────────

function rentKpis(b: Building): R.RentKpi[] {
  const f = b.figures();
  const oldest = Math.max(0, ...f.inArrears.map((l) => b.oldestOverdueDays(l.id)));
  const flightWords = f.flight.map((p) => {
    const unit = b.unitLabel(p.leaseId);
    const short = p.method === "mtn_momo" ? "MoMo" : p.method === "airtel_money" ? "Airtel" : METHOD_LABEL[p.method];
    return `${unit} ${short} ${p.status === "unknown" ? "unknown" : "pending"}`;
  });
  const vacant = b.vacant;
  return [
    {
      id: "scheduled",
      label: "Scheduled",
      value: f.scheduled,
      foot: `${f.charges.length} ${monthName(b.month)} charges`,
    },
    {
      id: "collected",
      label: "Collected, verified",
      value: f.verified,
      foot: `${f.closed} charges closed · ${pct(f.verified, f.scheduled)}%`,
    },
    {
      id: "pending",
      label: "Pending verification",
      value: f.pending,
      foot: flightWords.length ? flightWords.join(" · ") : "Nothing waiting",
    },
    {
      id: "overdue",
      label: "Overdue",
      value: f.arrears,
      foot: f.inArrears.length ? `${f.inArrears.length} residents · oldest ${oldest} days` : "Nothing overdue",
    },
    {
      id: "vacancy",
      label: "Vacancy",
      value: vacant.reduce((n, u) => n + u.askingRentRwf, 0),
      foot: vacant.length ? `${vacant.map((u) => u.label).join(" and ")} · not a receivable` : "No vacant units",
    },
  ];
}

export function rentRollOf(b: Building): R.RentRollRow[] {
  const months = [-3, -2, -1, 0].map((d) => shiftMonth(b.month, d));
  return b.current
    .filter((l) => b.charges(l.id).length > 0)
    .map((l) => {
      const history = months.map((m) => monthState(b, b.charge(l.id, m), l));
      const charge = b.charge(l.id, b.month);
      const overdue = b.overdue(l.id);
      const now = history[3];
      const status: R.RentStatus =
        overdue > 0
          ? "arrears"
          : now === "unknown"
            ? "unknown"
            : now === "pending" || now === "unpaid"
              ? "pending"
              : "paid";
      return {
        id: l.unitLabel,
        name: l.tenantName ?? "",
        lease: l.reference ?? "",
        due: ordinal(l.rentDueDay ?? 1),
        rent: l.monthlyRentRwf ?? 0,
        history,
        verified: charge?.paidAmountRwf ?? 0,
        overdue,
        status,
      };
    });
}

const REMINDER_TITLE: Record<ApiResidenceView["reminders"][number]["channel"], string> = {
  in_app: "In-app reminder",
  in_app_email: "In-app and email reminder",
  email: "Email",
  call: "Call",
  letter: "Formal letter",
};

/** The ledger of every tenancy with something open: its open charges and the payments meant for them. */
function rentLedgersOf(b: Building): R.RentLedger[] {
  return b.current.flatMap((l) => {
    const open = b.charges(l.id).filter((c) => outstanding(c) > 0);
    if (!open.length) return [];
    const ledger: R.LedgerEntry[] = [];
    for (const c of open) {
      const due = c.dueDate ?? c.periodMonth;
      const notDue = due >= b.today;
      ledger.push({
        icon: "FileDollar",
        title: `${monthName(c.periodMonth)} rent`,
        desc: notDue
          ? `Due ${dayMonth(due)} · ${due === b.today ? "due today" : "not yet due"}`
          : c.paidAmountRwf > 0
            ? `Charged ${dayMonth(due)} · ${rwf(c.paidAmountRwf)} paid · ${rwf(outstanding(c))} open`
            : `Charged ${dayMonth(due)} · nothing paid`,
        amount: c.amountRwf,
        state: c.paidAmountRwf > 0 ? "Part-paid" : "Open",
        tone: notDue ? "default" : "danger",
      });
      for (const p of b.payments(c.id)) {
        const mobile = p.method === "mtn_momo" || p.method === "airtel_money";
        const month = monthName(c.periodMonth);
        const desc =
          p.status === "verified"
            ? `ref ${p.providerRef} · ${dayMonth(p.receivedAt)} ${clock(p.receivedAt)} · allocated to ${month} rent`
            : p.status === "pending"
              ? `ref ${p.providerRef} · received ${dayMonth(p.receivedAt)} ${clock(p.receivedAt)}${p.recordedByName ? ` · recorded by ${p.recordedByName}` : ""} · allocated to ${month} rent once verified`
              : p.status === "unknown"
                ? `ref ${p.providerRef} · started ${clock(p.receivedAt)} · provider result unknown · do not ask for payment again yet`
                : `ref ${p.providerRef} · failed`;
        ledger.push({
          icon: mobile ? "Smartphone" : "Receipt",
          title: `${METHOD_LABEL[p.method]} payment`,
          desc,
          amount: p.amountRwf,
          state:
            p.status === "verified"
              ? "Verified"
              : p.status === "pending"
                ? "Pending"
                : p.status === "unknown"
                  ? "Unknown"
                  : "Failed",
          tone:
            p.status === "verified"
              ? "success"
              : p.status === "pending"
                ? "info"
                : p.status === "unknown"
                  ? "warning"
                  : "danger",
        });
      }
    }
    const sent = b.v.reminders.filter((r) => r.leaseId === l.id);
    const reminders = sent.map((r, i) => {
      const title =
        r.channel === "call"
          ? `Call by ${firstName(r.sentByName) || "management"} · ${r.note.replace(/^Call:\s*/, "")}`
          : r.channel === "email"
            ? r.note
            : REMINDER_TITLE[r.channel];
      const delivery =
        r.channel === "in_app" || r.channel === "in_app_email"
          ? r.readAt
            ? `read ${dayMonth(r.readAt)}`
            : "not read yet"
          : r.channel === "letter"
            ? "to deliver by hand"
            : r.channel === "email"
              ? "email sent"
              : "note logged";
      return {
        title,
        when: `${dayMonth(r.sentAt)} · ${delivery}`,
        status: (i === sent.length - 1 ? "current" : "success") as "current" | "success",
      };
    });
    return [{ id: l.unitLabel, ledger, reminders }];
  });
}

function payoutsOf(b: Building): R.LandlordPayout[] {
  const landlord = b.v.property?.landlord ?? "the landlord";
  const unverified = b.figures().flight.length;
  return b.v.payouts.map((p) => {
    const period = p.periodMonth ?? b.month;
    const label = `${monthName(period)} ${period.slice(0, 4)}`;
    const settled = p.status === "paid";
    return {
      id: period.slice(0, 7),
      title: settled ? `${label} rent` : `${label} to date`,
      desc: settled
        ? `Settled to ${landlord} · ${p.destinationRef ?? "account on file"}${p.settledAt ? ` · settled ${dayMonth(p.settledAt)}` : ""}`
        : `Verified payments only · ${unverified} unverified ${unverified === 1 ? "payment" : "payments"} excluded`,
      amount: p.amountRwf,
      state: settled ? "Settled" : p.status === "held" ? "Held" : "In settlement",
      tone: settled ? "success" : p.status === "held" ? "warning" : "info",
    };
  });
}

function depositKpisOf(b: Building): R.DepositKpi[] {
  const held = b.v.deposits.filter((d) => d.status === "held");
  const settling = held.filter((d) => {
    const l = b.leaseById.get(d.leaseId);
    return l && !isCurrent(l);
  });
  const notices = b.v.notices.filter((n) => {
    const l = b.leaseById.get(n.leaseId);
    return l && isCurrent(l) && n.moveOutDate >= b.today;
  });
  const quarterAgo = addDays(b.today, -92);
  const refunded = b.v.deposits.filter(
    (d) => d.settledAt && kigaliDate(d.settledAt) >= quarterAgo && (d.refundedRwf ?? 0) > 0,
  );
  const label = (leaseId: string) => b.unitLabel(leaseId);
  return [
    {
      id: "held",
      label: "Caution deposits held",
      value: held.reduce((n, d) => n + d.amountRwf, 0),
      format: "currency",
      foot: `${held.length} deposits · a liability, not income`,
    },
    {
      id: "settlement",
      label: "In settlement",
      value: settling.reduce((n, d) => n + d.amountRwf, 0),
      format: "currency",
      foot: settling.length ? `${settling.map((d) => label(d.leaseId)).join(", ")} · previous resident` : "None",
    },
    {
      id: "notices",
      label: "Notices running",
      value: notices.length,
      format: "count",
      foot: notices.length
        ? notices.map((n) => `${label(n.leaseId)} moves out ${dayMonth(n.moveOutDate)}`).join(", ")
        : "No notices",
    },
    {
      id: "refunded",
      label: "Refunded this quarter",
      value: refunded.reduce((n, d) => n + (d.refundedRwf ?? 0), 0),
      format: "currency",
      foot: refunded.length
        ? refunded.map((d) => `${label(d.leaseId)} · verified ${dayMonth(d.settledAt as string)}`).join(", ")
        : "None",
    },
  ];
}

// ── Visitors and access ────────────────────────────────────────────────────────────────────────────

/** "Today 14:00–20:00", "Tue 13 Oct 09:30–12:30". */
export function windowOf(today: string, from: string, to: string): string {
  const day = kigaliDate(from);
  const lastDay = kigaliDate(to);
  const head = day === today ? "Today" : `${weekdayShort(day)} ${dayMonth(day)}`;
  const tail = lastDay === day ? clock(to) : `${dayMonth(lastDay)} ${clock(to)}`;
  return `${head} ${clock(from)}–${tail}`;
}

function accessRequestsOf(b: Building): R.AccessRequest[] {
  return b.v.accessRequests.map((r) => {
    const l = b.leaseById.get(r.leaseId);
    const unit = l?.unitLabel ?? "";
    const visitor = r.visitorName ?? "a visitor";
    if (r.kind === "overnight") {
      const nights = r.forDate && r.toDate ? daysBetween(r.forDate, r.toDate) : 0;
      const range =
        r.forDate && r.toDate
          ? r.forDate.slice(0, 7) === r.toDate.slice(0, 7)
            ? `${Number(r.forDate.slice(8))}–${dayMonth(r.toDate)}`
            : `${dayMonth(r.forDate)}–${dayMonth(r.toDate)}`
          : "";
      return {
        id: r.id,
        icon: "Moon",
        title: `${unit} · ${l?.tenantName ?? "Resident"} asks for an overnight visitor`,
        desc: [visitor, nights ? `${nights} nights, ${range}` : "", r.reason ?? ""].filter(Boolean).join(" · "),
        approveLabel: "Approve overnight visit",
        status: r.status,
      };
    }
    return {
      id: r.id,
      icon: r.kind === "delivery" ? "Box" : "Person",
      title: `Gate · ${visitor} for ${unit} without a code`,
      desc: r.reason ?? "",
      approveLabel: r.kind === "delivery" ? "Leave parcel at the gate office" : "Let them in",
      status: r.status,
    };
  });
}

const PASS_STATE: Record<ApiPass["status"], { state: string; tone: R.Tone }> = {
  expected: { state: "Expected", tone: "info" },
  approved: { state: "Approved", tone: "success" },
  used: { state: "Visited", tone: "default" },
  expired: { state: "Expired", tone: "default" },
  revoked: { state: "Revoked", tone: "default" },
};

/** Codes the gate honours, and those that lapsed this week. */
function visitorsOf(b: Building): R.PreregisteredVisitor[] {
  const weekAgo = addDays(b.today, -7);
  return b.v.passes
    .filter(
      (p) =>
        p.status === "expected" ||
        p.status === "approved" ||
        (p.status === "expired" && kigaliDate(p.validTo) >= weekAgo),
    )
    .sort(
      (x, y) =>
        (x.status === "expired" ? 1 : 0) - (y.status === "expired" ? 1 : 0) || x.validFrom.localeCompare(y.validFrom),
    )
    .map((p) => {
      const lease = p.leaseId ? b.leaseById.get(p.leaseId) : undefined;
      return {
        id: p.id,
        initials: initials(p.visitorName),
        name: p.visitorName,
        unit: p.unitLabel,
        window: `${windowOf(b.today, p.validFrom, p.validTo)}${p.kind === "contractor" ? " · contractor" : ""}`,
        by: p.createdByName ?? (p.byTenant ? (lease?.tenantName ?? "the resident") : "Management"),
        code: p.code,
        ...PASS_STATE[p.status],
      };
    });
}

function visitorLogOf(b: Building): R.VisitorLogEntry[] {
  const kept = addDays(b.today, -90);
  return b.v.visitorLog
    .filter((v) => !v.arrivalAt || kigaliDate(v.arrivalAt) >= kept)
    .map((v) => {
      const lease = v.leaseId ? b.leaseById.get(v.leaseId) : undefined;
      const unit = v.unitLabel ? `${v.unitLabel} · ${lease?.tenantName ?? "vacant unit"}` : (v.place ?? "");
      const arrived = v.arrivalAt
        ? kigaliDate(v.arrivalAt) === b.today
          ? `Today ${clock(v.arrivalAt)}`
          : `${dayMonth(v.arrivalAt)} ${clock(v.arrivalAt)}`
        : "";
      return {
        id: v.id,
        name: v.visitorName,
        phone: v.visitorPhone ?? "",
        unit,
        how: v.admittedHow ?? "",
        arrived,
        left: v.departureAt ? clock(v.departureAt) : "Still inside",
        by: v.recordedBy ?? "",
      };
    });
}

// ── Applicants ─────────────────────────────────────────────────────────────────────────────────────

const SCREENING = ["identity", "income", "employment", "reference", "balance", "rules"];
const DOC_STATE: Record<string, { state: string; tone: R.Tone }> = {
  checked: { state: "Checked", tone: "success" },
  uploaded: { state: "Uploaded", tone: "default" },
  waiting: { state: "Waiting", tone: "warning" },
  requested: { state: "Requested", tone: "warning" },
};
const AVATAR_TONES: R.Tone[] = ["accent", "success", "default", "info", "warning"];

/** "+250 788 •• 31 07". */
function maskPhone(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) return "•••";
  return `+${digits.slice(0, 3)} ${digits.slice(3, 6)} •• ${digits.slice(-4, -2)} ${digits.slice(-2)}`;
}
/** "sandrine.iradukunda@…" → "s.iradukunda@…". */
function maskEmail(email: string | null): string | null {
  if (!email) return null;
  const [local] = email.split("@");
  const parts = local.split(".");
  return `${parts.length > 1 ? `${parts[0].charAt(0)}.${parts.slice(1).join(".")}` : local}@…`;
}

function applicantsOf(b: Building): R.Applicant[] {
  const units = new Map(b.v.units.map((u) => [u.roomId, u]));
  return b.v.applications
    .filter((a) => a.stage === "invited" || a.stage === "screening" || a.stage === "ready")
    .map((a, i) => {
      const stage =
        a.stage === "ready"
          ? { stage: "Ready", stageTone: "success" as const }
          : a.stage === "invited"
            ? { stage: "Invited", stageTone: "default" as const }
            : { stage: "Screening", stageTone: "info" as const };
      const tone = AVATAR_TONES[(a.name.length + i) % AVATAR_TONES.length];
      const source = a.broker
        ? `Referred by ${a.broker.name}`
        : a.stage === "invited"
          ? "Invited · not registered yet"
          : "Invitation";
      if (a.stage === "invited") {
        return {
          id: a.id,
          name: a.name,
          initials: initials(a.name),
          avatarTone: tone,
          unit: a.unitLabel,
          source,
          ...stage,
          profile: null,
          // Nothing is sent to an invited applicant (ApplicantsView: inviting is not available yet), so the note
          // says when they were added and that Injishi sent them nothing, never an email or an expiry.
          pendingNote: `Added as invited on ${dayMonth(a.createdAt)} for ${a.unitLabel}. Injishi has sent them nothing: sending invitations is not available yet. Their profile, documents and screening appear here once they register.`,
        };
      }
      const unit = units.get(a.roomId);
      return {
        id: a.id,
        name: a.name,
        initials: initials(a.name),
        avatarTone: tone,
        unit: a.unitLabel,
        source,
        ...stage,
        profile: {
          unitLabel: `${a.unitLabel} · ${unit?.type ?? ""}`,
          contact: [maskPhone(a.phone), maskEmail(a.email)].filter(Boolean).join(" · "),
          registered: dayMonth(a.createdAt),
          moveIn: a.desiredMoveIn ? dayMonthYear(a.desiredMoveIn) : "Not given",
          term: a.termMonths ? `${a.termMonths} months` : "Not given",
          occupants: a.occupants ?? "Not given",
          rent: a.offeredRentRwf ?? unit?.askingRentRwf ?? 0,
          deposit: a.depositRwf ?? 0,
          status: a.stage === "ready" ? "Ready for lease" : "Screening",
          statusTone: a.stage === "ready" ? "success" : "info",
          broker: a.broker
            ? {
                name: a.broker.name,
                initials: initials(a.broker.name),
                detail: `Residence broker · referral recorded ${dayMonth(a.broker.referredAt)} ${clock(a.broker.referredAt)}`,
                fee: a.broker.feeRwf,
                terms: a.broker.terms,
                due: "Only if a lease is signed",
              }
            : null,
          sourceLong: a.source,
          docs: a.documents.map((d) => ({ name: d.name, meta: d.note, ...(DOC_STATE[d.state] ?? DOC_STATE.uploaded) })),
          checks: SCREENING.map((c) => a.screening.includes(c)),
        },
      };
    });
}

// ── The sources ────────────────────────────────────────────────────────────────────────────────────

export const sources = defineSources({
  "residence.blocks": {
    naturalKey: "id",
    async list(ctx): Promise<R.ResidenceBlock[]> {
      return (await read(ctx)).v.blocks.map((bl) => ({ id: bl.code, name: bl.name, kind: bl.kind }));
    },
  },
  "residence.units": {
    naturalKey: "id",
    async list(ctx): Promise<R.ResidenceUnit[]> {
      return unitsOf(await read(ctx));
    },
  },
  "residence.homeKpis": {
    naturalKey: "id",
    async list(ctx): Promise<R.HomeKpi[]> {
      return homeKpis(await read(ctx));
    },
  },
  "residence.rentBuckets": {
    naturalKey: "id",
    async list(ctx): Promise<R.RentBucket[]> {
      return rentBuckets(await read(ctx));
    },
  },
  "residence.arrearsAging": {
    naturalKey: "id",
    async list(ctx): Promise<R.ArrearsBucket[]> {
      return arrearsAging(await read(ctx));
    },
  },
  "residence.vacancies": {
    naturalKey: "unit",
    async list(ctx): Promise<R.Vacancy[]> {
      return vacanciesOf(await read(ctx));
    },
  },
  "residence.renewals": {
    naturalKey: "id",
    async list(ctx): Promise<R.RenewalNotice[]> {
      return renewalsOf(await read(ctx));
    },
  },
  "residence.homeTickets": {
    naturalKey: "id",
    async list(ctx): Promise<R.HomeTicket[]> {
      return homeTicketsOf(await read(ctx));
    },
  },
  "residence.applicants": {
    naturalKey: "name",
    async list(ctx): Promise<R.Applicant[]> {
      return applicantsOf(await read(ctx));
    },
  },
  "residence.leases": {
    naturalKey: "id",
    async list(ctx): Promise<LiveLease[]> {
      return leasesOf(await read(ctx));
    },
  },
  "residence.leaseClauses": {
    naturalKey: "id",
    async list(ctx): Promise<R.LeaseClause[]> {
      return (await read(ctx)).v.clauses.map((c) => ({
        id: c.code,
        title: c.title,
        note: c.note,
        ...(c.needsReview ? { review: true } : {}),
      }));
    },
  },
  "residence.acceptedRenewals": {
    naturalKey: "id",
    async list(ctx): Promise<R.AcceptedRenewal[]> {
      return acceptedRenewalsOf(await read(ctx));
    },
  },
  "residence.rentKpis": {
    naturalKey: "id",
    async list(ctx): Promise<R.RentKpi[]> {
      return rentKpis(await read(ctx));
    },
  },
  "residence.rentRoll": {
    naturalKey: "id",
    async list(ctx): Promise<R.RentRollRow[]> {
      return rentRollOf(await read(ctx));
    },
  },
  "residence.rentLedgers": {
    naturalKey: "id",
    async list(ctx): Promise<R.RentLedger[]> {
      return rentLedgersOf(await read(ctx));
    },
  },
  // Keyed by the month a settlement covers: the prototype's September and October are this month and last.
  "residence.payouts": {
    parity: "shape",
    async list(ctx): Promise<R.LandlordPayout[]> {
      return payoutsOf(await read(ctx));
    },
  },
  "residence.depositKpis": {
    naturalKey: "id",
    async list(ctx): Promise<R.DepositKpi[]> {
      return depositKpisOf(await read(ctx));
    },
  },
  "residence.tickets": {
    naturalKey: "id",
    async list(ctx): Promise<R.ServiceTicket[]> {
      return ticketsOf(await read(ctx));
    },
  },
  "residence.accessRequests": {
    naturalKey: "title",
    async list(ctx): Promise<R.AccessRequest[]> {
      return accessRequestsOf(await read(ctx));
    },
  },
  "residence.visitors": {
    naturalKey: "code",
    async list(ctx): Promise<R.PreregisteredVisitor[]> {
      return visitorsOf(await read(ctx));
    },
  },
  "residence.visitorLog": {
    naturalKey: "name",
    async list(ctx): Promise<R.VisitorLogEntry[]> {
      return visitorLogOf(await read(ctx));
    },
  },
});
