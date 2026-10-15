import { z } from "zod";
import { BookingStatus } from "./booking";
import { AdapterMode, ContactPhone, OrgRole, Uuid } from "./primitives";
import { Tin } from "./registration";
/**
 * The operator command surface (ADR-012, `/api/v1/ops/*`).
 *
 * These are an OPERATOR's shapes, not a guest's. `booking.ts` answers "what am
 * I buying"; this answers "what is on my desk right now, and what may I do to
 * it". The two must not be merged: a guest read that quietly grew an internal
 * field is how a private note ends up on a public page.
 *
 * The first thread is Reservations (D-k). Every other operator command extends
 * this file by copying the shape below, one command per permission.
 */
// ---------------------------------------------------------------------------
// Reading the desk
// ---------------------------------------------------------------------------
/**
 * How a reservation reads on the front desk.
 *
 * NOT the same set as `BookingStatus`, on purpose. The desk cares whether the
 * guest is standing in the building, and the booking row cannot say: a
 * `confirmed` booking is a future arrival, an occupied room, or last week's
 * departure, and the three want three different buttons. The extra states are
 * derived from the stay attached to the booking, never stored twice.
 *
 * `bookingStatus` travels alongside, so a screen that needs the raw row state
 * still has it and nothing is hidden behind the derivation.
 */
export const OperatorReservationState = z.enum([
    /** `pending_approval`. The one state the approve command acts on. */
    "pending",
    /** Confirmed, nobody checked in yet. */
    "confirmed",
    /** Confirmed and an OPEN `guest_stays` row: the guest is in the building. */
    "inhouse",
    /** Confirmed and a CLOSED `guest_stays` row: they have checked out. */
    "checked_out",
    "declined",
    "cancelled",
    "no_show",
]);
export type OperatorReservationState = z.infer<typeof OperatorReservationState>;
/**
 * One row of the Reservations list.
 *
 * Every field is read from a column or derived from two of them; nothing is
 * computed in the browser (ADR-012, Value sourcing). `room` in particular comes
 * from `guest_stays.room_id` and is never guessed from the room type.
 */
export const OperatorReservation = z.object({
    id: Uuid,
    /** The human handle a guest quotes on the phone. */
    reference: z.string().min(1),
    /** `users.name`, which is nullable: an account may exist before a name does. */
    guestName: z.string().nullable(),
    /**
     * The guest account's email, for the desk to tell an unnamed guest apart
     * (shown where `guestName` is null). DISPLAY ONLY: never copied into the
     * check-in, which records a person's name. Defaulted so an older API parses.
     */
    guestEmail: z.string().nullable().default(null),
    /** `YYYY-MM-DD`. A bare date column, so no timezone rides along. */
    checkIn: z.string(),
    checkOut: z.string(),
    /** Derived from the two dates above, server side, so one definition of it. */
    nights: z.number().int().positive(),
    guestCount: z.number().int().positive(),
    state: OperatorReservationState,
    /** The raw `bookings.status`, so the derivation above hides nothing. */
    bookingStatus: BookingStatus,
    /** `rooms.label` for the stay's room. Null until someone checks them in. */
    room: z.string().nullable(),
    /**
     * The room TYPE the guest bought. A booking never names a room; this is
     * what a room held for it must match, and the room grid greys out every
     * row of another type before the desk drops a bar there and is refused.
     */
    roomTypeId: Uuid,
    /**
     * What the guest bought and where: the room type's name and the branch it
     * belongs to. A host with two branches saw rows naming neither, so a
     * request could not be told apart from one at the other property.
     * Defaulted so an older API still parses.
     */
    roomTypeName: z.string().nullable().default(null),
    propertyName: z.string().nullable().default(null),
    /**
     * `bookings.gross_rwf`: what this reservation is worth.
     *
     * NOT a folio balance. A folio sums `ledger_entries` and moves every time
     * someone posts a charge; this is the agreed price of the stay and does not.
     * The Bill screen owns the other number.
     */
    totalRwf: z.number().int().nullable(),
    /** When an unanswered request auto declines. Null once it is resolved. */
    approvalExpiresAt: z.string().nullable(),
    confirmedAt: z.string().nullable(),
});
export type OperatorReservation = z.infer<typeof OperatorReservation>;
export const OperatorReservationList = z.object({
    reservations: z.array(OperatorReservation),
});
export type OperatorReservationList = z.infer<typeof OperatorReservationList>;
/**
 * The query on the reservations read.
 *
 * `WorkspaceGuard` reads the workspace from the `x-workspace-id` header first
 * and falls back to the query string, so this stays optional here rather than
 * being validated into a second source of truth. A read that names no workspace
 * is refused by the guard, not by this schema.
 */
export const OperatorReservationQuery = z.object({
    workspaceId: Uuid.optional(),
    /** Narrow the list to one desk state. Absent means all of them. */
    state: OperatorReservationState.optional(),
});
export type OperatorReservationQuery = z.infer<typeof OperatorReservationQuery>;
// ---------------------------------------------------------------------------
// Commanding it
// ---------------------------------------------------------------------------
/**
 * Approve and decline take no body.
 *
 * That is the endpoint shape decision (D-d) made concrete: a command is named
 * for its action, so the URL already says what is being asked and the guard
 * never has to read a body to know which permission applies. The workspace
 * arrives in the `x-workspace-id` header, which means a command with nothing to
 * send still names where it acts.
 *
 * Both return the reservation as it now stands, so the caller patches its list
 * from the server's answer rather than guessing the new state.
 */
export const ReservationDecisionResult = OperatorReservation;
export type ReservationDecisionResult = z.infer<typeof ReservationDecisionResult>;
// ===========================================================================
// The state machines these commands move
// ===========================================================================
//
// Each mirrors its Postgres enum in `schema.ts` EXACTLY. They live here rather
// than in `primitives.ts` because only the operator surface reads them today;
// the day a second domain needs one, it moves there rather than being copied.
/** Is this room sellable? Owned by maintenance. */
export const RoomStatus = z.enum(["available", "maintenance", "out_of_service"]);
export type RoomStatus = z.infer<typeof RoomStatus>;
/** Is this room ready? Owned by housekeeping. Orthogonal to `RoomStatus`. */
export const HousekeepingStatus = z.enum([
    "clean",
    "dirty",
    "inspected",
    "out_of_order",
]);
export type HousekeepingStatus = z.infer<typeof HousekeepingStatus>;
/** Two states only. The database enum has no middle, whatever a screen shows. */
/**
 * ADR-016 D16. Widened from `open | resolved`, which could not say that
 * somebody had picked a ticket up and had no way to record one raised in error.
 */
export const MaintenanceStatus = z.enum([
    "open",
    "assigned",
    "in_progress",
    "resolved",
    "closed",
    "cancelled",
]);
export type MaintenanceStatus = z.infer<typeof MaintenanceStatus>;
export const LeaseStatus = z.enum([
    "draft",
    "pending_signature",
    "active",
    "ending",
    "ended",
    "cancelled",
]);
export type LeaseStatus = z.infer<typeof LeaseStatus>;
export const RentStatus = z.enum(["paid", "due", "overdue"]);
export type RentStatus = z.infer<typeof RentStatus>;
export const CautionStatus = z.enum(["held", "refunded", "forfeited"]);
export type CautionStatus = z.infer<typeof CautionStatus>;
// ===========================================================================
// The front desk: rooms and stays
// ===========================================================================
/**
 * A room as the desk sees it.
 *
 * Two statuses, never merged, because every real property management system
 * keeps them apart and merging them loses the case that matters: a clean room
 * that is out of service is not sellable, and a dirty room that is available
 * is. `status` is inventory (owned by maintenance), `housekeeping` is
 * readiness (owned by housekeeping).
 */
export const OperatorRoom = z.object({
    id: Uuid,
    /** `rooms.label`, e.g. "101". Null on a row nobody has numbered yet. */
    label: z.string().nullable(),
    roomTypeId: Uuid,
    roomTypeName: z.string(),
    /**
     * False once the room's TYPE is archived. The room keeps its own status, so
     * without this an archived type's rooms read as free and the desk offered
     * them to guests. Defaults to true so an older API still parses.
     */
    roomTypeActive: z.boolean().default(true),
    status: RoomStatus,
    housekeeping: HousekeepingStatus,
    /** The open stay in this room, if anyone is in it. */
    occupiedBy: z
        .object({ stayId: Uuid, guestName: z.string().nullable() })
        .nullable(),
});
export type OperatorRoom = z.infer<typeof OperatorRoom>;
export const OperatorRoomList = z.object({ rooms: z.array(OperatorRoom) });
export type OperatorRoomList = z.infer<typeof OperatorRoomList>;
// ===========================================================================
// §6.8  Registering a guest at the desk
// ===========================================================================
// The desk's half of the claim story. The guest's half — claiming, the
// departments, the refund request — is in `stay.ts`, which imports
// `DepartmentCategory` from this file and therefore cannot be imported back.

// ---------------------------------------------------------------------------
// Registering a guest at the desk
// ---------------------------------------------------------------------------

