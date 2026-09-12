import { z } from "zod";
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
export declare const OperatorReservationState: z.ZodEnum<["pending", "confirmed", "inhouse", "checked_out", "declined", "cancelled", "no_show"]>;
export type OperatorReservationState = z.infer<typeof OperatorReservationState>;
/**
 * One row of the Reservations list.
 *
 * Every field is read from a column or derived from two of them; nothing is
 * computed in the browser (ADR-012, Value sourcing). `room` in particular comes
 * from `guest_stays.room_id` and is never guessed from the room type.
 */
export declare const OperatorReservation: z.ZodObject<{
    id: z.ZodString;
    /** The human handle a guest quotes on the phone. */
    reference: z.ZodString;
    /** `users.name`, which is nullable: an account may exist before a name does. */
    guestName: z.ZodNullable<z.ZodString>;
    /** `YYYY-MM-DD`. A bare date column, so no timezone rides along. */
    checkIn: z.ZodString;
    checkOut: z.ZodString;
    /** Derived from the two dates above, server side, so one definition of it. */
    nights: z.ZodNumber;
    guestCount: z.ZodNumber;
    state: z.ZodEnum<["pending", "confirmed", "inhouse", "checked_out", "declined", "cancelled", "no_show"]>;
    /** The raw `bookings.status`, so the derivation above hides nothing. */
    bookingStatus: z.ZodEnum<["pending_approval", "confirmed", "declined", "cancelled", "no_show"]>;
    /** `rooms.label` for the stay's room. Null until someone checks them in. */
    room: z.ZodNullable<z.ZodString>;
    /**
     * The room TYPE the guest bought. A booking never names a room; this is
     * what a room held for it must match, and the room grid greys out every
     * row of another type before the desk drops a bar there and is refused.
     */
    roomTypeId: z.ZodString;
    /**
     * `bookings.gross_rwf`: what this reservation is worth.
     *
     * NOT a folio balance. A folio sums `ledger_entries` and moves every time
     * someone posts a charge; this is the agreed price of the stay and does not.
     * The Bill screen owns the other number.
     */
    totalRwf: z.ZodNullable<z.ZodNumber>;
    /** When an unanswered request auto declines. Null once it is resolved. */
    approvalExpiresAt: z.ZodNullable<z.ZodString>;
    confirmedAt: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    reference: string;
    guestName: string | null;
    state: "pending" | "confirmed" | "declined" | "cancelled" | "no_show" | "inhouse" | "checked_out";
    roomTypeId: string;
    nights: number;
    checkIn: string;
    checkOut: string;
    approvalExpiresAt: string | null;
    confirmedAt: string | null;
    guestCount: number;
    bookingStatus: "pending_approval" | "confirmed" | "declined" | "cancelled" | "no_show";
    room: string | null;
    totalRwf: number | null;
}, {
    id: string;
    reference: string;
    guestName: string | null;
    state: "pending" | "confirmed" | "declined" | "cancelled" | "no_show" | "inhouse" | "checked_out";
    roomTypeId: string;
    nights: number;
    checkIn: string;
    checkOut: string;
    approvalExpiresAt: string | null;
    confirmedAt: string | null;
    guestCount: number;
    bookingStatus: "pending_approval" | "confirmed" | "declined" | "cancelled" | "no_show";
    room: string | null;
    totalRwf: number | null;
}>;
export type OperatorReservation = z.infer<typeof OperatorReservation>;
export declare const OperatorReservationList: z.ZodObject<{
    reservations: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        /** The human handle a guest quotes on the phone. */
        reference: z.ZodString;
        /** `users.name`, which is nullable: an account may exist before a name does. */
        guestName: z.ZodNullable<z.ZodString>;
        /** `YYYY-MM-DD`. A bare date column, so no timezone rides along. */
        checkIn: z.ZodString;
        checkOut: z.ZodString;
        /** Derived from the two dates above, server side, so one definition of it. */
        nights: z.ZodNumber;
        guestCount: z.ZodNumber;
        state: z.ZodEnum<["pending", "confirmed", "inhouse", "checked_out", "declined", "cancelled", "no_show"]>;
        /** The raw `bookings.status`, so the derivation above hides nothing. */
        bookingStatus: z.ZodEnum<["pending_approval", "confirmed", "declined", "cancelled", "no_show"]>;
        /** `rooms.label` for the stay's room. Null until someone checks them in. */
        room: z.ZodNullable<z.ZodString>;
        /**
         * The room TYPE the guest bought. A booking never names a room; this is
         * what a room held for it must match, and the room grid greys out every
         * row of another type before the desk drops a bar there and is refused.
         */
        roomTypeId: z.ZodString;
        /**
         * `bookings.gross_rwf`: what this reservation is worth.
         *
         * NOT a folio balance. A folio sums `ledger_entries` and moves every time
         * someone posts a charge; this is the agreed price of the stay and does not.
         * The Bill screen owns the other number.
         */
        totalRwf: z.ZodNullable<z.ZodNumber>;
        /** When an unanswered request auto declines. Null once it is resolved. */
        approvalExpiresAt: z.ZodNullable<z.ZodString>;
        confirmedAt: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        reference: string;
        guestName: string | null;
        state: "pending" | "confirmed" | "declined" | "cancelled" | "no_show" | "inhouse" | "checked_out";
        roomTypeId: string;
        nights: number;
        checkIn: string;
        checkOut: string;
        approvalExpiresAt: string | null;
        confirmedAt: string | null;
        guestCount: number;
        bookingStatus: "pending_approval" | "confirmed" | "declined" | "cancelled" | "no_show";
        room: string | null;
        totalRwf: number | null;
    }, {
        id: string;
        reference: string;
        guestName: string | null;
        state: "pending" | "confirmed" | "declined" | "cancelled" | "no_show" | "inhouse" | "checked_out";
        roomTypeId: string;
        nights: number;
        checkIn: string;
        checkOut: string;
        approvalExpiresAt: string | null;
        confirmedAt: string | null;
        guestCount: number;
        bookingStatus: "pending_approval" | "confirmed" | "declined" | "cancelled" | "no_show";
        room: string | null;
        totalRwf: number | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    reservations: {
        id: string;
        reference: string;
        guestName: string | null;
        state: "pending" | "confirmed" | "declined" | "cancelled" | "no_show" | "inhouse" | "checked_out";
        roomTypeId: string;
        nights: number;
        checkIn: string;
        checkOut: string;
        approvalExpiresAt: string | null;
        confirmedAt: string | null;
        guestCount: number;
        bookingStatus: "pending_approval" | "confirmed" | "declined" | "cancelled" | "no_show";
        room: string | null;
        totalRwf: number | null;
    }[];
}, {
    reservations: {
        id: string;
        reference: string;
        guestName: string | null;
        state: "pending" | "confirmed" | "declined" | "cancelled" | "no_show" | "inhouse" | "checked_out";
        roomTypeId: string;
        nights: number;
        checkIn: string;
        checkOut: string;
        approvalExpiresAt: string | null;
        confirmedAt: string | null;
        guestCount: number;
        bookingStatus: "pending_approval" | "confirmed" | "declined" | "cancelled" | "no_show";
        room: string | null;
        totalRwf: number | null;
    }[];
}>;
export type OperatorReservationList = z.infer<typeof OperatorReservationList>;
/**
 * The query on the reservations read.
 *
 * `WorkspaceGuard` reads the workspace from the `x-workspace-id` header first
 * and falls back to the query string, so this stays optional here rather than
 * being validated into a second source of truth. A read that names no workspace
 * is refused by the guard, not by this schema.
 */
export declare const OperatorReservationQuery: z.ZodObject<{
    workspaceId: z.ZodOptional<z.ZodString>;
    /** Narrow the list to one desk state. Absent means all of them. */
    state: z.ZodOptional<z.ZodEnum<["pending", "confirmed", "inhouse", "checked_out", "declined", "cancelled", "no_show"]>>;
}, "strip", z.ZodTypeAny, {
    workspaceId?: string | undefined;
    state?: "pending" | "confirmed" | "declined" | "cancelled" | "no_show" | "inhouse" | "checked_out" | undefined;
}, {
    workspaceId?: string | undefined;
    state?: "pending" | "confirmed" | "declined" | "cancelled" | "no_show" | "inhouse" | "checked_out" | undefined;
}>;
export type OperatorReservationQuery = z.infer<typeof OperatorReservationQuery>;
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
export declare const ReservationDecisionResult: z.ZodObject<{
    id: z.ZodString;
    /** The human handle a guest quotes on the phone. */
    reference: z.ZodString;
    /** `users.name`, which is nullable: an account may exist before a name does. */
    guestName: z.ZodNullable<z.ZodString>;
    /** `YYYY-MM-DD`. A bare date column, so no timezone rides along. */
    checkIn: z.ZodString;
    checkOut: z.ZodString;
    /** Derived from the two dates above, server side, so one definition of it. */
    nights: z.ZodNumber;
    guestCount: z.ZodNumber;
    state: z.ZodEnum<["pending", "confirmed", "inhouse", "checked_out", "declined", "cancelled", "no_show"]>;
    /** The raw `bookings.status`, so the derivation above hides nothing. */
    bookingStatus: z.ZodEnum<["pending_approval", "confirmed", "declined", "cancelled", "no_show"]>;
    /** `rooms.label` for the stay's room. Null until someone checks them in. */
    room: z.ZodNullable<z.ZodString>;
    /**
     * The room TYPE the guest bought. A booking never names a room; this is
     * what a room held for it must match, and the room grid greys out every
     * row of another type before the desk drops a bar there and is refused.
     */
    roomTypeId: z.ZodString;
    /**
     * `bookings.gross_rwf`: what this reservation is worth.
     *
     * NOT a folio balance. A folio sums `ledger_entries` and moves every time
     * someone posts a charge; this is the agreed price of the stay and does not.
     * The Bill screen owns the other number.
     */
    totalRwf: z.ZodNullable<z.ZodNumber>;
    /** When an unanswered request auto declines. Null once it is resolved. */
    approvalExpiresAt: z.ZodNullable<z.ZodString>;
    confirmedAt: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    reference: string;
    guestName: string | null;
    state: "pending" | "confirmed" | "declined" | "cancelled" | "no_show" | "inhouse" | "checked_out";
    roomTypeId: string;
    nights: number;
    checkIn: string;
    checkOut: string;
    approvalExpiresAt: string | null;
    confirmedAt: string | null;
    guestCount: number;
    bookingStatus: "pending_approval" | "confirmed" | "declined" | "cancelled" | "no_show";
    room: string | null;
    totalRwf: number | null;
}, {
    id: string;
    reference: string;
    guestName: string | null;
    state: "pending" | "confirmed" | "declined" | "cancelled" | "no_show" | "inhouse" | "checked_out";
    roomTypeId: string;
    nights: number;
    checkIn: string;
    checkOut: string;
    approvalExpiresAt: string | null;
    confirmedAt: string | null;
    guestCount: number;
    bookingStatus: "pending_approval" | "confirmed" | "declined" | "cancelled" | "no_show";
    room: string | null;
    totalRwf: number | null;
}>;
export type ReservationDecisionResult = z.infer<typeof ReservationDecisionResult>;
/** Is this room sellable? Owned by maintenance. */
export declare const RoomStatus: z.ZodEnum<["available", "maintenance", "out_of_service"]>;
export type RoomStatus = z.infer<typeof RoomStatus>;
/** Is this room ready? Owned by housekeeping. Orthogonal to `RoomStatus`. */
export declare const HousekeepingStatus: z.ZodEnum<["clean", "dirty", "inspected", "out_of_order"]>;
export type HousekeepingStatus = z.infer<typeof HousekeepingStatus>;
/** Two states only. The database enum has no middle, whatever a screen shows. */
/**
 * ADR-016 D16. Widened from `open | resolved`, which could not say that
 * somebody had picked a ticket up and had no way to record one raised in error.
 */
export declare const MaintenanceStatus: z.ZodEnum<["open", "assigned", "in_progress", "resolved", "closed", "cancelled"]>;
export type MaintenanceStatus = z.infer<typeof MaintenanceStatus>;
export declare const LeaseStatus: z.ZodEnum<["draft", "pending_signature", "active", "ending", "ended", "cancelled"]>;
export type LeaseStatus = z.infer<typeof LeaseStatus>;
export declare const RentStatus: z.ZodEnum<["paid", "due", "overdue"]>;
export type RentStatus = z.infer<typeof RentStatus>;
export declare const CautionStatus: z.ZodEnum<["held", "refunded", "forfeited"]>;
export type CautionStatus = z.infer<typeof CautionStatus>;
/**
 * A room as the desk sees it.
 *
 * Two statuses, never merged, because every real property management system
 * keeps them apart and merging them loses the case that matters: a clean room
 * that is out of service is not sellable, and a dirty room that is available
 * is. `status` is inventory (owned by maintenance), `housekeeping` is
 * readiness (owned by housekeeping).
 */
