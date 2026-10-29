import { z } from "zod";
import { LeaveAllocationRequest } from "./leave";
import { ReportedTime, reportedTimePair } from "./offline";
import { AttendancePendingReason, AttendanceRecord, EmployeeStatus, LeaveRequest, RosterCard, RosterEntry } from "./people";
/**
 * Time (ADR-058, 058-time): publishing the roster, rotations, shift and swap
 * requests, attendance requests, overtime, the attendance policy and geofence
 * of a branch, kiosks and PINs, a business's own holidays and weekly days off,
 * the late, early and monthly insights, and the self service routes a person
 * clocks in and asks through (`/me/work/*`).
 *
 * The no ranking rule (index contract 7) shapes the insights: rows come in
 * name order and a figure is never a sort key, a threshold or a colour.
 */
const Uuid = z.string().uuid();
const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "A date is YYYY-MM-DD.");
const IsoMonth = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "A month is YYYY-MM.");
const Instant = z.string().datetime({ offset: true, message: "A time is an ISO instant." });
const Reason = z.string().trim().min(3, "Say why.").max(500);
const Note = z.string().trim().max(500);
/** At most a month: a range wider than that is a mistake, not a roster. */
function rangeRefine<T extends { from: string; to: string }>(b: T, ctx: z.RefinementCtx): void {
    if (b.to < b.from)
        ctx.addIssue({ code: "custom", message: "The range ends before it starts.", path: ["to"] });
    else if (Date.parse(`${b.to}T00:00:00Z`) - Date.parse(`${b.from}T00:00:00Z`) > 30 * 86_400_000)
        ctx.addIssue({ code: "custom", message: "Choose at most 31 days.", path: ["to"] });
}
// ---------------------------------------------------------------------------
// Publishing (AC-TM1)
// ---------------------------------------------------------------------------
/** `POST /ops/roster/publish`: every draft of a branch (and a department) in the range. */
export const PublishRosterRequest = z
    .object({
    propertyId: Uuid,
    departmentId: Uuid.nullable().optional(),
    from: IsoDate,
    to: IsoDate,
})
    .superRefine(rangeRefine);