/**
 * What the desk writes on the registration card (§6.4 `stay_identities`).
 *
 * Every field is optional EXCEPT in the sense that a property regulated in
 * Rwanda is required to record the identity of whoever sleeps in the building —
 * so this is optional in the schema and expected in practice, and the desk app
 * is what insists. A required field here would break the walk in at 23:00 whose
 * passport is in a bag upstairs, and a stay nobody could open is worse than a
 * stay with a name and no document number.
 */
export const StayRegistrationDetails = z
  .object({
    /** As printed on the document, which is not always the name on the booking. */
    fullName: z.string().trim().min(1).max(200).optional(),
    documentType: z.enum(["national_id", "passport", "other"]).optional(),
    idNumber: z.string().trim().min(1).max(64).optional(),
    /** Home address, free text: Rwandan and foreign addresses do not share a shape. */
    addressText: z.string().trim().min(1).max(500).optional(),
    /**
     * Where the "continue in the app" mail goes. The ONE address this stay's
     * claim invitation is ever sent to, which is why it is captured here at the
     * counter with the guest watching, and never supplied later by a caller.
     */
    email: z.string().trim().email().max(254).optional(),
    phone: z.string().trim().min(6).max(32).optional(),
    /**
     * Send the claim invitation now. Default true when an address was given:
     * a desk that captured an address meant to invite them, and making the
     * invitation a second deliberate step is how it never gets sent.
     */
    invite: z.boolean().optional(),
  })
  .strict();
export type StayRegistrationDetails = z.infer<typeof StayRegistrationDetails>;

/** The shape of a claim code as it is printed: four letters, a dash, four digits. */
export const CLAIM_CODE_PATTERN = /^[A-Z]{4}-\d{4}$/;

/**
 * What the desk gets back after registering somebody: the code on the slip, and
 * whether the mail actually left.
 *
 * `invitationSent` is false rather than an error when the transport refused.
 * The stay is real and the code is printed on the slip in the guest's hand;
 * failing the check in because an SMTP relay was down would put a guest back on
 * the street over an email.
 */
export const StayClaimInvite = z.object({
  stayId: Uuid,
  /** Null when the stay is already claimed — there is nothing left to hand out. */
  claimCode: z.string().nullable(),
  email: z.string().nullable(),
  invitationSent: z.boolean(),
  invitedAt: z.string().nullable(),
});
export type StayClaimInvite = z.infer<typeof StayClaimInvite>;

/** Re-send the invitation, or send a first one to an address captured late. */
export const IssueStayClaimInviteRequest = z
  .object({
    /** Absent keeps the address already on the stay. */
    email: z.string().trim().email().max(254).optional(),
    /**
     * Mint a NEW code, invalidating the old slip. For the guest who says the
     * code does not work, or the one who left the slip in the taxi.
     */
    reissue: z.boolean().optional(),
  })
  .strict();
export type IssueStayClaimInviteRequest = z.infer<typeof IssueStayClaimInviteRequest>;

/** A guest in the building, or one who has left. */
export const OperatorStay = z.object({
    id: Uuid,
    bookingId: Uuid.nullable(),
    guestName: z.string().nullable(),
    roomId: Uuid,
    roomLabel: z.string().nullable(),
    lifecycle: z.enum(["open", "closed"]),
    entryAt: z.string(),
    plannedExitAt: z.string().nullable(),
    actualExitAt: z.string().nullable(),
});
export type OperatorStay = z.infer<typeof OperatorStay>;
/**
 * Every stay on the property, open and closed (ADR-035, wave 2 follow-up).
 *
 * **This list did not exist.** `OperatorStay` was only ever a COMMAND result:
 * check in returned one, check out returned one, and nothing read a stay back.
 * So the stay record page had no source and showed a fixture, and its folio
 * lens could not join to the bill that stay actually has.
 *
 * Closed stays are included. A stay that has checked out is exactly the one a
 * guest disputes a charge from three nights later, and a list that dropped it
 * would make the record unreachable at the moment it matters most.
 */
export const OperatorStayList = z.object({ stays: z.array(OperatorStay) });
export type OperatorStayList = z.infer<typeof OperatorStayList>;
/**
 * Check a confirmed reservation in.
 *
 * The `:id` in the path is the BOOKING, not a stay: a stay does not exist
 * until someone arrives, so there is no stay id to name yet. The command
 * creates it.
 *
 * A walk in has no booking to name and therefore no route here. It needs its
 * own command, and the ADR's route table does not define one.
 */
export const CheckInRequest = z.object({
    /**
     * OPTIONAL since ADR-016 (D-i). Check in uses the room already assigned for
     * today when one exists; sending a `roomId` overrides it, which is what the
     * desk does when a guest asks to move. A booking with neither an assignment
     * nor a `roomId` is refused with a message naming what is missing (AC-7).
     */
    roomId: Uuid.optional(),
    /**
     * Only if the desk agreed a different nightly rate at the counter. Absent
     * means the rate locked on the booking stands, which is the normal case and
     * the one that must not be overwritten by a blank field.
     */
    nightlyRateRwf: z.number().int().positive().optional(),
    /**
     * The registration card, and the invitation that follows it (§6.8).
     *
     * OPTIONAL, because a booked guest already has an account and an address
     * and the desk usually types nothing. Present, it records the identity
     * against the stay and mails the guest a claim code so they can carry on
     * in the app. Absent, check in behaves exactly as it did.
     */
    guest: StayRegistrationDetails.optional(),
});
export type CheckInRequest = z.infer<typeof CheckInRequest>;
/**
 * Check a WALK IN in — somebody at the counter with no booking (ADR-035).
 *
 * **This command did not exist, and its absence was structural rather than an
 * oversight.** `POST /ops/stays/:id/checkin` names a BOOKING in its path, so a
 * person who never booked had no route at all. The desk button existed and did
 * nothing on the server.
 *
 * IT NAMES A ROOM, and the room is required. Ordinary check in may leave it out
 * because a reservation already has an assignment for today; a walk in has no
 * reservation, so nothing has chosen a room and the desk must.
 *
 * THE NAME IS REQUIRED for the same reason. There is no account to read it from
 * — that is what a walk in means — so a stay created without one is a room the
 * desk cannot attribute to anybody, and the folio raised against it names
 * nobody either.
 *
 * `plannedExitAt` is OPTIONAL and that is deliberate: a walk in often does not
 * know how long they are staying, which is half the reason they are a walk in.
 * Absent means open ended, not zero nights.
 */
export const WalkInRequest = z.object({
    /** Required: nothing has chosen a room, so the desk does. */
    roomId: Uuid,
    /** Required: there is no account to read a name from. */
    guestName: z.string().trim().min(1).max(200),
    /** Absent means open ended. */
    plannedExitAt: z.string().optional(),
    /**
     * The nightly rate agreed at the counter.
     *
     * Absent means the room type's default rate plan, and a walk in with
     * NEITHER is refused. The night audit bills a walk in from the price on its
     * stay, so a stay opened without one is a room nobody is ever charged for —
     * and check out closes that zero bill by itself, so the guest leaves and
     * nothing is owed.
     */
    nightlyRateRwf: z.number().int().positive().optional(),
    /**
     * The registration card, and the invitation that follows it (§6.8).
     *
     * THIS IS THE CASE IT WAS BUILT FOR. A walk in has no account, so the only
     * record of who they are is what the desk types here, and the only way they
     * ever reach the app is the claim code this mails them. Without it a walk in
     * is a room number and a first name, and every guest-facing surface this
     * platform has is closed to them for the whole of their stay.
     */
    guest: StayRegistrationDetails.optional(),
});
export type WalkInRequest = z.infer<typeof WalkInRequest>;
/**
 * Close an open stay.
 *
 * Flips the room to `dirty` in the same transaction, because a checkout that
 * does not dirty the room is how housekeeping misses a room, and leaving the
 * two to separate calls means a crash between them loses one.
 */
export const CheckOutRequest = z.object({
    /** Optional note for the stay record, e.g. "left early, keys at desk". */
    note: z.string().trim().max(500).optional(),
});
export type CheckOutRequest = z.infer<typeof CheckOutRequest>;
/** Set a room's housekeeping state. Never touches its inventory status. */
export const SetHousekeepingRequest = z.object({
    housekeeping: HousekeepingStatus,
});
export type SetHousekeepingRequest = z.infer<typeof SetHousekeepingRequest>;
// ===========================================================================
// Messaging
// ===========================================================================
/**
 * A conversation, hung off exactly one of a booking, a stay or a lease.
 *
 * `threads_scope_exactly_one` enforces the "exactly one" in the database, so a
 * thread can never be about two things at once and a reader never has to pick.
 */