export declare const OperatorRoom: z.ZodObject<{
    id: z.ZodString;
    /** `rooms.label`, e.g. "101". Null on a row nobody has numbered yet. */
    label: z.ZodNullable<z.ZodString>;
    roomTypeId: z.ZodString;
    roomTypeName: z.ZodString;
    status: z.ZodEnum<["available", "maintenance", "out_of_service"]>;
    housekeeping: z.ZodEnum<["clean", "dirty", "inspected", "out_of_order"]>;
    /** The open stay in this room, if anyone is in it. */
    occupiedBy: z.ZodNullable<z.ZodObject<{
        stayId: z.ZodString;
        guestName: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        stayId: string;
        guestName: string | null;
    }, {
        stayId: string;
        guestName: string | null;
    }>>;
}, "strip", z.ZodTypeAny, {
    status: "available" | "maintenance" | "out_of_service";
    label: string | null;
    id: string;
    roomTypeId: string;
    roomTypeName: string;
    housekeeping: "dirty" | "clean" | "inspected" | "out_of_order";
    occupiedBy: {
        stayId: string;
        guestName: string | null;
    } | null;
}, {
    status: "available" | "maintenance" | "out_of_service";
    label: string | null;
    id: string;
    roomTypeId: string;
    roomTypeName: string;
    housekeeping: "dirty" | "clean" | "inspected" | "out_of_order";
    occupiedBy: {
        stayId: string;
        guestName: string | null;
    } | null;
}>;
export type OperatorRoom = z.infer<typeof OperatorRoom>;
export declare const OperatorRoomList: z.ZodObject<{
    rooms: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        /** `rooms.label`, e.g. "101". Null on a row nobody has numbered yet. */
        label: z.ZodNullable<z.ZodString>;
        roomTypeId: z.ZodString;
        roomTypeName: z.ZodString;
        status: z.ZodEnum<["available", "maintenance", "out_of_service"]>;
        housekeeping: z.ZodEnum<["clean", "dirty", "inspected", "out_of_order"]>;
        /** The open stay in this room, if anyone is in it. */
        occupiedBy: z.ZodNullable<z.ZodObject<{
            stayId: z.ZodString;
            guestName: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            stayId: string;
            guestName: string | null;
        }, {
            stayId: string;
            guestName: string | null;
        }>>;
    }, "strip", z.ZodTypeAny, {
        status: "available" | "maintenance" | "out_of_service";
        label: string | null;
        id: string;
        roomTypeId: string;
        roomTypeName: string;
        housekeeping: "dirty" | "clean" | "inspected" | "out_of_order";
        occupiedBy: {
            stayId: string;
            guestName: string | null;
        } | null;
    }, {
        status: "available" | "maintenance" | "out_of_service";
        label: string | null;
        id: string;
        roomTypeId: string;
        roomTypeName: string;
        housekeeping: "dirty" | "clean" | "inspected" | "out_of_order";
        occupiedBy: {
            stayId: string;
            guestName: string | null;
        } | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    rooms: {
        status: "available" | "maintenance" | "out_of_service";
        label: string | null;
        id: string;
        roomTypeId: string;
        roomTypeName: string;
        housekeeping: "dirty" | "clean" | "inspected" | "out_of_order";
        occupiedBy: {
            stayId: string;
            guestName: string | null;
        } | null;
    }[];
}, {
    rooms: {
        status: "available" | "maintenance" | "out_of_service";
        label: string | null;
        id: string;
        roomTypeId: string;
        roomTypeName: string;
        housekeeping: "dirty" | "clean" | "inspected" | "out_of_order";
        occupiedBy: {
            stayId: string;
            guestName: string | null;
        } | null;
    }[];
}>;
export type OperatorRoomList = z.infer<typeof OperatorRoomList>;
/** A guest in the building, or one who has left. */
export declare const OperatorStay: z.ZodObject<{
    id: z.ZodString;
    bookingId: z.ZodNullable<z.ZodString>;
    guestName: z.ZodNullable<z.ZodString>;
    roomId: z.ZodString;
    roomLabel: z.ZodNullable<z.ZodString>;
    lifecycle: z.ZodEnum<["open", "closed"]>;
    entryAt: z.ZodString;
    plannedExitAt: z.ZodNullable<z.ZodString>;
    actualExitAt: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    guestName: string | null;
    bookingId: string | null;
    roomId: string;
    roomLabel: string | null;
    lifecycle: "open" | "closed";
    entryAt: string;
    plannedExitAt: string | null;
    actualExitAt: string | null;
}, {
    id: string;
    guestName: string | null;
    bookingId: string | null;
    roomId: string;
    roomLabel: string | null;
    lifecycle: "open" | "closed";
    entryAt: string;
    plannedExitAt: string | null;
    actualExitAt: string | null;
}>;
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
export declare const OperatorStayList: z.ZodObject<{
    stays: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        bookingId: z.ZodNullable<z.ZodString>;
        guestName: z.ZodNullable<z.ZodString>;
        roomId: z.ZodString;
        roomLabel: z.ZodNullable<z.ZodString>;
        lifecycle: z.ZodEnum<["open", "closed"]>;
        entryAt: z.ZodString;
        plannedExitAt: z.ZodNullable<z.ZodString>;
        actualExitAt: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        guestName: string | null;
        bookingId: string | null;
        roomId: string;
        roomLabel: string | null;
        lifecycle: "open" | "closed";
        entryAt: string;
        plannedExitAt: string | null;
        actualExitAt: string | null;
    }, {
        id: string;
        guestName: string | null;
        bookingId: string | null;
        roomId: string;
        roomLabel: string | null;
        lifecycle: "open" | "closed";
        entryAt: string;
        plannedExitAt: string | null;
        actualExitAt: string | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    stays: {
        id: string;
        guestName: string | null;
        bookingId: string | null;
        roomId: string;
        roomLabel: string | null;
        lifecycle: "open" | "closed";
        entryAt: string;
        plannedExitAt: string | null;
        actualExitAt: string | null;
    }[];
}, {
    stays: {
        id: string;
        guestName: string | null;
        bookingId: string | null;
        roomId: string;
        roomLabel: string | null;
        lifecycle: "open" | "closed";
        entryAt: string;
        plannedExitAt: string | null;
        actualExitAt: string | null;
    }[];
}>;
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
export declare const CheckInRequest: z.ZodObject<{
    /**
     * OPTIONAL since ADR-016 (D-i). Check in uses the room already assigned for
     * today when one exists; sending a `roomId` overrides it, which is what the
     * desk does when a guest asks to move. A booking with neither an assignment
     * nor a `roomId` is refused with a message naming what is missing (AC-7).
     */
    roomId: z.ZodOptional<z.ZodString>;
    /**
     * Only if the desk agreed a different nightly rate at the counter. Absent
     * means the rate locked on the booking stands, which is the normal case and
     * the one that must not be overwritten by a blank field.
     */
    nightlyRateRwf: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    nightlyRateRwf?: number | undefined;
    roomId?: string | undefined;
}, {
    nightlyRateRwf?: number | undefined;
    roomId?: string | undefined;
}>;
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
export declare const WalkInRequest: z.ZodObject<{
    /** Required: nothing has chosen a room, so the desk does. */
    roomId: z.ZodString;
    /** Required: there is no account to read a name from. */
    guestName: z.ZodString;
    /** Absent means open ended. */
    plannedExitAt: z.ZodOptional<z.ZodString>;
    /** The nightly rate agreed at the counter. */
    nightlyRateRwf: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    guestName: string;
    roomId: string;
    nightlyRateRwf?: number | undefined;
    plannedExitAt?: string | undefined;
}, {
    guestName: string;
    roomId: string;
    nightlyRateRwf?: number | undefined;
    plannedExitAt?: string | undefined;
}>;
export type WalkInRequest = z.infer<typeof WalkInRequest>;
/**
 * Close an open stay.
 *
 * Flips the room to `dirty` in the same transaction, because a checkout that
 * does not dirty the room is how housekeeping misses a room, and leaving the
 * two to separate calls means a crash between them loses one.
 */
export declare const CheckOutRequest: z.ZodObject<{
    /** Optional note for the stay record, e.g. "left early, keys at desk". */
    note: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    note?: string | undefined;
}, {
    note?: string | undefined;
}>;
export type CheckOutRequest = z.infer<typeof CheckOutRequest>;
/** Set a room's housekeeping state. Never touches its inventory status. */
export declare const SetHousekeepingRequest: z.ZodObject<{
    housekeeping: z.ZodEnum<["clean", "dirty", "inspected", "out_of_order"]>;
}, "strip", z.ZodTypeAny, {
    housekeeping: "dirty" | "clean" | "inspected" | "out_of_order";
}, {
    housekeeping: "dirty" | "clean" | "inspected" | "out_of_order";
}>;
export type SetHousekeepingRequest = z.infer<typeof SetHousekeepingRequest>;
/**
 * A conversation, hung off exactly one of a booking, a stay or a lease.
 *
 * `threads_scope_exactly_one` enforces the "exactly one" in the database, so a
 * thread can never be about two things at once and a reader never has to pick.
 */
export declare const OperatorThread: z.ZodObject<{
    id: z.ZodString;
    scope: z.ZodEnum<["booking", "stay", "lease"]>;
    /** The booking, stay or lease this thread is about. */
    subjectId: z.ZodString;
    /** Who the operator is talking to, when we can resolve a name. */
    counterpartName: z.ZodNullable<z.ZodString>;
    status: z.ZodEnum<["active", "archived"]>;
    lastMessageAt: z.ZodNullable<z.ZodString>;
    lastMessagePreview: z.ZodNullable<z.ZodString>;
    messageCount: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    status: "active" | "archived";
    id: string;
    subjectId: string;
    scope: "lease" | "booking" | "stay";
    counterpartName: string | null;
    lastMessageAt: string | null;
    lastMessagePreview: string | null;
    messageCount: number;
}, {
    status: "active" | "archived";
    id: string;
    subjectId: string;
    scope: "lease" | "booking" | "stay";
    counterpartName: string | null;
    lastMessageAt: string | null;
    lastMessagePreview: string | null;
    messageCount: number;
}>;
export type OperatorThread = z.infer<typeof OperatorThread>;
export declare const OperatorThreadList: z.ZodObject<{
    threads: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        scope: z.ZodEnum<["booking", "stay", "lease"]>;
        /** The booking, stay or lease this thread is about. */
        subjectId: z.ZodString;
        /** Who the operator is talking to, when we can resolve a name. */
        counterpartName: z.ZodNullable<z.ZodString>;
        status: z.ZodEnum<["active", "archived"]>;
        lastMessageAt: z.ZodNullable<z.ZodString>;
        lastMessagePreview: z.ZodNullable<z.ZodString>;
        messageCount: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        status: "active" | "archived";
        id: string;
        subjectId: string;
        scope: "lease" | "booking" | "stay";
        counterpartName: string | null;
        lastMessageAt: string | null;
        lastMessagePreview: string | null;
        messageCount: number;
    }, {
        status: "active" | "archived";
        id: string;
        subjectId: string;
        scope: "lease" | "booking" | "stay";
        counterpartName: string | null;
        lastMessageAt: string | null;
        lastMessagePreview: string | null;
        messageCount: number;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    threads: {
        status: "active" | "archived";
        id: string;
        subjectId: string;
        scope: "lease" | "booking" | "stay";
        counterpartName: string | null;
        lastMessageAt: string | null;
        lastMessagePreview: string | null;
        messageCount: number;
    }[];
}, {
    threads: {
        status: "active" | "archived";
        id: string;
        subjectId: string;
        scope: "lease" | "booking" | "stay";
        counterpartName: string | null;
        lastMessageAt: string | null;
        lastMessagePreview: string | null;
        messageCount: number;
    }[];
}>;
export type OperatorThreadList = z.infer<typeof OperatorThreadList>;
export declare const OperatorMessage: z.ZodObject<{
    id: z.ZodString;
    threadId: z.ZodString;
    senderUserId: z.ZodNullable<z.ZodString>;
    senderName: z.ZodNullable<z.ZodString>;
    /** True when this workspace sent it, so a screen can side the bubble. */
    fromUs: z.ZodBoolean;
    bodyType: z.ZodEnum<["text", "image", "voice"]>;
    body: z.ZodNullable<z.ZodString>;
    voiceDurationS: z.ZodNullable<z.ZodNumber>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    createdAt: string;
    body: string | null;
    threadId: string;
    senderUserId: string | null;
    senderName: string | null;
    fromUs: boolean;
    bodyType: "text" | "image" | "voice";
    voiceDurationS: number | null;
}, {
    id: string;
    createdAt: string;
    body: string | null;
    threadId: string;
    senderUserId: string | null;
    senderName: string | null;
    fromUs: boolean;
    bodyType: "text" | "image" | "voice";
    voiceDurationS: number | null;
}>;
export type OperatorMessage = z.infer<typeof OperatorMessage>;
export declare const OperatorMessageList: z.ZodObject<{
    messages: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        threadId: z.ZodString;
        senderUserId: z.ZodNullable<z.ZodString>;
        senderName: z.ZodNullable<z.ZodString>;
        /** True when this workspace sent it, so a screen can side the bubble. */
        fromUs: z.ZodBoolean;
        bodyType: z.ZodEnum<["text", "image", "voice"]>;
        body: z.ZodNullable<z.ZodString>;
        voiceDurationS: z.ZodNullable<z.ZodNumber>;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        createdAt: string;
        body: string | null;
        threadId: string;
        senderUserId: string | null;
        senderName: string | null;
        fromUs: boolean;
        bodyType: "text" | "image" | "voice";
        voiceDurationS: number | null;
    }, {
        id: string;
        createdAt: string;
        body: string | null;
        threadId: string;
        senderUserId: string | null;
        senderName: string | null;
        fromUs: boolean;
        bodyType: "text" | "image" | "voice";
        voiceDurationS: number | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    messages: {
        id: string;
        createdAt: string;
        body: string | null;
        threadId: string;
        senderUserId: string | null;
        senderName: string | null;
        fromUs: boolean;
        bodyType: "text" | "image" | "voice";
        voiceDurationS: number | null;
    }[];
}, {
    messages: {
        id: string;
        createdAt: string;
        body: string | null;
        threadId: string;
        senderUserId: string | null;
        senderName: string | null;
        fromUs: boolean;
        bodyType: "text" | "image" | "voice";
        voiceDurationS: number | null;
    }[];
}>;
export type OperatorMessageList = z.infer<typeof OperatorMessageList>;
/**
 * Send a message into a thread.
 *
 * Text only here. Image and voice need an uploaded object first (F-S09 is
 * unbuilt), and accepting a body type this route cannot honour would be a
 * contract that lies.
 */
export declare const SendMessageRequest: z.ZodObject<{
    body: z.ZodString;
}, "strip", z.ZodTypeAny, {
    body: string;
}, {
    body: string;
}>;
export type SendMessageRequest = z.infer<typeof SendMessageRequest>;
/** What a work order is about. */
export declare const MaintenanceCategory: z.ZodEnum<["plumbing", "electrical", "hvac", "appliance", "furniture", "it_tech", "safety", "other"]>;
export type MaintenanceCategory = z.infer<typeof MaintenanceCategory>;
export declare const MaintenancePriority: z.ZodEnum<["low", "normal", "high", "urgent"]>;
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
export declare const OperatorTicket: z.ZodObject<{
    id: z.ZodString;
    leaseId: z.ZodNullable<z.ZodString>;
    roomId: z.ZodNullable<z.ZodString>;
    /** The unit or room, so the list reads without a second call. */
    unitLabel: z.ZodNullable<z.ZodString>;
    raisedByName: z.ZodNullable<z.ZodString>;
    title: z.ZodString;
    description: z.ZodNullable<z.ZodString>;
    category: z.ZodNullable<z.ZodEnum<["plumbing", "electrical", "hvac", "appliance", "furniture", "it_tech", "safety", "other"]>>;
    priority: z.ZodEnum<["low", "normal", "high", "urgent"]>;
    status: z.ZodEnum<["open", "assigned", "in_progress", "resolved", "closed", "cancelled"]>;
    resolvedAt: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
    noteCount: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    status: "open" | "resolved" | "closed" | "cancelled" | "assigned" | "in_progress";
    title: string;
    id: string;
    createdAt: string;
    category: "other" | "plumbing" | "electrical" | "hvac" | "appliance" | "furniture" | "it_tech" | "safety" | null;
    resolvedAt: string | null;
    description: string | null;
    roomId: string | null;
    leaseId: string | null;
    unitLabel: string | null;
    raisedByName: string | null;
    priority: "low" | "normal" | "high" | "urgent";
    noteCount: number;
}, {
    status: "open" | "resolved" | "closed" | "cancelled" | "assigned" | "in_progress";
    title: string;
    id: string;
    createdAt: string;
    category: "other" | "plumbing" | "electrical" | "hvac" | "appliance" | "furniture" | "it_tech" | "safety" | null;
    resolvedAt: string | null;
    description: string | null;
    roomId: string | null;
    leaseId: string | null;
    unitLabel: string | null;
    raisedByName: string | null;
    priority: "low" | "normal" | "high" | "urgent";
    noteCount: number;
}>;
export type OperatorTicket = z.infer<typeof OperatorTicket>;
export declare const OperatorTicketList: z.ZodObject<{
    tickets: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        leaseId: z.ZodNullable<z.ZodString>;
        roomId: z.ZodNullable<z.ZodString>;
        /** The unit or room, so the list reads without a second call. */
        unitLabel: z.ZodNullable<z.ZodString>;
        raisedByName: z.ZodNullable<z.ZodString>;
        title: z.ZodString;
        description: z.ZodNullable<z.ZodString>;
        category: z.ZodNullable<z.ZodEnum<["plumbing", "electrical", "hvac", "appliance", "furniture", "it_tech", "safety", "other"]>>;
        priority: z.ZodEnum<["low", "normal", "high", "urgent"]>;
        status: z.ZodEnum<["open", "assigned", "in_progress", "resolved", "closed", "cancelled"]>;
        resolvedAt: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
        noteCount: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        status: "open" | "resolved" | "closed" | "cancelled" | "assigned" | "in_progress";
        title: string;
        id: string;
        createdAt: string;
        category: "other" | "plumbing" | "electrical" | "hvac" | "appliance" | "furniture" | "it_tech" | "safety" | null;
        resolvedAt: string | null;
        description: string | null;
        roomId: string | null;
        leaseId: string | null;
        unitLabel: string | null;
        raisedByName: string | null;
        priority: "low" | "normal" | "high" | "urgent";
        noteCount: number;
    }, {
        status: "open" | "resolved" | "closed" | "cancelled" | "assigned" | "in_progress";
        title: string;
        id: string;
        createdAt: string;
        category: "other" | "plumbing" | "electrical" | "hvac" | "appliance" | "furniture" | "it_tech" | "safety" | null;
        resolvedAt: string | null;
        description: string | null;
        roomId: string | null;
        leaseId: string | null;
        unitLabel: string | null;
        raisedByName: string | null;
        priority: "low" | "normal" | "high" | "urgent";
        noteCount: number;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    tickets: {
        status: "open" | "resolved" | "closed" | "cancelled" | "assigned" | "in_progress";
        title: string;
        id: string;
        createdAt: string;
        category: "other" | "plumbing" | "electrical" | "hvac" | "appliance" | "furniture" | "it_tech" | "safety" | null;
        resolvedAt: string | null;
        description: string | null;
        roomId: string | null;
        leaseId: string | null;
        unitLabel: string | null;
        raisedByName: string | null;
        priority: "low" | "normal" | "high" | "urgent";
        noteCount: number;
    }[];
}, {
    tickets: {
        status: "open" | "resolved" | "closed" | "cancelled" | "assigned" | "in_progress";
        title: string;
        id: string;
        createdAt: string;
        category: "other" | "plumbing" | "electrical" | "hvac" | "appliance" | "furniture" | "it_tech" | "safety" | null;
        resolvedAt: string | null;
        description: string | null;
        roomId: string | null;
        leaseId: string | null;
        unitLabel: string | null;
        raisedByName: string | null;
        priority: "low" | "normal" | "high" | "urgent";
        noteCount: number;
    }[];
}>;
export type OperatorTicketList = z.infer<typeof OperatorTicketList>;
/**
 * Move a ticket to its next state, with a note.
 *
 * The note is required rather than optional: `maintenance_events` is the only
 * record of WHY a ticket closed, and a resolved ticket with no reason is the
 * one a tenant reopens a week later.
 */
