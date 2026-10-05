import { z } from "zod";
import { LeaveBalances, LeaveRequest, LeaveType, RosterCard } from "./people";
/**
 * Leave in full (ADR-058, 058-leave): requests for extra and compensatory
 * days, restricted periods, everybody's balances, the dashboard, the national
 * defaults compared with a business's types, and the `/me/work` leave shapes.
 *
 * The leave request, its type and a balance stay in `people.ts`, where slice 1
 * put them.
 */
const Uuid = z.string().uuid();
const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "A date is YYYY-MM-DD.");
const Reason = z.string().trim().min(3, "Say why.").max(500);
// ---------------------------------------------------------------------------
// Extra and compensatory days (AC-LV8)
// ---------------------------------------------------------------------------
export const LeaveAllocationKind = z.enum(["extra", "compensatory"]);
export type LeaveAllocationKind = z.infer<typeof LeaveAllocationKind>;
export const LeaveAllocationStatus = z.enum(["requested", "approved", "rejected", "cancelled"]);
export type LeaveAllocationStatus = z.infer<typeof LeaveAllocationStatus>;
export const LeaveAllocationRequest = z.object({
    id: Uuid,
    employee: RosterCard,
    branchId: Uuid.nullable(),
    leaveType: z.object({ id: Uuid, name: z.string() }),
    kind: LeaveAllocationKind,
    days: z.number(),
    /** The worked holiday or day off a compensatory request is for. */
    attendanceRecordId: Uuid.nullable(),
    workDate: IsoDate.nullable(),
    reason: z.string(),
    status: LeaveAllocationStatus,
    routedTo: RosterCard.nullable(),
    routedToMe: z.boolean(),
    decidedAt: z.string().nullable(),
    decidedByName: z.string().nullable(),
    decisionNote: z.string().nullable(),
    createdAt: z.string(),
});
export type LeaveAllocationRequest = z.infer<typeof LeaveAllocationRequest>;
/** Extra days on a type, or the days a worked holiday or day off earns (counted by the server). */
export const AllocationAsk = z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("extra"), leaveTypeId: Uuid, days: z.number().positive().max(366).multipleOf(0.5), reason: Reason }),
    z.object({ kind: z.literal("compensatory"), attendanceRecordId: Uuid, reason: Reason }),
]);
export type AllocationAsk = z.infer<typeof AllocationAsk>;
/** `POST /ops/leave/allocation-requests`: on someone's behalf. */
export const CreateLeaveAllocationRequest = z.intersection(AllocationAsk, z.object({ employeeId: Uuid }));
export type CreateLeaveAllocationRequest = z.infer<typeof CreateLeaveAllocationRequest>;
/** The same through self service. */
export const CreateMyLeaveAllocationRequest = AllocationAsk;
export type CreateMyLeaveAllocationRequest = z.infer<typeof CreateMyLeaveAllocationRequest>;
// ---------------------------------------------------------------------------
// Restricted periods (AC-LV9)
// ---------------------------------------------------------------------------
export const RestrictedTypeMode = z.enum(["all", "only", "except"]);
export type RestrictedTypeMode = z.infer<typeof RestrictedTypeMode>;
export const RestrictedLeavePeriod = z.object({
    id: Uuid,
    title: z.string(),
    fromDate: IsoDate,
    toDate: IsoDate,
    /** Null: every department. */
    departmentId: Uuid.nullable(),
    departmentName: z.string().nullable(),
    /** Empty: every position. */
    jobPositionIds: z.array(Uuid),
    typeMode: RestrictedTypeMode,
    /** The types `only` covers or `except` leaves out. */
    leaveTypeIds: z.array(Uuid),
    description: z.string().nullable(),
});
export type RestrictedLeavePeriod = z.infer<typeof RestrictedLeavePeriod>;
export const RestrictedLeavePeriodList = z.object({ periods: z.array(RestrictedLeavePeriod) });
export type RestrictedLeavePeriodList = z.infer<typeof RestrictedLeavePeriodList>;
const PeriodFields = z.object({
    title: z.string().trim().min(2, "Name the period.").max(80),
    fromDate: IsoDate,
    toDate: IsoDate,
    departmentId: Uuid.nullable().optional(),
    jobPositionIds: z.array(Uuid).max(50).optional(),
    typeMode: RestrictedTypeMode.optional(),
    leaveTypeIds: z.array(Uuid).max(50).optional(),
    description: z.string().trim().max(500).nullable().optional(),
});
function periodRefine(b: { fromDate?: string; toDate?: string; typeMode?: string; leaveTypeIds?: string[] }, ctx: z.RefinementCtx): void {
    if (b.fromDate && b.toDate && b.toDate < b.fromDate) {
        ctx.addIssue({ code: "custom", path: ["toDate"], message: "It ends before it starts." });
    }
    if (b.typeMode && b.typeMode !== "all" && (b.leaveTypeIds?.length ?? 0) === 0) {
        ctx.addIssue({ code: "custom", path: ["leaveTypeIds"], message: "Name the types it covers or leaves out." });
    }
}
export const CreateRestrictedLeavePeriodRequest = PeriodFields.superRefine(periodRefine);
export type CreateRestrictedLeavePeriodRequest = z.infer<typeof CreateRestrictedLeavePeriodRequest>;
export const UpdateRestrictedLeavePeriodRequest = PeriodFields.partial()
    .superRefine(periodRefine)
    .refine((b) => Object.keys(b).length > 0, { message: "Nothing to change." });