export const OperatorThread = z.object({
    id: Uuid,
    scope: z.enum(["booking", "stay", "lease"]),
    /** The booking, stay or lease this thread is about. */
    subjectId: Uuid,
    /** Who the operator is talking to, when we can resolve a name. */
    counterpartName: z.string().nullable(),
    /**
     * The department the guest opened this conversation with (ADR-050 D-q),
     * or null for the reservation thread every booking gets at sale.
     */
    departmentName: z.string().nullable(),
    status: z.enum(["active", "archived"]),
    lastMessageAt: z.string().nullable(),
    lastMessagePreview: z.string().nullable(),
    messageCount: z.number().int().nonnegative(),
});
export type OperatorThread = z.infer<typeof OperatorThread>;
export const OperatorThreadList = z.object({
    threads: z.array(OperatorThread),
});
export type OperatorThreadList = z.infer<typeof OperatorThreadList>;
export const OperatorMessage = z.object({
    id: Uuid,
    threadId: Uuid,
    senderUserId: Uuid.nullable(),
    senderName: z.string().nullable(),
    /** True when this workspace sent it, so a screen can side the bubble. */
    fromUs: z.boolean(),
    /** `system` is a line the platform wrote, such as an order's status (ADR-050 D-s). */
    bodyType: z.enum(["text", "image", "voice", "system"]),
    body: z.string().nullable(),
    /** The order a `system` line reports on, so a screen can draw its card. */
    serviceOrderId: Uuid.nullable(),
    voiceDurationS: z.number().int().nullable(),
    createdAt: z.string(),
});
export type OperatorMessage = z.infer<typeof OperatorMessage>;
export const OperatorMessageList = z.object({
    messages: z.array(OperatorMessage),
});
export type OperatorMessageList = z.infer<typeof OperatorMessageList>;
/**
 * Send a message into a thread.
 *
 * Text only here. Image and voice need an uploaded object first (F-S09 is
 * unbuilt), and accepting a body type this route cannot honour would be a
 * contract that lies.
 */
export const SendMessageRequest = z.object({
    body: z
        .string()
        .trim()
        .min(1, "Write something before you send it.")
        .max(4000, "That message is too long to send."),
});
export type SendMessageRequest = z.infer<typeof SendMessageRequest>;
// ===========================================================================
// Residence: tickets, leases, rent, deposits
// ===========================================================================
/** What a work order is about. */
export const MaintenanceCategory = z.enum([
    "plumbing",
    "electrical",
    "hvac",
    "appliance",
    "furniture",
    "it_tech",
    "safety",
    "other",
]);
export type MaintenanceCategory = z.infer<typeof MaintenanceCategory>;
export const MaintenancePriority = z.enum(["low", "normal", "high", "urgent"]);
export type MaintenancePriority = z.infer<typeof MaintenancePriority>;
/**
 * A maintenance ticket, on either surface (ADR-016 D16, AC-11).
 *
 * It USED to be residence only, and that was the schema forcing the shape
 * rather than anybody choosing it: `maintenance_tickets.lease_id` was NOT NULL,
 * so a ticket could not exist without a lease and a hotel has none. Migration
 * phases 6 to 8 made the lease optional and gave the row a room instead, so one
 * board now serves a hotel and a rented building.
 *
 * `leaseId` and `roomId` are both nullable and at least one of them (or a
 * space) is always set, which the database checks.
 */
export const OperatorTicket = z.object({
    id: Uuid,
    leaseId: Uuid.nullable(),
    roomId: Uuid.nullable(),
    /** The unit or room, so the list reads without a second call. */
    unitLabel: z.string().nullable(),
    raisedByName: z.string().nullable(),
    title: z.string(),
    description: z.string().nullable(),
    category: MaintenanceCategory.nullable(),
    priority: MaintenancePriority,
    status: MaintenanceStatus,
    resolvedAt: z.string().nullable(),
    createdAt: z.string(),
    noteCount: z.number().int().nonnegative(),
});
export type OperatorTicket = z.infer<typeof OperatorTicket>;
export const OperatorTicketList = z.object({
    tickets: z.array(OperatorTicket),
});
export type OperatorTicketList = z.infer<typeof OperatorTicketList>;
/**
 * Move a ticket to its next state, with a note.
 *
 * The note is required rather than optional: `maintenance_events` is the only
 * record of WHY a ticket closed, and a resolved ticket with no reason is the
 * one a tenant reopens a week later.
 */
export const AdvanceTicketRequest = z.object({
    /**
     * Where the ticket goes next. Optional, and `resolved` when absent, which is
     * what every caller meant while the enum held only two values.
     */
    to: MaintenanceStatus.optional(),
    note: z
        .string()
        .trim()
        .min(1, "Say what was done.")
        .max(1000),
});
export type AdvanceTicketRequest = z.infer<typeof AdvanceTicketRequest>;
export const OperatorLease = z.object({
    id: Uuid,
    roomId: Uuid,
    unitLabel: z.string().nullable(),
    tenantName: z.string().nullable(),
    monthlyRentRwf: z.number().int().nullable(),
    cautionRwf: z.number().int().nullable(),
    startDate: z.string().nullable(),
    endDate: z.string().nullable(),
    status: LeaseStatus,
    /** Whether both signatures are in, which is what gates going active. */
    landlordSignedAt: z.string().nullable(),
    tenantSignedAt: z.string().nullable(),
});
export type OperatorLease = z.infer<typeof OperatorLease>;
export const OperatorLeaseList = z.object({ leases: z.array(OperatorLease) });
export type OperatorLeaseList = z.infer<typeof OperatorLeaseList>;
/**
 * Move a lease one step along its lifecycle.
 *
 * The caller names the state it expects to reach rather than saying "next".
 * A blind "next" is how a double click ends a lease that was only meant to be
 * activated: the server would have no way to tell the second call from a
 * legitimate second step.
 */
export const AdvanceLeaseRequest = z.object({ to: LeaseStatus });
export type AdvanceLeaseRequest = z.infer<typeof AdvanceLeaseRequest>;
/** One month's rent on one lease. */
export const OperatorRentCharge = z.object({
    id: Uuid,
    leaseId: Uuid,
    unitLabel: z.string().nullable(),
    tenantName: z.string().nullable(),
    /** `YYYY-MM-DD`, always the first of the month it covers. */
    periodMonth: z.string(),
    amountRwf: z.number().int().nullable(),
    paidAmountRwf: z.number().int().nullable(),
    status: RentStatus,
    dueDate: z.string().nullable(),
    paidAt: z.string().nullable(),
});
export type OperatorRentCharge = z.infer<typeof OperatorRentCharge>;
export const OperatorRentRoll = z.object({
    charges: z.array(OperatorRentCharge),
});
export type OperatorRentRoll = z.infer<typeof OperatorRentRoll>;
/**
 * Where the filing of one signed contract stands (F-R10 §8).
 *
 * The same three values as the `filing_status` enum, and deliberately no
 * fourth: "not filed yet" is the ABSENCE of a filing, carried as a null status
 * on the row below, not a state a filing can be in.
 */
export const FilingStatus = z.enum(["pending", "filed", "failed"]);
export type FilingStatus = z.infer<typeof FilingStatus>;
/**
 * How long Injishi has to file a signed contract with the tax administration,
 * counted from signing (F-R10 §6, §9).
 *
 * One definition, because both sides count against it: the API dates `due_by`
 * from it and the operator app words the clock from it.
 */
export const CONTRACT_FILING_WINDOW_DAYS = 15;
/**
 * A lease and the filing of its contract, for the Filings lens on Finance.
 *
 * One row PER LEASE, not per filing, and that is the point. A lease whose
 * contract nothing has filed is exactly what a landlord must be shown, and a
 * list of filings cannot show it. `status` is null on such a lease, and
 * `signedAt` says whether that is because nobody has signed yet or because the
 * filing was never raised.
 *
 * `adapterMode` rides along for the reason it rides along on every other
 * adapter-backed answer in this repository: a screen that cannot tell a real
 * filing from a stand-in will eventually claim one. There is no RRA contract
 * channel yet (F-R10 §11, open question O-4), so every row today is `mock`.
 */
export const OperatorContractFiling = z.object({
    leaseId: Uuid,
    unitLabel: z.string().nullable(),
    tenantName: z.string().nullable(),
    leaseStatus: LeaseStatus,
    /** Null when no filing has been raised for this lease at all. */
    status: FilingStatus.nullable(),
    /** When the fifteen days started. The signature, or the amendment that reset it. */
    clockStartAt: z.string().nullable(),
    dueBy: z.string().nullable(),
    attempts: z.number().int().nonnegative(),
    /** Required on a failure (F-R10 §6: never silently dropped), null otherwise. */
    failureReason: z.string().nullable(),
    adapterMode: AdapterMode.nullable(),
    /** The tenant's signature: what the clock starts at, when there is one. */
    signedAt: z.string().nullable(),
});
export type OperatorContractFiling = z.infer<typeof OperatorContractFiling>;
export const OperatorFilingList = z.object({
    filings: z.array(OperatorContractFiling),
});
export type OperatorFilingList = z.infer<typeof OperatorFilingList>;
/**
 * Record a rent payment against one month of one lease.
 *
 * `periodMonth` is required, and that is deliberate. "Apply it to the oldest
 * unpaid month" sounds helpful and is the source of the worst disputes in
 * rent collection: the tenant meant this month, the system took last month,
 * and neither party can see why. The operator names the month they were paid
 * for.
 *
 * Carries `Idempotency-Key` (AC-14).
 */