export declare const AdvanceTicketRequest: z.ZodObject<{
    /**
     * Where the ticket goes next. Optional, and `resolved` when absent, which is
     * what every caller meant while the enum held only two values.
     */
    to: z.ZodOptional<z.ZodEnum<["open", "assigned", "in_progress", "resolved", "closed", "cancelled"]>>;
    note: z.ZodString;
}, "strip", z.ZodTypeAny, {
    note: string;
    to?: "open" | "resolved" | "closed" | "cancelled" | "assigned" | "in_progress" | undefined;
}, {
    note: string;
    to?: "open" | "resolved" | "closed" | "cancelled" | "assigned" | "in_progress" | undefined;
}>;
export type AdvanceTicketRequest = z.infer<typeof AdvanceTicketRequest>;
export declare const OperatorLease: z.ZodObject<{
    id: z.ZodString;
    roomId: z.ZodString;
    unitLabel: z.ZodNullable<z.ZodString>;
    tenantName: z.ZodNullable<z.ZodString>;
    monthlyRentRwf: z.ZodNullable<z.ZodNumber>;
    cautionRwf: z.ZodNullable<z.ZodNumber>;
    startDate: z.ZodNullable<z.ZodString>;
    endDate: z.ZodNullable<z.ZodString>;
    status: z.ZodEnum<["draft", "pending_signature", "active", "ending", "ended", "cancelled"]>;
    /** Whether both signatures are in, which is what gates going active. */
    landlordSignedAt: z.ZodNullable<z.ZodString>;
    tenantSignedAt: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "active" | "draft" | "cancelled" | "pending_signature" | "ending" | "ended";
    id: string;
    roomId: string;
    unitLabel: string | null;
    tenantName: string | null;
    monthlyRentRwf: number | null;
    cautionRwf: number | null;
    startDate: string | null;
    endDate: string | null;
    landlordSignedAt: string | null;
    tenantSignedAt: string | null;
}, {
    status: "active" | "draft" | "cancelled" | "pending_signature" | "ending" | "ended";
    id: string;
    roomId: string;
    unitLabel: string | null;
    tenantName: string | null;
    monthlyRentRwf: number | null;
    cautionRwf: number | null;
    startDate: string | null;
    endDate: string | null;
    landlordSignedAt: string | null;
    tenantSignedAt: string | null;
}>;
export type OperatorLease = z.infer<typeof OperatorLease>;
export declare const OperatorLeaseList: z.ZodObject<{
    leases: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        roomId: z.ZodString;
        unitLabel: z.ZodNullable<z.ZodString>;
        tenantName: z.ZodNullable<z.ZodString>;
        monthlyRentRwf: z.ZodNullable<z.ZodNumber>;
        cautionRwf: z.ZodNullable<z.ZodNumber>;
        startDate: z.ZodNullable<z.ZodString>;
        endDate: z.ZodNullable<z.ZodString>;
        status: z.ZodEnum<["draft", "pending_signature", "active", "ending", "ended", "cancelled"]>;
        /** Whether both signatures are in, which is what gates going active. */
        landlordSignedAt: z.ZodNullable<z.ZodString>;
        tenantSignedAt: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status: "active" | "draft" | "cancelled" | "pending_signature" | "ending" | "ended";
        id: string;
        roomId: string;
        unitLabel: string | null;
        tenantName: string | null;
        monthlyRentRwf: number | null;
        cautionRwf: number | null;
        startDate: string | null;
        endDate: string | null;
        landlordSignedAt: string | null;
        tenantSignedAt: string | null;
    }, {
        status: "active" | "draft" | "cancelled" | "pending_signature" | "ending" | "ended";
        id: string;
        roomId: string;
        unitLabel: string | null;
        tenantName: string | null;
        monthlyRentRwf: number | null;
        cautionRwf: number | null;
        startDate: string | null;
        endDate: string | null;
        landlordSignedAt: string | null;
        tenantSignedAt: string | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    leases: {
        status: "active" | "draft" | "cancelled" | "pending_signature" | "ending" | "ended";
        id: string;
        roomId: string;
        unitLabel: string | null;
        tenantName: string | null;
        monthlyRentRwf: number | null;
        cautionRwf: number | null;
        startDate: string | null;
        endDate: string | null;
        landlordSignedAt: string | null;
        tenantSignedAt: string | null;
    }[];
}, {
    leases: {
        status: "active" | "draft" | "cancelled" | "pending_signature" | "ending" | "ended";
        id: string;
        roomId: string;
        unitLabel: string | null;
        tenantName: string | null;
        monthlyRentRwf: number | null;
        cautionRwf: number | null;
        startDate: string | null;
        endDate: string | null;
        landlordSignedAt: string | null;
        tenantSignedAt: string | null;
    }[];
}>;
export type OperatorLeaseList = z.infer<typeof OperatorLeaseList>;
/**
 * Move a lease one step along its lifecycle.
 *
 * The caller names the state it expects to reach rather than saying "next".
 * A blind "next" is how a double click ends a lease that was only meant to be
 * activated: the server would have no way to tell the second call from a
 * legitimate second step.
 */