export type UpdateRestrictedLeavePeriodRequest = z.infer<typeof UpdateRestrictedLeavePeriodRequest>;
// ---------------------------------------------------------------------------
// Everybody's balances (AC-LV13)
// ---------------------------------------------------------------------------
/** One person's balance per type: the sum of the ledger. Open the person for the lots and rows. */
export const LeaveBalanceRow = z.object({
    employee: RosterCard,
    branchId: Uuid.nullable(),
    balances: z.array(z.object({
        leaveTypeId: Uuid,
        /** Null for a type that keeps no balance. */
        days: z.number().nullable(),
    })),
});
export type LeaveBalanceRow = z.infer<typeof LeaveBalanceRow>;
// ---------------------------------------------------------------------------
// The dashboard (AC-LV13)
// ---------------------------------------------------------------------------
const OnLeave = z.object({
    requestId: Uuid,
    employee: RosterCard,
    leaveTypeName: z.string(),
    startsOn: IsoDate,
    endsOn: IsoDate,
});
export const LeaveDashboard = z.object({
    today: IsoDate,
    onLeaveToday: z.array(OnLeave),
    startingThisWeek: z.array(OnLeave),
    waiting: z.object({
        requests: z.number().int(),
        routedToMe: z.number().int(),
        atStepTwo: z.number().int(),
        allocations: z.number().int(),
    }),
});
export type LeaveDashboard = z.infer<typeof LeaveDashboard>;
// ---------------------------------------------------------------------------
// The national defaults against a business's types (AC-LV12)
// ---------------------------------------------------------------------------
export const LeaveDefaultsDiff = z.object({
    /** The defaults row in force. */
    configEntryId: Uuid,
    version: z.number().int(),
    /** Types in the defaults the business does not have. */
    missing: z.array(z.object({ code: z.string(), name: z.string() })),
    /** Rules that differ, by type: what the business has and what the defaults say. */
    changed: z.array(z.object({
        code: z.string(),
        name: z.string(),
        field: z.string(),
        current: z.union([z.string(), z.number(), z.boolean()]).nullable(),
        defaults: z.union([z.string(), z.number(), z.boolean()]).nullable(),
    })),
});
export type LeaveDefaultsDiff = z.infer<typeof LeaveDefaultsDiff>;
/**
 * `POST /ops/leave/types/defaults/apply`: the codes to take from the defaults.
 * A missing type is added; a present one takes the defaults' rules from now on.
 */
export const ApplyLeaveDefaultsRequest = z.object({
    codes: z.array(z.string().trim().min(1).max(40)).min(1).max(50),
});
export type ApplyLeaveDefaultsRequest = z.infer<typeof ApplyLeaveDefaultsRequest>;
// ---------------------------------------------------------------------------
// Self service: /me/work leave (058-self-service, the routes marked 5)
// ---------------------------------------------------------------------------
export const MyLeaveBalances = LeaveBalances;
export type MyLeaveBalances = z.infer<typeof MyLeaveBalances>;
export const MyLeaveRequestList = z.object({ requests: z.array(LeaveRequest) });
export type MyLeaveRequestList = z.infer<typeof MyLeaveRequestList>;
export const MyLeaveAllocationList = z.object({ requests: z.array(LeaveAllocationRequest) });
export type MyLeaveAllocationList = z.infer<typeof MyLeaveAllocationList>;
/** The types a person may ask for: their own eligibility already applied. */
export const MyLeaveTypeList = z.object({ types: z.array(LeaveType) });
export type MyLeaveTypeList = z.infer<typeof MyLeaveTypeList>;
/** `POST /me/work/:employeeId/files`: an attachment uploaded by the person, answered with its key. */
export const MyUpload = z.object({ key: z.string(), contentType: z.string(), sizeBytes: z.number().int() });
export type MyUpload = z.infer<typeof MyUpload>;