export type PublishRosterRequest = z.infer<typeof PublishRosterRequest>;
export const RosterPublication = z.object({
    id: Uuid,
    propertyId: Uuid,
    departmentId: Uuid.nullable(),
    fromDate: IsoDate,
    toDate: IsoDate,
    entryCount: z.number().int(),
    publishedAt: z.string(),
    publishedByName: z.string().nullable(),
});
export type RosterPublication = z.infer<typeof RosterPublication>;
export const RosterPublicationList = z.object({ publications: z.array(RosterPublication) });
export type RosterPublicationList = z.infer<typeof RosterPublicationList>;
/** `GET /ops/roster/week`: one branch's entries for seven days, drafts included, for the week grid. */
export const RosterWeek = z.object({
    propertyId: Uuid,
    from: IsoDate,
    to: IsoDate,
    entries: z.array(RosterEntry),
    /** The publishes that touched the week, newest first. */
    publications: z.array(RosterPublication),
});
export type RosterWeek = z.infer<typeof RosterWeek>;
/** `GET /ops/roster/week`: any day of the week wanted; the week runs Monday to Sunday. */
export const RosterWeekQuery = z.object({ propertyId: Uuid, from: IsoDate.optional() });
export type RosterWeekQuery = z.infer<typeof RosterWeekQuery>;
// ---------------------------------------------------------------------------
// Rotations (AC-TM3)
// ---------------------------------------------------------------------------
export const RotationRule = z.enum(["every_n_days", "weekly", "monthly"]);
export type RotationRule = z.infer<typeof RotationRule>;
/** A step is a shift template of the branch, or a day off. */
export const RotationStep = z.union([Uuid, z.literal("off")]);
export type RotationStep = z.infer<typeof RotationStep>;
export const RotationPatternStatus = z.enum(["active", "archived"]);
export type RotationPatternStatus = z.infer<typeof RotationPatternStatus>;
export const RotationPattern = z.object({
    id: Uuid,
    propertyId: Uuid,
    name: z.string(),
    steps: z.array(RotationStep),
    /** Each step's shift name, or "Off", in order. */
    stepNames: z.array(z.string()),
    rule: RotationRule,
    ruleValue: z.number().int(),
    status: RotationPatternStatus,
    /** People on it now. */
    openAssignments: z.number().int(),
});
export type RotationPattern = z.infer<typeof RotationPattern>;
export const RotationPatternList = z.object({ patterns: z.array(RotationPattern) });
export type RotationPatternList = z.infer<typeof RotationPatternList>;
export const RotationPatternQuery = z.object({ propertyId: Uuid.optional() });
export type RotationPatternQuery = z.infer<typeof RotationPatternQuery>;
function ruleRefine(b: { rule?: RotationRule; ruleValue?: number }, ctx: z.RefinementCtx): void {
    if (b.rule === undefined || b.ruleValue === undefined)
        return;
    const ok = b.rule === "weekly" ? b.ruleValue >= 0 && b.ruleValue <= 6 : b.ruleValue >= 1 && b.ruleValue <= 28;
    if (!ok) {
        ctx.addIssue({
            code: "custom",
            path: ["ruleValue"],
            message: b.rule === "weekly"
                ? "Choose the weekday the step moves on."
                : b.rule === "monthly"
                    ? "Choose a day of the month from 1 to 28."
                    : "Move every 1 to 28 days.",
        });
    }
}
export const CreateRotationPatternRequest = z
    .object({
    propertyId: Uuid,
    name: z.string().trim().min(1, "Name the rotation.").max(60),
    steps: z.array(RotationStep).min(2, "A rotation has at least two steps.").max(28),
    rule: RotationRule,
    ruleValue: z.number().int(),
})
    .superRefine(ruleRefine);
export type CreateRotationPatternRequest = z.infer<typeof CreateRotationPatternRequest>;
/**
 * `PATCH /ops/rotation-patterns/:id`. The steps and the rule of a pattern
 * someone is on never change: their generated drafts follow it, so a new
 * pattern is a new row (058-time, calls made while building).
 */
export const UpdateRotationPatternRequest = z
    .object({
    name: z.string().trim().min(1).max(60),
    status: RotationPatternStatus,
})
    .partial()
    .refine((b) => Object.keys(b).length > 0, { message: "Nothing to change." });