export declare const AdvanceLeaseRequest: z.ZodObject<{
    to: z.ZodEnum<["draft", "pending_signature", "active", "ending", "ended", "cancelled"]>;
}, "strip", z.ZodTypeAny, {
    to: "active" | "draft" | "cancelled" | "pending_signature" | "ending" | "ended";
}, {
    to: "active" | "draft" | "cancelled" | "pending_signature" | "ending" | "ended";
}>;
export type AdvanceLeaseRequest = z.infer<typeof AdvanceLeaseRequest>;
/** One month's rent on one lease. */
export declare const OperatorRentCharge: z.ZodObject<{
    id: z.ZodString;
    leaseId: z.ZodString;
    unitLabel: z.ZodNullable<z.ZodString>;
    tenantName: z.ZodNullable<z.ZodString>;
    /** `YYYY-MM-DD`, always the first of the month it covers. */
    periodMonth: z.ZodString;
    amountRwf: z.ZodNullable<z.ZodNumber>;
    paidAmountRwf: z.ZodNullable<z.ZodNumber>;
    status: z.ZodEnum<["paid", "due", "overdue"]>;
    dueDate: z.ZodNullable<z.ZodString>;
    paidAt: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "paid" | "due" | "overdue";
    amountRwf: number | null;
    id: string;
    leaseId: string;
    unitLabel: string | null;
    tenantName: string | null;
    periodMonth: string;
    paidAmountRwf: number | null;
    dueDate: string | null;
    paidAt: string | null;
}, {
    status: "paid" | "due" | "overdue";
    amountRwf: number | null;
    id: string;
    leaseId: string;
    unitLabel: string | null;
    tenantName: string | null;
    periodMonth: string;
    paidAmountRwf: number | null;
    dueDate: string | null;
    paidAt: string | null;
}>;
export type OperatorRentCharge = z.infer<typeof OperatorRentCharge>;
export declare const OperatorRentRoll: z.ZodObject<{
    charges: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        leaseId: z.ZodString;
        unitLabel: z.ZodNullable<z.ZodString>;
        tenantName: z.ZodNullable<z.ZodString>;
        /** `YYYY-MM-DD`, always the first of the month it covers. */
        periodMonth: z.ZodString;
        amountRwf: z.ZodNullable<z.ZodNumber>;
        paidAmountRwf: z.ZodNullable<z.ZodNumber>;
        status: z.ZodEnum<["paid", "due", "overdue"]>;
        dueDate: z.ZodNullable<z.ZodString>;
        paidAt: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status: "paid" | "due" | "overdue";
        amountRwf: number | null;
        id: string;
        leaseId: string;
        unitLabel: string | null;
        tenantName: string | null;
        periodMonth: string;
        paidAmountRwf: number | null;
        dueDate: string | null;
        paidAt: string | null;
    }, {
        status: "paid" | "due" | "overdue";
        amountRwf: number | null;
        id: string;
        leaseId: string;
        unitLabel: string | null;
        tenantName: string | null;
        periodMonth: string;
        paidAmountRwf: number | null;
        dueDate: string | null;
        paidAt: string | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    charges: {
        status: "paid" | "due" | "overdue";
        amountRwf: number | null;
        id: string;
        leaseId: string;
        unitLabel: string | null;
        tenantName: string | null;
        periodMonth: string;
        paidAmountRwf: number | null;
        dueDate: string | null;
        paidAt: string | null;
    }[];
}, {
    charges: {
        status: "paid" | "due" | "overdue";
        amountRwf: number | null;
        id: string;
        leaseId: string;
        unitLabel: string | null;
        tenantName: string | null;
        periodMonth: string;
        paidAmountRwf: number | null;
        dueDate: string | null;
        paidAt: string | null;
    }[];
}>;
export type OperatorRentRoll = z.infer<typeof OperatorRentRoll>;
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
export declare const RecordRentRequest: z.ZodObject<{
    periodMonth: z.ZodString;
    amountRwf: z.ZodNumber;
    /** How it arrived, for the record. Free text: v1 has no method catalog. */
    method: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    amountRwf: number;
    periodMonth: string;
    method?: string | undefined;
}, {
    amountRwf: number;
    periodMonth: string;
    method?: string | undefined;
}>;
export type RecordRentRequest = z.infer<typeof RecordRentRequest>;
/** A caution deposit being held against a lease. */
export declare const OperatorDeposit: z.ZodObject<{
    id: z.ZodString;
    leaseId: z.ZodString;
    unitLabel: z.ZodNullable<z.ZodString>;
    tenantName: z.ZodNullable<z.ZodString>;
    amountRwf: z.ZodNullable<z.ZodNumber>;
    status: z.ZodEnum<["held", "refunded", "forfeited"]>;
    heldAt: z.ZodString;
    /** Present once it has been settled. */
    settlement: z.ZodNullable<z.ZodObject<{
        refundedRwf: z.ZodNullable<z.ZodNumber>;
        forfeitedRwf: z.ZodNullable<z.ZodNumber>;
        reason: z.ZodNullable<z.ZodString>;
        settledAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        settledAt: string;
        reason: string | null;
        refundedRwf: number | null;
        forfeitedRwf: number | null;
    }, {
        settledAt: string;
        reason: string | null;
        refundedRwf: number | null;
        forfeitedRwf: number | null;
    }>>;
}, "strip", z.ZodTypeAny, {
    status: "held" | "forfeited" | "refunded";
    amountRwf: number | null;
    id: string;
    leaseId: string;
    unitLabel: string | null;
    tenantName: string | null;
    heldAt: string;
    settlement: {
        settledAt: string;
        reason: string | null;
        refundedRwf: number | null;
        forfeitedRwf: number | null;
    } | null;
}, {
    status: "held" | "forfeited" | "refunded";
    amountRwf: number | null;
    id: string;
    leaseId: string;
    unitLabel: string | null;
    tenantName: string | null;
    heldAt: string;
    settlement: {
        settledAt: string;
        reason: string | null;
        refundedRwf: number | null;
        forfeitedRwf: number | null;
    } | null;
}>;
export type OperatorDeposit = z.infer<typeof OperatorDeposit>;
export declare const OperatorDepositList: z.ZodObject<{
    deposits: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        leaseId: z.ZodString;
        unitLabel: z.ZodNullable<z.ZodString>;
        tenantName: z.ZodNullable<z.ZodString>;
        amountRwf: z.ZodNullable<z.ZodNumber>;
        status: z.ZodEnum<["held", "refunded", "forfeited"]>;
        heldAt: z.ZodString;
        /** Present once it has been settled. */
        settlement: z.ZodNullable<z.ZodObject<{
            refundedRwf: z.ZodNullable<z.ZodNumber>;
            forfeitedRwf: z.ZodNullable<z.ZodNumber>;
            reason: z.ZodNullable<z.ZodString>;
            settledAt: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            settledAt: string;
            reason: string | null;
            refundedRwf: number | null;
            forfeitedRwf: number | null;
        }, {
            settledAt: string;
            reason: string | null;
            refundedRwf: number | null;
            forfeitedRwf: number | null;
        }>>;
    }, "strip", z.ZodTypeAny, {
        status: "held" | "forfeited" | "refunded";
        amountRwf: number | null;
        id: string;
        leaseId: string;
        unitLabel: string | null;
        tenantName: string | null;
        heldAt: string;
        settlement: {
            settledAt: string;
            reason: string | null;
            refundedRwf: number | null;
            forfeitedRwf: number | null;
        } | null;
    }, {
        status: "held" | "forfeited" | "refunded";
        amountRwf: number | null;
        id: string;
        leaseId: string;
        unitLabel: string | null;
        tenantName: string | null;
        heldAt: string;
        settlement: {
            settledAt: string;
            reason: string | null;
            refundedRwf: number | null;
            forfeitedRwf: number | null;
        } | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    deposits: {
        status: "held" | "forfeited" | "refunded";
        amountRwf: number | null;
        id: string;
        leaseId: string;
        unitLabel: string | null;
        tenantName: string | null;
        heldAt: string;
        settlement: {
            settledAt: string;
            reason: string | null;
            refundedRwf: number | null;
            forfeitedRwf: number | null;
        } | null;
    }[];
}, {
    deposits: {
        status: "held" | "forfeited" | "refunded";
        amountRwf: number | null;
        id: string;
        leaseId: string;
        unitLabel: string | null;
        tenantName: string | null;
        heldAt: string;
        settlement: {
            settledAt: string;
            reason: string | null;
            refundedRwf: number | null;
            forfeitedRwf: number | null;
        } | null;
    }[];
}>;
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
export declare const ReturnDepositRequest: z.ZodEffects<z.ZodObject<{
    refundedRwf: z.ZodNumber;
    forfeitedRwf: z.ZodNumber;
    reason: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    refundedRwf: number;
    forfeitedRwf: number;
    reason?: string | undefined;
}, {
    refundedRwf: number;
    forfeitedRwf: number;
    reason?: string | undefined;
}>, {
    refundedRwf: number;
    forfeitedRwf: number;
    reason?: string | undefined;
}, {
    refundedRwf: number;
    forfeitedRwf: number;
    reason?: string | undefined;
}>;
export type ReturnDepositRequest = z.infer<typeof ReturnDepositRequest>;
export declare const OperatorAmenity: z.ZodObject<{
    code: z.ZodString;
    category: z.ZodNullable<z.ZodString>;
    label: z.ZodString;
    /** Whether this property offers it. */
    offered: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    code: string;
    label: string;
    category: string | null;
    offered: boolean;
}, {
    code: string;
    label: string;
    category: string | null;
    offered: boolean;
}>;
export type OperatorAmenity = z.infer<typeof OperatorAmenity>;
export declare const OperatorAmenityList: z.ZodObject<{
    amenities: z.ZodArray<z.ZodObject<{
        code: z.ZodString;
        category: z.ZodNullable<z.ZodString>;
        label: z.ZodString;
        /** Whether this property offers it. */
        offered: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        code: string;
        label: string;
        category: string | null;
        offered: boolean;
    }, {
        code: string;
        label: string;
        category: string | null;
        offered: boolean;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    amenities: {
        code: string;
        label: string;
        category: string | null;
        offered: boolean;
    }[];
}, {
    amenities: {
        code: string;
        label: string;
        category: string | null;
        offered: boolean;
    }[];
}>;
export type OperatorAmenityList = z.infer<typeof OperatorAmenityList>;
/** Add an amenity to a property. Removal is a DELETE on the same code. */
export declare const AddAmenityRequest: z.ZodObject<{
    propertyId: z.ZodString;
    amenityCode: z.ZodString;
}, "strip", z.ZodTypeAny, {
    propertyId: string;
    amenityCode: string;
}, {
    propertyId: string;
    amenityCode: string;
}>;
export type AddAmenityRequest = z.infer<typeof AddAmenityRequest>;
/**
 * Which property a read or a removal is about.
 *
 * Separate from the workspace: a workspace can hold several properties, and
 * "all the amenities in this workspace" is not a question anyone asks.
 */
export declare const PropertyScopedQuery: z.ZodObject<{
    propertyId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    propertyId: string;
}, {
    propertyId: string;
}>;
export type PropertyScopedQuery = z.infer<typeof PropertyScopedQuery>;
/**
 * The USALI vocabulary. Stable, which is why it is an enum while the
 * department NAMES are an editable per property catalog (D14).
 */
export declare const DepartmentCategory: z.ZodEnum<["rooms", "fnb", "spa_recreation", "other_operated", "misc_income", "admin_general", "sales_marketing", "it", "engineering", "utilities", "hr"]>;
export type DepartmentCategory = z.infer<typeof DepartmentCategory>;
/** `operated` departments earn; `undistributed` ones cost. */
export declare const DepartmentType: z.ZodEnum<["operated", "undistributed"]>;
export type DepartmentType = z.infer<typeof DepartmentType>;
export declare const DepartmentStatus: z.ZodEnum<["active", "archived"]>;
export type DepartmentStatus = z.infer<typeof DepartmentStatus>;
/**
 * A department as the operator sees it.
 *
 * `isRevenueCenter` is the one field a charge screen must read: a charge naming
 * a cost centre is refused with 422 (AC-1), so the picker has to be able to
 * grey the wrong ones out rather than let the desk find out on submit.
 */
export declare const OperatorDepartment: z.ZodObject<{
    id: z.ZodString;
    propertyId: z.ZodNullable<z.ZodString>;
    name: z.ZodString;
    departmentType: z.ZodEnum<["operated", "undistributed"]>;
    departmentCategory: z.ZodEnum<["rooms", "fnb", "spa_recreation", "other_operated", "misc_income", "admin_general", "sales_marketing", "it", "engineering", "utilities", "hr"]>;
    isRevenueCenter: z.ZodBoolean;
    guestRequestable: z.ZodBoolean;
    sortOrder: z.ZodNumber;
    status: z.ZodEnum<["active", "archived"]>;
}, "strip", z.ZodTypeAny, {
    status: "active" | "archived";
    id: string;
    name: string;
    propertyId: string | null;
    departmentType: "operated" | "undistributed";
    departmentCategory: "rooms" | "fnb" | "spa_recreation" | "other_operated" | "misc_income" | "admin_general" | "sales_marketing" | "it" | "engineering" | "utilities" | "hr";
    isRevenueCenter: boolean;
    guestRequestable: boolean;
    sortOrder: number;
}, {
    status: "active" | "archived";
    id: string;
    name: string;
    propertyId: string | null;
    departmentType: "operated" | "undistributed";
    departmentCategory: "rooms" | "fnb" | "spa_recreation" | "other_operated" | "misc_income" | "admin_general" | "sales_marketing" | "it" | "engineering" | "utilities" | "hr";
    isRevenueCenter: boolean;
    guestRequestable: boolean;
    sortOrder: number;
}>;
export type OperatorDepartment = z.infer<typeof OperatorDepartment>;
export declare const OperatorDepartmentList: z.ZodObject<{
    departments: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        propertyId: z.ZodNullable<z.ZodString>;
        name: z.ZodString;
        departmentType: z.ZodEnum<["operated", "undistributed"]>;
        departmentCategory: z.ZodEnum<["rooms", "fnb", "spa_recreation", "other_operated", "misc_income", "admin_general", "sales_marketing", "it", "engineering", "utilities", "hr"]>;
        isRevenueCenter: z.ZodBoolean;
        guestRequestable: z.ZodBoolean;
        sortOrder: z.ZodNumber;
        status: z.ZodEnum<["active", "archived"]>;
    }, "strip", z.ZodTypeAny, {
        status: "active" | "archived";
        id: string;
        name: string;
        propertyId: string | null;
        departmentType: "operated" | "undistributed";
        departmentCategory: "rooms" | "fnb" | "spa_recreation" | "other_operated" | "misc_income" | "admin_general" | "sales_marketing" | "it" | "engineering" | "utilities" | "hr";
        isRevenueCenter: boolean;
        guestRequestable: boolean;
        sortOrder: number;
    }, {
        status: "active" | "archived";
        id: string;
        name: string;
        propertyId: string | null;
        departmentType: "operated" | "undistributed";
        departmentCategory: "rooms" | "fnb" | "spa_recreation" | "other_operated" | "misc_income" | "admin_general" | "sales_marketing" | "it" | "engineering" | "utilities" | "hr";
        isRevenueCenter: boolean;
        guestRequestable: boolean;
        sortOrder: number;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    departments: {
        status: "active" | "archived";
        id: string;
        name: string;
        propertyId: string | null;
        departmentType: "operated" | "undistributed";
        departmentCategory: "rooms" | "fnb" | "spa_recreation" | "other_operated" | "misc_income" | "admin_general" | "sales_marketing" | "it" | "engineering" | "utilities" | "hr";
        isRevenueCenter: boolean;
        guestRequestable: boolean;
        sortOrder: number;
    }[];
}, {
    departments: {
        status: "active" | "archived";
        id: string;
        name: string;
        propertyId: string | null;
        departmentType: "operated" | "undistributed";
        departmentCategory: "rooms" | "fnb" | "spa_recreation" | "other_operated" | "misc_income" | "admin_general" | "sales_marketing" | "it" | "engineering" | "utilities" | "hr";
        isRevenueCenter: boolean;
        guestRequestable: boolean;
        sortOrder: number;
    }[];
}>;
export type OperatorDepartmentList = z.infer<typeof OperatorDepartmentList>;
/**
 * Add a department to a property.
 *
 * `isRevenueCenter` is not asked for: it follows from the type, because a cost
 * centre that takes revenue is a contradiction the database also refuses.
 */
export declare const CreateDepartmentRequest: z.ZodObject<{
    propertyId: z.ZodString;
    name: z.ZodString;
    departmentType: z.ZodEnum<["operated", "undistributed"]>;
    departmentCategory: z.ZodEnum<["rooms", "fnb", "spa_recreation", "other_operated", "misc_income", "admin_general", "sales_marketing", "it", "engineering", "utilities", "hr"]>;
    guestRequestable: z.ZodOptional<z.ZodBoolean>;
    sortOrder: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    name: string;
    propertyId: string;
    departmentType: "operated" | "undistributed";
    departmentCategory: "rooms" | "fnb" | "spa_recreation" | "other_operated" | "misc_income" | "admin_general" | "sales_marketing" | "it" | "engineering" | "utilities" | "hr";
    guestRequestable?: boolean | undefined;
    sortOrder?: number | undefined;
}, {
    name: string;
    propertyId: string;
    departmentType: "operated" | "undistributed";
    departmentCategory: "rooms" | "fnb" | "spa_recreation" | "other_operated" | "misc_income" | "admin_general" | "sales_marketing" | "it" | "engineering" | "utilities" | "hr";
    guestRequestable?: boolean | undefined;
    sortOrder?: number | undefined;
}>;
export type CreateDepartmentRequest = z.infer<typeof CreateDepartmentRequest>;
/**
 * Rename, reorder, or retire a department.
 *
 * The CATEGORY cannot be changed. It decides which revenue account the charges
 * post to, and moving it would silently re-attribute every shilling already
 * booked against the department.
 */
export declare const UpdateDepartmentRequest: z.ZodEffects<z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    guestRequestable: z.ZodOptional<z.ZodBoolean>;
    sortOrder: z.ZodOptional<z.ZodNumber>;
    status: z.ZodOptional<z.ZodEnum<["active", "archived"]>>;
}, "strip", z.ZodTypeAny, {
    status?: "active" | "archived" | undefined;
    name?: string | undefined;
    guestRequestable?: boolean | undefined;
    sortOrder?: number | undefined;
}, {
    status?: "active" | "archived" | undefined;
    name?: string | undefined;
    guestRequestable?: boolean | undefined;
    sortOrder?: number | undefined;
}>, {
    status?: "active" | "archived" | undefined;
    name?: string | undefined;
    guestRequestable?: boolean | undefined;
    sortOrder?: number | undefined;
}, {
    status?: "active" | "archived" | undefined;
    name?: string | undefined;
    guestRequestable?: boolean | undefined;
    sortOrder?: number | undefined;
}>;
export type UpdateDepartmentRequest = z.infer<typeof UpdateDepartmentRequest>;
export declare const FolioType: z.ZodEnum<["guest", "master", "group", "house"]>;
export type FolioType = z.infer<typeof FolioType>;
/**
 * `open -> settled -> closed`, and `settled -> disputed -> settled`.
 * `settled` means the balance reached zero; `closed` means no further charge
 * may post. Voiding a charge on a settled folio moves it back to `open`.
 */
export declare const FolioStatus: z.ZodEnum<["open", "settled", "closed", "disputed"]>;
export type FolioStatus = z.infer<typeof FolioStatus>;
/**
 * The ten typed lines a bill is made of.
 *
 * Signed: charges positive, payments and discounts negative. One sign rule,
 * fixed here, inherited by the ledger entry each line writes.
 */
export declare const ChargeType: z.ZodEnum<["room", "service_order", "pos", "tax", "service_charge", "adjustment", "discount", "deposit", "payment", "refund"]>;
export type ChargeType = z.infer<typeof ChargeType>;
export declare const TaxCode: z.ZodEnum<["TAX_A", "TAX_B", "TAX_C", "TAX_D"]>;
export type TaxCode = z.infer<typeof TaxCode>;
/** How the money arrived. It picks which cash account the payment posts to. */
export declare const PaymentMethod: z.ZodEnum<["mobile_money", "card", "cash"]>;
export type PaymentMethod = z.infer<typeof PaymentMethod>;
/** A bill as it appears in the Bills list. */
export declare const OperatorFolio: z.ZodObject<{
    id: z.ZodString;
    folioNumber: z.ZodString;
    folioType: z.ZodEnum<["guest", "master", "group", "house"]>;
    status: z.ZodEnum<["open", "settled", "closed", "disputed"]>;
    guestStayId: z.ZodNullable<z.ZodString>;
    bookingId: z.ZodNullable<z.ZodString>;
    guestName: z.ZodNullable<z.ZodString>;
    roomLabel: z.ZodNullable<z.ZodString>;
    balanceRwf: z.ZodNumber;
    openedAt: z.ZodString;
    closedAt: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "open" | "closed" | "settled" | "disputed";
    id: string;
    guestName: string | null;
    bookingId: string | null;
    roomLabel: string | null;
    folioNumber: string;
    folioType: "guest" | "master" | "group" | "house";
    guestStayId: string | null;
    balanceRwf: number;
    openedAt: string;
    closedAt: string | null;
}, {
    status: "open" | "closed" | "settled" | "disputed";
    id: string;
    guestName: string | null;
    bookingId: string | null;
    roomLabel: string | null;
    folioNumber: string;
    folioType: "guest" | "master" | "group" | "house";
    guestStayId: string | null;
    balanceRwf: number;
    openedAt: string;
    closedAt: string | null;
}>;
export type OperatorFolio = z.infer<typeof OperatorFolio>;
export declare const OperatorFolioList: z.ZodObject<{
    folios: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        folioNumber: z.ZodString;
        folioType: z.ZodEnum<["guest", "master", "group", "house"]>;
        status: z.ZodEnum<["open", "settled", "closed", "disputed"]>;
        guestStayId: z.ZodNullable<z.ZodString>;
        bookingId: z.ZodNullable<z.ZodString>;
        guestName: z.ZodNullable<z.ZodString>;
        roomLabel: z.ZodNullable<z.ZodString>;
        balanceRwf: z.ZodNumber;
        openedAt: z.ZodString;
        closedAt: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status: "open" | "closed" | "settled" | "disputed";
        id: string;
        guestName: string | null;
        bookingId: string | null;
        roomLabel: string | null;
        folioNumber: string;
        folioType: "guest" | "master" | "group" | "house";
        guestStayId: string | null;
        balanceRwf: number;
        openedAt: string;
        closedAt: string | null;
    }, {
        status: "open" | "closed" | "settled" | "disputed";
        id: string;
        guestName: string | null;
        bookingId: string | null;
        roomLabel: string | null;
        folioNumber: string;
        folioType: "guest" | "master" | "group" | "house";
        guestStayId: string | null;
        balanceRwf: number;
        openedAt: string;
        closedAt: string | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    folios: {
        status: "open" | "closed" | "settled" | "disputed";
        id: string;
        guestName: string | null;
        bookingId: string | null;
        roomLabel: string | null;
        folioNumber: string;
        folioType: "guest" | "master" | "group" | "house";
        guestStayId: string | null;
        balanceRwf: number;
        openedAt: string;
        closedAt: string | null;
    }[];
}, {
    folios: {
        status: "open" | "closed" | "settled" | "disputed";
        id: string;
        guestName: string | null;
        bookingId: string | null;
        roomLabel: string | null;
        folioNumber: string;
        folioType: "guest" | "master" | "group" | "house";
        guestStayId: string | null;
        balanceRwf: number;
        openedAt: string;
        closedAt: string | null;
    }[];
}>;
export type OperatorFolioList = z.infer<typeof OperatorFolioList>;
/**
 * One line on a bill. Never edited and never deleted.
 *
 * `voidedByChargeId` is how a screen greys out a reversed line without the row
 * carrying a mutable flag: the reversal names its target, so the relationship
 * is a fact about two rows rather than a field somebody could flip.
 */
