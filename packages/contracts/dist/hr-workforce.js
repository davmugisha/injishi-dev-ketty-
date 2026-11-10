"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmployeeDependantList = exports.EmployeeDependant = exports.DependantRelation = exports.ExpiringDocumentQuery = exports.ExpiringDocumentList = exports.ExpiringDocument = exports.HrCompensation = exports.PayAccountLabel = exports.ContractTerms = exports.SaveCoverRequest = exports.CoverQuery = exports.CoverRequirementList = exports.CoverRequirement = exports.HrTeamList = exports.HrPlacement = exports.HrTeam = void 0;
const zod_1 = require("zod");
/**
 * The workforce reads the new interface's HR screens draw with (real-data,
 * people): teams and who is in them, the minimum cover a team must keep, the
 * terms each contract was made on, the documents about to expire, the steps of
 * an onboarding or offboarding, and a person's dependants.
 *
 * They follow the HR file's rule (`people.ts`): what a `people.view` reader may
 * see (a team, a grade, whether a PIN is set) is apart from what only
 * `people.manage` or `payroll.run` may (what a contract pays, where the pay
 * goes, a person's family), and the API answers each from its own route under
 * its own permission rather than one shape with fields removed.
 */
const Uuid = zod_1.z.string().uuid();
const IsoDate = zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "A date is YYYY-MM-DD.");
// ---------------------------------------------------------------------------
// Teams (`GET /ops/hr/teams`)
// ---------------------------------------------------------------------------
/** A team inside a department at one branch: Housekeeping and Front office under Rooms. */
exports.HrTeam = zod_1.z.object({
    id: Uuid,
    code: zod_1.z.string(),
    name: zod_1.z.string(),
    propertyId: Uuid,
    departmentId: Uuid.nullable(),
    departmentName: zod_1.z.string().nullable(),
    leadEmployeeId: Uuid.nullable(),
    sortOrder: zod_1.z.number().int(),
});
/** Where one person works, and the work fields the directory shows beside the file. */
exports.HrPlacement = zod_1.z.object({
    employeeId: Uuid,
    /** Null: in no team yet. */
    teamId: Uuid.nullable(),
    /** From the file: null for a reader who holds no file permission (the desk). */
    grade: zod_1.z.string().nullable(),
    /** A kiosk PIN is set (never the PIN): who clocks in at the desk until one is. */
    hasKioskPin: zod_1.z.boolean(),
    /** The current contract's last day of probation, when it starts one; null for a reader who holds no file permission. */
    probationEndsOn: IsoDate.nullable(),
});
exports.HrTeamList = zod_1.z.object({
    teams: zod_1.z.array(exports.HrTeam),
    /** Every file of the business in the caller's branches, active or leaving. */
    placements: zod_1.z.array(exports.HrPlacement),
});
// ---------------------------------------------------------------------------
// Minimum cover (`GET /ops/roster/cover`)
// ---------------------------------------------------------------------------
exports.CoverRequirement = zod_1.z.object({
    id: Uuid,
    propertyId: Uuid,
    teamId: Uuid,
    teamCode: zod_1.z.string(),
    teamName: zod_1.z.string(),
    /** The cover row's name on the roster ("Morning cover"). */
    label: zod_1.z.string(),
    /** Shift templates of the branch that count toward the cover. */
    shiftTemplateIds: zod_1.z.array(Uuid),
    /** Seven minimums, Monday to Sunday. */
    minByWeekday: zod_1.z.array(zod_1.z.number().int().nonnegative()).length(7),
    note: zod_1.z.string().nullable(),
    setByName: zod_1.z.string().nullable(),
    sortOrder: zod_1.z.number().int(),
});
exports.CoverRequirementList = zod_1.z.object({ requirements: zod_1.z.array(exports.CoverRequirement) });
/** Every branch in the caller's scope when no branch is named. */
exports.CoverQuery = zod_1.z.object({ propertyId: Uuid.optional() });
/**
 * `PUT /ops/roster/cover`: the fewest people a team needs, per weekday (Monday first), and the shifts
 * that count. Saving again changes the team's minimum rather than adding another.
 */
