"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateOrgHolidayRequest = exports.OrgHolidayList = exports.OrgHoliday = exports.KioskPunchResult = exports.KioskPunchRequest = exports.KioskSession = exports.KioskPairRequest = exports.KioskPinState = exports.ChangeMyKioskPinRequest = exports.SetKioskPinRequest = exports.UnlockKioskPinRequest = exports.KioskPairingCode = exports.CreateKioskRequest = exports.KioskList = exports.Kiosk = exports.KioskStatus = exports.PutBranchClockSettingsRequest = exports.PutAttendancePolicyRequest = exports.AttendanceSettings = exports.BranchClockSettings = exports.AttendancePolicy = exports.DecideOvertimeRequest = exports.CreateMyAttendanceRequestRequest = exports.CreateAttendanceRequestRequest = exports.AttendanceRequest = exports.AttendanceRequestStatus = exports.DecideRequestBody = exports.CreateMyShiftRequestRequest = exports.CreateShiftRequestRequest = exports.ShiftRequest = exports.ShiftRequestStatus = exports.ShiftRequestKind = exports.EndRotationAssignmentRequest = exports.CreateRotationAssignmentRequest = exports.RotationAssignmentQuery = exports.RotationAssignmentList = exports.RotationAssignment = exports.UpdateRotationPatternRequest = exports.CreateRotationPatternRequest = exports.RotationPatternQuery = exports.RotationPatternList = exports.RotationPattern = exports.RotationPatternStatus = exports.RotationStep = exports.RotationRule = exports.RosterWeekQuery = exports.RosterWeek = exports.RosterPublicationList = exports.RosterPublication = exports.PublishRosterRequest = void 0;
exports.MyTeamRequests = exports.TeamRequestsQuery = exports.TeamRequestKind = exports.MyTeamAttendance = exports.MyTeamRoster = exports.MyTeam = exports.MyMonthlySummary = exports.MonthQuery = exports.MyAttendanceRequestList = exports.MyAttendance = exports.MyShiftOptions = exports.MyShiftRequestList = exports.MyRoster = exports.RangeQuery = exports.PhoneClockResult = exports.PhoneClockRequest = exports.MyWorkFileList = exports.MyWorkFile = exports.MonthlyQuery = exports.InsightsQuery = exports.MonthlySummary = exports.MonthlySummaryRow = exports.LateEarlyReport = exports.LateEarlyRow = exports.UpdateWeeklyOffRequest = exports.CreateWeeklyOffRequest = exports.WeeklyOffList = exports.WeeklyOff = exports.UpdateOrgHolidayRequest = void 0;
const zod_1 = require("zod");
const leave_1 = require("./leave");
const people_1 = require("./people");
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
const Uuid = zod_1.z.string().uuid();
const IsoDate = zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "A date is YYYY-MM-DD.");
const IsoMonth = zod_1.z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "A month is YYYY-MM.");
const Instant = zod_1.z.string().datetime({ offset: true, message: "A time is an ISO instant." });
const Reason = zod_1.z.string().trim().min(3, "Say why.").max(500);
const Note = zod_1.z.string().trim().max(500);
/** At most a month: a range wider than that is a mistake, not a roster. */
function rangeRefine(b, ctx) {
    if (b.to < b.from)
        ctx.addIssue({ code: "custom", message: "The range ends before it starts.", path: ["to"] });
    else if (Date.parse(`${b.to}T00:00:00Z`) - Date.parse(`${b.from}T00:00:00Z`) > 30 * 86400000)
        ctx.addIssue({ code: "custom", message: "Choose at most 31 days.", path: ["to"] });
}
// ---------------------------------------------------------------------------
// Publishing (AC-TM1)
// ---------------------------------------------------------------------------
/** `POST /ops/roster/publish`: every draft of a branch (and a department) in the range. */
exports.PublishRosterRequest = zod_1.z
    .object({
    propertyId: Uuid,
    departmentId: Uuid.nullable().optional(),
    from: IsoDate,
    to: IsoDate,
})
    .superRefine(rangeRefine);