export declare const OperatorFolioCharge: z.ZodObject<{
    id: z.ZodString;
    chargeType: z.ZodEnum<["room", "service_order", "pos", "tax", "service_charge", "adjustment", "discount", "deposit", "payment", "refund"]>;
    description: z.ZodNullable<z.ZodString>;
    departmentId: z.ZodNullable<z.ZodString>;
    departmentName: z.ZodNullable<z.ZodString>;
    quantity: z.ZodNumber;
    unitPriceRwf: z.ZodNullable<z.ZodNumber>;
    /** Signed, and tax exclusive. Tax is its own line. */
    amountRwf: z.ZodNumber;
    taxCode: z.ZodNullable<z.ZodEnum<["TAX_A", "TAX_B", "TAX_C", "TAX_D"]>>;
    taxRate: z.ZodNullable<z.ZodNumber>;
    taxAmountRwf: z.ZodNullable<z.ZodNumber>;
    /** `manual`, `night_audit`, `service_order`, `external_pos`, or `void`. */
    sourceRefType: z.ZodNullable<z.ZodString>;
    sourceRefId: z.ZodNullable<z.ZodString>;
    /** Set when another line reverses this one. */
    voidedByChargeId: z.ZodNullable<z.ZodString>;
    postedByUserId: z.ZodNullable<z.ZodString>;
    businessDate: z.ZodNullable<z.ZodString>;
    postedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    amountRwf: number;
    id: string;
    description: string | null;
    chargeType: "payment" | "refund" | "room" | "service_order" | "pos" | "tax" | "service_charge" | "adjustment" | "discount" | "deposit";
    departmentId: string | null;
    departmentName: string | null;
    quantity: number;
    unitPriceRwf: number | null;
    taxCode: "TAX_A" | "TAX_B" | "TAX_C" | "TAX_D" | null;
    taxRate: number | null;
    taxAmountRwf: number | null;
    sourceRefType: string | null;
    sourceRefId: string | null;
    voidedByChargeId: string | null;
    postedByUserId: string | null;
    businessDate: string | null;
    postedAt: string;
}, {
    amountRwf: number;
    id: string;
    description: string | null;
    chargeType: "payment" | "refund" | "room" | "service_order" | "pos" | "tax" | "service_charge" | "adjustment" | "discount" | "deposit";
    departmentId: string | null;
    departmentName: string | null;
    quantity: number;
    unitPriceRwf: number | null;
    taxCode: "TAX_A" | "TAX_B" | "TAX_C" | "TAX_D" | null;
    taxRate: number | null;
    taxAmountRwf: number | null;
    sourceRefType: string | null;
    sourceRefId: string | null;
    voidedByChargeId: string | null;
    postedByUserId: string | null;
    businessDate: string | null;
    postedAt: string;
}>;
export type OperatorFolioCharge = z.infer<typeof OperatorFolioCharge>;
/** The bill, with its lines. */
export declare const OperatorFolioDetail: z.ZodObject<{
    id: z.ZodString;
    folioNumber: z.ZodString;
    folioType: z.ZodEnum<["guest", "master", "group", "house"]>;
    status: z.ZodEnum<["open", "settled", "closed", "disputed"]>;
    guestStayId: z.ZodNullable<z.ZodString>;
    bookingId: z.ZodNullable<z.ZodString>;
    guestName: z.ZodNullable<z.ZodString>;
    roomLabel: z.ZodNullable<z.ZodString>;
    balanceRwf: z.ZodNumber;
    openedAt: z.ZodString;
    closedAt: z.ZodNullable<z.ZodString>;
} & {
    charges: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        chargeType: z.ZodEnum<["room", "service_order", "pos", "tax", "service_charge", "adjustment", "discount", "deposit", "payment", "refund"]>;
        description: z.ZodNullable<z.ZodString>;
        departmentId: z.ZodNullable<z.ZodString>;
        departmentName: z.ZodNullable<z.ZodString>;
        quantity: z.ZodNumber;
        unitPriceRwf: z.ZodNullable<z.ZodNumber>;
        /** Signed, and tax exclusive. Tax is its own line. */
        amountRwf: z.ZodNumber;
        taxCode: z.ZodNullable<z.ZodEnum<["TAX_A", "TAX_B", "TAX_C", "TAX_D"]>>;
        taxRate: z.ZodNullable<z.ZodNumber>;
        taxAmountRwf: z.ZodNullable<z.ZodNumber>;
        /** `manual`, `night_audit`, `service_order`, `external_pos`, or `void`. */
        sourceRefType: z.ZodNullable<z.ZodString>;
        sourceRefId: z.ZodNullable<z.ZodString>;
        /** Set when another line reverses this one. */
        voidedByChargeId: z.ZodNullable<z.ZodString>;
        postedByUserId: z.ZodNullable<z.ZodString>;
        businessDate: z.ZodNullable<z.ZodString>;
        postedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        amountRwf: number;
        id: string;
        description: string | null;
        chargeType: "payment" | "refund" | "room" | "service_order" | "pos" | "tax" | "service_charge" | "adjustment" | "discount" | "deposit";
        departmentId: string | null;
        departmentName: string | null;
        quantity: number;
        unitPriceRwf: number | null;
        taxCode: "TAX_A" | "TAX_B" | "TAX_C" | "TAX_D" | null;
        taxRate: number | null;
        taxAmountRwf: number | null;
        sourceRefType: string | null;
        sourceRefId: string | null;
        voidedByChargeId: string | null;
        postedByUserId: string | null;
        businessDate: string | null;
        postedAt: string;
    }, {
        amountRwf: number;
        id: string;
        description: string | null;
        chargeType: "payment" | "refund" | "room" | "service_order" | "pos" | "tax" | "service_charge" | "adjustment" | "discount" | "deposit";
        departmentId: string | null;
        departmentName: string | null;
        quantity: number;
        unitPriceRwf: number | null;
        taxCode: "TAX_A" | "TAX_B" | "TAX_C" | "TAX_D" | null;
        taxRate: number | null;
        taxAmountRwf: number | null;
        sourceRefType: string | null;
        sourceRefId: string | null;
        voidedByChargeId: string | null;
        postedByUserId: string | null;
        businessDate: string | null;
        postedAt: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    status: "open" | "closed" | "settled" | "disputed";
    id: string;
    guestName: string | null;
    bookingId: string | null;
    roomLabel: string | null;
    charges: {
        amountRwf: number;
        id: string;
        description: string | null;
        chargeType: "payment" | "refund" | "room" | "service_order" | "pos" | "tax" | "service_charge" | "adjustment" | "discount" | "deposit";
        departmentId: string | null;
        departmentName: string | null;
        quantity: number;
        unitPriceRwf: number | null;
        taxCode: "TAX_A" | "TAX_B" | "TAX_C" | "TAX_D" | null;
        taxRate: number | null;
        taxAmountRwf: number | null;
        sourceRefType: string | null;
        sourceRefId: string | null;
        voidedByChargeId: string | null;
        postedByUserId: string | null;
        businessDate: string | null;
        postedAt: string;
    }[];
    folioNumber: string;
    folioType: "guest" | "master" | "group" | "house";
    guestStayId: string | null;
    balanceRwf: number;
    openedAt: string;
    closedAt: string | null;
}, {
    status: "open" | "closed" | "settled" | "disputed";
    id: string;
    guestName: string | null;
    bookingId: string | null;
    roomLabel: string | null;
    charges: {
        amountRwf: number;
        id: string;
        description: string | null;
        chargeType: "payment" | "refund" | "room" | "service_order" | "pos" | "tax" | "service_charge" | "adjustment" | "discount" | "deposit";
        departmentId: string | null;
        departmentName: string | null;
        quantity: number;
        unitPriceRwf: number | null;
        taxCode: "TAX_A" | "TAX_B" | "TAX_C" | "TAX_D" | null;
        taxRate: number | null;
        taxAmountRwf: number | null;
        sourceRefType: string | null;
        sourceRefId: string | null;
        voidedByChargeId: string | null;
        postedByUserId: string | null;
        businessDate: string | null;
        postedAt: string;
    }[];
    folioNumber: string;
    folioType: "guest" | "master" | "group" | "house";
    guestStayId: string | null;
    balanceRwf: number;
    openedAt: string;
    closedAt: string | null;
}>;
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
export declare const PostChargeRequest: z.ZodObject<{
    chargeType: z.ZodEnum<["room", "service_order", "pos", "service_charge", "adjustment", "discount", "deposit", "refund"]>;
    departmentId: z.ZodOptional<z.ZodString>;
    outletId: z.ZodOptional<z.ZodString>;
    description: z.ZodString;
    quantity: z.ZodDefault<z.ZodNumber>;
    /** Signed. A discount or a refund is negative and the service checks it. */
    amountRwf: z.ZodNumber;
    /** `TAX_B` (the standard 18%) when absent. */
    taxCode: z.ZodOptional<z.ZodEnum<["TAX_A", "TAX_B", "TAX_C", "TAX_D"]>>;
}, "strip", z.ZodTypeAny, {
    amountRwf: number;
    description: string;
    chargeType: "refund" | "room" | "service_order" | "pos" | "service_charge" | "adjustment" | "discount" | "deposit";
    quantity: number;
    departmentId?: string | undefined;
    taxCode?: "TAX_A" | "TAX_B" | "TAX_C" | "TAX_D" | undefined;
    outletId?: string | undefined;
}, {
    amountRwf: number;
    description: string;
    chargeType: "refund" | "room" | "service_order" | "pos" | "service_charge" | "adjustment" | "discount" | "deposit";
    departmentId?: string | undefined;
    quantity?: number | undefined;
    taxCode?: "TAX_A" | "TAX_B" | "TAX_C" | "TAX_D" | undefined;
    outletId?: string | undefined;
}>;
export type PostChargeRequest = z.infer<typeof PostChargeRequest>;
/**
 * Take a payment against a bill.
 *
 * Posts a negative `payment` line and one cash ledger entry. It never posts
 * revenue: the charge already did that at post time (D-f). Building it the
 * other way round would double count every shilling.
 */
export declare const TakePaymentRequest: z.ZodObject<{
    amountRwf: z.ZodNumber;
    method: z.ZodEnum<["mobile_money", "card", "cash"]>;
    reference: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    amountRwf: number;
    method: "mobile_money" | "card" | "cash";
    reference?: string | undefined;
}, {
    amountRwf: number;
    method: "mobile_money" | "card" | "cash";
    reference?: string | undefined;
}>;
export type TakePaymentRequest = z.infer<typeof TakePaymentRequest>;
/**
 * Void a posted charge.
 *
 * Posts a reversing line naming the original. The original row is never
 * touched, so a bill shows the mistake and the correction rather than hiding
 * both. Allowed once per charge, and a void can never itself be voided.
 */
export declare const VoidChargeRequest: z.ZodObject<{
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
}, {
    reason: string;
}>;
export type VoidChargeRequest = z.infer<typeof VoidChargeRequest>;
/**
 * Which month of revenue to roll up. The property's current month when absent.
 *
 * `workspaceId` is optional for the same reason it is on every ops read: the
 * guard takes it from the `x-workspace-id` header first.
 */
export declare const OperatorRevenueQuery: z.ZodObject<{
    workspaceId: z.ZodOptional<z.ZodString>;
    month: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    workspaceId?: string | undefined;
    month?: string | undefined;
}, {
    workspaceId?: string | undefined;
    month?: string | undefined;
}>;
export type OperatorRevenueQuery = z.infer<typeof OperatorRevenueQuery>;
/** One revenue centre's takings for the month. */
export declare const OperatorRevenueDepartment: z.ZodObject<{
    departmentId: z.ZodString;
    name: z.ZodString;
    departmentCategory: z.ZodEnum<["rooms", "fnb", "spa_recreation", "other_operated", "misc_income", "admin_general", "sales_marketing", "it", "engineering", "utilities", "hr"]>;
    status: z.ZodEnum<["active", "archived"]>;
    /** Tax exclusive, net of voids. Can be zero; never absent. */
    revenueRwf: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    status: "active" | "archived";
    name: string;
    departmentCategory: "rooms" | "fnb" | "spa_recreation" | "other_operated" | "misc_income" | "admin_general" | "sales_marketing" | "it" | "engineering" | "utilities" | "hr";
    departmentId: string;
    revenueRwf: number;
}, {
    status: "active" | "archived";
    name: string;
    departmentCategory: "rooms" | "fnb" | "spa_recreation" | "other_operated" | "misc_income" | "admin_general" | "sales_marketing" | "it" | "engineering" | "utilities" | "hr";
    departmentId: string;
    revenueRwf: number;
}>;
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
export declare const OperatorRevenue: z.ZodObject<{
    month: z.ZodString;
    /** `YYYY-MM-DD`, inclusive. */
    from: z.ZodString;
    /** `YYYY-MM-DD`, exclusive. */
    to: z.ZodString;
    departments: z.ZodArray<z.ZodObject<{
        departmentId: z.ZodString;
        name: z.ZodString;
        departmentCategory: z.ZodEnum<["rooms", "fnb", "spa_recreation", "other_operated", "misc_income", "admin_general", "sales_marketing", "it", "engineering", "utilities", "hr"]>;
        status: z.ZodEnum<["active", "archived"]>;
        /** Tax exclusive, net of voids. Can be zero; never absent. */
        revenueRwf: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        status: "active" | "archived";
        name: string;
        departmentCategory: "rooms" | "fnb" | "spa_recreation" | "other_operated" | "misc_income" | "admin_general" | "sales_marketing" | "it" | "engineering" | "utilities" | "hr";
        departmentId: string;
        revenueRwf: number;
    }, {
        status: "active" | "archived";
        name: string;
        departmentCategory: "rooms" | "fnb" | "spa_recreation" | "other_operated" | "misc_income" | "admin_general" | "sales_marketing" | "it" | "engineering" | "utilities" | "hr";
        departmentId: string;
        revenueRwf: number;
    }>, "many">;
    totalRwf: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    from: string;
    totalRwf: number;
    to: string;
    departments: {
        status: "active" | "archived";
        name: string;
        departmentCategory: "rooms" | "fnb" | "spa_recreation" | "other_operated" | "misc_income" | "admin_general" | "sales_marketing" | "it" | "engineering" | "utilities" | "hr";
        departmentId: string;
        revenueRwf: number;
    }[];
    month: string;
}, {
    from: string;
    totalRwf: number;
    to: string;
    departments: {
        status: "active" | "archived";
        name: string;
        departmentCategory: "rooms" | "fnb" | "spa_recreation" | "other_operated" | "misc_income" | "admin_general" | "sales_marketing" | "it" | "engineering" | "utilities" | "hr";
        departmentId: string;
        revenueRwf: number;
    }[];
    month: string;
}>;
export type OperatorRevenue = z.infer<typeof OperatorRevenue>;
export declare const RoomAssignmentStatus: z.ZodEnum<["assigned", "released"]>;
export type RoomAssignmentStatus = z.infer<typeof RoomAssignmentStatus>;
/**
 * A room held for a booking over a date range.
 *
 * `from` and `to` are a half open range: the guest holds the room from `from`
 * up to but not including `to`, so a departure on the morning of the 5th does
 * not collide with an arrival that afternoon.
 */
export declare const OperatorRoomAssignment: z.ZodObject<{
    id: z.ZodString;
    bookingId: z.ZodString;
    roomId: z.ZodString;
    roomLabel: z.ZodNullable<z.ZodString>;
    from: z.ZodString;
    to: z.ZodString;
    status: z.ZodEnum<["assigned", "released"]>;
    assignedByUserId: z.ZodNullable<z.ZodString>;
    releasedAt: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "released" | "assigned";
    id: string;
    from: string;
    bookingId: string;
    roomId: string;
    roomLabel: string | null;
    to: string;
    assignedByUserId: string | null;
    releasedAt: string | null;
}, {
    status: "released" | "assigned";
    id: string;
    from: string;
    bookingId: string;
    roomId: string;
    roomLabel: string | null;
    to: string;
    assignedByUserId: string | null;
    releasedAt: string | null;
}>;
export type OperatorRoomAssignment = z.infer<typeof OperatorRoomAssignment>;
export declare const OperatorRoomAssignmentList: z.ZodObject<{
    assignments: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        bookingId: z.ZodString;
        roomId: z.ZodString;
        roomLabel: z.ZodNullable<z.ZodString>;
        from: z.ZodString;
        to: z.ZodString;
        status: z.ZodEnum<["assigned", "released"]>;
        assignedByUserId: z.ZodNullable<z.ZodString>;
        releasedAt: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status: "released" | "assigned";
        id: string;
        from: string;
        bookingId: string;
        roomId: string;
        roomLabel: string | null;
        to: string;
        assignedByUserId: string | null;
        releasedAt: string | null;
    }, {
        status: "released" | "assigned";
        id: string;
        from: string;
        bookingId: string;
        roomId: string;
        roomLabel: string | null;
        to: string;
        assignedByUserId: string | null;
        releasedAt: string | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    assignments: {
        status: "released" | "assigned";
        id: string;
        from: string;
        bookingId: string;
        roomId: string;
        roomLabel: string | null;
        to: string;
        assignedByUserId: string | null;
        releasedAt: string | null;
    }[];
}, {
    assignments: {
        status: "released" | "assigned";
        id: string;
        from: string;
        bookingId: string;
        roomId: string;
        roomLabel: string | null;
        to: string;
        assignedByUserId: string | null;
        releasedAt: string | null;
    }[];
}>;
export type OperatorRoomAssignmentList = z.infer<typeof OperatorRoomAssignmentList>;
/**
 * Give a booking a physical room.
 *
 * The dates default to the booking's own check in and check out. An explicit
 * range is for a SPLIT STAY: a guest in 101 for two nights and 205 for the
 * third is two assignments against one booking, which is the requirement a
 * nullable column on `bookings` could not have met.
 */
