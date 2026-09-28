/**
 * PMS domain types for the demo data layer.
 *
 * These deliberately mirror the shape the API will return once the F-P* modules
 * land (architecture-schema.md §14), so Phase 4 swaps the adapter under the
 * store rather than rewriting the screens. Canonical enum values are kept in
 * the data (`needs`, `inhouse`); friendlier display labels live in the UI
 * (ui-glossary.md §13).
 */

/** Housekeeping status — orthogonal to availability (D15 / F-P04). */
export type HkStatus = "ready" | "needs" | "cleaning" | "inspected";

/** Stored reservation states. `arriving`/`departing` are derived, never stored. */
export type ResStatus = "pending" | "confirmed" | "inhouse" | "out" | "declined";

export type TicketState = "open" | "assigned" | "progress" | "resolved";

export type OrderState = "new" | "prep" | "way" | "done";

export type LeaseState = "draft" | "awaiting" | "active" | "ending" | "ended";

export type RentState = "paid" | "due" | "overdue";

/**
 * Staff role inside a business workspace. Re-exported from `@injishi/contracts`
 * rather than declared here: this app, the API, and the `org_role` Postgres
 * enum must be the same set, and a hand-kept fourth copy is how `housekeeper`
 * came to exist in the app but not in the database (Spec 0002).
 */
export type { OrgRole } from "@injishi/contracts";

/**
 * A workspace is what you are doing, not who you are — one account can hold
 * several. Three kinds here, all supply side. Personal left for `apps/web` in
 * ADR-018 move 4: a guest who operates nothing should never be sent to a tool
 * built for hotel staff, and the landing order in `lib/nav.ts` had been saying
 * so as a workaround.
 *
 * The two government consoles are NOT workspace kinds and never were:
 * an officer's authority is an assignment against a district, so it could not be
 * addressed by a workspace id even in principle. They left for their own app
 * (ADR-018, move 2), and this union is the shape that fact makes true.
 *
 */
export type WorkspaceKey = "host" | "landlord" | "broker";

export type PropertyKey = "hotel" | "guesthouse";

export type Intent = "ok" | "warn" | "bad" | "info" | "accent" | "neutral";

export interface Room {
  id: string;
  type: string;
  rate: number;
  hk: HkStatus;
  /** Out of service, with the reason — usually the maintenance ticket. */
  oos?: string;
}

/**
 * `start` is a day offset from today (negative = already in-house). The
 * prototype's relative model is kept for the demo so the dataset never goes
 * stale; the API will return real dates.
 */
export interface Reservation {
  id: string;
  guest: string;
  room: string | null;
  start: number;
  nights: number;
  status: ResStatus;
  /** Guest reputation line, shown on pending requests. */
  rep?: string;
  /** Expected arrival/departure clock time. */
  time?: string;
  walkin?: boolean;
  /** Rate override captured at check-in; falls back to the room's rate. */
  rateOv?: number;
  /** Charges posted during this session: [department, label, amount]. */
  xLines?: [string, string, number][];
  /** Payments taken during this session: [label, amount]. */
  xPay?: [string, number][];
  closed?: boolean;
  invoice?: string;
}

/** Seeded folio history: charges are [dept, label, dayOffset, amount]. */
export interface Extras {
  lines: [string, string, number, number][];
  pay: [string, number, number][];
}

export interface CleaningTask {
  room: string;
  kind: string;
  ts: string;
  /** The housekeeper it is assigned to, or null for the shared list. */
  who?: string | null;
  started?: boolean;
}

export interface Ticket {
  id: string;
  /** Room number, or a common area ("Pool", "Lobby", "Compound"). */
  room: string;
  fault: string;
  title: string;
  by: string;
  age: string;
  st: TicketState;
  to?: string;
  /** Photo placeholder caption — the real ticket leads with the image. */
  ph: string;
}

export interface ServiceOrder {
  id: string;
  room: string;
  guest: string;
  dept: string;
  items: string[];
  total: number;
  age: string;
  st: OrderState;
}

/** A menu item: [name, price, available]. */
export type MenuItem = [string, number, boolean];

/** A staff group: [department, [[name, position, role], …]]. */
export type StaffGroup = [string, [string, string, string][]];

export interface DeptRevenue {
  month: string;
  /** [department, revenue, direct costs]. */
  depts: [string, number, number][];
  /** [label, amount] — expenses no department carries. */
  undistributed: [string, number][];
}

export interface HospitalityProperty {
  key: PropertyKey;
  name: string;
  loc: string;
  sq: string;
  departments: string[];
  rooms: Room[];
  /** The sell-side of inventory: what a guest gets, and the terms it sells on. */
  roomTypes: RoomType[];
  /** Property-scoped amenity codes from the catalogue. */
  propAmen: string[];
  /** Shared spaces guests see on the listing — describable, never bookable. */
  shared: string[];
  res: Reservation[];
  extras: Record<string, Extras>;
  tasks: CleaningTask[];
  tickets: Ticket[];
  orders: ServiceOrder[];
  menu: Record<string, MenuItem[]>;
  staff: StaffGroup[];
  threads: Thread[];
  rev: DeptRevenue;
  invSeq: number;
  msgs: number;
}

export interface Unit {
  id: string;
  type: string;
  rent: number;
}

export interface Lease {
  id: string;
  tenant: string;
  unit: string;
  rent: number;
  start: string;
  end: string;
  st: LeaseState;
  pay?: RentState;
  payLine?: string;
  depReturned?: boolean;
}

