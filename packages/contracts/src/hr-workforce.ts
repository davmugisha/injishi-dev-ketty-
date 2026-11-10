import { z } from "zod";
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
const Uuid = z.string().uuid();
const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "A date is YYYY-MM-DD.");
// ---------------------------------------------------------------------------
// Teams (`GET /ops/hr/teams`)
// ---------------------------------------------------------------------------
/** A team inside a department at one branch: Housekeeping and Front office under Rooms. */
export const HrTeam = z.object({
    id: Uuid,
    code: z.string(),
    name: z.string(),
    propertyId: Uuid,
    departmentId: Uuid.nullable(),
    departmentName: z.string().nullable(),
    leadEmployeeId: Uuid.nullable(),
    sortOrder: z.number().int(),
});
export type HrTeam = z.infer<typeof HrTeam>;
/** Where one person works, and the work fields the directory shows beside the file. */
export const HrPlacement = z.object({
    employeeId: Uuid,
    /** Null: in no team yet. */
    teamId: Uuid.nullable(),
    /** From the file: null for a reader who holds no file permission (the desk). */
    grade: z.string().nullable(),
    /** A kiosk PIN is set (never the PIN): who clocks in at the desk until one is. */
    hasKioskPin: z.boolean(),
    /** The current contract's last day of probation, when it starts one; null for a reader who holds no file permission. */
    probationEndsOn: IsoDate.nullable(),
});
export type HrPlacement = z.infer<typeof HrPlacement>;
export const HrTeamList = z.object({
    teams: z.array(HrTeam),
    /** Every file of the business in the caller's branches, active or leaving. */
    placements: z.array(HrPlacement),
});
export type HrTeamList = z.infer<typeof HrTeamList>;
// ---------------------------------------------------------------------------
// Minimum cover (`GET /ops/roster/cover`)
// ---------------------------------------------------------------------------
export const CoverRequirement = z.object({
    id: Uuid,
    propertyId: Uuid,
    teamId: Uuid,
    teamCode: z.string(),
    teamName: z.string(),
    /** The cover row's name on the roster ("Morning cover"). */
    label: z.string(),
    /** Shift templates of the branch that count toward the cover. */
    shiftTemplateIds: z.array(Uuid),
    /** Seven minimums, Monday to Sunday. */
    minByWeekday: z.array(z.number().int().nonnegative()).length(7),
    note: z.string().nullable(),
    setByName: z.string().nullable(),
    sortOrder: z.number().int(),
});
export type CoverRequirement = z.infer<typeof CoverRequirement>;
export const CoverRequirementList = z.object({ requirements: z.array(CoverRequirement) });
export type CoverRequirementList = z.infer<typeof CoverRequirementList>;
/** Every branch in the caller's scope when no branch is named. */
export const CoverQuery = z.object({ propertyId: Uuid.optional() });
export type CoverQuery = z.infer<typeof CoverQuery>;
/**
 * `PUT /ops/roster/cover`: the fewest people a team needs, per weekday (Monday first), and the shifts
 * that count. Saving again changes the team's minimum rather than adding another.
 */
export const SaveCoverRequest = z.object({
    teamId: Uuid,
    shiftTemplateIds: z.array(Uuid).min(1, "Choose at least one shift.").max(12),
    minByWeekday: z.array(z.number().int().min(0).max(99)).length(7),
    note: z.string().trim().max(200).nullable().optional(),
});
export type SaveCoverRequest = z.infer<typeof SaveCoverRequest>;
// ---------------------------------------------------------------------------
// Compensation (`GET /ops/hr/compensation`, people.manage or payroll.run)
// ---------------------------------------------------------------------------
/** The terms a contract was made on: its pay, why, and who made it. */
export const ContractTerms = z.object({
    contractId: Uuid,
    employeeId: Uuid,
    contractType: z.enum(["permanent", "fixed_term", "casual"]),
    startsOn: IsoDate,
    endsOn: IsoDate.nullable(),
    status: z.enum(["scheduled", "active", "ended"]),
    wageRwf: z.number().int(),
    /** The fixed allowances of the contract's pay structure, a month, in whole francs. */
    allowanceRwf: z.number().int(),
    probationEndsOn: IsoDate.nullable(),
    changeReason: z.string().nullable(),
    endReason: z.string().nullable(),
    /** Who made the contract (a person who holds `people.manage`), and when. */
    decidedByName: z.string().nullable(),
    decidedAt: z.string(),
});
export type ContractTerms = z.infer<typeof ContractTerms>;
/** Where a person's pay goes, as a pay screen names it: the network or bank and the last digits only. */
export const PayAccountLabel = z.object({
    employeeId: Uuid,
    kind: z.enum(["bank", "momo"]),
    /** "MTN MoMo", "Airtel Money", or the bank's name. */
    provider: z.string(),
    /** The last three or four digits. */
    lastDigits: z.string(),
});
export type PayAccountLabel = z.infer<typeof PayAccountLabel>;
export const HrCompensation = z.object({
    /** Every contract of every file in the caller's branches, newest start first per person. */
    contracts: z.array(ContractTerms),
    /** Each person's primary active pay account. */
    payAccounts: z.array(PayAccountLabel),
});
export type HrCompensation = z.infer<typeof HrCompensation>;
// ---------------------------------------------------------------------------
// Expiring documents (`GET /ops/hr/expiring-documents`, people.manage)
// ---------------------------------------------------------------------------
export const ExpiringDocument = z.object({
    documentId: Uuid,
    employeeId: Uuid,
    title: z.string(),
    expiresOn: IsoDate,
});
export type ExpiringDocument = z.infer<typeof ExpiringDocument>;
export const ExpiringDocumentList = z.object({ documents: z.array(ExpiringDocument) });
export type ExpiringDocumentList = z.infer<typeof ExpiringDocumentList>;
/** From today, at most a year ahead. */
export const ExpiringDocumentQuery = z.object({
    withinDays: z.coerce.number().int().min(1).max(366).optional(),
});
export type ExpiringDocumentQuery = z.infer<typeof ExpiringDocumentQuery>;
// ---------------------------------------------------------------------------
// Dependants (`GET /ops/hr/dependants`, people.manage)
// ---------------------------------------------------------------------------
export const DependantRelation = z.enum(["spouse", "child", "parent", "sibling", "other"]);
export type DependantRelation = z.infer<typeof DependantRelation>;
export const EmployeeDependant = z.object({
    id: Uuid,
    employeeId: Uuid,
    name: z.string(),
    relation: DependantRelation,
    sex: z.enum(["female", "male"]).nullable(),
    dateOfBirth: IsoDate.nullable(),
    phone: z.string().nullable(),
    isEmergencyContact: z.boolean(),
    medicalDependant: z.boolean(),
    /** Share of a death benefit, 0 to 100; null when not a beneficiary. */
    beneficiaryPercent: z.number().nullable(),
});
export type EmployeeDependant = z.infer<typeof EmployeeDependant>;
export const EmployeeDependantList = z.object({ dependants: z.array(EmployeeDependant) });
export type EmployeeDependantList = z.infer<typeof EmployeeDependantList>;