export declare const AssignRoomRequest: z.ZodObject<{
    roomId: z.ZodString;
    /** `YYYY-MM-DD`. Defaults to the booking's check in. */
    from: z.ZodOptional<z.ZodString>;
    /** `YYYY-MM-DD`, exclusive. Defaults to the booking's check out. */
    to: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    roomId: string;
    from?: string | undefined;
    to?: string | undefined;
}, {
    roomId: string;
    from?: string | undefined;
    to?: string | undefined;
}>;
export type AssignRoomRequest = z.infer<typeof AssignRoomRequest>;
/**
 * Every room held across the property over a window of dates.
 *
 * The room grid's read. Holds were only readable one booking at a time, so a
 * tape chart would have cost one request per reservation on screen. Only live
 * holds come back: a released one is history, and drawing it would put a
 * guest in a room they were moved out of.
 */
export declare const RoomAssignmentWindowQuery: z.ZodEffects<z.ZodObject<{
    workspaceId: z.ZodOptional<z.ZodString>;
    /** `YYYY-MM-DD`, inclusive. */
    from: z.ZodString;
    /** `YYYY-MM-DD`, exclusive. */
    to: z.ZodString;
}, "strip", z.ZodTypeAny, {
    from: string;
    to: string;
    workspaceId?: string | undefined;
}, {
    from: string;
    to: string;
    workspaceId?: string | undefined;
}>, {
    from: string;
    to: string;
    workspaceId?: string | undefined;
}, {
    from: string;
    to: string;
    workspaceId?: string | undefined;
}>;
export type RoomAssignmentWindowQuery = z.infer<typeof RoomAssignmentWindowQuery>;
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
export declare const OperatorTeamMember: z.ZodObject<{
    userId: z.ZodString;
    name: z.ZodNullable<z.ZodString>;
    email: z.ZodNullable<z.ZodString>;
    orgRole: z.ZodEnum<["owner", "manager", "receptionist", "housekeeper"]>;
    /** `active` or `removed`. A removed member keeps their history. */
    status: z.ZodString;
    joinedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: string;
    userId: string;
    name: string | null;
    email: string | null;
    orgRole: "owner" | "manager" | "receptionist" | "housekeeper";
    joinedAt: string;
}, {
    status: string;
    userId: string;
    name: string | null;
    email: string | null;
    orgRole: "owner" | "manager" | "receptionist" | "housekeeper";
    joinedAt: string;
}>;
export type OperatorTeamMember = z.infer<typeof OperatorTeamMember>;
export declare const OperatorTeamList: z.ZodObject<{
    members: z.ZodArray<z.ZodObject<{
        userId: z.ZodString;
        name: z.ZodNullable<z.ZodString>;
        email: z.ZodNullable<z.ZodString>;
        orgRole: z.ZodEnum<["owner", "manager", "receptionist", "housekeeper"]>;
        /** `active` or `removed`. A removed member keeps their history. */
        status: z.ZodString;
        joinedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        status: string;
        userId: string;
        name: string | null;
        email: string | null;
        orgRole: "owner" | "manager" | "receptionist" | "housekeeper";
        joinedAt: string;
    }, {
        status: string;
        userId: string;
        name: string | null;
        email: string | null;
        orgRole: "owner" | "manager" | "receptionist" | "housekeeper";
        joinedAt: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    members: {
        status: string;
        userId: string;
        name: string | null;
        email: string | null;
        orgRole: "owner" | "manager" | "receptionist" | "housekeeper";
        joinedAt: string;
    }[];
}, {
    members: {
        status: string;
        userId: string;
        name: string | null;
        email: string | null;
        orgRole: "owner" | "manager" | "receptionist" | "housekeeper";
        joinedAt: string;
    }[];
}>;
export type OperatorTeamList = z.infer<typeof OperatorTeamList>;
export declare const HousekeepingTaskType: z.ZodEnum<["checkout_clean", "stayover_clean", "inspection", "deep_clean", "turndown"]>;
export type HousekeepingTaskType = z.infer<typeof HousekeepingTaskType>;
/**
 * `pending -> in_progress -> done -> inspected`, and any state to `blocked`
 * (it needs maintenance first) and back to `pending`.
 */
export declare const HousekeepingTaskStatus: z.ZodEnum<["pending", "in_progress", "done", "inspected", "blocked"]>;
export type HousekeepingTaskStatus = z.infer<typeof HousekeepingTaskStatus>;
export declare const OperatorHousekeepingTask: z.ZodObject<{
    id: z.ZodString;
    roomId: z.ZodString;
    roomLabel: z.ZodNullable<z.ZodString>;
    taskType: z.ZodEnum<["checkout_clean", "stayover_clean", "inspection", "deep_clean", "turndown"]>;
    status: z.ZodEnum<["pending", "in_progress", "done", "inspected", "blocked"]>;
    assignedToUserId: z.ZodNullable<z.ZodString>;
    assignedToName: z.ZodNullable<z.ZodString>;
    priority: z.ZodNumber;
    note: z.ZodNullable<z.ZodString>;
    startedAt: z.ZodNullable<z.ZodString>;
    completedAt: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "pending" | "inspected" | "in_progress" | "done" | "blocked";
    id: string;
    createdAt: string;
    roomId: string;
    roomLabel: string | null;
    note: string | null;
    priority: number;
    taskType: "checkout_clean" | "stayover_clean" | "inspection" | "deep_clean" | "turndown";
    assignedToUserId: string | null;
    assignedToName: string | null;
    startedAt: string | null;
    completedAt: string | null;
}, {
    status: "pending" | "inspected" | "in_progress" | "done" | "blocked";
    id: string;
    createdAt: string;
    roomId: string;
    roomLabel: string | null;
    note: string | null;
    priority: number;
    taskType: "checkout_clean" | "stayover_clean" | "inspection" | "deep_clean" | "turndown";
    assignedToUserId: string | null;
    assignedToName: string | null;
    startedAt: string | null;
    completedAt: string | null;
}>;
export type OperatorHousekeepingTask = z.infer<typeof OperatorHousekeepingTask>;
export declare const OperatorHousekeepingTaskList: z.ZodObject<{
    tasks: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        roomId: z.ZodString;
        roomLabel: z.ZodNullable<z.ZodString>;
        taskType: z.ZodEnum<["checkout_clean", "stayover_clean", "inspection", "deep_clean", "turndown"]>;
        status: z.ZodEnum<["pending", "in_progress", "done", "inspected", "blocked"]>;
        assignedToUserId: z.ZodNullable<z.ZodString>;
        assignedToName: z.ZodNullable<z.ZodString>;
        priority: z.ZodNumber;
        note: z.ZodNullable<z.ZodString>;
        startedAt: z.ZodNullable<z.ZodString>;
        completedAt: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        status: "pending" | "inspected" | "in_progress" | "done" | "blocked";
        id: string;
        createdAt: string;
        roomId: string;
        roomLabel: string | null;
        note: string | null;
        priority: number;
        taskType: "checkout_clean" | "stayover_clean" | "inspection" | "deep_clean" | "turndown";
        assignedToUserId: string | null;
        assignedToName: string | null;
        startedAt: string | null;
        completedAt: string | null;
    }, {
        status: "pending" | "inspected" | "in_progress" | "done" | "blocked";
        id: string;
        createdAt: string;
        roomId: string;
        roomLabel: string | null;
        note: string | null;
        priority: number;
        taskType: "checkout_clean" | "stayover_clean" | "inspection" | "deep_clean" | "turndown";
        assignedToUserId: string | null;
        assignedToName: string | null;
        startedAt: string | null;
        completedAt: string | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    tasks: {
        status: "pending" | "inspected" | "in_progress" | "done" | "blocked";
        id: string;
        createdAt: string;
        roomId: string;
        roomLabel: string | null;
        note: string | null;
        priority: number;
        taskType: "checkout_clean" | "stayover_clean" | "inspection" | "deep_clean" | "turndown";
        assignedToUserId: string | null;
        assignedToName: string | null;
        startedAt: string | null;
        completedAt: string | null;
    }[];
}, {
    tasks: {
        status: "pending" | "inspected" | "in_progress" | "done" | "blocked";
        id: string;
        createdAt: string;
        roomId: string;
        roomLabel: string | null;
        note: string | null;
        priority: number;
        taskType: "checkout_clean" | "stayover_clean" | "inspection" | "deep_clean" | "turndown";
        assignedToUserId: string | null;
        assignedToName: string | null;
        startedAt: string | null;
        completedAt: string | null;
    }[];
}>;
export type OperatorHousekeepingTaskList = z.infer<typeof OperatorHousekeepingTaskList>;
/** Put a room on the cleaning board, optionally against a named housekeeper. */
export declare const CreateHousekeepingTaskRequest: z.ZodObject<{
    roomId: z.ZodString;
    taskType: z.ZodEnum<["checkout_clean", "stayover_clean", "inspection", "deep_clean", "turndown"]>;
    assignedToUserId: z.ZodOptional<z.ZodString>;
    priority: z.ZodOptional<z.ZodNumber>;
    note: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    roomId: string;
    taskType: "checkout_clean" | "stayover_clean" | "inspection" | "deep_clean" | "turndown";
    note?: string | undefined;
    priority?: number | undefined;
    assignedToUserId?: string | undefined;
}, {
    roomId: string;
    taskType: "checkout_clean" | "stayover_clean" | "inspection" | "deep_clean" | "turndown";
    note?: string | undefined;
    priority?: number | undefined;
    assignedToUserId?: string | undefined;
}>;
export type CreateHousekeepingTaskRequest = z.infer<typeof CreateHousekeepingTaskRequest>;
/**
 * Move a task along.
 *
 * The person doing the cleaning sends this, so it is gated on
 * `housekeeping.set` rather than on `task.assign`: a housekeeper holds the
 * first and not the second.
 */
export declare const AdvanceHousekeepingTaskRequest: z.ZodObject<{
    to: z.ZodEnum<["pending", "in_progress", "done", "inspected", "blocked"]>;
    note: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    to: "pending" | "inspected" | "in_progress" | "done" | "blocked";
    note?: string | undefined;
}, {
    to: "pending" | "inspected" | "in_progress" | "done" | "blocked";
    note?: string | undefined;
}>;
export type AdvanceHousekeepingTaskRequest = z.infer<typeof AdvanceHousekeepingTaskRequest>;
/**
 * Raise a work order.
 *
 * At least one of `roomId` or `leaseId` is required, which is the same rule the
 * database checks: a ticket has to be ABOUT something, and a work order nobody
 * can locate is worse than no work order.
 */
export declare const RaiseTicketRequest: z.ZodEffects<z.ZodObject<{
    roomId: z.ZodOptional<z.ZodString>;
    leaseId: z.ZodOptional<z.ZodString>;
    title: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    category: z.ZodOptional<z.ZodEnum<["plumbing", "electrical", "hvac", "appliance", "furniture", "it_tech", "safety", "other"]>>;
    priority: z.ZodOptional<z.ZodEnum<["low", "normal", "high", "urgent"]>>;
}, "strip", z.ZodTypeAny, {
    title: string;
    category?: "other" | "plumbing" | "electrical" | "hvac" | "appliance" | "furniture" | "it_tech" | "safety" | undefined;
    description?: string | undefined;
    roomId?: string | undefined;
    leaseId?: string | undefined;
    priority?: "low" | "normal" | "high" | "urgent" | undefined;
}, {
    title: string;
    category?: "other" | "plumbing" | "electrical" | "hvac" | "appliance" | "furniture" | "it_tech" | "safety" | undefined;
    description?: string | undefined;
    roomId?: string | undefined;
    leaseId?: string | undefined;
    priority?: "low" | "normal" | "high" | "urgent" | undefined;
}>, {
    title: string;
    category?: "other" | "plumbing" | "electrical" | "hvac" | "appliance" | "furniture" | "it_tech" | "safety" | undefined;
    description?: string | undefined;
    roomId?: string | undefined;
    leaseId?: string | undefined;
    priority?: "low" | "normal" | "high" | "urgent" | undefined;
}, {
    title: string;
    category?: "other" | "plumbing" | "electrical" | "hvac" | "appliance" | "furniture" | "it_tech" | "safety" | undefined;
    description?: string | undefined;
    roomId?: string | undefined;
    leaseId?: string | undefined;
    priority?: "low" | "normal" | "high" | "urgent" | undefined;
}>;
export type RaiseTicketRequest = z.infer<typeof RaiseTicketRequest>;
export declare const ServiceCatalogStatus: z.ZodEnum<["active", "out_of_stock", "archived"]>;
export type ServiceCatalogStatus = z.infer<typeof ServiceCatalogStatus>;
export declare const FulfillmentType: z.ZodEnum<["in_room_delivery", "pickup", "appointment", "onsite", "instant"]>;
export type FulfillmentType = z.infer<typeof FulfillmentType>;
export declare const ServiceOrderChannel: z.ZodEnum<["guest_app", "in_room_device", "front_desk", "staff", "api"]>;
export type ServiceOrderChannel = z.infer<typeof ServiceOrderChannel>;
/**
 * `submitted -> acknowledged -> in_progress -> ready -> delivered ->
 * completed`, plus `submitted -> rejected`, and anything before `delivered` to
 * `cancelled`.
 */
export declare const ServiceOrderStatus: z.ZodEnum<["submitted", "acknowledged", "in_progress", "ready", "delivered", "completed", "cancelled", "rejected"]>;
export type ServiceOrderStatus = z.infer<typeof ServiceOrderStatus>;
export declare const OperatorServiceItem: z.ZodObject<{
    id: z.ZodString;
    serviceCategoryId: z.ZodString;
    departmentId: z.ZodString;
    name: z.ZodString;
    description: z.ZodNullable<z.ZodString>;
    priceRwf: z.ZodNumber;
    taxCode: z.ZodEnum<["TAX_A", "TAX_B", "TAX_C", "TAX_D"]>;
    fulfillmentType: z.ZodEnum<["in_room_delivery", "pickup", "appointment", "onsite", "instant"]>;
    prepTimeMinutes: z.ZodNullable<z.ZodNumber>;
    guestOrderable: z.ZodBoolean;
    stockQty: z.ZodNullable<z.ZodNumber>;
    status: z.ZodEnum<["active", "out_of_stock", "archived"]>;
}, "strip", z.ZodTypeAny, {
    status: "active" | "archived" | "out_of_stock";
    id: string;
    name: string;
    priceRwf: number;
    description: string | null;
    departmentId: string;
    taxCode: "TAX_A" | "TAX_B" | "TAX_C" | "TAX_D";
    serviceCategoryId: string;
    fulfillmentType: "in_room_delivery" | "pickup" | "appointment" | "onsite" | "instant";
    prepTimeMinutes: number | null;
    guestOrderable: boolean;
    stockQty: number | null;
}, {
    status: "active" | "archived" | "out_of_stock";
    id: string;
    name: string;
    priceRwf: number;
    description: string | null;
    departmentId: string;
    taxCode: "TAX_A" | "TAX_B" | "TAX_C" | "TAX_D";
    serviceCategoryId: string;
    fulfillmentType: "in_room_delivery" | "pickup" | "appointment" | "onsite" | "instant";
    prepTimeMinutes: number | null;
    guestOrderable: boolean;
    stockQty: number | null;
}>;
export type OperatorServiceItem = z.infer<typeof OperatorServiceItem>;
export declare const OperatorServiceCategory: z.ZodObject<{
    id: z.ZodString;
    departmentId: z.ZodString;
    departmentName: z.ZodNullable<z.ZodString>;
    name: z.ZodString;
    sortOrder: z.ZodNumber;
    guestVisible: z.ZodBoolean;
    status: z.ZodEnum<["active", "archived"]>;
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        serviceCategoryId: z.ZodString;
        departmentId: z.ZodString;
        name: z.ZodString;
        description: z.ZodNullable<z.ZodString>;
        priceRwf: z.ZodNumber;
        taxCode: z.ZodEnum<["TAX_A", "TAX_B", "TAX_C", "TAX_D"]>;
        fulfillmentType: z.ZodEnum<["in_room_delivery", "pickup", "appointment", "onsite", "instant"]>;
        prepTimeMinutes: z.ZodNullable<z.ZodNumber>;
        guestOrderable: z.ZodBoolean;
        stockQty: z.ZodNullable<z.ZodNumber>;
        status: z.ZodEnum<["active", "out_of_stock", "archived"]>;
    }, "strip", z.ZodTypeAny, {
        status: "active" | "archived" | "out_of_stock";
        id: string;
        name: string;
        priceRwf: number;
        description: string | null;
        departmentId: string;
        taxCode: "TAX_A" | "TAX_B" | "TAX_C" | "TAX_D";
        serviceCategoryId: string;
        fulfillmentType: "in_room_delivery" | "pickup" | "appointment" | "onsite" | "instant";
        prepTimeMinutes: number | null;
        guestOrderable: boolean;
        stockQty: number | null;
    }, {
        status: "active" | "archived" | "out_of_stock";
        id: string;
        name: string;
        priceRwf: number;
        description: string | null;
        departmentId: string;
        taxCode: "TAX_A" | "TAX_B" | "TAX_C" | "TAX_D";
        serviceCategoryId: string;
        fulfillmentType: "in_room_delivery" | "pickup" | "appointment" | "onsite" | "instant";
        prepTimeMinutes: number | null;
        guestOrderable: boolean;
        stockQty: number | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    status: "active" | "archived";
    id: string;
    items: {
        status: "active" | "archived" | "out_of_stock";
        id: string;
        name: string;
        priceRwf: number;
        description: string | null;
        departmentId: string;
        taxCode: "TAX_A" | "TAX_B" | "TAX_C" | "TAX_D";
        serviceCategoryId: string;
        fulfillmentType: "in_room_delivery" | "pickup" | "appointment" | "onsite" | "instant";
        prepTimeMinutes: number | null;
        guestOrderable: boolean;
        stockQty: number | null;
    }[];
    name: string;
    sortOrder: number;
    departmentId: string;
    departmentName: string | null;
    guestVisible: boolean;
}, {
    status: "active" | "archived";
    id: string;
    items: {
        status: "active" | "archived" | "out_of_stock";
        id: string;
        name: string;
        priceRwf: number;
        description: string | null;
        departmentId: string;
        taxCode: "TAX_A" | "TAX_B" | "TAX_C" | "TAX_D";
        serviceCategoryId: string;
        fulfillmentType: "in_room_delivery" | "pickup" | "appointment" | "onsite" | "instant";
        prepTimeMinutes: number | null;
        guestOrderable: boolean;
        stockQty: number | null;
    }[];
    name: string;
    sortOrder: number;
    departmentId: string;
    departmentName: string | null;
    guestVisible: boolean;
}>;
export type OperatorServiceCategory = z.infer<typeof OperatorServiceCategory>;
/** The whole menu, grouped, which is the only way anyone reads it. */
export declare const OperatorServiceCatalog: z.ZodObject<{
    categories: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        departmentId: z.ZodString;
        departmentName: z.ZodNullable<z.ZodString>;
        name: z.ZodString;
        sortOrder: z.ZodNumber;
        guestVisible: z.ZodBoolean;
        status: z.ZodEnum<["active", "archived"]>;
        items: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            serviceCategoryId: z.ZodString;
            departmentId: z.ZodString;
            name: z.ZodString;
            description: z.ZodNullable<z.ZodString>;
            priceRwf: z.ZodNumber;
            taxCode: z.ZodEnum<["TAX_A", "TAX_B", "TAX_C", "TAX_D"]>;
            fulfillmentType: z.ZodEnum<["in_room_delivery", "pickup", "appointment", "onsite", "instant"]>;
            prepTimeMinutes: z.ZodNullable<z.ZodNumber>;
            guestOrderable: z.ZodBoolean;
            stockQty: z.ZodNullable<z.ZodNumber>;
            status: z.ZodEnum<["active", "out_of_stock", "archived"]>;
        }, "strip", z.ZodTypeAny, {
            status: "active" | "archived" | "out_of_stock";
            id: string;
            name: string;
            priceRwf: number;
            description: string | null;
            departmentId: string;
            taxCode: "TAX_A" | "TAX_B" | "TAX_C" | "TAX_D";
            serviceCategoryId: string;
            fulfillmentType: "in_room_delivery" | "pickup" | "appointment" | "onsite" | "instant";
            prepTimeMinutes: number | null;
            guestOrderable: boolean;
            stockQty: number | null;
        }, {
            status: "active" | "archived" | "out_of_stock";
            id: string;
            name: string;
            priceRwf: number;
            description: string | null;
            departmentId: string;
            taxCode: "TAX_A" | "TAX_B" | "TAX_C" | "TAX_D";
            serviceCategoryId: string;
            fulfillmentType: "in_room_delivery" | "pickup" | "appointment" | "onsite" | "instant";
            prepTimeMinutes: number | null;
            guestOrderable: boolean;
            stockQty: number | null;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        status: "active" | "archived";
        id: string;
        items: {
            status: "active" | "archived" | "out_of_stock";
            id: string;
            name: string;
            priceRwf: number;
            description: string | null;
            departmentId: string;
            taxCode: "TAX_A" | "TAX_B" | "TAX_C" | "TAX_D";
            serviceCategoryId: string;
            fulfillmentType: "in_room_delivery" | "pickup" | "appointment" | "onsite" | "instant";
            prepTimeMinutes: number | null;
            guestOrderable: boolean;
            stockQty: number | null;
        }[];
        name: string;
        sortOrder: number;
        departmentId: string;
        departmentName: string | null;
        guestVisible: boolean;
    }, {
        status: "active" | "archived";
        id: string;
        items: {
            status: "active" | "archived" | "out_of_stock";
            id: string;
            name: string;
            priceRwf: number;
            description: string | null;
            departmentId: string;
            taxCode: "TAX_A" | "TAX_B" | "TAX_C" | "TAX_D";
            serviceCategoryId: string;
            fulfillmentType: "in_room_delivery" | "pickup" | "appointment" | "onsite" | "instant";
            prepTimeMinutes: number | null;
            guestOrderable: boolean;
            stockQty: number | null;
        }[];
        name: string;
        sortOrder: number;
        departmentId: string;
        departmentName: string | null;
        guestVisible: boolean;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    categories: {
        status: "active" | "archived";
        id: string;
        items: {
            status: "active" | "archived" | "out_of_stock";
            id: string;
            name: string;
            priceRwf: number;
            description: string | null;
            departmentId: string;
            taxCode: "TAX_A" | "TAX_B" | "TAX_C" | "TAX_D";
            serviceCategoryId: string;
            fulfillmentType: "in_room_delivery" | "pickup" | "appointment" | "onsite" | "instant";
            prepTimeMinutes: number | null;
            guestOrderable: boolean;
            stockQty: number | null;
        }[];
        name: string;
        sortOrder: number;
        departmentId: string;
        departmentName: string | null;
        guestVisible: boolean;
    }[];
}, {
    categories: {
        status: "active" | "archived";
        id: string;
        items: {
            status: "active" | "archived" | "out_of_stock";
            id: string;
            name: string;
            priceRwf: number;
            description: string | null;
            departmentId: string;
            taxCode: "TAX_A" | "TAX_B" | "TAX_C" | "TAX_D";
            serviceCategoryId: string;
            fulfillmentType: "in_room_delivery" | "pickup" | "appointment" | "onsite" | "instant";
            prepTimeMinutes: number | null;
            guestOrderable: boolean;
            stockQty: number | null;
        }[];
        name: string;
        sortOrder: number;
        departmentId: string;
        departmentName: string | null;
        guestVisible: boolean;
    }[];
}>;
export type OperatorServiceCatalog = z.infer<typeof OperatorServiceCatalog>;
export declare const CreateServiceCategoryRequest: z.ZodObject<{
    propertyId: z.ZodString;
    departmentId: z.ZodString;
    name: z.ZodString;
    guestVisible: z.ZodOptional<z.ZodBoolean>;
    sortOrder: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    name: string;
    propertyId: string;
    departmentId: string;
    sortOrder?: number | undefined;
    guestVisible?: boolean | undefined;
}, {
    name: string;
    propertyId: string;
    departmentId: string;
    sortOrder?: number | undefined;
    guestVisible?: boolean | undefined;
}>;
export type CreateServiceCategoryRequest = z.infer<typeof CreateServiceCategoryRequest>;
/**
 * Add or change a menu item.
 *
 * Editing one never rewrites a placed order: an order snapshots the name, the
 * price and the tax code at order time (D8), so last week's bill still says
 * what last week's menu said.
 */
export declare const UpsertServiceItemRequest: z.ZodObject<{
    serviceCategoryId: z.ZodString;
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    priceRwf: z.ZodNumber;
    taxCode: z.ZodOptional<z.ZodEnum<["TAX_A", "TAX_B", "TAX_C", "TAX_D"]>>;
    fulfillmentType: z.ZodOptional<z.ZodEnum<["in_room_delivery", "pickup", "appointment", "onsite", "instant"]>>;
    prepTimeMinutes: z.ZodOptional<z.ZodNumber>;
    guestOrderable: z.ZodOptional<z.ZodBoolean>;
    stockQty: z.ZodOptional<z.ZodNumber>;
    status: z.ZodOptional<z.ZodEnum<["active", "out_of_stock", "archived"]>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    priceRwf: number;
    serviceCategoryId: string;
    status?: "active" | "archived" | "out_of_stock" | undefined;
    description?: string | undefined;
    taxCode?: "TAX_A" | "TAX_B" | "TAX_C" | "TAX_D" | undefined;
    fulfillmentType?: "in_room_delivery" | "pickup" | "appointment" | "onsite" | "instant" | undefined;
    prepTimeMinutes?: number | undefined;
    guestOrderable?: boolean | undefined;
    stockQty?: number | undefined;
}, {
    name: string;
    priceRwf: number;
    serviceCategoryId: string;
    status?: "active" | "archived" | "out_of_stock" | undefined;
    description?: string | undefined;
    taxCode?: "TAX_A" | "TAX_B" | "TAX_C" | "TAX_D" | undefined;
    fulfillmentType?: "in_room_delivery" | "pickup" | "appointment" | "onsite" | "instant" | undefined;
    prepTimeMinutes?: number | undefined;
    guestOrderable?: boolean | undefined;
    stockQty?: number | undefined;
}>;
export type UpsertServiceItemRequest = z.infer<typeof UpsertServiceItemRequest>;
export declare const OperatorServiceOrderItem: z.ZodObject<{
    id: z.ZodString;
    serviceItemId: z.ZodNullable<z.ZodString>;
    nameSnapshot: z.ZodString;
    quantity: z.ZodNumber;
    unitPriceRwf: z.ZodNumber;
    lineTotalRwf: z.ZodNumber;
    taxCode: z.ZodNullable<z.ZodEnum<["TAX_A", "TAX_B", "TAX_C", "TAX_D"]>>;
    note: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    note: string | null;
    quantity: number;
    unitPriceRwf: number;
    taxCode: "TAX_A" | "TAX_B" | "TAX_C" | "TAX_D" | null;
    serviceItemId: string | null;
    nameSnapshot: string;
    lineTotalRwf: number;
}, {
    id: string;
    note: string | null;
    quantity: number;
    unitPriceRwf: number;
    taxCode: "TAX_A" | "TAX_B" | "TAX_C" | "TAX_D" | null;
    serviceItemId: string | null;
    nameSnapshot: string;
    lineTotalRwf: number;
}>;
export type OperatorServiceOrderItem = z.infer<typeof OperatorServiceOrderItem>;
export declare const OperatorServiceOrder: z.ZodObject<{
    id: z.ZodString;
    orderNumber: z.ZodString;
    departmentId: z.ZodString;
    departmentName: z.ZodNullable<z.ZodString>;
    folioId: z.ZodNullable<z.ZodString>;
    roomId: z.ZodNullable<z.ZodString>;
    roomLabel: z.ZodNullable<z.ZodString>;
    channel: z.ZodEnum<["guest_app", "in_room_device", "front_desk", "staff", "api"]>;
    status: z.ZodEnum<["submitted", "acknowledged", "in_progress", "ready", "delivered", "completed", "cancelled", "rejected"]>;
    fulfillmentType: z.ZodEnum<["in_room_delivery", "pickup", "appointment", "onsite", "instant"]>;
    subtotalRwf: z.ZodNumber;
    taxRwf: z.ZodNumber;
    totalRwf: z.ZodNumber;
    guestNote: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        serviceItemId: z.ZodNullable<z.ZodString>;
        nameSnapshot: z.ZodString;
        quantity: z.ZodNumber;
        unitPriceRwf: z.ZodNumber;
        lineTotalRwf: z.ZodNumber;
        taxCode: z.ZodNullable<z.ZodEnum<["TAX_A", "TAX_B", "TAX_C", "TAX_D"]>>;
        note: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        note: string | null;
        quantity: number;
        unitPriceRwf: number;
        taxCode: "TAX_A" | "TAX_B" | "TAX_C" | "TAX_D" | null;
        serviceItemId: string | null;
        nameSnapshot: string;
        lineTotalRwf: number;
    }, {
        id: string;
        note: string | null;
        quantity: number;
        unitPriceRwf: number;
        taxCode: "TAX_A" | "TAX_B" | "TAX_C" | "TAX_D" | null;
        serviceItemId: string | null;
        nameSnapshot: string;
        lineTotalRwf: number;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    status: "submitted" | "rejected" | "cancelled" | "in_progress" | "acknowledged" | "ready" | "delivered" | "completed";
    id: string;
    createdAt: string;
    items: {
        id: string;
        note: string | null;
        quantity: number;
        unitPriceRwf: number;
        taxCode: "TAX_A" | "TAX_B" | "TAX_C" | "TAX_D" | null;
        serviceItemId: string | null;
        nameSnapshot: string;
        lineTotalRwf: number;
    }[];
    totalRwf: number;
    roomId: string | null;
    roomLabel: string | null;
    departmentId: string;
    departmentName: string | null;
    fulfillmentType: "in_room_delivery" | "pickup" | "appointment" | "onsite" | "instant";
    orderNumber: string;
    folioId: string | null;
    channel: "guest_app" | "in_room_device" | "front_desk" | "staff" | "api";
    subtotalRwf: number;
    taxRwf: number;
    guestNote: string | null;
}, {
    status: "submitted" | "rejected" | "cancelled" | "in_progress" | "acknowledged" | "ready" | "delivered" | "completed";
    id: string;
    createdAt: string;
    items: {
        id: string;
        note: string | null;
        quantity: number;
        unitPriceRwf: number;
        taxCode: "TAX_A" | "TAX_B" | "TAX_C" | "TAX_D" | null;
        serviceItemId: string | null;
        nameSnapshot: string;
        lineTotalRwf: number;
    }[];
    totalRwf: number;
    roomId: string | null;
    roomLabel: string | null;
    departmentId: string;
    departmentName: string | null;
    fulfillmentType: "in_room_delivery" | "pickup" | "appointment" | "onsite" | "instant";
    orderNumber: string;
    folioId: string | null;
    channel: "guest_app" | "in_room_device" | "front_desk" | "staff" | "api";
    subtotalRwf: number;
    taxRwf: number;
    guestNote: string | null;
}>;
export type OperatorServiceOrder = z.infer<typeof OperatorServiceOrder>;
export declare const OperatorServiceOrderList: z.ZodObject<{
    orders: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        orderNumber: z.ZodString;
        departmentId: z.ZodString;
        departmentName: z.ZodNullable<z.ZodString>;
        folioId: z.ZodNullable<z.ZodString>;
        roomId: z.ZodNullable<z.ZodString>;
        roomLabel: z.ZodNullable<z.ZodString>;
        channel: z.ZodEnum<["guest_app", "in_room_device", "front_desk", "staff", "api"]>;
        status: z.ZodEnum<["submitted", "acknowledged", "in_progress", "ready", "delivered", "completed", "cancelled", "rejected"]>;
        fulfillmentType: z.ZodEnum<["in_room_delivery", "pickup", "appointment", "onsite", "instant"]>;
        subtotalRwf: z.ZodNumber;
        taxRwf: z.ZodNumber;
        totalRwf: z.ZodNumber;
        guestNote: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
        items: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            serviceItemId: z.ZodNullable<z.ZodString>;
            nameSnapshot: z.ZodString;
            quantity: z.ZodNumber;
            unitPriceRwf: z.ZodNumber;
            lineTotalRwf: z.ZodNumber;
            taxCode: z.ZodNullable<z.ZodEnum<["TAX_A", "TAX_B", "TAX_C", "TAX_D"]>>;
            note: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            note: string | null;
            quantity: number;
            unitPriceRwf: number;
            taxCode: "TAX_A" | "TAX_B" | "TAX_C" | "TAX_D" | null;
            serviceItemId: string | null;
            nameSnapshot: string;
            lineTotalRwf: number;
        }, {
            id: string;
            note: string | null;
            quantity: number;
            unitPriceRwf: number;
            taxCode: "TAX_A" | "TAX_B" | "TAX_C" | "TAX_D" | null;
            serviceItemId: string | null;
            nameSnapshot: string;
            lineTotalRwf: number;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        status: "submitted" | "rejected" | "cancelled" | "in_progress" | "acknowledged" | "ready" | "delivered" | "completed";
        id: string;
        createdAt: string;
        items: {
            id: string;
            note: string | null;
            quantity: number;
            unitPriceRwf: number;
            taxCode: "TAX_A" | "TAX_B" | "TAX_C" | "TAX_D" | null;
            serviceItemId: string | null;
            nameSnapshot: string;
            lineTotalRwf: number;
        }[];
        totalRwf: number;
        roomId: string | null;
        roomLabel: string | null;
        departmentId: string;
        departmentName: string | null;
        fulfillmentType: "in_room_delivery" | "pickup" | "appointment" | "onsite" | "instant";
        orderNumber: string;
        folioId: string | null;
        channel: "guest_app" | "in_room_device" | "front_desk" | "staff" | "api";
        subtotalRwf: number;
        taxRwf: number;
        guestNote: string | null;
    }, {
        status: "submitted" | "rejected" | "cancelled" | "in_progress" | "acknowledged" | "ready" | "delivered" | "completed";
        id: string;
        createdAt: string;
        items: {
            id: string;
            note: string | null;
            quantity: number;
            unitPriceRwf: number;
            taxCode: "TAX_A" | "TAX_B" | "TAX_C" | "TAX_D" | null;
            serviceItemId: string | null;
            nameSnapshot: string;
            lineTotalRwf: number;
        }[];
        totalRwf: number;
        roomId: string | null;
        roomLabel: string | null;
        departmentId: string;
        departmentName: string | null;
        fulfillmentType: "in_room_delivery" | "pickup" | "appointment" | "onsite" | "instant";
        orderNumber: string;
        folioId: string | null;
        channel: "guest_app" | "in_room_device" | "front_desk" | "staff" | "api";
        subtotalRwf: number;
        taxRwf: number;
        guestNote: string | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    orders: {
        status: "submitted" | "rejected" | "cancelled" | "in_progress" | "acknowledged" | "ready" | "delivered" | "completed";
        id: string;
        createdAt: string;
        items: {
            id: string;
            note: string | null;
            quantity: number;
            unitPriceRwf: number;
            taxCode: "TAX_A" | "TAX_B" | "TAX_C" | "TAX_D" | null;
            serviceItemId: string | null;
            nameSnapshot: string;
            lineTotalRwf: number;
        }[];
        totalRwf: number;
        roomId: string | null;
        roomLabel: string | null;
        departmentId: string;
        departmentName: string | null;
        fulfillmentType: "in_room_delivery" | "pickup" | "appointment" | "onsite" | "instant";
        orderNumber: string;
        folioId: string | null;
        channel: "guest_app" | "in_room_device" | "front_desk" | "staff" | "api";
        subtotalRwf: number;
        taxRwf: number;
        guestNote: string | null;
    }[];
}, {
    orders: {
        status: "submitted" | "rejected" | "cancelled" | "in_progress" | "acknowledged" | "ready" | "delivered" | "completed";
        id: string;
        createdAt: string;
        items: {
            id: string;
            note: string | null;
            quantity: number;
            unitPriceRwf: number;
            taxCode: "TAX_A" | "TAX_B" | "TAX_C" | "TAX_D" | null;
            serviceItemId: string | null;
            nameSnapshot: string;
            lineTotalRwf: number;
        }[];
        totalRwf: number;
        roomId: string | null;
        roomLabel: string | null;
        departmentId: string;
        departmentName: string | null;
        fulfillmentType: "in_room_delivery" | "pickup" | "appointment" | "onsite" | "instant";
        orderNumber: string;
        folioId: string | null;
        channel: "guest_app" | "in_room_device" | "front_desk" | "staff" | "api";
        subtotalRwf: number;
        taxRwf: number;
        guestNote: string | null;
    }[];
}>;
export type OperatorServiceOrderList = z.infer<typeof OperatorServiceOrderList>;
/**
 * Place an order against a stay.
 *
 * The department is NOT asked for: it comes from the items, because an item
 * carries its own department and a caller who could choose would eventually
 * route a club sandwich to Engineering.
 */
export declare const CreateServiceOrderRequest: z.ZodObject<{
    guestStayId: z.ZodString;
    channel: z.ZodOptional<z.ZodEnum<["guest_app", "in_room_device", "front_desk", "staff", "api"]>>;
    guestNote: z.ZodOptional<z.ZodString>;
    items: z.ZodArray<z.ZodObject<{
        serviceItemId: z.ZodString;
        quantity: z.ZodNumber;
        note: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        quantity: number;
        serviceItemId: string;
        note?: string | undefined;
    }, {
        quantity: number;
        serviceItemId: string;
        note?: string | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    items: {
        quantity: number;
        serviceItemId: string;
        note?: string | undefined;
    }[];
    guestStayId: string;
    channel?: "guest_app" | "in_room_device" | "front_desk" | "staff" | "api" | undefined;
    guestNote?: string | undefined;
}, {
    items: {
        quantity: number;
        serviceItemId: string;
        note?: string | undefined;
    }[];
    guestStayId: string;
    channel?: "guest_app" | "in_room_device" | "front_desk" | "staff" | "api" | undefined;
    guestNote?: string | undefined;
}>;
export type CreateServiceOrderRequest = z.infer<typeof CreateServiceOrderRequest>;
/**
 * Move an order along its board.
 *
 * Reaching `delivered` or `completed` posts the folio charge, in the same
 * transaction, so the bill can never disagree with the board.
 */
export declare const AdvanceServiceOrderRequest: z.ZodObject<{
    to: z.ZodEnum<["submitted", "acknowledged", "in_progress", "ready", "delivered", "completed", "cancelled", "rejected"]>;
    note: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    to: "submitted" | "rejected" | "cancelled" | "in_progress" | "acknowledged" | "ready" | "delivered" | "completed";
    note?: string | undefined;
}, {
    to: "submitted" | "rejected" | "cancelled" | "in_progress" | "acknowledged" | "ready" | "delivered" | "completed";
    note?: string | undefined;
}>;
export type AdvanceServiceOrderRequest = z.infer<typeof AdvanceServiceOrderRequest>;
/**
 * Change a menu item that already exists.
 *
 * Partial, and the CATEGORY is absent on purpose: moving an item to another
 * menu would move its department too, and a bill already run against the old
 * one would then disagree with the new one. Archive it and add a new one.
 */
export declare const UpdateServiceItemRequest: z.ZodEffects<z.ZodObject<{
    status: z.ZodOptional<z.ZodOptional<z.ZodEnum<["active", "out_of_stock", "archived"]>>>;
    name: z.ZodOptional<z.ZodString>;
    priceRwf: z.ZodOptional<z.ZodNumber>;
    description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    taxCode: z.ZodOptional<z.ZodOptional<z.ZodEnum<["TAX_A", "TAX_B", "TAX_C", "TAX_D"]>>>;
    fulfillmentType: z.ZodOptional<z.ZodOptional<z.ZodEnum<["in_room_delivery", "pickup", "appointment", "onsite", "instant"]>>>;
    prepTimeMinutes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    guestOrderable: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
    stockQty: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    status?: "active" | "archived" | "out_of_stock" | undefined;
    name?: string | undefined;
    priceRwf?: number | undefined;
    description?: string | undefined;
    taxCode?: "TAX_A" | "TAX_B" | "TAX_C" | "TAX_D" | undefined;
    fulfillmentType?: "in_room_delivery" | "pickup" | "appointment" | "onsite" | "instant" | undefined;
    prepTimeMinutes?: number | undefined;
    guestOrderable?: boolean | undefined;
    stockQty?: number | undefined;
}, {
    status?: "active" | "archived" | "out_of_stock" | undefined;
    name?: string | undefined;
    priceRwf?: number | undefined;
    description?: string | undefined;
    taxCode?: "TAX_A" | "TAX_B" | "TAX_C" | "TAX_D" | undefined;
    fulfillmentType?: "in_room_delivery" | "pickup" | "appointment" | "onsite" | "instant" | undefined;
    prepTimeMinutes?: number | undefined;
    guestOrderable?: boolean | undefined;
    stockQty?: number | undefined;
}>, {
    status?: "active" | "archived" | "out_of_stock" | undefined;
    name?: string | undefined;
    priceRwf?: number | undefined;
    description?: string | undefined;
    taxCode?: "TAX_A" | "TAX_B" | "TAX_C" | "TAX_D" | undefined;
    fulfillmentType?: "in_room_delivery" | "pickup" | "appointment" | "onsite" | "instant" | undefined;
    prepTimeMinutes?: number | undefined;
    guestOrderable?: boolean | undefined;
    stockQty?: number | undefined;
}, {
    status?: "active" | "archived" | "out_of_stock" | undefined;
    name?: string | undefined;
    priceRwf?: number | undefined;
    description?: string | undefined;
    taxCode?: "TAX_A" | "TAX_B" | "TAX_C" | "TAX_D" | undefined;
    fulfillmentType?: "in_room_delivery" | "pickup" | "appointment" | "onsite" | "instant" | undefined;
    prepTimeMinutes?: number | undefined;
    guestOrderable?: boolean | undefined;
    stockQty?: number | undefined;
}>;
export type UpdateServiceItemRequest = z.infer<typeof UpdateServiceItemRequest>;
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
export declare const DepartmentPosition: z.ZodEnum<["department_head", "supervisor", "staff"]>;
export type DepartmentPosition = z.infer<typeof DepartmentPosition>;
export declare const OperatorDepartmentMember: z.ZodObject<{
    id: z.ZodString;
    departmentId: z.ZodString;
    userId: z.ZodString;
    name: z.ZodNullable<z.ZodString>;
    email: z.ZodNullable<z.ZodString>;
    departmentPosition: z.ZodEnum<["department_head", "supervisor", "staff"]>;
    /** The staffer's home department, the one their shift board defaults to. */
    isPrimary: z.ZodBoolean;
    status: z.ZodEnum<["active", "removed"]>;
}, "strip", z.ZodTypeAny, {
    status: "active" | "removed";
    id: string;
    userId: string;
    name: string | null;
    email: string | null;
    departmentId: string;
    departmentPosition: "staff" | "department_head" | "supervisor";
    isPrimary: boolean;
}, {
    status: "active" | "removed";
    id: string;
    userId: string;
    name: string | null;
    email: string | null;
    departmentId: string;
    departmentPosition: "staff" | "department_head" | "supervisor";
    isPrimary: boolean;
}>;
export type OperatorDepartmentMember = z.infer<typeof OperatorDepartmentMember>;
export declare const OperatorDepartmentMemberList: z.ZodObject<{
    members: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        departmentId: z.ZodString;
        userId: z.ZodString;
        name: z.ZodNullable<z.ZodString>;
        email: z.ZodNullable<z.ZodString>;
        departmentPosition: z.ZodEnum<["department_head", "supervisor", "staff"]>;
        /** The staffer's home department, the one their shift board defaults to. */
        isPrimary: z.ZodBoolean;
        status: z.ZodEnum<["active", "removed"]>;
    }, "strip", z.ZodTypeAny, {
        status: "active" | "removed";
        id: string;
        userId: string;
        name: string | null;
        email: string | null;
        departmentId: string;
        departmentPosition: "staff" | "department_head" | "supervisor";
        isPrimary: boolean;
    }, {
        status: "active" | "removed";
        id: string;
        userId: string;
        name: string | null;
        email: string | null;
        departmentId: string;
        departmentPosition: "staff" | "department_head" | "supervisor";
        isPrimary: boolean;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    members: {
        status: "active" | "removed";
        id: string;
        userId: string;
        name: string | null;
        email: string | null;
        departmentId: string;
        departmentPosition: "staff" | "department_head" | "supervisor";
        isPrimary: boolean;
    }[];
}, {
    members: {
        status: "active" | "removed";
        id: string;
        userId: string;
        name: string | null;
        email: string | null;
        departmentId: string;
        departmentPosition: "staff" | "department_head" | "supervisor";
        isPrimary: boolean;
    }[];
}>;
export type OperatorDepartmentMemberList = z.infer<typeof OperatorDepartmentMemberList>;
/**
 * Put somebody on a department's roster.
 *
 * Names the USER rather than the membership: the caller knows who they mean,
 * and the server resolves that person's membership of this org. A caller who
 * had to supply a membership id could supply somebody else's.
 */
export declare const AssignDepartmentMemberRequest: z.ZodObject<{
    userId: z.ZodString;
    departmentPosition: z.ZodOptional<z.ZodEnum<["department_head", "supervisor", "staff"]>>;
    isPrimary: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    userId: string;
    departmentPosition?: "staff" | "department_head" | "supervisor" | undefined;
    isPrimary?: boolean | undefined;
}, {
    userId: string;
    departmentPosition?: "staff" | "department_head" | "supervisor" | undefined;
    isPrimary?: boolean | undefined;
}>;
export type AssignDepartmentMemberRequest = z.infer<typeof AssignDepartmentMemberRequest>;
//# sourceMappingURL=ops.d.ts.map