export interface ResidenceProperty {
  key: "residence";
  name: string;
  loc: string;
  sq: string;
  fixer: string;
  units: Unit[];
  leases: Lease[];
  tickets: Ticket[];
  staff: StaffGroup[];
  threads: Thread[];
  /** Unit ids currently listed to brokers. Only vacant units may be listed. */
  dirListed: string[];
  /** Contact reveals spent by brokers against this portfolio. */
  reveals: number;
  msgs: number;
}

/* ── Conversations ──────────────────────────────────────────────────────── */

/**
 * Who wrote a message, from the operator's side.
 *
 * `them`/`me` belong to the demand side, where the person is the guest or tenant
 * rather than the business. That surface moved to `apps/web` in ADR-018 move 4;
 * the two authors stay in the union because a thread carries both halves and the
 * operator reads what the guest wrote.
 */
export type MessageAuthor = "guest" | "host" | "tenant" | "them" | "me";

export interface Message {
  from: MessageAuthor;
  text: string;
  /** Clock time, or a day-qualified one ("Yesterday 21:04") for older messages. */
  ts: string;
}

/**
 * A thread is always about something — a reservation, a lease, a trip. There is
 * no free-floating inbox: `kind` is the context line the operator reads first.
 */
export interface Thread {
  id: string;
  /** The other party, named from the operator's side. */
  with: string;
  kind: string;
  /** The reservation / lease / booking this thread hangs off. */
  ref?: string;
  unread: boolean;
  msgs: Message[];
}

/* ── Rooms & rates (the sell-side of inventory) ─────────────────────────── */

/** How a rate responds to its parent — "Non-refundable follows Flexible −10%". */
export interface RatePlanFollows {
  parent: string;
  pct: number;
}

export type CancelPolicy = "flex" | "mod" | "nr";
export type BookingMode = "instant" | "request";

export interface RatePlan {
  id: string;
  name: string;
  price: number;
  baseOcc: number;
  cancel: CancelPolicy;
  mode: BookingMode;
  minN: number;
  follows?: RatePlanFollows;
}

/** [bed code, count] — the code is from the fixed catalogue, never free text. */
export type BedSpec = [string, number];

export interface BedConfig {
  /** The configuration sold by default when a guest doesn't choose. */
  def: boolean;
  beds: BedSpec[];
}

export interface Bedroom {
  name: string;
  configs: BedConfig[];
}

export interface Occupancy {
  max: number;
  adults: number;
  children: number;
}

export interface RoomType {
  key: string;
  name: string;
  /** Square metres, or null while the type is still a draft. */
  size: number | null;
  occ: Occupancy;
  st: "published" | "draft";
  /** Amenity codes from the catalogue, room-scoped only. */
  amen: string[];
  bedrooms: Bedroom[];
  plans: RatePlan[];
}

/* ── Broker workspace ───────────────────────────────────────────────────── */

export interface DirectoryListing {
  id: string;
  type: string;
  loc: string;
  rent: number;
  /** Deposit, expressed the way Rwandan lettings do — "1 month". */
  caution: string;
  landlord: string;
  phone: string;
  /** A reveal is spent, logged, and cannot be taken back. */
  revealed: boolean;
}

export type PlacementState = "none" | "progress" | "awaiting" | "disbursed";

export interface Placement {
  tenant: string | null;
  unit: string | null;
  landlord: string;
  lease: string | null;
  fee: number | null;
  st: PlacementState;
}

export type LedgerState = "pending" | "disbursed";

/** [label, when, amount, state]. A fee is pending until its lease activates. */
export type LedgerLine = [string, string, number, LedgerState];

export interface BrokerData {
  key: "broker";
  name: string;
  dir: DirectoryListing[];
  placements: Placement[];
  ledger: LedgerLine[];
  /** Reveals left this period. */
  reveals: number;
}

/* ── Personal workspace ─────────────────────────────────────────────────── */

export interface Trip {
  id: string;
  prop: string;
  loc: string;
  dates: string;
  guests: string;
  amt: number;
  st: "confirmed" | "pending";
  /** Hours left for the host to answer a request. */
  hrs?: number;
  /** Photo placeholder caption — the real card leads with the image. */
  ph: string;
}

export interface PastStay {
  id: string;
  prop: string;
  dates: string;
  reviewed: boolean;
  stars?: string;
  ph: string;
}

/** The same tenancy the landlord sees on the rent roll, from the tenant's side. */
export interface TenantLease {
  prop: string;
  unit: string;
  rent: number;
  period: string;
  landlord: string;
  pay: RentState;
  payLine: string;
  deposit: number;
}

/** [label, date, amount]. */
export type RentPayment = [string, string, number];

export interface PersonalData {
  key: "personal";
  name: string;
  trips: Trip[];
  past: PastStay[];
  lease: TenantLease;
  pays: RentPayment[];
  threads: Thread[];
}

export interface Person {
  name: string;
  title: string;
  ini: string;
}

export interface WorkspaceRef {
  key: WorkspaceKey;
  name: string;
  role: string;
  sq: string;
  /**
   * The workspace this entry addresses (ADR-018).
   *
   * Null for the demo fixtures, which have no server row behind them. A switcher
   * entry with no id cannot be routed to under `/w/`, which is exactly the fact
   * this field carries.
   */
  workspaceId?: string | null;
  /** Demand-side workspaces live in apps/web; the switcher links out. */
  external?: string;
}

export interface Db {
  hotel: HospitalityProperty;
  guesthouse: HospitalityProperty;
  residence: ResidenceProperty;
  broker: BrokerData;
}