export const RecordRentRequest = z.object({
    periodMonth: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-08-01."),
    amountRwf: z.number().int().positive("Enter what was actually paid."),
    /** How it arrived, for the record. Free text: v1 has no method catalog. */
    method: z.string().trim().max(60).optional(),
});
export type RecordRentRequest = z.infer<typeof RecordRentRequest>;
/** A caution deposit being held against a lease. */
export const OperatorDeposit = z.object({
    id: Uuid,
    leaseId: Uuid,
    unitLabel: z.string().nullable(),
    tenantName: z.string().nullable(),
    amountRwf: z.number().int().nullable(),
    status: CautionStatus,
    heldAt: z.string(),
    /** Present once it has been settled. */
    settlement: z
        .object({
        refundedRwf: z.number().int().nullable(),
        forfeitedRwf: z.number().int().nullable(),
        reason: z.string().nullable(),
        settledAt: z.string(),
    })
        .nullable(),
});
export type OperatorDeposit = z.infer<typeof OperatorDeposit>;
export const OperatorDepositList = z.object({
    deposits: z.array(OperatorDeposit),
});
export type OperatorDepositList = z.infer<typeof OperatorDepositList>;
/**
 * Return a caution deposit, in whole or in part.
 *
 * Both halves are named explicitly rather than one being derived, because the
 * two together must equal what was held and the server checks exactly that. A
 * derived remainder hides an arithmetic mistake instead of refusing it.
 *
 * `reason` is required whenever anything is forfeited: money kept from a
 * tenant with no stated reason is the dispute this table exists to settle.
 *
 * Carries `Idempotency-Key` (AC-14).
 */
export const ReturnDepositRequest = z
    .object({
    refundedRwf: z.number().int().nonnegative(),
    forfeitedRwf: z.number().int().nonnegative(),
    reason: z.string().trim().max(1000).optional(),
})
    .refine((v) => v.forfeitedRwf === 0 || Boolean(v.reason), {
    message: "Say why part of the deposit is being kept.",
    path: ["reason"],
});
export type ReturnDepositRequest = z.infer<typeof ReturnDepositRequest>;
// ===========================================================================
// Amenities
// ===========================================================================
export const OperatorAmenity = z.object({
    code: z.string(),
    category: z.string().nullable(),
    label: z.string(),
    /** Whether this property offers it. */
    offered: z.boolean(),
});
export type OperatorAmenity = z.infer<typeof OperatorAmenity>;
export const OperatorAmenityList = z.object({
    amenities: z.array(OperatorAmenity),
});
export type OperatorAmenityList = z.infer<typeof OperatorAmenityList>;
/** Add an amenity to a property. Removal is a DELETE on the same code. */
export const AddAmenityRequest = z.object({
    propertyId: Uuid,
    amenityCode: z.string().trim().min(1),
});
export type AddAmenityRequest = z.infer<typeof AddAmenityRequest>;
/**
 * Which property a read or a removal is about.
 *
 * Separate from the workspace: a workspace can hold several properties, and
 * "all the amenities in this workspace" is not a question anyone asks.
 */
export const PropertyScopedQuery = z.object({ propertyId: Uuid });
export type PropertyScopedQuery = z.infer<typeof PropertyScopedQuery>;
// ===========================================================================
// The PMS operations layer (ADR-016)
//
// Departments, the folio, room assignment, the cleaning queue and the service
// catalog. Everything below unblocks a command ADR-012 had to leave unbuilt
// because the table under it did not exist.
// ===========================================================================
// ---------------------------------------------------------------------------
// Departments
// ---------------------------------------------------------------------------
/**
 * The USALI vocabulary. Stable, which is why it is an enum while the
 * department NAMES are an editable per property catalog (D14).
 */
export const DepartmentCategory = z.enum([
    "rooms",
    "fnb",
    "spa_recreation",
    "other_operated",
    "misc_income",
    "admin_general",
    "sales_marketing",
    "it",
    "engineering",
    "utilities",
    "hr",
]);
export type DepartmentCategory = z.infer<typeof DepartmentCategory>;
/** `operated` departments earn; `undistributed` ones cost. */
export const DepartmentType = z.enum(["operated", "undistributed"]);
export type DepartmentType = z.infer<typeof DepartmentType>;
export const DepartmentStatus = z.enum(["active", "archived"]);
export type DepartmentStatus = z.infer<typeof DepartmentStatus>;
/**
 * A department as the operator sees it.
 *
 * `isRevenueCenter` is the one field a charge screen must read: a charge naming
 * a cost centre is refused with 422 (AC-1), so the picker has to be able to
 * grey the wrong ones out rather than let the desk find out on submit.
 */
export const OperatorDepartment = z.object({
    id: Uuid,
    propertyId: Uuid.nullable(),
    name: z.string(),
    departmentType: DepartmentType,
    departmentCategory: DepartmentCategory,
    isRevenueCenter: z.boolean(),
    guestRequestable: z.boolean(),
    sortOrder: z.number().int(),
    status: DepartmentStatus,
    /**
     * The department's contact card: who heads it, their number, and the
     * department's own line. Text rather than a roster row, because a head of
     * department often has no account on the day a property is set up.
     */
    headName: z.string().nullable(),
    headPhone: z.string().nullable(),
    phone: z.string().nullable(),
});
export type OperatorDepartment = z.infer<typeof OperatorDepartment>;
/** The contact card fields, shared by create and update. `null` clears one. */
const departmentContactFields = {
    headName: z.string().trim().max(120, "That name is too long.").nullable().optional(),
    headPhone: ContactPhone.nullable().optional(),
    phone: ContactPhone.nullable().optional(),
};
export const OperatorDepartmentList = z.object({
    departments: z.array(OperatorDepartment),
});
export type OperatorDepartmentList = z.infer<typeof OperatorDepartmentList>;
/**
 * Add a department to a property.
 *
 * `isRevenueCenter` is not asked for: it follows from the type, because a cost
 * centre that takes revenue is a contradiction the database also refuses.
 */
export const CreateDepartmentRequest = z.object({
    propertyId: Uuid,
    name: z.string().trim().min(1).max(120),
    departmentType: DepartmentType,
    departmentCategory: DepartmentCategory,
    guestRequestable: z.boolean().optional(),
    sortOrder: z.number().int().min(0).max(9999).optional(),
    ...departmentContactFields,
});
export type CreateDepartmentRequest = z.infer<typeof CreateDepartmentRequest>;
/**
 * Rename, reorder, or retire a department.
 *
 * The CATEGORY cannot be changed. It decides which revenue account the charges
 * post to, and moving it would silently re-attribute every shilling already
 * booked against the department.
 */
export const UpdateDepartmentRequest = z
    .object({
    name: z.string().trim().min(1).max(120).optional(),
    guestRequestable: z.boolean().optional(),
    sortOrder: z.number().int().min(0).max(9999).optional(),
    status: DepartmentStatus.optional(),
    ...departmentContactFields,
})
    .refine((v) => Object.keys(v).length > 0, {
    message: "Say what to change.",
});
export type UpdateDepartmentRequest = z.infer<typeof UpdateDepartmentRequest>;
// ---------------------------------------------------------------------------
// The folio
// ---------------------------------------------------------------------------
export const FolioType = z.enum(["guest", "master", "group", "house"]);
export type FolioType = z.infer<typeof FolioType>;
/**
 * `open -> settled -> closed`, and `settled -> disputed -> settled`.
 * `settled` means the balance reached zero; `closed` means no further charge
 * may post. Voiding a charge on a settled folio moves it back to `open`.
 */
export const FolioStatus = z.enum(["open", "settled", "closed", "disputed"]);
export type FolioStatus = z.infer<typeof FolioStatus>;
/**
 * The ten typed lines a bill is made of.
 *
 * Signed: charges positive, payments and discounts negative. One sign rule,
 * fixed here, inherited by the ledger entry each line writes.
 */
export const ChargeType = z.enum([
    "room",
    "service_order",
    "pos",
    "tax",
    "service_charge",
    "adjustment",
    "discount",
    "deposit",
    "payment",
    "refund",
]);
export type ChargeType = z.infer<typeof ChargeType>;
export const TaxCode = z.enum(["TAX_A", "TAX_B", "TAX_C", "TAX_D"]);
export type TaxCode = z.infer<typeof TaxCode>;
/** How the money arrived. It picks which cash account the payment posts to. */
export const PaymentMethod = z.enum(["mobile_money", "card", "cash"]);
export type PaymentMethod = z.infer<typeof PaymentMethod>;
/** A bill as it appears in the Bills list. */
export const OperatorFolio = z.object({
    id: Uuid,
    folioNumber: z.string(),
    folioType: FolioType,
    status: FolioStatus,
    guestStayId: Uuid.nullable(),
    bookingId: Uuid.nullable(),
    guestName: z.string().nullable(),
    roomLabel: z.string().nullable(),
    balanceRwf: z.number().int(),
    /**
     * Which bill of the stay this is (ADR-050 D-c). A charge arriving after a
     * bill was signed opens the next sequence, so a stay can hold several.
     */
    folioSequence: z.number().int().positive(),
    /** When the bill was signed. A locked bill takes no new line. */
    lockedAt: z.string().nullable(),
    openedAt: z.string(),
    closedAt: z.string().nullable(),
});
export type OperatorFolio = z.infer<typeof OperatorFolio>;
export const OperatorFolioList = z.object({ folios: z.array(OperatorFolio) });
export type OperatorFolioList = z.infer<typeof OperatorFolioList>;
/**
 * One line on a bill. Never edited and never deleted.
 *
 * `voidedByChargeId` is how a screen greys out a reversed line without the row
 * carrying a mutable flag: the reversal names its target, so the relationship
 * is a fact about two rows rather than a field somebody could flip.
 */