export type UpdateRotationPatternRequest = z.infer<typeof UpdateRotationPatternRequest>;
export const RotationAssignment = z.object({
    id: Uuid,
    employee: RosterCard,
    patternId: Uuid,
    patternName: z.string(),
    propertyId: Uuid,
    startsOn: IsoDate,
    endsOn: IsoDate.nullable(),
    startStep: z.number().int(),
});
export type RotationAssignment = z.infer<typeof RotationAssignment>;
export const RotationAssignmentList = z.object({ assignments: z.array(RotationAssignment) });
export type RotationAssignmentList = z.infer<typeof RotationAssignmentList>;
/** Running assignments, unless ended ones are asked for too. */
export const RotationAssignmentQuery = z.object({
    patternId: Uuid.optional(),
    includeEnded: z.enum(["true", "false"]).optional(),
});
export type RotationAssignmentQuery = z.infer<typeof RotationAssignmentQuery>;
export const CreateRotationAssignmentRequest = z.object({
    employeeId: Uuid,
    patternId: Uuid,
    startsOn: IsoDate,
    /** Which step the person is on on `startsOn`, from 0. */
    startStep: z.number().int().min(0).max(27).optional(),
});
export type CreateRotationAssignmentRequest = z.infer<typeof CreateRotationAssignmentRequest>;
/** Ending an assignment cancels the drafts it generated after its last day. */
export const EndRotationAssignmentRequest = z.object({ endsOn: IsoDate });
export type EndRotationAssignmentRequest = z.infer<typeof EndRotationAssignmentRequest>;
// ---------------------------------------------------------------------------
// Shift and swap requests (AC-TM5)
// ---------------------------------------------------------------------------
export const ShiftRequestKind = z.enum(["change", "swap"]);
export type ShiftRequestKind = z.infer<typeof ShiftRequestKind>;
export const ShiftRequestStatus = z.enum(["requested", "awaiting_colleague", "approved", "rejected", "cancelled"]);
export type ShiftRequestStatus = z.infer<typeof ShiftRequestStatus>;
export const ShiftRequest = z.object({
    id: Uuid,
    employee: RosterCard,
    branchId: Uuid.nullable(),
    kind: ShiftRequestKind,
    shiftTemplate: z.object({ id: Uuid, name: z.string() }).nullable(),
    swapWith: RosterCard.nullable(),
    fromDate: IsoDate,
    toDate: IsoDate,
    reason: z.string(),
    status: ShiftRequestStatus,
    colleagueAcceptedAt: z.string().nullable(),
    routedTo: RosterCard.nullable(),
    /** Routed to the caller's own file. */
    routedToMe: z.boolean(),
    decidedAt: z.string().nullable(),
    decidedByName: z.string().nullable(),
    decisionNote: z.string().nullable(),
    createdAt: z.string(),
});
export type ShiftRequest = z.infer<typeof ShiftRequest>;
const ShiftRange = z.object({ from: IsoDate, to: IsoDate, reason: Reason });
/** `POST /ops/shift-requests`: on someone's behalf. A swap names a colleague at the same branch. */
export const CreateShiftRequestRequest = z.discriminatedUnion("kind", [
    ShiftRange.extend({ kind: z.literal("change"), employeeId: Uuid, shiftTemplateId: Uuid }),
    ShiftRange.extend({ kind: z.literal("swap"), employeeId: Uuid, swapEmployeeId: Uuid }),
]).superRefine(rangeRefine);
export type CreateShiftRequestRequest = z.infer<typeof CreateShiftRequestRequest>;
/** The same, raised by the person through self service: their own file is the path. */
export const CreateMyShiftRequestRequest = z.discriminatedUnion("kind", [
    ShiftRange.extend({ kind: z.literal("change"), shiftTemplateId: Uuid }),
    ShiftRange.extend({ kind: z.literal("swap"), swapEmployeeId: Uuid }),
]).superRefine(rangeRefine);
export type CreateMyShiftRequestRequest = z.infer<typeof CreateMyShiftRequestRequest>;
export const DecideRequestBody = z.object({ note: Note.nullable().optional() });
export type DecideRequestBody = z.infer<typeof DecideRequestBody>;
// ---------------------------------------------------------------------------
// Attendance requests and overtime (AC-TM6, AC-TM8)
// ---------------------------------------------------------------------------
export const AttendanceRequestStatus = z.enum(["requested", "approved", "rejected", "cancelled"]);
export type AttendanceRequestStatus = z.infer<typeof AttendanceRequestStatus>;
export const AttendanceRequest = z.object({
    id: Uuid,
    employee: RosterCard,
    branchId: Uuid.nullable(),
    workDate: IsoDate,
    clockInAt: z.string(),
    clockOutAt: z.string(),
    /** The record it would put right; null asks for a missing one. */
    recordId: Uuid.nullable(),
    reason: z.string(),
    status: AttendanceRequestStatus,
    routedTo: RosterCard.nullable(),
    routedToMe: z.boolean(),
    decidedAt: z.string().nullable(),
    decidedByName: z.string().nullable(),
    decisionNote: z.string().nullable(),
    resultRecordId: Uuid.nullable(),
    createdAt: z.string(),
    /** What backs the times asked for: a work order closed, a handover note signed. */
    evidence: z.string().nullable().optional(),
    /** The line manager who confirmed the times before the request reached the office. */
    managerConfirmedByName: z.string().nullable().optional(),
    managerConfirmedAt: z.string().nullable().optional(),
    /** The record as it stands, so a reader sees what would change. */
    recordClockInAt: z.string().nullable().optional(),
    recordClockOutAt: z.string().nullable().optional(),
});
export type AttendanceRequest = z.infer<typeof AttendanceRequest>;
const AttendanceAsk = z
    .object({
    workDate: IsoDate,
    clockInAt: Instant,
    clockOutAt: Instant,
    recordId: Uuid.nullable().optional(),
    reason: Reason,
})
    .refine((b) => Date.parse(b.clockOutAt) > Date.parse(b.clockInAt), {
    message: "The clock out must come after the clock in.",
    path: ["clockOutAt"],
});
/** `POST /ops/attendance-requests`: on someone's behalf (`attendance.record`). */
export const CreateAttendanceRequestRequest = z.intersection(AttendanceAsk, z.object({ employeeId: Uuid }));
export type CreateAttendanceRequestRequest = z.infer<typeof CreateAttendanceRequestRequest>;
/** The same through self service. */
export const CreateMyAttendanceRequestRequest = AttendanceAsk;
export type CreateMyAttendanceRequestRequest = z.infer<typeof CreateMyAttendanceRequestRequest>;
/** `POST /ops/attendance/:id/overtime`: approve all of it, or less (AC-TM8). */
export const DecideOvertimeRequest = z.object({
    approvedMinutes: z.number().int().min(0).max(1440),
    note: Note.nullable().optional(),
});
export type DecideOvertimeRequest = z.infer<typeof DecideOvertimeRequest>;
// ---------------------------------------------------------------------------
// The attendance policy and the geofence (AC-TM4, AC-TM7 to AC-TM9)
// ---------------------------------------------------------------------------
const PolicyFields = z.object({
    graceInMinutes: z.number().int().min(0).max(240),
    graceOutMinutes: z.number().int().min(0).max(240),
    overtimeCutoffMinutes: z.number().int().min(0).max(1440).nullable(),
    overtimeAutoApprove: z.boolean(),
    overtimeMinMinutes: z.number().int().min(0).max(1440),
    linkWindowMinutes: z.number().int().min(0).max(720),
    staleOpenHours: z.number().int().min(1).max(72),
    defaultShiftMinutes: z.number().int().min(30).max(1440),
    /** 058-leave AC-LV8: minutes on a worked holiday or day off that earn a whole compensatory day; half of it earns half. */
    compensationThresholdMinutes: z.number().int().min(30).max(1440),
});
export const AttendancePolicy = PolicyFields.extend({
    /** Null: the business default every branch without its own row follows. */
    propertyId: Uuid.nullable(),
    /** False when nothing is saved and these are the built in defaults. */
    saved: z.boolean(),
});
export type AttendancePolicy = z.infer<typeof AttendancePolicy>;
const Centre = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });
export const BranchClockSettings = z.object({
    propertyId: Uuid,
    branchName: z.string(),
    geofenceRadiusM: z.number().int(),
    /** The geofence's own centre, set here: where staff clock in, when that is not the map pin. */
    centre: Centre.nullable(),
    /** The property's own map pin is known, and is the centre when none is set here. */
    propertyHasCoordinates: z.boolean(),
    /** Some centre is known. Without one, every phone punch waits for validation. */
    hasCoordinates: z.boolean(),
});
export type BranchClockSettings = z.infer<typeof BranchClockSettings>;
/** `GET /ops/attendance/policies`: the business default, each branch's own, and each branch's geofence. */
export const AttendanceSettings = z.object({
    policies: z.array(AttendancePolicy),
    clock: z.array(BranchClockSettings),
});
export type AttendanceSettings = z.infer<typeof AttendanceSettings>;
export const PutAttendancePolicyRequest = PolicyFields.extend({
    propertyId: Uuid.nullable(),
    /** Left out, the row keeps what it had. */
    compensationThresholdMinutes: z.number().int().min(30).max(1440).optional(),
});
export type PutAttendancePolicyRequest = z.infer<typeof PutAttendancePolicyRequest>;
/** The radius, and the centre: null clears it back to the property's pin, absent leaves it. */
export const PutBranchClockSettingsRequest = z.object({
    geofenceRadiusM: z.number().int().min(25).max(2000),
    centre: Centre.nullable().optional(),
});
export type PutBranchClockSettingsRequest = z.infer<typeof PutBranchClockSettingsRequest>;
// ---------------------------------------------------------------------------
// Kiosks and PINs (AC-TM10, AC-TM11)
// ---------------------------------------------------------------------------
export const KioskStatus = z.enum(["pairing", "active", "revoked"]);
export type KioskStatus = z.infer<typeof KioskStatus>;
const IpAddress = z.string().trim().regex(/^[0-9a-fA-F:.]{2,45}$/, "That is not an IP address.");
export const Kiosk = z.object({
    id: Uuid,
    propertyId: Uuid,
    branchName: z.string(),
    name: z.string(),
    status: KioskStatus,
    allowedIps: z.array(z.string()),
    lastSeenAt: z.string().nullable(),
    pairingExpiresAt: z.string().nullable(),
    createdAt: z.string(),
});
export type Kiosk = z.infer<typeof Kiosk>;
export const KioskList = z.object({ kiosks: z.array(Kiosk) });
export type KioskList = z.infer<typeof KioskList>;
export const CreateKioskRequest = z.object({
    propertyId: Uuid,
    name: z.string().trim().min(1, "Name the kiosk.").max(60),
    allowedIps: z.array(IpAddress).max(20).optional(),
});
export type CreateKioskRequest = z.infer<typeof CreateKioskRequest>;
/** The pairing code is shown once, here, and lives ten minutes. */
export const KioskPairingCode = z.object({
    kiosk: Kiosk,
    pairingCode: z.string(),
    expiresAt: z.string(),
});
export type KioskPairingCode = z.infer<typeof KioskPairingCode>;
export const UnlockKioskPinRequest = z.object({ employeeId: Uuid });
export type UnlockKioskPinRequest = z.infer<typeof UnlockKioskPinRequest>;
const Pin = z.string().regex(/^\d{4,6}$/, "A PIN is 4 to 6 digits.");
/** `PUT /ops/employees/:id/kiosk-pin`: set or reset. Never shown again. */
export const SetKioskPinRequest = z.object({ pin: Pin });
export type SetKioskPinRequest = z.infer<typeof SetKioskPinRequest>;
/** `PUT /me/work/:employeeId/kiosk-pin`: the current PIN proves it is them. */
export const ChangeMyKioskPinRequest = z.object({ currentPin: Pin, pin: Pin });
export type ChangeMyKioskPinRequest = z.infer<typeof ChangeMyKioskPinRequest>;
export const KioskPinState = z.object({ hasPin: z.boolean(), setAt: z.string().nullable() });
export type KioskPinState = z.infer<typeof KioskPinState>;
/** `POST /kiosk/pair`: the tablet trades the code for its device cookie. */
export const KioskPairRequest = z.object({ code: z.string().trim().regex(/^\d{8}$/, "The code is 8 digits.") });
export type KioskPairRequest = z.infer<typeof KioskPairRequest>;
/** `GET /kiosk/session`: the branch, and never a list of people. */
export const KioskSession = z.object({ kioskName: z.string(), branchName: z.string() });
export type KioskSession = z.infer<typeof KioskSession>;
export const KioskPunchRequest = z.object({
    employeeNumber: z.string().trim().min(1, "Type your employee number.").max(20),
    pin: Pin,
});
export type KioskPunchRequest = z.infer<typeof KioskPunchRequest>;
/** Only after a correct PIN does the kiosk learn a name, to confirm the punch with. */
export const KioskPunchResult = z.object({
    displayName: z.string(),
    direction: z.enum(["in", "out"]),
    at: z.string(),
});
export type KioskPunchResult = z.infer<typeof KioskPunchResult>;
// ---------------------------------------------------------------------------
// Holidays and weekly days off (AC-TM12)
// ---------------------------------------------------------------------------
export const OrgHoliday = z.object({
    id: Uuid,
    /** Null: every branch. */
    propertyId: Uuid.nullable(),
    name: z.string(),
    fromDate: IsoDate,
    toDate: IsoDate,
    recurringYearly: z.boolean(),
});
export type OrgHoliday = z.infer<typeof OrgHoliday>;
export const OrgHolidayList = z.object({ holidays: z.array(OrgHoliday) });
export type OrgHolidayList = z.infer<typeof OrgHolidayList>;
export const CreateOrgHolidayRequest = z
    .object({
    propertyId: Uuid.nullable().optional(),
    name: z.string().trim().min(2, "Name the holiday.").max(80),
    fromDate: IsoDate,
    toDate: IsoDate,
    recurringYearly: z.boolean().optional(),
})
    .refine((b) => b.toDate >= b.fromDate, { message: "It ends before it starts.", path: ["toDate"] });
