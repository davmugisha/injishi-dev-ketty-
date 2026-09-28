"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PropertyScopedQuery = exports.AddAmenityRequest = exports.OperatorAmenityList = exports.OperatorAmenity = exports.ReturnDepositRequest = exports.OperatorDepositList = exports.OperatorDeposit = exports.RecordRentRequest = exports.OperatorFilingList = exports.OperatorContractFiling = exports.CONTRACT_FILING_WINDOW_DAYS = exports.FilingStatus = exports.OperatorRentRoll = exports.OperatorRentCharge = exports.AdvanceLeaseRequest = exports.OperatorLeaseList = exports.OperatorLease = exports.AdvanceTicketRequest = exports.OperatorTicketList = exports.OperatorTicket = exports.MaintenancePriority = exports.MaintenanceCategory = exports.SendMessageRequest = exports.OperatorMessageList = exports.OperatorMessage = exports.OperatorThreadList = exports.OperatorThread = exports.SetHousekeepingRequest = exports.CheckOutRequest = exports.WalkInRequest = exports.CheckInRequest = exports.OperatorStayList = exports.OperatorStay = exports.IssueStayClaimInviteRequest = exports.StayClaimInvite = exports.CLAIM_CODE_PATTERN = exports.StayRegistrationDetails = exports.OperatorRoomList = exports.OperatorRoom = exports.CautionStatus = exports.RentStatus = exports.LeaseStatus = exports.MaintenanceStatus = exports.HousekeepingStatus = exports.RoomStatus = exports.ReservationDecisionResult = exports.OperatorReservationQuery = exports.OperatorReservationList = exports.OperatorReservation = exports.OperatorReservationState = void 0;
exports.CreateHousekeepingTaskRequest = exports.OperatorHousekeepingTaskList = exports.OperatorHousekeepingTask = exports.HousekeepingTaskStatus = exports.HousekeepingTaskType = exports.AcceptedStaffInvitation = exports.StaffInvitationPreview = exports.StaffInvitationTokenRequest = exports.OperatorStaffInvitationList = exports.OperatorStaffInvitation = exports.StaffInvitationStatus = exports.InviteStaffRequest = exports.ORG_ROLE_LABEL = exports.InvitableOrgRole = exports.OperatorTeamList = exports.MEMBER_BRANCHES_REFUSAL = exports.SetMemberBranchesRequest = exports.MemberBranchIds = exports.OperatorTeamMember = exports.RoomAssignmentWindowQuery = exports.AssignRoomRequest = exports.OperatorRoomAssignmentList = exports.OperatorRoomAssignment = exports.RoomAssignmentStatus = exports.OperatorRevenue = exports.OperatorRevenueDepartment = exports.OperatorRevenueQuery = exports.CloseFolioResult = exports.FolioDeclaration = exports.CloseFolioRequest = exports.VoidChargeRequest = exports.TakePaymentRequest = exports.PostChargeResult = exports.PostChargeRequest = exports.OperatorFolioDetail = exports.OperatorFolioCharge = exports.OperatorFolioList = exports.OperatorFolio = exports.PaymentMethod = exports.TaxCode = exports.ChargeType = exports.FolioStatus = exports.FolioType = exports.UpdateDepartmentRequest = exports.CreateDepartmentRequest = exports.OperatorDepartmentList = exports.OperatorDepartment = exports.DepartmentStatus = exports.DepartmentType = exports.DepartmentCategory = void 0;
exports.AssignDepartmentMemberRequest = exports.OperatorDepartmentMemberList = exports.OperatorDepartmentMember = exports.DepartmentPosition = exports.UpdateServiceItemRequest = exports.AdvanceServiceOrderRequest = exports.MarkOrderPaidCashResult = exports.MarkOrderPaidCashRequest = exports.CreateServiceOrderRequest = exports.OperatorServiceOrderList = exports.OperatorServiceOrder = exports.OperatorServiceOrderItem = exports.RraClassificationList = exports.RraClassificationSearch = exports.RraClassification = exports.UpsertServiceItemRequest = exports.UpdateServiceCategoryRequest = exports.CreateServiceCategoryRequest = exports.OperatorServiceCatalog = exports.OperatorServiceCategory = exports.OperatorServiceItem = exports.RraItemField = exports.SelectedOptionSnapshot = exports.SelectedOption = exports.ServiceItemOptions = exports.ServiceItemOption = exports.RraUnitCode = exports.RraClassificationCode = exports.RraItemTypeCode = exports.OrderContext = exports.ServiceOrderStatus = exports.ServiceOrderChannel = exports.FulfillmentType = exports.ServiceCatalogStatus = exports.RaiseTicketRequest = exports.AdvanceHousekeepingTaskRequest = void 0;
const zod_1 = require("zod");
const booking_1 = require("./booking");
const primitives_1 = require("./primitives");
const registration_1 = require("./registration");
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
exports.OperatorReservationState = zod_1.z.enum([
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
/**
 * One row of the Reservations list.
 *
 * Every field is read from a column or derived from two of them; nothing is
 * computed in the browser (ADR-012, Value sourcing). `room` in particular comes
 * from `guest_stays.room_id` and is never guessed from the room type.
 */
exports.OperatorReservation = zod_1.z.object({
    id: primitives_1.Uuid,
    /** The human handle a guest quotes on the phone. */
    reference: zod_1.z.string().min(1),
    /** `users.name`, which is nullable: an account may exist before a name does. */
    guestName: zod_1.z.string().nullable(),
    /** `YYYY-MM-DD`. A bare date column, so no timezone rides along. */
    checkIn: zod_1.z.string(),
    checkOut: zod_1.z.string(),
    /** Derived from the two dates above, server side, so one definition of it. */
    nights: zod_1.z.number().int().positive(),
    guestCount: zod_1.z.number().int().positive(),
    state: exports.OperatorReservationState,
    /** The raw `bookings.status`, so the derivation above hides nothing. */
    bookingStatus: booking_1.BookingStatus,
    /** `rooms.label` for the stay's room. Null until someone checks them in. */
    room: zod_1.z.string().nullable(),
    /**
     * The room TYPE the guest bought. A booking never names a room; this is
     * what a room held for it must match, and the room grid greys out every
     * row of another type before the desk drops a bar there and is refused.
     */
    roomTypeId: primitives_1.Uuid,
    /**
     * `bookings.gross_rwf`: what this reservation is worth.
     *
     * NOT a folio balance. A folio sums `ledger_entries` and moves every time
     * someone posts a charge; this is the agreed price of the stay and does not.
     * The Bill screen owns the other number.
     */
    totalRwf: zod_1.z.number().int().nullable(),
    /** When an unanswered request auto declines. Null once it is resolved. */
    approvalExpiresAt: zod_1.z.string().nullable(),
    confirmedAt: zod_1.z.string().nullable(),
});
exports.OperatorReservationList = zod_1.z.object({
    reservations: zod_1.z.array(exports.OperatorReservation),
});
/**
 * The query on the reservations read.
 *
 * `WorkspaceGuard` reads the workspace from the `x-workspace-id` header first
 * and falls back to the query string, so this stays optional here rather than
 * being validated into a second source of truth. A read that names no workspace
 * is refused by the guard, not by this schema.
 */
exports.OperatorReservationQuery = zod_1.z.object({
    workspaceId: primitives_1.Uuid.optional(),
    /** Narrow the list to one desk state. Absent means all of them. */
    state: exports.OperatorReservationState.optional(),
});
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
exports.ReservationDecisionResult = exports.OperatorReservation;
// ===========================================================================
// The state machines these commands move
// ===========================================================================
//
// Each mirrors its Postgres enum in `schema.ts` EXACTLY. They live here rather
// than in `primitives.ts` because only the operator surface reads them today;
// the day a second domain needs one, it moves there rather than being copied.
/** Is this room sellable? Owned by maintenance. */
exports.RoomStatus = zod_1.z.enum(["available", "maintenance", "out_of_service"]);
/** Is this room ready? Owned by housekeeping. Orthogonal to `RoomStatus`. */
exports.HousekeepingStatus = zod_1.z.enum([
    "clean",
    "dirty",
    "inspected",
    "out_of_order",
]);
/** Two states only. The database enum has no middle, whatever a screen shows. */
/**
 * ADR-016 D16. Widened from `open | resolved`, which could not say that
 * somebody had picked a ticket up and had no way to record one raised in error.
 */
exports.MaintenanceStatus = zod_1.z.enum([
    "open",
    "assigned",
    "in_progress",
    "resolved",
    "closed",
    "cancelled",
]);
exports.LeaseStatus = zod_1.z.enum([
    "draft",
    "pending_signature",
    "active",
    "ending",
    "ended",
    "cancelled",
]);
exports.RentStatus = zod_1.z.enum(["paid", "due", "overdue"]);
exports.CautionStatus = zod_1.z.enum(["held", "refunded", "forfeited"]);
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
exports.OperatorRoom = zod_1.z.object({
    id: primitives_1.Uuid,
    /** `rooms.label`, e.g. "101". Null on a row nobody has numbered yet. */
    label: zod_1.z.string().nullable(),
    roomTypeId: primitives_1.Uuid,
    roomTypeName: zod_1.z.string(),
    status: exports.RoomStatus,
    housekeeping: exports.HousekeepingStatus,
    /** The open stay in this room, if anyone is in it. */
    occupiedBy: zod_1.z
        .object({ stayId: primitives_1.Uuid, guestName: zod_1.z.string().nullable() })
        .nullable(),
});
exports.OperatorRoomList = zod_1.z.object({ rooms: zod_1.z.array(exports.OperatorRoom) });
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
exports.StayRegistrationDetails = zod_1.z
    .object({
    /** As printed on the document, which is not always the name on the booking. */
    fullName: zod_1.z.string().trim().min(1).max(200).optional(),
    documentType: zod_1.z.enum(["national_id", "passport", "other"]).optional(),
    idNumber: zod_1.z.string().trim().min(1).max(64).optional(),
    /** Home address, free text: Rwandan and foreign addresses do not share a shape. */
    addressText: zod_1.z.string().trim().min(1).max(500).optional(),
    /**
     * Where the "continue in the app" mail goes. The ONE address this stay's
     * claim invitation is ever sent to, which is why it is captured here at the
     * counter with the guest watching, and never supplied later by a caller.
     */
    email: zod_1.z.string().trim().email().max(254).optional(),
    phone: zod_1.z.string().trim().min(6).max(32).optional(),
    /**
     * Send the claim invitation now. Default true when an address was given:
     * a desk that captured an address meant to invite them, and making the
     * invitation a second deliberate step is how it never gets sent.
     */
    invite: zod_1.z.boolean().optional(),
})
    .strict();
/** The shape of a claim code as it is printed: four letters, a dash, four digits. */
exports.CLAIM_CODE_PATTERN = /^[A-Z]{4}-\d{4}$/;
/**
 * What the desk gets back after registering somebody: the code on the slip, and
 * whether the mail actually left.
 *
 * `invitationSent` is false rather than an error when the transport refused.
 * The stay is real and the code is printed on the slip in the guest's hand;
 * failing the check in because an SMTP relay was down would put a guest back on
 * the street over an email.
 */
exports.StayClaimInvite = zod_1.z.object({
    stayId: primitives_1.Uuid,
    /** Null when the stay is already claimed — there is nothing left to hand out. */
    claimCode: zod_1.z.string().nullable(),
    email: zod_1.z.string().nullable(),
    invitationSent: zod_1.z.boolean(),
    invitedAt: zod_1.z.string().nullable(),
});
/** Re-send the invitation, or send a first one to an address captured late. */
exports.IssueStayClaimInviteRequest = zod_1.z
    .object({
    /** Absent keeps the address already on the stay. */
    email: zod_1.z.string().trim().email().max(254).optional(),
    /**
     * Mint a NEW code, invalidating the old slip. For the guest who says the
     * code does not work, or the one who left the slip in the taxi.
     */
    reissue: zod_1.z.boolean().optional(),
})
    .strict();
/** A guest in the building, or one who has left. */
exports.OperatorStay = zod_1.z.object({
    id: primitives_1.Uuid,
    bookingId: primitives_1.Uuid.nullable(),
    guestName: zod_1.z.string().nullable(),
    roomId: primitives_1.Uuid,
    roomLabel: zod_1.z.string().nullable(),
    lifecycle: zod_1.z.enum(["open", "closed"]),
    entryAt: zod_1.z.string(),
    plannedExitAt: zod_1.z.string().nullable(),
    actualExitAt: zod_1.z.string().nullable(),
});
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
exports.OperatorStayList = zod_1.z.object({ stays: zod_1.z.array(exports.OperatorStay) });
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
exports.CheckInRequest = zod_1.z.object({
    /**
     * OPTIONAL since ADR-016 (D-i). Check in uses the room already assigned for
     * today when one exists; sending a `roomId` overrides it, which is what the
     * desk does when a guest asks to move. A booking with neither an assignment
     * nor a `roomId` is refused with a message naming what is missing (AC-7).
     */
    roomId: primitives_1.Uuid.optional(),
    /**
     * Only if the desk agreed a different nightly rate at the counter. Absent
     * means the rate locked on the booking stands, which is the normal case and
     * the one that must not be overwritten by a blank field.
     */
    nightlyRateRwf: zod_1.z.number().int().positive().optional(),
    /**
     * The registration card, and the invitation that follows it (§6.8).
     *
     * OPTIONAL, because a booked guest already has an account and an address
     * and the desk usually types nothing. Present, it records the identity
     * against the stay and mails the guest a claim code so they can carry on
     * in the app. Absent, check in behaves exactly as it did.
     */
    guest: exports.StayRegistrationDetails.optional(),
});
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
exports.WalkInRequest = zod_1.z.object({
    /** Required: nothing has chosen a room, so the desk does. */
    roomId: primitives_1.Uuid,
    /** Required: there is no account to read a name from. */
    guestName: zod_1.z.string().trim().min(1).max(200),
    /** Absent means open ended. */
    plannedExitAt: zod_1.z.string().optional(),
    /** The nightly rate agreed at the counter. */
    nightlyRateRwf: zod_1.z.number().int().positive().optional(),
    /**
     * The registration card, and the invitation that follows it (§6.8).
     *
     * THIS IS THE CASE IT WAS BUILT FOR. A walk in has no account, so the only
     * record of who they are is what the desk types here, and the only way they
     * ever reach the app is the claim code this mails them. Without it a walk in
     * is a room number and a first name, and every guest-facing surface this
     * platform has is closed to them for the whole of their stay.
     */
    guest: exports.StayRegistrationDetails.optional(),
});
/**
 * Close an open stay.
 *
 * Flips the room to `dirty` in the same transaction, because a checkout that
 * does not dirty the room is how housekeeping misses a room, and leaving the
 * two to separate calls means a crash between them loses one.
 */
exports.CheckOutRequest = zod_1.z.object({
    /** Optional note for the stay record, e.g. "left early, keys at desk". */
    note: zod_1.z.string().trim().max(500).optional(),
});
/** Set a room's housekeeping state. Never touches its inventory status. */
exports.SetHousekeepingRequest = zod_1.z.object({
    housekeeping: exports.HousekeepingStatus,
});
// ===========================================================================
// Messaging
// ===========================================================================
/**
 * A conversation, hung off exactly one of a booking, a stay or a lease.
 *
 * `threads_scope_exactly_one` enforces the "exactly one" in the database, so a
 * thread can never be about two things at once and a reader never has to pick.
 */
exports.OperatorThread = zod_1.z.object({
    id: primitives_1.Uuid,
    scope: zod_1.z.enum(["booking", "stay", "lease"]),
    /** The booking, stay or lease this thread is about. */
    subjectId: primitives_1.Uuid,
    /** Who the operator is talking to, when we can resolve a name. */
    counterpartName: zod_1.z.string().nullable(),
    /**
     * The department the guest opened this conversation with (ADR-050 D-q),
     * or null for the reservation thread every booking gets at sale.
     */
    departmentName: zod_1.z.string().nullable(),
    status: zod_1.z.enum(["active", "archived"]),
    lastMessageAt: zod_1.z.string().nullable(),
    lastMessagePreview: zod_1.z.string().nullable(),
    messageCount: zod_1.z.number().int().nonnegative(),
});
exports.OperatorThreadList = zod_1.z.object({
    threads: zod_1.z.array(exports.OperatorThread),
});
exports.OperatorMessage = zod_1.z.object({
    id: primitives_1.Uuid,
    threadId: primitives_1.Uuid,
    senderUserId: primitives_1.Uuid.nullable(),
    senderName: zod_1.z.string().nullable(),
    /** True when this workspace sent it, so a screen can side the bubble. */
    fromUs: zod_1.z.boolean(),
    /** `system` is a line the platform wrote, such as an order's status (ADR-050 D-s). */
    bodyType: zod_1.z.enum(["text", "image", "voice", "system"]),
    body: zod_1.z.string().nullable(),
    /** The order a `system` line reports on, so a screen can draw its card. */
    serviceOrderId: primitives_1.Uuid.nullable(),
    voiceDurationS: zod_1.z.number().int().nullable(),
    createdAt: zod_1.z.string(),
});
exports.OperatorMessageList = zod_1.z.object({
    messages: zod_1.z.array(exports.OperatorMessage),
});
/**
 * Send a message into a thread.
 *
 * Text only here. Image and voice need an uploaded object first (F-S09 is
 * unbuilt), and accepting a body type this route cannot honour would be a
 * contract that lies.
 */
exports.SendMessageRequest = zod_1.z.object({
    body: zod_1.z
        .string()
        .trim()
        .min(1, "Write something before you send it.")
        .max(4000, "That message is too long to send."),
});
// ===========================================================================
// Residence: tickets, leases, rent, deposits
// ===========================================================================
/** What a work order is about. */
exports.MaintenanceCategory = zod_1.z.enum([
    "plumbing",
    "electrical",
    "hvac",
    "appliance",
    "furniture",
    "it_tech",
    "safety",
    "other",
]);
exports.MaintenancePriority = zod_1.z.enum(["low", "normal", "high", "urgent"]);
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
exports.OperatorTicket = zod_1.z.object({
    id: primitives_1.Uuid,
    leaseId: primitives_1.Uuid.nullable(),
    roomId: primitives_1.Uuid.nullable(),
    /** The unit or room, so the list reads without a second call. */
    unitLabel: zod_1.z.string().nullable(),
    raisedByName: zod_1.z.string().nullable(),
    title: zod_1.z.string(),
    description: zod_1.z.string().nullable(),
    category: exports.MaintenanceCategory.nullable(),
    priority: exports.MaintenancePriority,
    status: exports.MaintenanceStatus,
    resolvedAt: zod_1.z.string().nullable(),
    createdAt: zod_1.z.string(),
    noteCount: zod_1.z.number().int().nonnegative(),
});
exports.OperatorTicketList = zod_1.z.object({
    tickets: zod_1.z.array(exports.OperatorTicket),
});
/**
 * Move a ticket to its next state, with a note.
 *
 * The note is required rather than optional: `maintenance_events` is the only
 * record of WHY a ticket closed, and a resolved ticket with no reason is the
 * one a tenant reopens a week later.
 */
exports.AdvanceTicketRequest = zod_1.z.object({
    /**
     * Where the ticket goes next. Optional, and `resolved` when absent, which is
     * what every caller meant while the enum held only two values.
     */
    to: exports.MaintenanceStatus.optional(),
    note: zod_1.z
        .string()
        .trim()
        .min(1, "Say what was done.")
        .max(1000),
});
exports.OperatorLease = zod_1.z.object({
    id: primitives_1.Uuid,
    roomId: primitives_1.Uuid,
    unitLabel: zod_1.z.string().nullable(),
    tenantName: zod_1.z.string().nullable(),
    monthlyRentRwf: zod_1.z.number().int().nullable(),
    cautionRwf: zod_1.z.number().int().nullable(),
    startDate: zod_1.z.string().nullable(),
    endDate: zod_1.z.string().nullable(),
    status: exports.LeaseStatus,
    /** Whether both signatures are in, which is what gates going active. */
    landlordSignedAt: zod_1.z.string().nullable(),
    tenantSignedAt: zod_1.z.string().nullable(),
});
exports.OperatorLeaseList = zod_1.z.object({ leases: zod_1.z.array(exports.OperatorLease) });
/**
 * Move a lease one step along its lifecycle.
 *
 * The caller names the state it expects to reach rather than saying "next".
 * A blind "next" is how a double click ends a lease that was only meant to be
 * activated: the server would have no way to tell the second call from a
 * legitimate second step.
 */
exports.AdvanceLeaseRequest = zod_1.z.object({ to: exports.LeaseStatus });
/** One month's rent on one lease. */
exports.OperatorRentCharge = zod_1.z.object({
    id: primitives_1.Uuid,
    leaseId: primitives_1.Uuid,
    unitLabel: zod_1.z.string().nullable(),
    tenantName: zod_1.z.string().nullable(),
    /** `YYYY-MM-DD`, always the first of the month it covers. */
    periodMonth: zod_1.z.string(),
    amountRwf: zod_1.z.number().int().nullable(),
    paidAmountRwf: zod_1.z.number().int().nullable(),
    status: exports.RentStatus,
    dueDate: zod_1.z.string().nullable(),
    paidAt: zod_1.z.string().nullable(),
});
exports.OperatorRentRoll = zod_1.z.object({
    charges: zod_1.z.array(exports.OperatorRentCharge),
});
/**
 * Where the filing of one signed contract stands (F-R10 §8).
 *
 * The same three values as the `filing_status` enum, and deliberately no
 * fourth: "not filed yet" is the ABSENCE of a filing, carried as a null status
 * on the row below, not a state a filing can be in.
 */
exports.FilingStatus = zod_1.z.enum(["pending", "filed", "failed"]);
/**
 * How long Injishi has to file a signed contract with the tax administration,
 * counted from signing (F-R10 §6, §9).
 *
 * One definition, because both sides count against it: the API dates `due_by`
 * from it and the operator app words the clock from it.
 */
exports.CONTRACT_FILING_WINDOW_DAYS = 15;
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
exports.OperatorContractFiling = zod_1.z.object({
    leaseId: primitives_1.Uuid,
    unitLabel: zod_1.z.string().nullable(),
    tenantName: zod_1.z.string().nullable(),
    leaseStatus: exports.LeaseStatus,
    /** Null when no filing has been raised for this lease at all. */
    status: exports.FilingStatus.nullable(),
    /** When the fifteen days started. The signature, or the amendment that reset it. */
    clockStartAt: zod_1.z.string().nullable(),
    dueBy: zod_1.z.string().nullable(),
    attempts: zod_1.z.number().int().nonnegative(),
    /** Required on a failure (F-R10 §6: never silently dropped), null otherwise. */
    failureReason: zod_1.z.string().nullable(),
    adapterMode: primitives_1.AdapterMode.nullable(),
    /** The tenant's signature: what the clock starts at, when there is one. */
    signedAt: zod_1.z.string().nullable(),
});
exports.OperatorFilingList = zod_1.z.object({
    filings: zod_1.z.array(exports.OperatorContractFiling),
});
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
exports.RecordRentRequest = zod_1.z.object({
    periodMonth: zod_1.z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-08-01."),
    amountRwf: zod_1.z.number().int().positive("Enter what was actually paid."),
    /** How it arrived, for the record. Free text: v1 has no method catalog. */
    method: zod_1.z.string().trim().max(60).optional(),
});
/** A caution deposit being held against a lease. */
exports.OperatorDeposit = zod_1.z.object({
    id: primitives_1.Uuid,
    leaseId: primitives_1.Uuid,
    unitLabel: zod_1.z.string().nullable(),
    tenantName: zod_1.z.string().nullable(),
    amountRwf: zod_1.z.number().int().nullable(),
    status: exports.CautionStatus,
    heldAt: zod_1.z.string(),
    /** Present once it has been settled. */
    settlement: zod_1.z
        .object({
        refundedRwf: zod_1.z.number().int().nullable(),
        forfeitedRwf: zod_1.z.number().int().nullable(),
        reason: zod_1.z.string().nullable(),
        settledAt: zod_1.z.string(),
    })
        .nullable(),
});
exports.OperatorDepositList = zod_1.z.object({
    deposits: zod_1.z.array(exports.OperatorDeposit),
});
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
exports.ReturnDepositRequest = zod_1.z
    .object({
    refundedRwf: zod_1.z.number().int().nonnegative(),
    forfeitedRwf: zod_1.z.number().int().nonnegative(),
    reason: zod_1.z.string().trim().max(1000).optional(),
})
    .refine((v) => v.forfeitedRwf === 0 || Boolean(v.reason), {
    message: "Say why part of the deposit is being kept.",
    path: ["reason"],
});
// ===========================================================================
// Amenities
// ===========================================================================
exports.OperatorAmenity = zod_1.z.object({
    code: zod_1.z.string(),
    category: zod_1.z.string().nullable(),
    label: zod_1.z.string(),
    /** Whether this property offers it. */
    offered: zod_1.z.boolean(),
});
exports.OperatorAmenityList = zod_1.z.object({
    amenities: zod_1.z.array(exports.OperatorAmenity),
});
/** Add an amenity to a property. Removal is a DELETE on the same code. */
exports.AddAmenityRequest = zod_1.z.object({
    propertyId: primitives_1.Uuid,
    amenityCode: zod_1.z.string().trim().min(1),
});
/**
 * Which property a read or a removal is about.
 *
 * Separate from the workspace: a workspace can hold several properties, and
 * "all the amenities in this workspace" is not a question anyone asks.
 */
exports.PropertyScopedQuery = zod_1.z.object({ propertyId: primitives_1.Uuid });
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
exports.DepartmentCategory = zod_1.z.enum([
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
/** `operated` departments earn; `undistributed` ones cost. */
exports.DepartmentType = zod_1.z.enum(["operated", "undistributed"]);
exports.DepartmentStatus = zod_1.z.enum(["active", "archived"]);
/**
 * A department as the operator sees it.
 *
 * `isRevenueCenter` is the one field a charge screen must read: a charge naming
 * a cost centre is refused with 422 (AC-1), so the picker has to be able to
 * grey the wrong ones out rather than let the desk find out on submit.
 */
exports.OperatorDepartment = zod_1.z.object({
    id: primitives_1.Uuid,
    propertyId: primitives_1.Uuid.nullable(),
    name: zod_1.z.string(),
    departmentType: exports.DepartmentType,
    departmentCategory: exports.DepartmentCategory,
    isRevenueCenter: zod_1.z.boolean(),
    guestRequestable: zod_1.z.boolean(),
    sortOrder: zod_1.z.number().int(),
    status: exports.DepartmentStatus,
    /**
     * The department's contact card: who heads it, their number, and the
     * department's own line. Text rather than a roster row, because a head of
     * department often has no account on the day a property is set up.
     */
    headName: zod_1.z.string().nullable(),
    headPhone: zod_1.z.string().nullable(),
    phone: zod_1.z.string().nullable(),
});
/** The contact card fields, shared by create and update. `null` clears one. */
const departmentContactFields = {
    headName: zod_1.z.string().trim().max(120, "That name is too long.").nullable().optional(),
    headPhone: primitives_1.ContactPhone.nullable().optional(),
    phone: primitives_1.ContactPhone.nullable().optional(),
};
exports.OperatorDepartmentList = zod_1.z.object({
    departments: zod_1.z.array(exports.OperatorDepartment),
});
/**
 * Add a department to a property.
 *
 * `isRevenueCenter` is not asked for: it follows from the type, because a cost
 * centre that takes revenue is a contradiction the database also refuses.
 */
exports.CreateDepartmentRequest = zod_1.z.object({
    propertyId: primitives_1.Uuid,
    name: zod_1.z.string().trim().min(1).max(120),
    departmentType: exports.DepartmentType,
    departmentCategory: exports.DepartmentCategory,
    guestRequestable: zod_1.z.boolean().optional(),
    sortOrder: zod_1.z.number().int().min(0).max(9999).optional(),
    ...departmentContactFields,
});
/**
 * Rename, reorder, or retire a department.
 *
 * The CATEGORY cannot be changed. It decides which revenue account the charges
 * post to, and moving it would silently re-attribute every shilling already
 * booked against the department.
 */
exports.UpdateDepartmentRequest = zod_1.z
    .object({
    name: zod_1.z.string().trim().min(1).max(120).optional(),
    guestRequestable: zod_1.z.boolean().optional(),
    sortOrder: zod_1.z.number().int().min(0).max(9999).optional(),
    status: exports.DepartmentStatus.optional(),
    ...departmentContactFields,
})
    .refine((v) => Object.keys(v).length > 0, {
    message: "Say what to change.",
});
// ---------------------------------------------------------------------------
// The folio
// ---------------------------------------------------------------------------
exports.FolioType = zod_1.z.enum(["guest", "master", "group", "house"]);
/**
 * `open -> settled -> closed`, and `settled -> disputed -> settled`.
 * `settled` means the balance reached zero; `closed` means no further charge
 * may post. Voiding a charge on a settled folio moves it back to `open`.
 */
exports.FolioStatus = zod_1.z.enum(["open", "settled", "closed", "disputed"]);
/**
 * The ten typed lines a bill is made of.
 *
 * Signed: charges positive, payments and discounts negative. One sign rule,
 * fixed here, inherited by the ledger entry each line writes.
 */
exports.ChargeType = zod_1.z.enum([
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
exports.TaxCode = zod_1.z.enum(["TAX_A", "TAX_B", "TAX_C", "TAX_D"]);
/** How the money arrived. It picks which cash account the payment posts to. */
exports.PaymentMethod = zod_1.z.enum(["mobile_money", "card", "cash"]);
/** A bill as it appears in the Bills list. */
exports.OperatorFolio = zod_1.z.object({
    id: primitives_1.Uuid,
    folioNumber: zod_1.z.string(),
    folioType: exports.FolioType,
    status: exports.FolioStatus,
    guestStayId: primitives_1.Uuid.nullable(),
    bookingId: primitives_1.Uuid.nullable(),
    guestName: zod_1.z.string().nullable(),
    roomLabel: zod_1.z.string().nullable(),
    balanceRwf: zod_1.z.number().int(),
    /**
     * Which bill of the stay this is (ADR-050 D-c). A charge arriving after a
     * bill was signed opens the next sequence, so a stay can hold several.
     */
    folioSequence: zod_1.z.number().int().positive(),
    /** When the bill was signed. A locked bill takes no new line. */
    lockedAt: zod_1.z.string().nullable(),
    openedAt: zod_1.z.string(),
    closedAt: zod_1.z.string().nullable(),
});
exports.OperatorFolioList = zod_1.z.object({ folios: zod_1.z.array(exports.OperatorFolio) });
/**
 * One line on a bill. Never edited and never deleted.
 *
 * `voidedByChargeId` is how a screen greys out a reversed line without the row
 * carrying a mutable flag: the reversal names its target, so the relationship
 * is a fact about two rows rather than a field somebody could flip.
 */
exports.OperatorFolioCharge = zod_1.z.object({
    id: primitives_1.Uuid,
    chargeType: exports.ChargeType,
    description: zod_1.z.string().nullable(),
    departmentId: primitives_1.Uuid.nullable(),
    departmentName: zod_1.z.string().nullable(),
    quantity: zod_1.z.number().int(),
    unitPriceRwf: zod_1.z.number().int().nullable(),
    /** Signed, and tax exclusive. Tax is its own line. */
    amountRwf: zod_1.z.number().int(),
    taxCode: exports.TaxCode.nullable(),
    taxRate: zod_1.z.number().nullable(),
    taxAmountRwf: zod_1.z.number().int().nullable(),
    /** `manual`, `night_audit`, `service_order`, `external_pos`, or `void`. */
    sourceRefType: zod_1.z.string().nullable(),
    sourceRefId: primitives_1.Uuid.nullable(),
    /** Set when another line reverses this one. */
    voidedByChargeId: primitives_1.Uuid.nullable(),
    postedByUserId: primitives_1.Uuid.nullable(),
    businessDate: zod_1.z.string().nullable(),
    postedAt: zod_1.z.string(),
});
/** The bill, with its lines. */
exports.OperatorFolioDetail = exports.OperatorFolio.extend({
    charges: zod_1.z.array(exports.OperatorFolioCharge),
});
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
exports.PostChargeRequest = zod_1.z.object({
    chargeType: zod_1.z.enum([
        "room",
        "service_order",
        "pos",
        "service_charge",
        "adjustment",
        "discount",
        "deposit",
        "refund",
    ]),
    departmentId: primitives_1.Uuid.optional(),
    outletId: primitives_1.Uuid.optional(),
    description: zod_1.z.string().trim().min(1).max(500),
    quantity: zod_1.z.number().int().positive().max(9999).default(1),
    /** Signed. A discount or a refund is negative and the service checks it. */
    amountRwf: zod_1.z.number().int(),
    /** `TAX_B` (the standard 18%) when absent. */
    taxCode: exports.TaxCode.optional(),
});
/**
 * The bill a charge landed on (ADR-050 D-c).
 *
 * `openedFolioId` is set when the bill asked for had already been signed, so
 * the charge went to the stay's next bill instead; the rest of the answer is
 * THAT bill. Null for every ordinary charge.
 */
exports.PostChargeResult = exports.OperatorFolioDetail.extend({
    openedFolioId: primitives_1.Uuid.nullable(),
});
/**
 * Take a payment against a bill.
 *
 * Posts a negative `payment` line and one cash ledger entry. It never posts
 * revenue: the charge already did that at post time (D-f). Building it the
 * other way round would double count every shilling.
 */
exports.TakePaymentRequest = zod_1.z.object({
    amountRwf: zod_1.z.number().int().positive(),
    method: exports.PaymentMethod,
    reference: zod_1.z.string().trim().max(120).optional(),
});
/**
 * Void a posted charge.
 *
 * Posts a reversing line naming the original. The original row is never
 * touched, so a bill shows the mistake and the correction rather than hiding
 * both. Allowed once per charge, and a void can never itself be voided.
 */
exports.VoidChargeRequest = zod_1.z.object({
    reason: zod_1.z.string().trim().min(1, "Say why.").max(500),
});
/**
 * Close a bill, which signs its sale (ADR-050 D-a).
 *
 * Both fields are optional: most guests are not businesses. A guest who wants
 * the receipt made out to their company gives its TIN and name here, and §4 d
 * and e put them on the receipt.
 */
exports.CloseFolioRequest = zod_1.z.object({
    customerTin: registration_1.Tin.optional(),
    customerName: zod_1.z.string().trim().min(1).max(200).optional(),
});
/**
 * What closing a bill declared, and what it deliberately did not.
 *
 * `emissionId` is null only where nothing may be declared at all (the demo
 * environment). `status` is `failed` with a `reason` when the business has no
 * EBM connection: the close still succeeds, because a missing connection must
 * never strand a front desk (D-b). `excludedChargeIds` are lines another
 * taxpayer already declared, which this receipt must not cover again.
 */
exports.FolioDeclaration = zod_1.z.object({
    emissionId: primitives_1.Uuid.nullable(),
    status: zod_1.z.enum(["held", "failed", "emitted"]).nullable(),
    reason: zod_1.z.string().nullable(),
    excludedChargeIds: zod_1.z.array(primitives_1.Uuid),
});
exports.CloseFolioResult = exports.OperatorFolioDetail.extend({
    lockedAt: zod_1.z.string().nullable(),
    declaration: exports.FolioDeclaration,
});
// ---------------------------------------------------------------------------
// Departmental revenue
// ---------------------------------------------------------------------------
/** `YYYY-MM`. */
const IsoMonth = zod_1.z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "A month is YYYY-MM.");
/**
 * Which month of revenue to roll up. The property's current month when absent.
 *
 * `workspaceId` is optional for the same reason it is on every ops read: the
 * guard takes it from the `x-workspace-id` header first.
 */
exports.OperatorRevenueQuery = zod_1.z.object({
    workspaceId: primitives_1.Uuid.optional(),
    month: IsoMonth.optional(),
});
/** One revenue centre's takings for the month. */
exports.OperatorRevenueDepartment = zod_1.z.object({
    departmentId: primitives_1.Uuid,
    name: zod_1.z.string(),
    departmentCategory: exports.DepartmentCategory,
    status: exports.DepartmentStatus,
    /** Tax exclusive, net of voids. Can be zero; never absent. */
    revenueRwf: zod_1.z.number().int(),
});
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
exports.OperatorRevenue = zod_1.z.object({
    month: IsoMonth,
    /** `YYYY-MM-DD`, inclusive. */
    from: zod_1.z.string(),
    /** `YYYY-MM-DD`, exclusive. */
    to: zod_1.z.string(),
    departments: zod_1.z.array(exports.OperatorRevenueDepartment),
    totalRwf: zod_1.z.number().int(),
});
// ---------------------------------------------------------------------------
// Room assignment
// ---------------------------------------------------------------------------
exports.RoomAssignmentStatus = zod_1.z.enum(["assigned", "released"]);
/**
 * A room held for a booking over a date range.
 *
 * `from` and `to` are a half open range: the guest holds the room from `from`
 * up to but not including `to`, so a departure on the morning of the 5th does
 * not collide with an arrival that afternoon.
 */
exports.OperatorRoomAssignment = zod_1.z.object({
    id: primitives_1.Uuid,
    bookingId: primitives_1.Uuid,
    roomId: primitives_1.Uuid,
    roomLabel: zod_1.z.string().nullable(),
    from: zod_1.z.string(),
    to: zod_1.z.string(),
    status: exports.RoomAssignmentStatus,
    assignedByUserId: primitives_1.Uuid.nullable(),
    releasedAt: zod_1.z.string().nullable(),
});
exports.OperatorRoomAssignmentList = zod_1.z.object({
    assignments: zod_1.z.array(exports.OperatorRoomAssignment),
});
/**
 * Give a booking a physical room.
 *
 * The dates default to the booking's own check in and check out. An explicit
 * range is for a SPLIT STAY: a guest in 101 for two nights and 205 for the
 * third is two assignments against one booking, which is the requirement a
 * nullable column on `bookings` could not have met.
 */
exports.AssignRoomRequest = zod_1.z.object({
    roomId: primitives_1.Uuid,
    /** `YYYY-MM-DD`. Defaults to the booking's check in. */
    from: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    /** `YYYY-MM-DD`, exclusive. Defaults to the booking's check out. */
    to: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
/**
 * Every room held across the property over a window of dates.
 *
 * The room grid's read. Holds were only readable one booking at a time, so a
 * tape chart would have cost one request per reservation on screen. Only live
 * holds come back: a released one is history, and drawing it would put a
 * guest in a room they were moved out of.
 */
exports.RoomAssignmentWindowQuery = zod_1.z
    .object({
    workspaceId: primitives_1.Uuid.optional(),
    /** `YYYY-MM-DD`, inclusive. */
    from: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    /** `YYYY-MM-DD`, exclusive. */
    to: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})
    .refine((q) => q.from < q.to, {
    message: "The window has to end after it starts.",
});
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
exports.OperatorTeamMember = zod_1.z.object({
    userId: primitives_1.Uuid,
    name: zod_1.z.string().nullable(),
    email: zod_1.z.string().nullable(),
    orgRole: primitives_1.OrgRole,
    /** `active` or `removed`. A removed member keeps their history. */
    status: zod_1.z.string(),
    joinedAt: zod_1.z.string(),
    /**
     * The branches this member is limited to (ADR-054 AC-T1). `null` means
     * every branch, which an owner always is. Archived branches a member was
     * limited to stay listed, so the screen can say why one reads as retired.
     */
    branchIds: zod_1.z.array(primitives_1.Uuid).nullable(),
});
/**
 * Which branches a member covers, as a request carries it (ADR-054 AC-T1).
 *
 * `null` means every branch; a list means only those. An empty list is not
 * refused here but by the service, with the other AC-T1 refusals, because
 * "no branch at all" is a rule about the business, not the shape: it answers
 * 422 beside "that branch is archived" rather than 400 beside a malformed id.
 */
exports.MemberBranchIds = zod_1.z.array(primitives_1.Uuid).nullable();
/** `PUT /api/v1/ops/team/:userId/branches`. */
exports.SetMemberBranchesRequest = zod_1.z.object({
    branchIds: exports.MemberBranchIds,
});
/** The words a member's branch refusal carries (ADR-054 AC-T1), one per rule. */
exports.MEMBER_BRANCHES_REFUSAL = {
    owner: "An owner always covers every branch.",
    empty: "Choose at least one branch, or every branch.",
    foreign: "That branch does not belong to this business.",
    archived: "That branch is archived. Restore it first, or choose another.",
    residence: "A residence business has no branches to limit.",
};
exports.OperatorTeamList = zod_1.z.object({
    members: zod_1.z.array(exports.OperatorTeamMember),
});
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
exports.InvitableOrgRole = primitives_1.OrgRole.exclude(["owner"]);
/** What a role is called on screens and in the invitation mail. */
exports.ORG_ROLE_LABEL = {
    owner: "Owner",
    manager: "Manager",
    receptionist: "Front office / Receptionist",
    housekeeper: "Housekeeper",
};
exports.InviteStaffRequest = zod_1.z.object({
    email: zod_1.z
        .string()
        .trim()
        .toLowerCase()
        .email("Use an email address like name@example.com.")
        .max(200),
    orgRole: exports.InvitableOrgRole,
    /** The branches the invitee will cover; absent or null is every branch (ADR-054). */
    branchIds: exports.MemberBranchIds.default(null),
});
exports.StaffInvitationStatus = zod_1.z.enum(["sent", "accepted", "revoked", "expired"]);
/**
 * One invitation, as the business that sent it sees it.
 *
 * The TOKEN is never on this shape. It travels once, in the mail, and a list
 * that carried it would turn anybody who can read the People screen into
 * somebody who can accept every pending invitation themselves.
 */
exports.OperatorStaffInvitation = zod_1.z.object({
    id: primitives_1.Uuid,
    email: zod_1.z.string(),
    orgRole: primitives_1.OrgRole,
    /** `expired` is derived at read time from `expiresAt`, not stored. */
    status: exports.StaffInvitationStatus,
    expiresAt: zod_1.z.string(),
    createdAt: zod_1.z.string(),
    /** The branches the invitee will cover; null is every branch (ADR-054). */
    branchIds: zod_1.z.array(primitives_1.Uuid).nullable(),
});
exports.OperatorStaffInvitationList = zod_1.z.object({
    invitations: zod_1.z.array(exports.OperatorStaffInvitation),
});
/** The token from the mail. POSTed in a body, never put in a query string. */
exports.StaffInvitationTokenRequest = zod_1.z.object({
    token: zod_1.z.string().min(16).max(200),
});
/** What the join page shows before somebody accepts. */
exports.StaffInvitationPreview = zod_1.z.object({
    legalName: zod_1.z.string(),
    orgRole: primitives_1.OrgRole,
    /** The address it was sent to, so a person signed in as someone else sees why it refuses. */
    email: zod_1.z.string(),
});
exports.AcceptedStaffInvitation = zod_1.z.object({
    orgId: primitives_1.Uuid,
    workspaceId: primitives_1.Uuid,
    orgRole: primitives_1.OrgRole,
});
// ---------------------------------------------------------------------------
// Housekeeping tasks
// ---------------------------------------------------------------------------
exports.HousekeepingTaskType = zod_1.z.enum([
    "checkout_clean",
    "stayover_clean",
    "inspection",
    "deep_clean",
    "turndown",
]);
/**
 * `pending -> in_progress -> done -> inspected`, and any state to `blocked`
 * (it needs maintenance first) and back to `pending`.
 */
exports.HousekeepingTaskStatus = zod_1.z.enum([
    "pending",
    "in_progress",
    "done",
    "inspected",
    "blocked",
]);
exports.OperatorHousekeepingTask = zod_1.z.object({
    id: primitives_1.Uuid,
    roomId: primitives_1.Uuid,
    roomLabel: zod_1.z.string().nullable(),
    taskType: exports.HousekeepingTaskType,
    status: exports.HousekeepingTaskStatus,
    assignedToUserId: primitives_1.Uuid.nullable(),
    assignedToName: zod_1.z.string().nullable(),
    priority: zod_1.z.number().int(),
    note: zod_1.z.string().nullable(),
    startedAt: zod_1.z.string().nullable(),
    completedAt: zod_1.z.string().nullable(),
    createdAt: zod_1.z.string(),
});
exports.OperatorHousekeepingTaskList = zod_1.z.object({
    tasks: zod_1.z.array(exports.OperatorHousekeepingTask),
});
/** Put a room on the cleaning board, optionally against a named housekeeper. */
exports.CreateHousekeepingTaskRequest = zod_1.z.object({
    roomId: primitives_1.Uuid,
    taskType: exports.HousekeepingTaskType,
    assignedToUserId: primitives_1.Uuid.optional(),
    priority: zod_1.z.number().int().min(0).max(100).optional(),
    note: zod_1.z.string().trim().max(500).optional(),
});
/**
 * Move a task along.
 *
 * The person doing the cleaning sends this, so it is gated on
 * `housekeeping.set` rather than on `task.assign`: a housekeeper holds the
 * first and not the second.
 */
exports.AdvanceHousekeepingTaskRequest = zod_1.z.object({
    to: exports.HousekeepingTaskStatus,
    note: zod_1.z.string().trim().max(500).optional(),
});
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
exports.RaiseTicketRequest = zod_1.z
    .object({
    roomId: primitives_1.Uuid.optional(),
    leaseId: primitives_1.Uuid.optional(),
    title: zod_1.z.string().trim().min(1).max(200),
    description: zod_1.z.string().trim().max(2000).optional(),
    category: exports.MaintenanceCategory.optional(),
    priority: exports.MaintenancePriority.optional(),
})
    .refine((v) => Boolean(v.roomId ?? v.leaseId), {
    message: "Name the room or the lease this is about.",
});
// ---------------------------------------------------------------------------
// The service catalog and its orders
// ---------------------------------------------------------------------------
exports.ServiceCatalogStatus = zod_1.z.enum([
    "active",
    "out_of_stock",
    "archived",
]);
exports.FulfillmentType = zod_1.z.enum([
    "in_room_delivery",
    "pickup",
    "appointment",
    "onsite",
    "instant",
]);
exports.ServiceOrderChannel = zod_1.z.enum([
    "guest_app",
    "in_room_device",
    "front_desk",
    "staff",
    "api",
]);
/**
 * `submitted -> acknowledged -> in_progress -> ready -> delivered ->
 * completed`, plus `submitted -> rejected`, and anything before `delivered` to
 * `cancelled`.
 *
 * A pay now order starts before the board sees it (ADR-050 D-n):
 * `pending_payment -> submitted` when its money settles, or
 * `pending_payment -> payment_failed` when it is refused or expires.
 */
exports.ServiceOrderStatus = zod_1.z.enum([
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
/**
 * When an order's money moves (ADR-050 D-n). `in_house_folio` posts to the
 * guest's bill on `delivered`; `pay_now` settles first and never touches a bill.
 */
exports.OrderContext = zod_1.z.enum(["in_house_folio", "pay_now"]);
// --- RRA item codes (ADR-050 D-m) ------------------------------------------
/** `itemTyCd`, VSDC v1.0.5 §4.3: `1` raw material, `2` finished product, `3` service. */
exports.RraItemTypeCode = zod_1.z.enum(["1", "2", "3"]);
/** `itemClsCd`, a code from RRA's classification list (§3.3.2.2). Digits, CHAR 10 on an item. */
exports.RraClassificationCode = zod_1.z
    .string()
    .trim()
    .regex(/^\d{1,10}$/, "A classification code is up to ten digits from RRA's list.");
/** `pkgUnitCd` (§4.5) or `qtyUnitCd` (§4.6): the Authority's own unit code, CHAR 5. */
exports.RraUnitCode = zod_1.z
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
exports.ServiceItemOption = zod_1.z.object({
    name: zod_1.z.string().trim().min(1).max(80),
    required: zod_1.z.boolean().default(false),
    maxChoices: zod_1.z.number().int().min(1).max(20).default(1),
    choices: zod_1.z
        .array(zod_1.z.object({
        label: zod_1.z.string().trim().min(1).max(80),
        /** Tax exclusive, like the item's own price. May be zero or negative. */
        priceDeltaRwf: zod_1.z.number().int().min(-10000000).max(10000000).default(0),
    }))
        .min(1)
        .max(30),
});
exports.ServiceItemOptions = zod_1.z.array(exports.ServiceItemOption).max(20);
/** What a guest or a waiter picked for one option, by label. */
exports.SelectedOption = zod_1.z.object({
    name: zod_1.z.string().trim().min(1).max(80),
    choices: zod_1.z.array(zod_1.z.string().trim().min(1).max(80)).min(1).max(20),
});
/** A chosen option as the order line stores it: the labels AND the deltas, locked. */
exports.SelectedOptionSnapshot = zod_1.z.object({
    name: zod_1.z.string(),
    choices: zod_1.z.array(zod_1.z.object({ label: zod_1.z.string(), priceDeltaRwf: zod_1.z.number().int() })),
});
/**
 * The RRA values an item still lacks before it may be sold, by name. Empty
 * means it may be sold. The server computes it; a screen only shows it.
 */
exports.RraItemField = zod_1.z.enum([
    "classification",
    "productType",
    "itemCode",
    "packagingUnit",
    "quantityUnit",
]);
exports.OperatorServiceItem = zod_1.z.object({
    id: primitives_1.Uuid,
    serviceCategoryId: primitives_1.Uuid,
    departmentId: primitives_1.Uuid,
    name: zod_1.z.string(),
    description: zod_1.z.string().nullable(),
    priceRwf: zod_1.z.number().int(),
    taxCode: exports.TaxCode,
    fulfillmentType: exports.FulfillmentType,
    prepTimeMinutes: zod_1.z.number().int().nullable(),
    guestOrderable: zod_1.z.boolean(),
    stockQty: zod_1.z.number().int().nullable(),
    status: exports.ServiceCatalogStatus,
    options: exports.ServiceItemOptions,
    rraItemClsCd: zod_1.z.string().nullable(),
    /** The classification's name, for a screen to show beside the code. */
    rraItemClsName: zod_1.z.string().nullable(),
    rraItemTyCd: exports.RraItemTypeCode.nullable(),
    /** Minted by the server once, and never changed. */
    rraItemCd: zod_1.z.string().nullable(),
    rraPkgUnitCd: zod_1.z.string().nullable(),
    rraQtyUnitCd: zod_1.z.string().nullable(),
    /**
     * What still stops this item selling (ADR-050 D-m). An item flagged
     * `guestOrderable` with anything listed here is refused on every channel.
     */
    missingRra: zod_1.z.array(exports.RraItemField),
});
exports.OperatorServiceCategory = zod_1.z.object({
    id: primitives_1.Uuid,
    departmentId: primitives_1.Uuid,
    departmentName: zod_1.z.string().nullable(),
    outletId: primitives_1.Uuid.nullable(),
    name: zod_1.z.string(),
    sortOrder: zod_1.z.number().int(),
    guestVisible: zod_1.z.boolean(),
    status: exports.DepartmentStatus,
    /** Prefills for a new item on this menu. Never a rule. */
    defaultRraItemClsCd: zod_1.z.string().nullable(),
    defaultRraItemTyCd: exports.RraItemTypeCode.nullable(),
    defaultRraPkgUnitCd: zod_1.z.string().nullable(),
    defaultRraQtyUnitCd: zod_1.z.string().nullable(),
    defaultTaxCode: exports.TaxCode.nullable(),
    items: zod_1.z.array(exports.OperatorServiceItem),
});
/** The whole menu, grouped, which is the only way anyone reads it. */
exports.OperatorServiceCatalog = zod_1.z.object({
    categories: zod_1.z.array(exports.OperatorServiceCategory),
});
exports.CreateServiceCategoryRequest = zod_1.z.object({
    propertyId: primitives_1.Uuid,
    departmentId: primitives_1.Uuid,
    /** The outlet this menu sells from. Its items are listed to guests under it. */
    outletId: primitives_1.Uuid.optional(),
    name: zod_1.z.string().trim().min(1).max(120),
    guestVisible: zod_1.z.boolean().optional(),
    sortOrder: zod_1.z.number().int().min(0).max(9999).optional(),
    defaultRraItemClsCd: exports.RraClassificationCode.optional(),
    defaultRraItemTyCd: exports.RraItemTypeCode.optional(),
    defaultRraPkgUnitCd: exports.RraUnitCode.optional(),
    defaultRraQtyUnitCd: exports.RraUnitCode.optional(),
    defaultTaxCode: exports.TaxCode.optional(),
});
/**
 * Change a menu's name, visibility, order or prefills. The department and the
 * property are absent on purpose, for the reason an item cannot change menus.
 */
exports.UpdateServiceCategoryRequest = exports.CreateServiceCategoryRequest.omit({
    propertyId: true,
    departmentId: true,
})
    .partial()
    .refine((v) => Object.keys(v).length > 0, { message: "Say what to change." });
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
exports.UpsertServiceItemRequest = zod_1.z.object({
    serviceCategoryId: primitives_1.Uuid,
    name: zod_1.z.string().trim().min(1).max(160),
    description: zod_1.z.string().trim().max(1000).optional(),
    priceRwf: zod_1.z.number().int().nonnegative(),
    taxCode: exports.TaxCode.optional(),
    fulfillmentType: exports.FulfillmentType.optional(),
    prepTimeMinutes: zod_1.z.number().int().min(0).max(1440).optional(),
    guestOrderable: zod_1.z.boolean().optional(),
    stockQty: zod_1.z.number().int().min(0).nullable().optional(),
    status: exports.ServiceCatalogStatus.optional(),
    options: exports.ServiceItemOptions.optional(),
    rraItemClsCd: exports.RraClassificationCode.optional(),
    rraItemTyCd: exports.RraItemTypeCode.optional(),
    rraPkgUnitCd: exports.RraUnitCode.optional(),
    rraQtyUnitCd: exports.RraUnitCode.optional(),
});
/** One row of RRA's classification list, for the menu's picker. */
exports.RraClassification = zod_1.z.object({
    code: zod_1.z.string(),
    name: zod_1.z.string(),
    level: zod_1.z.number().int(),
});
exports.RraClassificationSearch = zod_1.z.object({
    q: zod_1.z.string().trim().max(80).default(""),
});
exports.RraClassificationList = zod_1.z.object({
    classifications: zod_1.z.array(exports.RraClassification),
});
exports.OperatorServiceOrderItem = zod_1.z.object({
    id: primitives_1.Uuid,
    serviceItemId: primitives_1.Uuid.nullable(),
    nameSnapshot: zod_1.z.string(),
    quantity: zod_1.z.number().int(),
    unitPriceRwf: zod_1.z.number().int(),
    lineTotalRwf: zod_1.z.number().int(),
    taxCode: exports.TaxCode.nullable(),
    note: zod_1.z.string().nullable(),
    /** The modifiers chosen, with the deltas locked when the order was placed. */
    selectedOptions: zod_1.z.array(exports.SelectedOptionSnapshot),
});
exports.OperatorServiceOrder = zod_1.z.object({
    id: primitives_1.Uuid,
    orderNumber: zod_1.z.string(),
    departmentId: primitives_1.Uuid,
    departmentName: zod_1.z.string().nullable(),
    outletId: primitives_1.Uuid.nullable(),
    folioId: primitives_1.Uuid.nullable(),
    roomId: primitives_1.Uuid.nullable(),
    roomLabel: zod_1.z.string().nullable(),
    channel: exports.ServiceOrderChannel,
    status: exports.ServiceOrderStatus,
    orderContext: exports.OrderContext,
    fulfillmentType: exports.FulfillmentType,
    subtotalRwf: zod_1.z.number().int(),
    taxRwf: zod_1.z.number().int(),
    totalRwf: zod_1.z.number().int(),
    /** Pay now only: when its money settled, and the RRA means of payment (`01` cash, `06` mobile money). */
    paidAt: zod_1.z.string().nullable(),
    paymentMethod: zod_1.z.string().nullable(),
    guestNote: zod_1.z.string().nullable(),
    createdAt: zod_1.z.string(),
    items: zod_1.z.array(exports.OperatorServiceOrderItem),
});
exports.OperatorServiceOrderList = zod_1.z.object({
    orders: zod_1.z.array(exports.OperatorServiceOrder),
});
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
exports.CreateServiceOrderRequest = zod_1.z
    .object({
    context: exports.OrderContext.default("in_house_folio"),
    guestStayId: primitives_1.Uuid.optional(),
    channel: exports.ServiceOrderChannel.optional(),
    guestNote: zod_1.z.string().trim().max(1000).optional(),
    items: zod_1.z
        .array(zod_1.z.object({
        serviceItemId: primitives_1.Uuid,
        quantity: zod_1.z.number().int().positive().max(99),
        note: zod_1.z.string().trim().max(300).optional(),
        selectedOptions: zod_1.z.array(exports.SelectedOption).max(20).optional(),
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
/**
 * Mark a pay now order paid in cash (ADR-050 D-p, AC-24).
 *
 * `amountRwf` must be exactly the order's total. It is asked for rather than
 * read, so the person holding the cash confirms the number they took, and a
 * mismatch is refused instead of recorded.
 */
exports.MarkOrderPaidCashRequest = zod_1.z.object({
    amountRwf: zod_1.z.number().int().positive(),
});
/** What marking cash raised: the order, now `submitted`, and its `NS` emission. */
exports.MarkOrderPaidCashResult = exports.OperatorServiceOrder.extend({
    /** Null in the demo environment, where nothing is declared. */
    emissionId: primitives_1.Uuid.nullable(),
});
/**
 * Move an order along its board.
 *
 * Reaching `delivered` or `completed` posts the folio charge, in the same
 * transaction, so the bill can never disagree with the board.
 */
exports.AdvanceServiceOrderRequest = zod_1.z.object({
    to: exports.ServiceOrderStatus,
    note: zod_1.z.string().trim().max(500).optional(),
});
/**
 * Change a menu item that already exists.
 *
 * Partial, and the CATEGORY is absent on purpose: moving an item to another
 * menu would move its department too, and a bill already run against the old
 * one would then disagree with the new one. Archive it and add a new one.
 */
exports.UpdateServiceItemRequest = exports.UpsertServiceItemRequest.omit({
    serviceCategoryId: true,
})
    .partial()
    .refine((v) => Object.keys(v).length > 0, {
    message: "Say what to change.",
});
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
exports.DepartmentPosition = zod_1.z.enum([
    "department_head",
    "supervisor",
    "staff",
]);
exports.OperatorDepartmentMember = zod_1.z.object({
    id: primitives_1.Uuid,
    departmentId: primitives_1.Uuid,
    userId: primitives_1.Uuid,
    name: zod_1.z.string().nullable(),
    email: zod_1.z.string().nullable(),
    departmentPosition: exports.DepartmentPosition,
    /** The staffer's home department, the one their shift board defaults to. */
    isPrimary: zod_1.z.boolean(),
    status: zod_1.z.enum(["active", "removed"]),
});
exports.OperatorDepartmentMemberList = zod_1.z.object({
    members: zod_1.z.array(exports.OperatorDepartmentMember),
});
/**
 * Put somebody on a department's roster.
 *
 * Names the USER rather than the membership: the caller knows who they mean,
 * and the server resolves that person's membership of this org. A caller who
 * had to supply a membership id could supply somebody else's.
 */
exports.AssignDepartmentMemberRequest = zod_1.z.object({
    userId: primitives_1.Uuid,
    departmentPosition: exports.DepartmentPosition.optional(),
    isPrimary: zod_1.z.boolean().optional(),
});
//# sourceMappingURL=ops.js.map