exports.SaveCoverRequest = zod_1.z.object({
    teamId: Uuid,
    shiftTemplateIds: zod_1.z.array(Uuid).min(1, "Choose at least one shift.").max(12),
    minByWeekday: zod_1.z.array(zod_1.z.number().int().min(0).max(99)).length(7),
    note: zod_1.z.string().trim().max(200).nullable().optional(),
});
// ---------------------------------------------------------------------------
// Compensation (`GET /ops/hr/compensation`, people.manage or payroll.run)
// ---------------------------------------------------------------------------
/** The terms a contract was made on: its pay, why, and who made it. */
exports.ContractTerms = zod_1.z.object({
    contractId: Uuid,
    employeeId: Uuid,
    contractType: zod_1.z.enum(["permanent", "fixed_term", "casual"]),
    startsOn: IsoDate,
    endsOn: IsoDate.nullable(),
    status: zod_1.z.enum(["scheduled", "active", "ended"]),
    wageRwf: zod_1.z.number().int(),
    /** The fixed allowances of the contract's pay structure, a month, in whole francs. */
    allowanceRwf: zod_1.z.number().int(),
    probationEndsOn: IsoDate.nullable(),
    changeReason: zod_1.z.string().nullable(),
    endReason: zod_1.z.string().nullable(),
    /** Who made the contract (a person who holds `people.manage`), and when. */
    decidedByName: zod_1.z.string().nullable(),
    decidedAt: zod_1.z.string(),
});
/** Where a person's pay goes, as a pay screen names it: the network or bank and the last digits only. */
exports.PayAccountLabel = zod_1.z.object({
    employeeId: Uuid,
    kind: zod_1.z.enum(["bank", "momo"]),
    /** "MTN MoMo", "Airtel Money", or the bank's name. */
    provider: zod_1.z.string(),
    /** The last three or four digits. */
    lastDigits: zod_1.z.string(),
});
exports.HrCompensation = zod_1.z.object({
    /** Every contract of every file in the caller's branches, newest start first per person. */
    contracts: zod_1.z.array(exports.ContractTerms),
    /** Each person's primary active pay account. */
    payAccounts: zod_1.z.array(exports.PayAccountLabel),
});
// ---------------------------------------------------------------------------
// Expiring documents (`GET /ops/hr/expiring-documents`, people.manage)
// ---------------------------------------------------------------------------
exports.ExpiringDocument = zod_1.z.object({
    documentId: Uuid,
    employeeId: Uuid,
    title: zod_1.z.string(),
    expiresOn: IsoDate,
});
exports.ExpiringDocumentList = zod_1.z.object({ documents: zod_1.z.array(exports.ExpiringDocument) });
/** From today, at most a year ahead. */
exports.ExpiringDocumentQuery = zod_1.z.object({
    withinDays: zod_1.z.coerce.number().int().min(1).max(366).optional(),
});
// ---------------------------------------------------------------------------
// Dependants (`GET /ops/hr/dependants`, people.manage)
// ---------------------------------------------------------------------------
exports.DependantRelation = zod_1.z.enum(["spouse", "child", "parent", "sibling", "other"]);
exports.EmployeeDependant = zod_1.z.object({
    id: Uuid,
    employeeId: Uuid,
    name: zod_1.z.string(),
    relation: exports.DependantRelation,
    sex: zod_1.z.enum(["female", "male"]).nullable(),
    dateOfBirth: IsoDate.nullable(),
    phone: zod_1.z.string().nullable(),
    isEmergencyContact: zod_1.z.boolean(),
    medicalDependant: zod_1.z.boolean(),
    /** Share of a death benefit, 0 to 100; null when not a beneficiary. */
    beneficiaryPercent: zod_1.z.number().nullable(),
});
exports.EmployeeDependantList = zod_1.z.object({ dependants: zod_1.z.array(exports.EmployeeDependant) });
//# sourceMappingURL=hr-workforce.js.map