exports.RosterPublication = zod_1.z.object({
    id: Uuid,
    propertyId: Uuid,
    departmentId: Uuid.nullable(),
    fromDate: IsoDate,
    toDate: IsoDate,
    entryCount: zod_1.z.number().int(),
    publishedAt: zod_1.z.string(),
    publishedByName: zod_1.z.string().nullable(),
});
exports.RosterPublicationList = zod_1.z.object({ publications: zod_1.z.array(exports.RosterPublication) });
/** `GET /ops/roster/week`: one branch's entries for seven days, drafts included, for the week grid. */
exports.RosterWeek = zod_1.z.object({
    propertyId: Uuid,
    from: IsoDate,
    to: IsoDate,
    entries: zod_1.z.array(people_1.RosterEntry),
    /** The publishes that touched the week, newest first. */
    publications: zod_1.z.array(exports.RosterPublication),
});
/** `GET /ops/roster/week`: any day of the week wanted; the week runs Monday to Sunday. */
exports.RosterWeekQuery = zod_1.z.object({ propertyId: Uuid, from: IsoDate.optional() });
// ---------------------------------------------------------------------------
// Rotations (AC-TM3)
// ---------------------------------------------------------------------------
exports.RotationRule = zod_1.z.enum(["every_n_days", "weekly", "monthly"]);
/** A step is a shift template of the branch, or a day off. */
exports.RotationStep = zod_1.z.union([Uuid, zod_1.z.literal("off")]);
exports.RotationPatternStatus = zod_1.z.enum(["active", "archived"]);
exports.RotationPattern = zod_1.z.object({
    id: Uuid,
    propertyId: Uuid,
    name: zod_1.z.string(),
    steps: zod_1.z.array(exports.RotationStep),
    /** Each step's shift name, or "Off", in order. */
    stepNames: zod_1.z.array(zod_1.z.string()),
    rule: exports.RotationRule,
    ruleValue: zod_1.z.number().int(),
    status: exports.RotationPatternStatus,
    /** People on it now. */
    openAssignments: zod_1.z.number().int(),
});
exports.RotationPatternList = zod_1.z.object({ patterns: zod_1.z.array(exports.RotationPattern) });
exports.RotationPatternQuery = zod_1.z.object({ propertyId: Uuid.optional() });
function ruleRefine(b, ctx) {
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
exports.CreateRotationPatternRequest = zod_1.z
    .object({
    propertyId: Uuid,
    name: zod_1.z.string().trim().min(1, "Name the rotation.").max(60),
    steps: zod_1.z.array(exports.RotationStep).min(2, "A rotation has at least two steps.").max(28),
    rule: exports.RotationRule,
    ruleValue: zod_1.z.number().int(),
})
    .superRefine(ruleRefine);
/**
 * `PATCH /ops/rotation-patterns/:id`. The steps and the rule of a pattern
 * someone is on never change: their generated drafts follow it, so a new
 * pattern is a new row (058-time, calls made while building).
 */
exports.UpdateRotationPatternRequest = zod_1.z
    .object({
    name: zod_1.z.string().trim().min(1).max(60),
    status: exports.RotationPatternStatus,
})
    .partial()
    .refine((b) => Object.keys(b).length > 0, { message: "Nothing to change." });
exports.RotationAssignment = zod_1.z.object({
    id: Uuid,
    employee: people_1.RosterCard,
    patternId: Uuid,
    patternName: zod_1.z.string(),
    propertyId: Uuid,
    startsOn: IsoDate,
    endsOn: IsoDate.nullable(),
    startStep: zod_1.z.number().int(),
});
exports.RotationAssignmentList = zod_1.z.object({ assignments: zod_1.z.array(exports.RotationAssignment) });
/** Running assignments, unless ended ones are asked for too. */
exports.RotationAssignmentQuery = zod_1.z.object({
    patternId: Uuid.optional(),
    includeEnded: zod_1.z.enum(["true", "false"]).optional(),
});
exports.CreateRotationAssignmentRequest = zod_1.z.object({
    employeeId: Uuid,
    patternId: Uuid,
    startsOn: IsoDate,
    /** Which step the person is on on `startsOn`, from 0. */
    startStep: zod_1.z.number().int().min(0).max(27).optional(),
});
/** Ending an assignment cancels the drafts it generated after its last day. */
exports.EndRotationAssignmentRequest = zod_1.z.object({ endsOn: IsoDate });
// ---------------------------------------------------------------------------
// Shift and swap requests (AC-TM5)
// ---------------------------------------------------------------------------
exports.ShiftRequestKind = zod_1.z.enum(["change", "swap"]);
exports.ShiftRequestStatus = zod_1.z.enum(["requested", "awaiting_colleague", "approved", "rejected", "cancelled"]);
exports.ShiftRequest = zod_1.z.object({
    id: Uuid,
    employee: people_1.RosterCard,
    branchId: Uuid.nullable(),
    kind: exports.ShiftRequestKind,
    shiftTemplate: zod_1.z.object({ id: Uuid, name: zod_1.z.string() }).nullable(),
    swapWith: people_1.RosterCard.nullable(),
    fromDate: IsoDate,
    toDate: IsoDate,
    reason: zod_1.z.string(),
    status: exports.ShiftRequestStatus,
    colleagueAcceptedAt: zod_1.z.string().nullable(),
    routedTo: people_1.RosterCard.nullable(),
    /** Routed to the caller's own file. */
    routedToMe: zod_1.z.boolean(),
    decidedAt: zod_1.z.string().nullable(),
    decidedByName: zod_1.z.string().nullable(),
    decisionNote: zod_1.z.string().nullable(),
    createdAt: zod_1.z.string(),
});
const ShiftRange = zod_1.z.object({ from: IsoDate, to: IsoDate, reason: Reason });
/** `POST /ops/shift-requests`: on someone's behalf. A swap names a colleague at the same branch. */
exports.CreateShiftRequestRequest = zod_1.z.discriminatedUnion("kind", [
    ShiftRange.extend({ kind: zod_1.z.literal("change"), employeeId: Uuid, shiftTemplateId: Uuid }),
    ShiftRange.extend({ kind: zod_1.z.literal("swap"), employeeId: Uuid, swapEmployeeId: Uuid }),
]).superRefine(rangeRefine);
/** The same, raised by the person through self service: their own file is the path. */
exports.CreateMyShiftRequestRequest = zod_1.z.discriminatedUnion("kind", [
    ShiftRange.extend({ kind: zod_1.z.literal("change"), shiftTemplateId: Uuid }),
    ShiftRange.extend({ kind: zod_1.z.literal("swap"), swapEmployeeId: Uuid }),
]).superRefine(rangeRefine);
exports.DecideRequestBody = zod_1.z.object({ note: Note.nullable().optional() });
// ---------------------------------------------------------------------------
// Attendance requests and overtime (AC-TM6, AC-TM8)
// ---------------------------------------------------------------------------
exports.AttendanceRequestStatus = zod_1.z.enum(["requested", "approved", "rejected", "cancelled"]);
exports.AttendanceRequest = zod_1.z.object({
    id: Uuid,
    employee: people_1.RosterCard,
    branchId: Uuid.nullable(),
    workDate: IsoDate,
    clockInAt: zod_1.z.string(),
    clockOutAt: zod_1.z.string(),
    /** The record it would put right; null asks for a missing one. */
    recordId: Uuid.nullable(),
    reason: zod_1.z.string(),
    status: exports.AttendanceRequestStatus,
    routedTo: people_1.RosterCard.nullable(),
    routedToMe: zod_1.z.boolean(),
    decidedAt: zod_1.z.string().nullable(),
    decidedByName: zod_1.z.string().nullable(),
    decisionNote: zod_1.z.string().nullable(),
    resultRecordId: Uuid.nullable(),
    createdAt: zod_1.z.string(),
});
const AttendanceAsk = zod_1.z
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
exports.CreateAttendanceRequestRequest = zod_1.z.intersection(AttendanceAsk, zod_1.z.object({ employeeId: Uuid }));
/** The same through self service. */
exports.CreateMyAttendanceRequestRequest = AttendanceAsk;
/** `POST /ops/attendance/:id/overtime`: approve all of it, or less (AC-TM8). */
exports.DecideOvertimeRequest = zod_1.z.object({
    approvedMinutes: zod_1.z.number().int().min(0).max(1440),
    note: Note.nullable().optional(),
});
// ---------------------------------------------------------------------------
// The attendance policy and the geofence (AC-TM4, AC-TM7 to AC-TM9)
// ---------------------------------------------------------------------------
const PolicyFields = zod_1.z.object({
    graceInMinutes: zod_1.z.number().int().min(0).max(240),
    graceOutMinutes: zod_1.z.number().int().min(0).max(240),
    overtimeCutoffMinutes: zod_1.z.number().int().min(0).max(1440).nullable(),
    overtimeAutoApprove: zod_1.z.boolean(),
    overtimeMinMinutes: zod_1.z.number().int().min(0).max(1440),
    linkWindowMinutes: zod_1.z.number().int().min(0).max(720),
    staleOpenHours: zod_1.z.number().int().min(1).max(72),
    defaultShiftMinutes: zod_1.z.number().int().min(30).max(1440),
    /** 058-leave AC-LV8: minutes on a worked holiday or day off that earn a whole compensatory day; half of it earns half. */
    compensationThresholdMinutes: zod_1.z.number().int().min(30).max(1440),
});
exports.AttendancePolicy = PolicyFields.extend({
    /** Null: the business default every branch without its own row follows. */
    propertyId: Uuid.nullable(),
    /** False when nothing is saved and these are the built in defaults. */
    saved: zod_1.z.boolean(),
});
const Centre = zod_1.z.object({ lat: zod_1.z.number().min(-90).max(90), lng: zod_1.z.number().min(-180).max(180) });
exports.BranchClockSettings = zod_1.z.object({
    propertyId: Uuid,
    branchName: zod_1.z.string(),
    geofenceRadiusM: zod_1.z.number().int(),
    /** The geofence's own centre, set here: where staff clock in, when that is not the map pin. */
    centre: Centre.nullable(),
    /** The property's own map pin is known, and is the centre when none is set here. */
    propertyHasCoordinates: zod_1.z.boolean(),
    /** Some centre is known. Without one, every phone punch waits for validation. */
    hasCoordinates: zod_1.z.boolean(),
});
/** `GET /ops/attendance/policies`: the business default, each branch's own, and each branch's geofence. */
exports.AttendanceSettings = zod_1.z.object({
    policies: zod_1.z.array(exports.AttendancePolicy),
    clock: zod_1.z.array(exports.BranchClockSettings),
});
exports.PutAttendancePolicyRequest = PolicyFields.extend({
    propertyId: Uuid.nullable(),
    /** Left out, the row keeps what it had. */
    compensationThresholdMinutes: zod_1.z.number().int().min(30).max(1440).optional(),
});
/** The radius, and the centre: null clears it back to the property's pin, absent leaves it. */
exports.PutBranchClockSettingsRequest = zod_1.z.object({
    geofenceRadiusM: zod_1.z.number().int().min(25).max(2000),
    centre: Centre.nullable().optional(),
});
// ---------------------------------------------------------------------------
// Kiosks and PINs (AC-TM10, AC-TM11)
// ---------------------------------------------------------------------------
exports.KioskStatus = zod_1.z.enum(["pairing", "active", "revoked"]);
const IpAddress = zod_1.z.string().trim().regex(/^[0-9a-fA-F:.]{2,45}$/, "That is not an IP address.");
exports.Kiosk = zod_1.z.object({
    id: Uuid,
    propertyId: Uuid,
    branchName: zod_1.z.string(),
    name: zod_1.z.string(),
    status: exports.KioskStatus,
    allowedIps: zod_1.z.array(zod_1.z.string()),
    lastSeenAt: zod_1.z.string().nullable(),
    pairingExpiresAt: zod_1.z.string().nullable(),
    createdAt: zod_1.z.string(),
});
exports.KioskList = zod_1.z.object({ kiosks: zod_1.z.array(exports.Kiosk) });
exports.CreateKioskRequest = zod_1.z.object({
    propertyId: Uuid,
    name: zod_1.z.string().trim().min(1, "Name the kiosk.").max(60),
    allowedIps: zod_1.z.array(IpAddress).max(20).optional(),
});
/** The pairing code is shown once, here, and lives ten minutes. */
exports.KioskPairingCode = zod_1.z.object({
    kiosk: exports.Kiosk,
    pairingCode: zod_1.z.string(),
    expiresAt: zod_1.z.string(),
});
exports.UnlockKioskPinRequest = zod_1.z.object({ employeeId: Uuid });
const Pin = zod_1.z.string().regex(/^\d{4,6}$/, "A PIN is 4 to 6 digits.");
/** `PUT /ops/employees/:id/kiosk-pin`: set or reset. Never shown again. */
exports.SetKioskPinRequest = zod_1.z.object({ pin: Pin });
/** `PUT /me/work/:employeeId/kiosk-pin`: the current PIN proves it is them. */
exports.ChangeMyKioskPinRequest = zod_1.z.object({ currentPin: Pin, pin: Pin });
exports.KioskPinState = zod_1.z.object({ hasPin: zod_1.z.boolean(), setAt: zod_1.z.string().nullable() });
/** `POST /kiosk/pair`: the tablet trades the code for its device cookie. */
exports.KioskPairRequest = zod_1.z.object({ code: zod_1.z.string().trim().regex(/^\d{8}$/, "The code is 8 digits.") });
/** `GET /kiosk/session`: the branch, and never a list of people. */
exports.KioskSession = zod_1.z.object({ kioskName: zod_1.z.string(), branchName: zod_1.z.string() });
exports.KioskPunchRequest = zod_1.z.object({
    employeeNumber: zod_1.z.string().trim().min(1, "Type your employee number.").max(20),
    pin: Pin,
});
/** Only after a correct PIN does the kiosk learn a name, to confirm the punch with. */
exports.KioskPunchResult = zod_1.z.object({
    displayName: zod_1.z.string(),
    direction: zod_1.z.enum(["in", "out"]),
    at: zod_1.z.string(),
});
// ---------------------------------------------------------------------------
// Holidays and weekly days off (AC-TM12)
// ---------------------------------------------------------------------------
exports.OrgHoliday = zod_1.z.object({
    id: Uuid,
    /** Null: every branch. */
    propertyId: Uuid.nullable(),
    name: zod_1.z.string(),
    fromDate: IsoDate,
    toDate: IsoDate,
    recurringYearly: zod_1.z.boolean(),
});
exports.OrgHolidayList = zod_1.z.object({ holidays: zod_1.z.array(exports.OrgHoliday) });
exports.CreateOrgHolidayRequest = zod_1.z
    .object({
    propertyId: Uuid.nullable().optional(),
    name: zod_1.z.string().trim().min(2, "Name the holiday.").max(80),
    fromDate: IsoDate,
    toDate: IsoDate,
    recurringYearly: zod_1.z.boolean().optional(),
})
    .refine((b) => b.toDate >= b.fromDate, { message: "It ends before it starts.", path: ["toDate"] });
exports.UpdateOrgHolidayRequest = zod_1.z
    .object({
    name: zod_1.z.string().trim().min(2).max(80),
    fromDate: IsoDate,
    toDate: IsoDate,
    recurringYearly: zod_1.z.boolean(),
})
    .partial()
    .refine((b) => Object.keys(b).length > 0, { message: "Nothing to change." });
const WeekOfMonth = zod_1.z.number().int().min(1).max(5);
exports.WeeklyOff = zod_1.z.object({
    id: Uuid,
    propertyId: Uuid.nullable(),
    /** 0 Sunday to 6 Saturday. */
    weekday: zod_1.z.number().int().min(0).max(6),
    /** Empty: every week; else which weeks of the month. */
    weeks: zod_1.z.array(WeekOfMonth),
});
exports.WeeklyOffList = zod_1.z.object({ weeklyOffs: zod_1.z.array(exports.WeeklyOff) });
exports.CreateWeeklyOffRequest = zod_1.z.object({
    propertyId: Uuid.nullable().optional(),
    weekday: zod_1.z.number().int().min(0).max(6),
    weeks: zod_1.z.array(WeekOfMonth).max(5).optional(),
});
exports.UpdateWeeklyOffRequest = zod_1.z.object({ weeks: zod_1.z.array(WeekOfMonth).max(5) });
// ---------------------------------------------------------------------------
// Insights (AC-TM13): to the person, their reporting manager and people.manage
// ---------------------------------------------------------------------------
exports.LateEarlyRow = zod_1.z.object({
    recordId: Uuid,
    employee: people_1.RosterCard,
    workDate: IsoDate,
    shiftName: zod_1.z.string().nullable(),
    lateMinutes: zod_1.z.number().int(),
    earlyMinutes: zod_1.z.number().int(),
});
/** Rows by name, then date: never by a figure. */
exports.LateEarlyReport = zod_1.z.object({ from: IsoDate, to: IsoDate, rows: zod_1.z.array(exports.LateEarlyRow) });
exports.MonthlySummaryRow = zod_1.z.object({
    employee: people_1.RosterCard,
    daysWorked: zod_1.z.number().int(),
    workedMinutes: zod_1.z.number().int(),
    /** The rostered minutes of the month, breaks taken off. */
    expectedMinutes: zod_1.z.number().int(),
    overtimeMinutes: zod_1.z.number().int(),
    approvedOvertimeMinutes: zod_1.z.number().int(),
    lateCount: zod_1.z.number().int(),
    earlyCount: zod_1.z.number().int(),
});
exports.MonthlySummary = zod_1.z.object({ month: IsoMonth, rows: zod_1.z.array(exports.MonthlySummaryRow) });
exports.InsightsQuery = zod_1.z.object({ from: IsoDate, to: IsoDate, propertyId: Uuid.optional() }).superRefine(rangeRefine);
exports.MonthlyQuery = zod_1.z.object({ month: IsoMonth, propertyId: Uuid.optional() });
// ---------------------------------------------------------------------------
// Self service: /me/work (058-self-service, the routes marked 4)
// ---------------------------------------------------------------------------
/**
 * One file the caller holds at a business (AC-SS1). A file the person has left
 * stays listed and readable, and refuses every write (409).
 */
exports.MyWorkFile = zod_1.z.object({
    employeeId: Uuid,
    orgId: Uuid,
    businessName: zod_1.z.string(),
    displayName: zod_1.z.string(),
    employeeNumber: zod_1.z.string(),
    branchName: zod_1.z.string().nullable(),
    jobPositionTitle: zod_1.z.string().nullable(),
    status: people_1.EmployeeStatus,
    /** Somebody's reporting manager: the team routes answer for them. */
    hasReports: zod_1.z.boolean(),
    /** An open clock in, when there is one. */
    openRecord: zod_1.z.object({ id: Uuid, clockInAt: zod_1.z.string() }).nullable(),
});
exports.MyWorkFileList = zod_1.z.object({ files: zod_1.z.array(exports.MyWorkFile) });
/** `POST /me/work/:employeeId/clock-in` and `/clock-out`: where the phone says it is, when it says. */
exports.PhoneClockRequest = zod_1.z.object({
    lat: zod_1.z.number().min(-90).max(90).optional(),
    lng: zod_1.z.number().min(-180).max(180).optional(),
    accuracyM: zod_1.z.number().min(0).max(100000).optional(),
});
/** What a phone punch came to: the record, and whether it waits for validation and why. */
exports.PhoneClockResult = zod_1.z.object({
    record: people_1.AttendanceRecord,
    validated: zod_1.z.boolean(),
    /** Why it waits, in words; null when validated. */
    pendingReason: zod_1.z.string().nullable(),
    distanceM: zod_1.z.number().int().nullable(),
});
exports.RangeQuery = zod_1.z.object({ from: IsoDate, to: IsoDate }).superRefine(rangeRefine);
/** `GET /me/work/:employeeId/roster`: published entries only (AC-TM2). */
exports.MyRoster = zod_1.z.object({ from: IsoDate, to: IsoDate, entries: zod_1.z.array(people_1.RosterEntry) });
exports.MyShiftRequestList = zod_1.z.object({
    /** What the person asked. */
    mine: zod_1.z.array(exports.ShiftRequest),
    /** Swaps colleagues asked of them, waiting for an answer. */
    askedOfMe: zod_1.z.array(exports.ShiftRequest),
});
/**
 * `GET /me/work/:employeeId/shift-options`: what a request of the person's own
 * may name (AC-TM5). The active shifts of the branch they work at, and the
 * colleagues there a swap could be with: a roster card each, never a file.
 */
exports.MyShiftOptions = zod_1.z.object({ shifts: zod_1.z.array(people_1.ShiftTemplate), colleagues: zod_1.z.array(people_1.RosterCard) });
exports.MyAttendance = zod_1.z.object({
    from: IsoDate,
    to: IsoDate,
    records: zod_1.z.array(people_1.AttendanceRecord),
    requests: zod_1.z.array(exports.AttendanceRequest),
});
exports.MyAttendanceRequestList = zod_1.z.object({ requests: zod_1.z.array(exports.AttendanceRequest) });
exports.MonthQuery = zod_1.z.object({ month: IsoMonth });
/** One person's month: their own figures, never a colleague's. */
exports.MyMonthlySummary = zod_1.z.object({ month: IsoMonth, summary: exports.MonthlySummaryRow.omit({ employee: true }) });
/** `GET /me/work/:employeeId/team`: direct reports, roster cards only (AC-SS15). */
exports.MyTeam = zod_1.z.object({ reports: zod_1.z.array(people_1.RosterCard) });
exports.MyTeamRoster = zod_1.z.object({ from: IsoDate, to: IsoDate, entries: zod_1.z.array(people_1.RosterEntry) });
exports.MyTeamAttendance = zod_1.z.object({
    from: IsoDate,
    to: IsoDate,
    records: zod_1.z.array(people_1.AttendanceRecord),
    /** Each report's month when the range is one month; else empty. */
    summaries: zod_1.z.array(exports.MonthlySummaryRow),
});
/** Which requests routed to a manager to read: a swap is a shift request that names a colleague. */
exports.TeamRequestKind = zod_1.z.enum(["shift", "swap", "attendance", "leave", "allocation"]);
exports.TeamRequestsQuery = zod_1.z.object({
    kind: exports.TeamRequestKind.optional(),
    status: zod_1.z.string().trim().max(40).optional(),
});
/** Requests routed to the caller, whatever kind, with their state: nothing here decides. */
exports.MyTeamRequests = zod_1.z.object({
    shift: zod_1.z.array(exports.ShiftRequest),
    attendance: zod_1.z.array(exports.AttendanceRequest),
    /** 058-leave: leave and allocation requests routed to the caller. */
    leave: zod_1.z.array(people_1.LeaveRequest),
    allocation: zod_1.z.array(leave_1.LeaveAllocationRequest),
});
//# sourceMappingURL=time.js.map