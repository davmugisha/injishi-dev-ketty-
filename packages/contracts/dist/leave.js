"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MyUpload = exports.MyLeaveTypeList = exports.MyLeaveAllocationList = exports.MyLeaveRequestList = exports.MyLeaveBalances = exports.ApplyLeaveDefaultsRequest = exports.LeaveDefaultsDiff = exports.LeaveDashboard = exports.LeaveBalanceRow = exports.UpdateRestrictedLeavePeriodRequest = exports.CreateRestrictedLeavePeriodRequest = exports.RestrictedLeavePeriodList = exports.RestrictedLeavePeriod = exports.RestrictedTypeMode = exports.CreateMyLeaveAllocationRequest = exports.CreateLeaveAllocationRequest = exports.AllocationAsk = exports.LeaveAllocationRequest = exports.LeaveAllocationStatus = exports.LeaveAllocationKind = void 0;
const zod_1 = require("zod");
const people_1 = require("./people");
/**
 * Leave in full (ADR-058, 058-leave): requests for extra and compensatory
 * days, restricted periods, everybody's balances, the dashboard, the national
 * defaults compared with a business's types, and the `/me/work` leave shapes.
 *
 * The leave request, its type and a balance stay in `people.ts`, where slice 1
 * put them.
 */
const Uuid = zod_1.z.string().uuid();
const IsoDate = zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "A date is YYYY-MM-DD.");
const Reason = zod_1.z.string().trim().min(3, "Say why.").max(500);
// ---------------------------------------------------------------------------
// Extra and compensatory days (AC-LV8)
// ---------------------------------------------------------------------------
exports.LeaveAllocationKind = zod_1.z.enum(["extra", "compensatory"]);
exports.LeaveAllocationStatus = zod_1.z.enum(["requested", "approved", "rejected", "cancelled"]);
exports.LeaveAllocationRequest = zod_1.z.object({
    id: Uuid,
    employee: people_1.RosterCard,
    branchId: Uuid.nullable(),
    leaveType: zod_1.z.object({ id: Uuid, name: zod_1.z.string() }),
    kind: exports.LeaveAllocationKind,
    days: zod_1.z.number(),
    /** The worked holiday or day off a compensatory request is for. */
    attendanceRecordId: Uuid.nullable(),
    workDate: IsoDate.nullable(),
    reason: zod_1.z.string(),
    status: exports.LeaveAllocationStatus,
    routedTo: people_1.RosterCard.nullable(),
    routedToMe: zod_1.z.boolean(),
    decidedAt: zod_1.z.string().nullable(),
    decidedByName: zod_1.z.string().nullable(),
    decisionNote: zod_1.z.string().nullable(),
    createdAt: zod_1.z.string(),
});
/** Extra days on a type, or the days a worked holiday or day off earns (counted by the server). */
exports.AllocationAsk = zod_1.z.discriminatedUnion("kind", [
    zod_1.z.object({ kind: zod_1.z.literal("extra"), leaveTypeId: Uuid, days: zod_1.z.number().positive().max(366).multipleOf(0.5), reason: Reason }),
    zod_1.z.object({ kind: zod_1.z.literal("compensatory"), attendanceRecordId: Uuid, reason: Reason }),
]);
/** `POST /ops/leave/allocation-requests`: on someone's behalf. */
exports.CreateLeaveAllocationRequest = zod_1.z.intersection(exports.AllocationAsk, zod_1.z.object({ employeeId: Uuid }));
/** The same through self service. */
exports.CreateMyLeaveAllocationRequest = exports.AllocationAsk;
// ---------------------------------------------------------------------------
// Restricted periods (AC-LV9)
// ---------------------------------------------------------------------------
exports.RestrictedTypeMode = zod_1.z.enum(["all", "only", "except"]);
exports.RestrictedLeavePeriod = zod_1.z.object({
    id: Uuid,
    title: zod_1.z.string(),
    fromDate: IsoDate,
    toDate: IsoDate,
    /** Null: every department. */
    departmentId: Uuid.nullable(),
    departmentName: zod_1.z.string().nullable(),
    /** Empty: every position. */
    jobPositionIds: zod_1.z.array(Uuid),
    typeMode: exports.RestrictedTypeMode,
    /** The types `only` covers or `except` leaves out. */
    leaveTypeIds: zod_1.z.array(Uuid),
    description: zod_1.z.string().nullable(),
});
exports.RestrictedLeavePeriodList = zod_1.z.object({ periods: zod_1.z.array(exports.RestrictedLeavePeriod) });
const PeriodFields = zod_1.z.object({
    title: zod_1.z.string().trim().min(2, "Name the period.").max(80),
    fromDate: IsoDate,
    toDate: IsoDate,
    departmentId: Uuid.nullable().optional(),
    jobPositionIds: zod_1.z.array(Uuid).max(50).optional(),
    typeMode: exports.RestrictedTypeMode.optional(),
    leaveTypeIds: zod_1.z.array(Uuid).max(50).optional(),
    description: zod_1.z.string().trim().max(500).nullable().optional(),
});
function periodRefine(b, ctx) {
    if (b.fromDate && b.toDate && b.toDate < b.fromDate) {
        ctx.addIssue({ code: "custom", path: ["toDate"], message: "It ends before it starts." });
    }
    if (b.typeMode && b.typeMode !== "all" && (b.leaveTypeIds?.length ?? 0) === 0) {
        ctx.addIssue({ code: "custom", path: ["leaveTypeIds"], message: "Name the types it covers or leaves out." });
    }
}
exports.CreateRestrictedLeavePeriodRequest = PeriodFields.superRefine(periodRefine);
exports.UpdateRestrictedLeavePeriodRequest = PeriodFields.partial()
    .superRefine(periodRefine)
    .refine((b) => Object.keys(b).length > 0, { message: "Nothing to change." });