export type CreateOrgHolidayRequest = z.infer<typeof CreateOrgHolidayRequest>;
export const UpdateOrgHolidayRequest = z
    .object({
    name: z.string().trim().min(2).max(80),
    fromDate: IsoDate,
    toDate: IsoDate,
    recurringYearly: z.boolean(),
})
    .partial()
    .refine((b) => Object.keys(b).length > 0, { message: "Nothing to change." });
export type UpdateOrgHolidayRequest = z.infer<typeof UpdateOrgHolidayRequest>;
const WeekOfMonth = z.number().int().min(1).max(5);
export const WeeklyOff = z.object({
    id: Uuid,
    propertyId: Uuid.nullable(),
    /** 0 Sunday to 6 Saturday. */
    weekday: z.number().int().min(0).max(6),
    /** Empty: every week; else which weeks of the month. */
    weeks: z.array(WeekOfMonth),
});
export type WeeklyOff = z.infer<typeof WeeklyOff>;
export const WeeklyOffList = z.object({ weeklyOffs: z.array(WeeklyOff) });
export type WeeklyOffList = z.infer<typeof WeeklyOffList>;
export const CreateWeeklyOffRequest = z.object({
    propertyId: Uuid.nullable().optional(),
    weekday: z.number().int().min(0).max(6),
    weeks: z.array(WeekOfMonth).max(5).optional(),
});
export type CreateWeeklyOffRequest = z.infer<typeof CreateWeeklyOffRequest>;
export const UpdateWeeklyOffRequest = z.object({ weeks: z.array(WeekOfMonth).max(5) });
export type UpdateWeeklyOffRequest = z.infer<typeof UpdateWeeklyOffRequest>;
// ---------------------------------------------------------------------------
// Insights (AC-TM13): to the person, their reporting manager and people.manage
// ---------------------------------------------------------------------------
export const LateEarlyRow = z.object({
    recordId: Uuid,
    employee: RosterCard,
    workDate: IsoDate,
    shiftName: z.string().nullable(),
    lateMinutes: z.number().int(),
    earlyMinutes: z.number().int(),
});
export type LateEarlyRow = z.infer<typeof LateEarlyRow>;
/** Rows by name, then date: never by a figure. */
export const LateEarlyReport = z.object({ from: IsoDate, to: IsoDate, rows: z.array(LateEarlyRow) });
export type LateEarlyReport = z.infer<typeof LateEarlyReport>;
export const MonthlySummaryRow = z.object({
    employee: RosterCard,
    daysWorked: z.number().int(),
    workedMinutes: z.number().int(),
    /** The rostered minutes of the month, breaks taken off. */
    expectedMinutes: z.number().int(),
    overtimeMinutes: z.number().int(),
    approvedOvertimeMinutes: z.number().int(),
    lateCount: z.number().int(),
    earlyCount: z.number().int(),
});
export type MonthlySummaryRow = z.infer<typeof MonthlySummaryRow>;
export const MonthlySummary = z.object({ month: IsoMonth, rows: z.array(MonthlySummaryRow) });
export type MonthlySummary = z.infer<typeof MonthlySummary>;
export const InsightsQuery = z.object({ from: IsoDate, to: IsoDate, propertyId: Uuid.optional() }).superRefine(rangeRefine);
export type InsightsQuery = z.infer<typeof InsightsQuery>;
export const MonthlyQuery = z.object({ month: IsoMonth, propertyId: Uuid.optional() });
export type MonthlyQuery = z.infer<typeof MonthlyQuery>;
// ---------------------------------------------------------------------------
// Self service: /me/work (058-self-service, the routes marked 4)
// ---------------------------------------------------------------------------
/**
 * One file the caller holds at a business (AC-SS1). A file the person has left
 * stays listed and readable, and refuses every write (409).
 */