export const OperatorFolioCharge = z.object({
    id: Uuid,
    chargeType: ChargeType,
    description: z.string().nullable(),
    departmentId: Uuid.nullable(),
    departmentName: z.string().nullable(),
    quantity: z.number().int(),
    unitPriceRwf: z.number().int().nullable(),
    /** Signed, and tax exclusive. Tax is its own line. */
    amountRwf: z.number().int(),
    taxCode: TaxCode.nullable(),
    taxRate: z.number().nullable(),
    taxAmountRwf: z.number().int().nullable(),
    /** `manual`, `night_audit`, `service_order`, `external_pos`, or `void`. */
    sourceRefType: z.string().nullable(),
    sourceRefId: Uuid.nullable(),
    /** Set when another line reverses this one. */
    voidedByChargeId: Uuid.nullable(),
    postedByUserId: Uuid.nullable(),
    businessDate: z.string().nullable(),
    postedAt: z.string(),
});
export type OperatorFolioCharge = z.infer<typeof OperatorFolioCharge>;
/** The bill, with its lines. */
export const OperatorFolioDetail = OperatorFolio.extend({
    charges: z.array(OperatorFolioCharge),
});
export type OperatorFolioDetail = z.infer<typeof OperatorFolioDetail>;
/**
 * Post a charge to a bill.
 *
 * `amountRwf` is TAX EXCLUSIVE (D-n). The tax is computed from the rate
 * effective at post time and posted as its own line, so the two never have to
 * be pulled apart again for an invoice.
 *
 * `departmentId` is required for a revenue charge and refused when the
 * department is not a revenue centre.
 */
export const PostChargeRequest = z.object({
    chargeType: z.enum([
        "room",
        "service_order",
        "pos",
        "service_charge",
        "adjustment",
        "discount",
        "deposit",
        "refund",
    ]),
    departmentId: Uuid.optional(),
    outletId: Uuid.optional(),
    description: z.string().trim().min(1).max(500),
    quantity: z.number().int().positive().max(9999).default(1),
    /** Signed. A discount or a refund is negative and the service checks it. */
    amountRwf: z.number().int(),
    /** `TAX_B` (the standard 18%) when absent. */
    taxCode: TaxCode.optional(),
});
export type PostChargeRequest = z.infer<typeof PostChargeRequest>;
/**
 * The bill a charge landed on (ADR-050 D-c).
 *
 * `openedFolioId` is set when the bill asked for had already been signed, so
 * the charge went to the stay's next bill instead; the rest of the answer is
 * THAT bill. Null for every ordinary charge.
 */
export const PostChargeResult = OperatorFolioDetail.extend({
    openedFolioId: Uuid.nullable(),
});
export type PostChargeResult = z.infer<typeof PostChargeResult>;
/**
 * Take a payment against a bill.
 *
 * Posts a negative `payment` line and one cash ledger entry. It never posts
 * revenue: the charge already did that at post time (D-f). Building it the
 * other way round would double count every shilling.
 */
export const TakePaymentRequest = z.object({
    amountRwf: z.number().int().positive(),
    method: PaymentMethod,
    reference: z.string().trim().max(120).optional(),
});
export type TakePaymentRequest = z.infer<typeof TakePaymentRequest>;
/**
 * Void a posted charge.
 *
 * Posts a reversing line naming the original. The original row is never
 * touched, so a bill shows the mistake and the correction rather than hiding
 * both. Allowed once per charge, and a void can never itself be voided.
 */
export const VoidChargeRequest = z.object({
    reason: z.string().trim().min(1, "Say why.").max(500),
});
export type VoidChargeRequest = z.infer<typeof VoidChargeRequest>;
/**
 * Close a bill, which signs its sale (ADR-050 D-a).
 *
 * Both fields are optional: most guests are not businesses. A guest who wants
 * the receipt made out to their company gives its TIN and name here, and §4 d
 * and e put them on the receipt.
 */
export const CloseFolioRequest = z.object({
    customerTin: Tin.optional(),
    customerName: z.string().trim().min(1).max(200).optional(),
});
export type CloseFolioRequest = z.infer<typeof CloseFolioRequest>;
/**
 * What closing a bill declared, and what it deliberately did not.
 *
 * `emissionId` is null only where nothing may be declared at all (the demo
 * environment). `status` is `failed` with a `reason` when the business has no
 * EBM connection: the close still succeeds, because a missing connection must
 * never strand a front desk (D-b). `excludedChargeIds` are lines another
 * taxpayer already declared, which this receipt must not cover again.
 */
export const FolioDeclaration = z.object({
    emissionId: Uuid.nullable(),
    status: z.enum(["held", "failed", "emitted"]).nullable(),
    reason: z.string().nullable(),
    excludedChargeIds: z.array(Uuid),
});
export type FolioDeclaration = z.infer<typeof FolioDeclaration>;
export const CloseFolioResult = OperatorFolioDetail.extend({
    lockedAt: z.string().nullable(),
    declaration: FolioDeclaration,
});
export type CloseFolioResult = z.infer<typeof CloseFolioResult>;
// ---------------------------------------------------------------------------
// Departmental revenue
// ---------------------------------------------------------------------------
/** `YYYY-MM`. */
const IsoMonth = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "A month is YYYY-MM.");
/**
 * Which month of revenue to roll up. The property's current month when absent.
 *
 * `workspaceId` is optional for the same reason it is on every ops read: the
 * guard takes it from the `x-workspace-id` header first.
 */
export const OperatorRevenueQuery = z.object({
    workspaceId: Uuid.optional(),
    month: IsoMonth.optional(),
});
export type OperatorRevenueQuery = z.infer<typeof OperatorRevenueQuery>;
/** One revenue centre's takings for the month. */
export const OperatorRevenueDepartment = z.object({
    departmentId: Uuid,
    name: z.string(),
    departmentCategory: DepartmentCategory,
    status: DepartmentStatus,
    /** Tax exclusive, net of voids. Can be zero; never absent. */
    revenueRwf: z.number().int(),
});
export type OperatorRevenueDepartment = z.infer<typeof OperatorRevenueDepartment>;
/**
 * Revenue by department for one month (USALI, F-P01).
 *
 * READ STRAIGHT OFF THE CHARGES. A revenue charge (`room`, `service_order`,
 * `pos`) must name a revenue centre department, and a void posts the same type
 * and department with the amount negated, so a plain sum per department is the
 * takings net of every correction. Tax is its own line and is not revenue.
 *
 * REVENUE ONLY, and that is the whole of what the data can say. There is no
 * expense ledger, so direct costs, undistributed expenses and the Gross
 * Operating Profit have no source; a shape that carried them would be carrying
 * invented numbers.
 */
export const OperatorRevenue = z.object({
    month: IsoMonth,
    /** `YYYY-MM-DD`, inclusive. */
    from: z.string(),
    /** `YYYY-MM-DD`, exclusive. */
    to: z.string(),
    departments: z.array(OperatorRevenueDepartment),
    totalRwf: z.number().int(),
});
export type OperatorRevenue = z.infer<typeof OperatorRevenue>;
// ---------------------------------------------------------------------------
// Room assignment
// ---------------------------------------------------------------------------
export const RoomAssignmentStatus = z.enum(["assigned", "released"]);
export type RoomAssignmentStatus = z.infer<typeof RoomAssignmentStatus>;
/**
 * A room held for a booking over a date range.
 *
 * `from` and `to` are a half open range: the guest holds the room from `from`
 * up to but not including `to`, so a departure on the morning of the 5th does
 * not collide with an arrival that afternoon.
 */
export const OperatorRoomAssignment = z.object({
    id: Uuid,
    bookingId: Uuid,
    roomId: Uuid,
    roomLabel: z.string().nullable(),
    from: z.string(),
    to: z.string(),
    status: RoomAssignmentStatus,
    assignedByUserId: Uuid.nullable(),
    releasedAt: z.string().nullable(),
});
export type OperatorRoomAssignment = z.infer<typeof OperatorRoomAssignment>;
export const OperatorRoomAssignmentList = z.object({
    assignments: z.array(OperatorRoomAssignment),
});
export type OperatorRoomAssignmentList = z.infer<typeof OperatorRoomAssignmentList>;
/**
 * Give a booking a physical room.
 *
 * The dates default to the booking's own check in and check out. An explicit
 * range is for a SPLIT STAY: a guest in 101 for two nights and 205 for the
 * third is two assignments against one booking, which is the requirement a
 * nullable column on `bookings` could not have met.
 */