// ---------------------------------------------------------------------------
// Everybody's balances (AC-LV13)
// ---------------------------------------------------------------------------
/** One person's balance per type: the sum of the ledger. Open the person for the lots and rows. */
exports.LeaveBalanceRow = zod_1.z.object({
    employee: people_1.RosterCard,
    branchId: Uuid.nullable(),
    balances: zod_1.z.array(zod_1.z.object({
        leaveTypeId: Uuid,
        /** Null for a type that keeps no balance. */
        days: zod_1.z.number().nullable(),
    })),
});
// ---------------------------------------------------------------------------
// The dashboard (AC-LV13)
// ---------------------------------------------------------------------------
const OnLeave = zod_1.z.object({
    requestId: Uuid,
    employee: people_1.RosterCard,
    leaveTypeName: zod_1.z.string(),
    startsOn: IsoDate,
    endsOn: IsoDate,
});
exports.LeaveDashboard = zod_1.z.object({
    today: IsoDate,
    onLeaveToday: zod_1.z.array(OnLeave),
    startingThisWeek: zod_1.z.array(OnLeave),
    waiting: zod_1.z.object({
        requests: zod_1.z.number().int(),
        routedToMe: zod_1.z.number().int(),
        atStepTwo: zod_1.z.number().int(),
        allocations: zod_1.z.number().int(),
    }),
});
// ---------------------------------------------------------------------------
// The national defaults against a business's types (AC-LV12)
// ---------------------------------------------------------------------------
exports.LeaveDefaultsDiff = zod_1.z.object({
    /** The defaults row in force. */
    configEntryId: Uuid,
    version: zod_1.z.number().int(),
    /** Types in the defaults the business does not have. */
    missing: zod_1.z.array(zod_1.z.object({ code: zod_1.z.string(), name: zod_1.z.string() })),
    /** Rules that differ, by type: what the business has and what the defaults say. */
    changed: zod_1.z.array(zod_1.z.object({
        code: zod_1.z.string(),
        name: zod_1.z.string(),
        field: zod_1.z.string(),
        current: zod_1.z.union([zod_1.z.string(), zod_1.z.number(), zod_1.z.boolean()]).nullable(),
        defaults: zod_1.z.union([zod_1.z.string(), zod_1.z.number(), zod_1.z.boolean()]).nullable(),
    })),
});
/**
 * `POST /ops/leave/types/defaults/apply`: the codes to take from the defaults.
 * A missing type is added; a present one takes the defaults' rules from now on.
 */
exports.ApplyLeaveDefaultsRequest = zod_1.z.object({
    codes: zod_1.z.array(zod_1.z.string().trim().min(1).max(40)).min(1).max(50),
});
// ---------------------------------------------------------------------------
// Self service: /me/work leave (058-self-service, the routes marked 5)
// ---------------------------------------------------------------------------
exports.MyLeaveBalances = people_1.LeaveBalances;
exports.MyLeaveRequestList = zod_1.z.object({ requests: zod_1.z.array(people_1.LeaveRequest) });
exports.MyLeaveAllocationList = zod_1.z.object({ requests: zod_1.z.array(exports.LeaveAllocationRequest) });
/** The types a person may ask for: their own eligibility already applied. */
exports.MyLeaveTypeList = zod_1.z.object({ types: zod_1.z.array(people_1.LeaveType) });
/** `POST /me/work/:employeeId/files`: an attachment uploaded by the person, answered with its key. */
exports.MyUpload = zod_1.z.object({ key: zod_1.z.string(), contentType: zod_1.z.string(), sizeBytes: zod_1.z.number().int() });
//# sourceMappingURL=leave.js.map