export const MyWorkFile = z.object({
    employeeId: Uuid,
    orgId: Uuid,
    businessName: z.string(),
    displayName: z.string(),
    employeeNumber: z.string(),
    branchName: z.string().nullable(),
    jobPositionTitle: z.string().nullable(),
    status: EmployeeStatus,
    /** Somebody's reporting manager: the team routes answer for them. */
    hasReports: z.boolean(),
    /** An open clock in, when there is one. */
    openRecord: z.object({ id: Uuid, clockInAt: z.string() }).nullable(),
});
export type MyWorkFile = z.infer<typeof MyWorkFile>;
export const MyWorkFileList = z.object({ files: z.array(MyWorkFile) });
export type MyWorkFileList = z.infer<typeof MyWorkFileList>;
/**
 * `POST /me/work/:employeeId/clock-in` and `/clock-out`: where the phone says it
 * is, and when the tap really happened (mobile spec 0003, `ReportedTime`).
 */
export const PhoneClockRequest = z
    .object({
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
    accuracyM: z.number().min(0).max(100_000).optional(),
})
    .merge(ReportedTime)
    .superRefine(reportedTimePair);
export type PhoneClockRequest = z.infer<typeof PhoneClockRequest>;
/** What a phone punch came to: the record, and whether it waits for validation and why. */
export const PhoneClockResult = z.object({
    record: AttendanceRecord,
    validated: z.boolean(),
    /** Why it waits, in words; null when validated. */
    pendingReason: z.string().nullable(),
    distanceM: z.number().int().nullable(),
});
export type PhoneClockResult = z.infer<typeof PhoneClockResult>;
/** One published shift on the phone's shift card, with its template's planned break. */
export const MyWorkTodayShift = z.object({
    rosterEntryId: Uuid,
    shiftName: z.string(),
    startsAt: z.string(),
    endsAt: z.string(),
    /** The template's planned break: what paid hours use, whatever breaks are recorded. */
    breakMinutes: z.number().int().min(0),
    propertyId: Uuid,
});
export type MyWorkTodayShift = z.infer<typeof MyWorkTodayShift>;
/**
 * `GET /me/work/:employeeId/today`: the phone's shift card in one read (mobile
 * spec 0003, D-u). `shifts` holds the published, scheduled entries of today's
 * Kigali work date, every one that overlaps the two hours either side of now
 * (a night shift that crossed midnight), and the open record's own entry, by
 * `startsAt`. `generatedAt` is the server's clock, for the phone's overlay.
 */