export const AssignRoomRequest = z.object({
    roomId: Uuid,
    /** `YYYY-MM-DD`. Defaults to the booking's check in. */
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    /** `YYYY-MM-DD`, exclusive. Defaults to the booking's check out. */
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
export type AssignRoomRequest = z.infer<typeof AssignRoomRequest>;
/**
 * Every room held across the property over a window of dates.
 *
 * The room grid's read. Holds were only readable one booking at a time, so a
 * tape chart would have cost one request per reservation on screen. Only live
 * holds come back: a released one is history, and drawing it would put a
 * guest in a room they were moved out of.
 */
export const RoomAssignmentWindowQuery = z
    .object({
    workspaceId: Uuid.optional(),
    /** `YYYY-MM-DD`, inclusive. */
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    /** `YYYY-MM-DD`, exclusive. */
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})
    .refine((q) => q.from < q.to, {
    message: "The window has to end after it starts.",
});
export type RoomAssignmentWindowQuery = z.infer<typeof RoomAssignmentWindowQuery>;
// ---------------------------------------------------------------------------
// The team: who works at this business
// ---------------------------------------------------------------------------
/**
 * One person who works here (ADR-035, wave 2 follow-up).
 *
 * **This shape exists because nothing answered the question.**
 * `org_memberships` is the row that says somebody works at a business, and no
 * controller read it for anybody but the caller: `WorkspaceService` used it to
 * resolve your own grant and stopped there. So the operator app had no way to
 * list its own staff, and the screen that tried showed invented people.
 *
 * THE ROLE IS THE POINT. `orgRole` is not decoration here — it is the same
 * field `permissionsForWorkspace` resolves every refusal from, so this list is
 * the one place an owner can see WHY a receptionist cannot open Finance. A
 * roster without it would be an address book.
 *
 * `name` and `email` are nullable because a membership can exist before its
 * person has completed a profile. An invited account that has never signed in
 * is a real row, and hiding it would hide the invitation.
 */
export const OperatorTeamMember = z.object({
    userId: Uuid,
    name: z.string().nullable(),
    email: z.string().nullable(),
    orgRole: OrgRole,
    /** `active` or `removed`. A removed member keeps their history. */
    status: z.string(),
    joinedAt: z.string(),
    /**
     * The branches this member is limited to (ADR-054 AC-T1). `null` means
     * every branch, which an owner always is. Archived branches a member was
     * limited to stay listed, so the screen can say why one reads as retired.
     */
    branchIds: z.array(Uuid).nullable(),
    /** The last time any of their sessions was used, or null when they never signed in. */
    lastActiveAt: z.string().nullable(),
    /** When a removed member was taken off the business; null while active. */
    removedAt: z.string().nullable(),
    /** Their identity is verified (KYC), which an ownership transfer will ask for. */
    identityVerified: z.boolean(),
});
export type OperatorTeamMember = z.infer<typeof OperatorTeamMember>;
/**
 * Which branches a member covers, as a request carries it (ADR-054 AC-T1).
 *
 * `null` means every branch; a list means only those. An empty list is not
 * refused here but by the service, with the other AC-T1 refusals, because
 * "no branch at all" is a rule about the business, not the shape: it answers
 * 422 beside "that branch is archived" rather than 400 beside a malformed id.
 */
export const MemberBranchIds = z.array(Uuid).nullable();
export type MemberBranchIds = z.infer<typeof MemberBranchIds>;
/** `PUT /api/v1/ops/team/:userId/branches`. */
export const SetMemberBranchesRequest = z.object({
    branchIds: MemberBranchIds,
});
export type SetMemberBranchesRequest = z.infer<typeof SetMemberBranchesRequest>;
/** The words a member's branch refusal carries (ADR-054 AC-T1), one per rule. */
export const MEMBER_BRANCHES_REFUSAL = {
    owner: "An owner always covers every branch.",
    empty: "Choose at least one branch, or every branch.",
    foreign: "That branch does not belong to this business.",
    archived: "That branch is archived. Restore it first, or choose another.",
    residence: "A residence business has no branches to limit.",
} as const;
export const OperatorTeamList = z.object({
    members: z.array(OperatorTeamMember),
});
export type OperatorTeamList = z.infer<typeof OperatorTeamList>;
// ---------------------------------------------------------------------------
// Inviting staff
// ---------------------------------------------------------------------------
/**
 * The roles an owner or manager may invite somebody into.
 *
 * `owner` is not offered. Ownership changes hands through the owner claim
 * (FL02), which checks an identity document; an emailed link that could make
 * somebody an owner would be a way round that check.
 */
export const InvitableOrgRole = OrgRole.exclude(["owner"]);
export type InvitableOrgRole = z.infer<typeof InvitableOrgRole>;
/** What a role is called on screens and in the invitation mail. */
export const ORG_ROLE_LABEL: Readonly<Record<OrgRole, string>> = {
    owner: "Owner",
    manager: "Manager",
    receptionist: "Front office / Receptionist",
    finance: "Finance",
    hr: "HR",
    housekeeper: "Housekeeper",
};
export const InviteStaffRequest = z.object({
    /** The person's name as the inviter typed it, shown on the Team screen until they accept. */
    name: z.string().trim().min(1).max(120).optional(),
    email: z
        .string()
        .trim()
        .toLowerCase()
        .email("Use an email address like name@example.com.")
        .max(200),
    orgRole: InvitableOrgRole,
    /** The branches the invitee will cover; absent or null is every branch (ADR-054). */
    branchIds: MemberBranchIds.default(null),
});
export type InviteStaffRequest = z.infer<typeof InviteStaffRequest>;
/**
 * `PATCH /api/v1/ops/team/:userId/role`: move a member to another staff role.
 *
 * `InvitableOrgRole` refuses `owner` on the way in, and the service refuses a
 * member who IS the owner on the way out: ownership changes hands through the
 * owner claim, which checks an identity document, never through this.
 */
export const ChangeMemberRoleRequest = z.object({
    orgRole: InvitableOrgRole,
});
export type ChangeMemberRoleRequest = z.infer<typeof ChangeMemberRoleRequest>;
/** The words a role change refusal carries, one per rule. */
export const MEMBER_ROLE_REFUSAL = {
    owner: "An owner's role changes only through an ownership transfer.",
    same: "This member already holds that role.",
} as const;
export const StaffInvitationStatus = z.enum(["sent", "accepted", "revoked", "expired"]);
export type StaffInvitationStatus = z.infer<typeof StaffInvitationStatus>;
/**
 * One invitation, as the business that sent it sees it.
 *
 * The TOKEN is never on this shape. It travels once, in the mail, and a list
 * that carried it would turn anybody who can read the People screen into
 * somebody who can accept every pending invitation themselves.
 */
export const OperatorStaffInvitation = z.object({
    id: Uuid,
    email: z.string(),
    orgRole: OrgRole,
    /** `expired` is derived at read time from `expiresAt`, not stored. */
    status: StaffInvitationStatus,
    expiresAt: z.string(),
    createdAt: z.string(),
    /** The branches the invitee will cover; null is every branch (ADR-054). */
    branchIds: z.array(Uuid).nullable(),
    /** The name the inviter typed, or null for an invitation sent with an address only. */
    name: z.string().nullable(),
});
export type OperatorStaffInvitation = z.infer<typeof OperatorStaffInvitation>;
export const OperatorStaffInvitationList = z.object({
    invitations: z.array(OperatorStaffInvitation),
});
export type OperatorStaffInvitationList = z.infer<typeof OperatorStaffInvitationList>;
/** The token from the mail. POSTed in a body, never put in a query string. */
export const StaffInvitationTokenRequest = z.object({
    token: z.string().min(16).max(200),
});
export type StaffInvitationTokenRequest = z.infer<typeof StaffInvitationTokenRequest>;
/** What the join page shows before somebody accepts. */
export const StaffInvitationPreview = z.object({
    legalName: z.string(),
    orgRole: OrgRole,
    /** The address it was sent to, so a person signed in as someone else sees why it refuses. */
    email: z.string(),
});
export type StaffInvitationPreview = z.infer<typeof StaffInvitationPreview>;
export const AcceptedStaffInvitation = z.object({
    orgId: Uuid,
    workspaceId: Uuid,
    orgRole: OrgRole,
});
export type AcceptedStaffInvitation = z.infer<typeof AcceptedStaffInvitation>;
// ---------------------------------------------------------------------------
// Housekeeping tasks
// ---------------------------------------------------------------------------
export const HousekeepingTaskType = z.enum([
    "checkout_clean",
    "stayover_clean",
    "inspection",
    "deep_clean",
    "turndown",
]);
export type HousekeepingTaskType = z.infer<typeof HousekeepingTaskType>;
/**
 * `pending -> in_progress -> done -> inspected`, and any state to `blocked`
 * (it needs maintenance first) and back to `pending`.
 */
export const HousekeepingTaskStatus = z.enum([
    "pending",
    "in_progress",
    "done",
    "inspected",
    "blocked",
]);
export type HousekeepingTaskStatus = z.infer<typeof HousekeepingTaskStatus>;
export const OperatorHousekeepingTask = z.object({
    id: Uuid,
    roomId: Uuid,
    roomLabel: z.string().nullable(),
    taskType: HousekeepingTaskType,
    status: HousekeepingTaskStatus,
    assignedToUserId: Uuid.nullable(),
    assignedToName: z.string().nullable(),
    priority: z.number().int(),
    note: z.string().nullable(),
    startedAt: z.string().nullable(),
    completedAt: z.string().nullable(),
    createdAt: z.string(),
});
export type OperatorHousekeepingTask = z.infer<typeof OperatorHousekeepingTask>;
export const OperatorHousekeepingTaskList = z.object({
    tasks: z.array(OperatorHousekeepingTask),
});
export type OperatorHousekeepingTaskList = z.infer<typeof OperatorHousekeepingTaskList>;
/** Put a room on the cleaning board, optionally against a named housekeeper. */
export const CreateHousekeepingTaskRequest = z.object({
    roomId: Uuid,
    taskType: HousekeepingTaskType,
    assignedToUserId: Uuid.optional(),
    priority: z.number().int().min(0).max(100).optional(),
    note: z.string().trim().max(500).optional(),
});
export type CreateHousekeepingTaskRequest = z.infer<typeof CreateHousekeepingTaskRequest>;
/**
 * Move a task along.
 *
 * The person doing the cleaning sends this, so it is gated on
 * `housekeeping.set` rather than on `task.assign`: a housekeeper holds the
 * first and not the second.
 */
export const AdvanceHousekeepingTaskRequest = z.object({
    to: HousekeepingTaskStatus,
    note: z.string().trim().max(500).optional(),
});
export type AdvanceHousekeepingTaskRequest = z.infer<typeof AdvanceHousekeepingTaskRequest>;
// ---------------------------------------------------------------------------
// Maintenance, on both surfaces
// ---------------------------------------------------------------------------
/**
 * Raise a work order.
 *
 * At least one of `roomId` or `leaseId` is required, which is the same rule the
 * database checks: a ticket has to be ABOUT something, and a work order nobody
 * can locate is worse than no work order.
 */
export const RaiseTicketRequest = z
    .object({
    roomId: Uuid.optional(),
    leaseId: Uuid.optional(),
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(2000).optional(),
    category: MaintenanceCategory.optional(),
    priority: MaintenancePriority.optional(),
})
    .refine((v) => Boolean(v.roomId ?? v.leaseId), {
    message: "Name the room or the lease this is about.",
});
export type RaiseTicketRequest = z.infer<typeof RaiseTicketRequest>;
// ---------------------------------------------------------------------------
// The service catalog and its orders
// ---------------------------------------------------------------------------
export const ServiceCatalogStatus = z.enum([
    "active",
    "out_of_stock",
    "archived",
]);
export type ServiceCatalogStatus = z.infer<typeof ServiceCatalogStatus>;
export const FulfillmentType = z.enum([
    "in_room_delivery",
    "pickup",
    "appointment",
    "onsite",
    "instant",
]);
export type FulfillmentType = z.infer<typeof FulfillmentType>;
export const ServiceOrderChannel = z.enum([
    "guest_app",
    "in_room_device",
    "front_desk",
    "staff",
    "api",
]);
export type ServiceOrderChannel = z.infer<typeof ServiceOrderChannel>;
/**
 * `submitted -> acknowledged -> in_progress -> ready -> delivered ->
 * completed`, plus `submitted -> rejected`, and anything before `delivered` to
 * `cancelled`.
 *
 * A pay now order starts before the board sees it (ADR-050 D-n):
 * `pending_payment -> submitted` when its money settles, or
 * `pending_payment -> payment_failed` when it is refused or expires.
 */
export const ServiceOrderStatus = z.enum([
    "submitted",
    "acknowledged",
    "in_progress",
    "ready",
    "delivered",
    "completed",
    "cancelled",
    "rejected",
    "pending_payment",
    "payment_failed",
]);
export type ServiceOrderStatus = z.infer<typeof ServiceOrderStatus>;
/**
 * When an order's money moves (ADR-050 D-n). `in_house_folio` posts to the
 * guest's bill on `delivered`; `pay_now` settles first and never touches a bill.
 */
export const OrderContext = z.enum(["in_house_folio", "pay_now"]);
export type OrderContext = z.infer<typeof OrderContext>;
// --- RRA item codes (ADR-050 D-m) ------------------------------------------
/** `itemTyCd`, VSDC v1.0.5 §4.3: `1` raw material, `2` finished product, `3` service. */
export const RraItemTypeCode = z.enum(["1", "2", "3"]);
export type RraItemTypeCode = z.infer<typeof RraItemTypeCode>;
/** `itemClsCd`, a code from RRA's classification list (§3.3.2.2). Digits, CHAR 10 on an item. */
export const RraClassificationCode = z
    .string()
    .trim()
    .regex(/^\d{1,10}$/, "A classification code is up to ten digits from RRA's list.");
/** `pkgUnitCd` (§4.5) or `qtyUnitCd` (§4.6): the Authority's own unit code, CHAR 5. */
export const RraUnitCode = z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{1,5}$/, "A unit code is one to five letters or digits from RRA's list.");
/**
 * One modifier on an item: a size, an extra, a choice of side (ADR-050 D-m).
 *
 * A chosen modifier is SNAPSHOTTED onto the order line with its price delta, so
 * changing the menu never changes a placed order.
 */
export const ServiceItemOption = z.object({
    name: z.string().trim().min(1).max(80),
    required: z.boolean().default(false),
    maxChoices: z.number().int().min(1).max(20).default(1),
    choices: z
        .array(z.object({
        label: z.string().trim().min(1).max(80),
        /** Tax exclusive, like the item's own price. May be zero or negative. */
        priceDeltaRwf: z.number().int().min(-10_000_000).max(10_000_000).default(0),
    }))
        .min(1)
        .max(30),
});
export type ServiceItemOption = z.infer<typeof ServiceItemOption>;
export const ServiceItemOptions = z.array(ServiceItemOption).max(20);
export type ServiceItemOptions = z.infer<typeof ServiceItemOptions>;
/** What a guest or a waiter picked for one option, by label. */
export const SelectedOption = z.object({
    name: z.string().trim().min(1).max(80),
    choices: z.array(z.string().trim().min(1).max(80)).min(1).max(20),
});
export type SelectedOption = z.infer<typeof SelectedOption>;
/** A chosen option as the order line stores it: the labels AND the deltas, locked. */
export const SelectedOptionSnapshot = z.object({
    name: z.string(),
    choices: z.array(z.object({ label: z.string(), priceDeltaRwf: z.number().int() })),
});
export type SelectedOptionSnapshot = z.infer<typeof SelectedOptionSnapshot>;
/**
 * The RRA values an item still lacks before it may be sold, by name. Empty
 * means it may be sold. The server computes it; a screen only shows it.
 */
export const RraItemField = z.enum([
    "classification",
    "productType",
    "itemCode",
    "packagingUnit",
    "quantityUnit",
]);
export type RraItemField = z.infer<typeof RraItemField>;
export const OperatorServiceItem = z.object({
    id: Uuid,
    serviceCategoryId: Uuid,
    departmentId: Uuid,
    name: z.string(),
    description: z.string().nullable(),
    priceRwf: z.number().int(),
    taxCode: TaxCode,
    fulfillmentType: FulfillmentType,
    prepTimeMinutes: z.number().int().nullable(),
    guestOrderable: z.boolean(),
    stockQty: z.number().int().nullable(),
    status: ServiceCatalogStatus,
    options: ServiceItemOptions,
    rraItemClsCd: z.string().nullable(),
    /** The classification's name, for a screen to show beside the code. */
    rraItemClsName: z.string().nullable(),
    rraItemTyCd: RraItemTypeCode.nullable(),
    /** Minted by the server once, and never changed. */
    rraItemCd: z.string().nullable(),
    rraPkgUnitCd: z.string().nullable(),
    rraQtyUnitCd: z.string().nullable(),
    /**
     * What still stops this item selling (ADR-050 D-m). An item flagged
     * `guestOrderable` with anything listed here is refused on every channel.
     */
    missingRra: z.array(RraItemField),
});
export type OperatorServiceItem = z.infer<typeof OperatorServiceItem>;
export const OperatorServiceCategory = z.object({
    id: Uuid,
    departmentId: Uuid,
    departmentName: z.string().nullable(),
    outletId: Uuid.nullable(),
    name: z.string(),
    sortOrder: z.number().int(),
    guestVisible: z.boolean(),
    status: DepartmentStatus,
    /** Prefills for a new item on this menu. Never a rule. */
    defaultRraItemClsCd: z.string().nullable(),
    defaultRraItemTyCd: RraItemTypeCode.nullable(),
    defaultRraPkgUnitCd: z.string().nullable(),
    defaultRraQtyUnitCd: z.string().nullable(),
    defaultTaxCode: TaxCode.nullable(),
    items: z.array(OperatorServiceItem),
});
export type OperatorServiceCategory = z.infer<typeof OperatorServiceCategory>;
/** The whole menu, grouped, which is the only way anyone reads it. */
export const OperatorServiceCatalog = z.object({
    categories: z.array(OperatorServiceCategory),
});
export type OperatorServiceCatalog = z.infer<typeof OperatorServiceCatalog>;
export const CreateServiceCategoryRequest = z.object({
    propertyId: Uuid,
    departmentId: Uuid,
    /** The outlet this menu sells from. Its items are listed to guests under it. */
    outletId: Uuid.optional(),
    name: z.string().trim().min(1).max(120),
    guestVisible: z.boolean().optional(),
    sortOrder: z.number().int().min(0).max(9999).optional(),
    defaultRraItemClsCd: RraClassificationCode.optional(),
    defaultRraItemTyCd: RraItemTypeCode.optional(),
    defaultRraPkgUnitCd: RraUnitCode.optional(),
    defaultRraQtyUnitCd: RraUnitCode.optional(),
    defaultTaxCode: TaxCode.optional(),
});
export type CreateServiceCategoryRequest = z.infer<typeof CreateServiceCategoryRequest>;
/**
 * Change a menu's name, visibility, order or prefills. The department and the
 * property are absent on purpose, for the reason an item cannot change menus.
 */
export const UpdateServiceCategoryRequest = CreateServiceCategoryRequest.omit({
    propertyId: true,
    departmentId: true,
})
    .partial()
    .refine((v) => Object.keys(v).length > 0, { message: "Say what to change." });
export type UpdateServiceCategoryRequest = z.infer<typeof UpdateServiceCategoryRequest>;
/**
 * Add or change a menu item.
 *
 * Editing one never rewrites a placed order: an order snapshots the name, the
 * price and the tax code at order time (D8), so last week's bill still says
 * what last week's menu said.
 *
 * The four RRA values are the item's own (ADR-050 D-m): on create, any left
 * out are prefilled from the category. `rraItemCd` is never accepted, because
 * the server mints it. Turning `guestOrderable` on without every RRA value is
 * refused with 422; left out on create, it is on exactly when they are all set.
 */
export const UpsertServiceItemRequest = z.object({
    serviceCategoryId: Uuid,
    name: z.string().trim().min(1).max(160),
    description: z.string().trim().max(1000).optional(),
    priceRwf: z.number().int().nonnegative(),
    taxCode: TaxCode.optional(),
    fulfillmentType: FulfillmentType.optional(),
    prepTimeMinutes: z.number().int().min(0).max(1440).optional(),
    guestOrderable: z.boolean().optional(),
    stockQty: z.number().int().min(0).nullable().optional(),
    status: ServiceCatalogStatus.optional(),
    options: ServiceItemOptions.optional(),
    rraItemClsCd: RraClassificationCode.optional(),
    rraItemTyCd: RraItemTypeCode.optional(),
    rraPkgUnitCd: RraUnitCode.optional(),
    rraQtyUnitCd: RraUnitCode.optional(),
});
export type UpsertServiceItemRequest = z.infer<typeof UpsertServiceItemRequest>;
/** One row of RRA's classification list, for the menu's picker. */
export const RraClassification = z.object({
    code: z.string(),
    name: z.string(),
    level: z.number().int(),
});
export type RraClassification = z.infer<typeof RraClassification>;
export const RraClassificationSearch = z.object({
    q: z.string().trim().max(80).default(""),
});
export type RraClassificationSearch = z.infer<typeof RraClassificationSearch>;
export const RraClassificationList = z.object({
    classifications: z.array(RraClassification),
});
export type RraClassificationList = z.infer<typeof RraClassificationList>;
export const OperatorServiceOrderItem = z.object({
    id: Uuid,
    serviceItemId: Uuid.nullable(),
    nameSnapshot: z.string(),
    quantity: z.number().int(),
    unitPriceRwf: z.number().int(),
    lineTotalRwf: z.number().int(),
    taxCode: TaxCode.nullable(),
    note: z.string().nullable(),
    /** The modifiers chosen, with the deltas locked when the order was placed. */
    selectedOptions: z.array(SelectedOptionSnapshot),
});
export type OperatorServiceOrderItem = z.infer<typeof OperatorServiceOrderItem>;
export const OperatorServiceOrder = z.object({
    id: Uuid,
    orderNumber: z.string(),
    departmentId: Uuid,
    departmentName: z.string().nullable(),
    outletId: Uuid.nullable(),
    folioId: Uuid.nullable(),
    roomId: Uuid.nullable(),
    roomLabel: z.string().nullable(),
    channel: ServiceOrderChannel,
    status: ServiceOrderStatus,
    orderContext: OrderContext,
    fulfillmentType: FulfillmentType,
    subtotalRwf: z.number().int(),
    taxRwf: z.number().int(),
    totalRwf: z.number().int(),
    /** Pay now only: when its money settled, and the RRA means of payment (`01` cash, `06` mobile money). */
    paidAt: z.string().nullable(),
    paymentMethod: z.string().nullable(),
    guestNote: z.string().nullable(),
    createdAt: z.string(),
    items: z.array(OperatorServiceOrderItem),
});
export type OperatorServiceOrder = z.infer<typeof OperatorServiceOrder>;
export const OperatorServiceOrderList = z.object({
    orders: z.array(OperatorServiceOrder),
});
export type OperatorServiceOrderList = z.infer<typeof OperatorServiceOrderList>;
/**
 * Place an order on a guest's behalf.
 *
 * The department is NOT asked for: it comes from the items, because an item
 * carries its own department and a caller who could choose would eventually
 * route a club sandwich to Engineering.
 *
 * `in_house_folio`, the default, charges a stay's bill and needs `guestStayId`.
 * `pay_now` is a walk in at the counter (ADR-050 D-n): no stay and no bill, it
 * waits `pending_payment` until someone marks it paid in cash.
 */
export const CreateServiceOrderRequest = z
    .object({
    context: OrderContext.default("in_house_folio"),
    guestStayId: Uuid.optional(),
    channel: ServiceOrderChannel.optional(),
    guestNote: z.string().trim().max(1000).optional(),
    items: z
        .array(z.object({
        serviceItemId: Uuid,
        quantity: z.number().int().positive().max(99),
        note: z.string().trim().max(300).optional(),
        selectedOptions: z.array(SelectedOption).max(20).optional(),
    }))
        .min(1, "An order needs at least one item."),
})
    .refine((v) => v.context === "pay_now" || Boolean(v.guestStayId), {
    message: "Name the stay this order is charged to.",
    path: ["guestStayId"],
})
    .refine((v) => v.context === "in_house_folio" || !v.guestStayId, {
    message: "A pay now order is not charged to a stay.",
    path: ["guestStayId"],
});
export type CreateServiceOrderRequest = z.infer<typeof CreateServiceOrderRequest>;
/**
 * Mark a pay now order paid in cash (ADR-050 D-p, AC-24).
 *
 * `amountRwf` must be exactly the order's total. It is asked for rather than
 * read, so the person holding the cash confirms the number they took, and a
 * mismatch is refused instead of recorded.
 */
export const MarkOrderPaidCashRequest = z.object({
    amountRwf: z.number().int().positive(),
});
export type MarkOrderPaidCashRequest = z.infer<typeof MarkOrderPaidCashRequest>;
/** What marking cash raised: the order, now `submitted`, and its `NS` emission. */
export const MarkOrderPaidCashResult = OperatorServiceOrder.extend({
    /** Null in the demo environment, where nothing is declared. */
    emissionId: Uuid.nullable(),
});
export type MarkOrderPaidCashResult = z.infer<typeof MarkOrderPaidCashResult>;
/**
 * Move an order along its board.
 *
 * Reaching `delivered` or `completed` posts the folio charge, in the same
 * transaction, so the bill can never disagree with the board.
 */
export const AdvanceServiceOrderRequest = z.object({
    to: ServiceOrderStatus,
    note: z.string().trim().max(500).optional(),
});
export type AdvanceServiceOrderRequest = z.infer<typeof AdvanceServiceOrderRequest>;
/**
 * Change a menu item that already exists.
 *
 * Partial, and the CATEGORY is absent on purpose: moving an item to another
 * menu would move its department too, and a bill already run against the old
 * one would then disagree with the new one. Archive it and add a new one.
 */
export const UpdateServiceItemRequest = UpsertServiceItemRequest.omit({
    serviceCategoryId: true,
})
    .partial()
    .refine((v) => Object.keys(v).length > 0, {
    message: "Say what to change.",
});
export type UpdateServiceItemRequest = z.infer<typeof UpdateServiceItemRequest>;
// ---------------------------------------------------------------------------
// Department staff (ADR-016 slice 8, D17)
// ---------------------------------------------------------------------------
/**
 * Operational rank inside a department.
 *
 * A SECOND AXIS over `org_role`, never a replacement for it (D17). `org_role`
 * governs what a person may DO (move money, edit config, invite staff);
 * this governs whose board a task shows on. They compose: a receptionist can be
 * the Front Office head, and a manager can oversee several departments.
 *
 * Overloading `org_role` with operational rank is the mistake this avoids: it
 * would mean promoting somebody to shift lead handed them the money commands.
 */
export const DepartmentPosition = z.enum([
    "department_head",
    "supervisor",
    "staff",
]);
export type DepartmentPosition = z.infer<typeof DepartmentPosition>;
export const OperatorDepartmentMember = z.object({
    id: Uuid,
    departmentId: Uuid,
    userId: Uuid,
    name: z.string().nullable(),
    email: z.string().nullable(),
    departmentPosition: DepartmentPosition,
    /** The staffer's home department, the one their shift board defaults to. */
    isPrimary: z.boolean(),
    status: z.enum(["active", "removed"]),
});
export type OperatorDepartmentMember = z.infer<typeof OperatorDepartmentMember>;
export const OperatorDepartmentMemberList = z.object({
    members: z.array(OperatorDepartmentMember),
});
export type OperatorDepartmentMemberList = z.infer<typeof OperatorDepartmentMemberList>;
/**
 * Put somebody on a department's roster.
 *
 * Names the USER rather than the membership: the caller knows who they mean,
 * and the server resolves that person's membership of this org. A caller who
 * had to supply a membership id could supply somebody else's.
 */
export const AssignDepartmentMemberRequest = z.object({
    userId: Uuid,
    departmentPosition: DepartmentPosition.optional(),
    isPrimary: z.boolean().optional(),
});
export type AssignDepartmentMemberRequest = z.infer<typeof AssignDepartmentMemberRequest>;