export const MyWorkToday = z.object({
    employeeId: Uuid,
    workDate: IsoDate,
    generatedAt: z.string(),
    shifts: z.array(MyWorkTodayShift),
    openRecord: z
        .object({
        id: Uuid,
        rosterEntryId: Uuid.nullable(),
        workDate: IsoDate,
        clockInAt: z.string(),
        validated: z.boolean(),
        pendingReason: AttendancePendingReason.nullable(),
    })
        .nullable(),
    /** The open break; breaks arrive with milestone 3, so null until then. */
    openBreak: z.object({ id: Uuid, startedAt: z.string() }).nullable(),
    /** The latest clock out of this work day, when one closed. */
    lastClockOutAt: z.string().nullable(),
});
export type MyWorkToday = z.infer<typeof MyWorkToday>;
export const RangeQuery = z.object({ from: IsoDate, to: IsoDate }).superRefine(rangeRefine);
export type RangeQuery = z.infer<typeof RangeQuery>;
/** `GET /me/work/:employeeId/roster`: published entries only (AC-TM2). */
export const MyRoster = z.object({ from: IsoDate, to: IsoDate, entries: z.array(RosterEntry) });
export type MyRoster = z.infer<typeof MyRoster>;
export const MyShiftRequestList = z.object({
    /** What the person asked. */
    mine: z.array(ShiftRequest),
    /** Swaps colleagues asked of them, waiting for an answer. */
    askedOfMe: z.array(ShiftRequest),
});
export type MyShiftRequestList = z.infer<typeof MyShiftRequestList>;
export const MyAttendance = z.object({
    from: IsoDate,
    to: IsoDate,
    records: z.array(AttendanceRecord),
    requests: z.array(AttendanceRequest),
});
export type MyAttendance = z.infer<typeof MyAttendance>;
export const MyAttendanceRequestList = z.object({ requests: z.array(AttendanceRequest) });
export type MyAttendanceRequestList = z.infer<typeof MyAttendanceRequestList>;
export const MonthQuery = z.object({ month: IsoMonth });
export type MonthQuery = z.infer<typeof MonthQuery>;
/** One person's month: their own figures, never a colleague's. */
export const MyMonthlySummary = z.object({ month: IsoMonth, summary: MonthlySummaryRow.omit({ employee: true }) });
export type MyMonthlySummary = z.infer<typeof MyMonthlySummary>;
/** `GET /me/work/:employeeId/team`: direct reports, roster cards only (AC-SS15). */
export const MyTeam = z.object({ reports: z.array(RosterCard) });
export type MyTeam = z.infer<typeof MyTeam>;
export const MyTeamRoster = z.object({ from: IsoDate, to: IsoDate, entries: z.array(RosterEntry) });
export type MyTeamRoster = z.infer<typeof MyTeamRoster>;
export const MyTeamAttendance = z.object({
    from: IsoDate,
    to: IsoDate,
    records: z.array(AttendanceRecord),
    /** Each report's month when the range is one month; else empty. */
    summaries: z.array(MonthlySummaryRow),
});
export type MyTeamAttendance = z.infer<typeof MyTeamAttendance>;
/** Which requests routed to a manager to read: a swap is a shift request that names a colleague. */
export const TeamRequestKind = z.enum(["shift", "swap", "attendance", "leave", "allocation"]);
export type TeamRequestKind = z.infer<typeof TeamRequestKind>;
export const TeamRequestsQuery = z.object({
    kind: TeamRequestKind.optional(),
    status: z.string().trim().max(40).optional(),
});
export type TeamRequestsQuery = z.infer<typeof TeamRequestsQuery>;
/** Requests routed to the caller, whatever kind, with their state: nothing here decides. */
export const MyTeamRequests = z.object({
    shift: z.array(ShiftRequest),
    attendance: z.array(AttendanceRequest),
    /** 058-leave: leave and allocation requests routed to the caller. */
    leave: z.array(LeaveRequest),
    allocation: z.array(LeaveAllocationRequest),
});
export type MyTeamRequests = z.infer<typeof MyTeamRequests>;
