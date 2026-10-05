import { z } from "zod";
import { IsoDate } from "./booking";
import { PayPeriod, PayRunStatus } from "./payroll";
import { RosterCard } from "./people";
import { Uuid } from "./primitives";
/**
 * Payroll in full (ADR-058, 058-payroll): what a run pays besides wages and
 * what a confirmed run produces.
 *
 * Pay components and structures (AC-PY5), loans and their installments
 * (AC-PY8), claims (AC-PY9), pay adjustments (AC-PY16), paid status (AC-PY10),
 * the bank and MoMo files and the declarations (AC-PY10, AC-PY12), the rules in
 * force and the dashboard (AC-PY15). Every route here needs `payroll.run`,
 * except the contracts list (`people.manage` too) and the self service shapes.
 *
 * Money is whole Rwandan francs. A write that creates money (a loan, a claim,
 * an adjustment, marking paid) carries an `Idempotency-Key`.
 */
const Reason = z.string().trim().min(3, "Say why.").max(500);
const Money = z.number().int().positive().max(100_000_000_000);
// ---------------------------------------------------------------------------
// Pay components and structures (AC-PY5)
// ---------------------------------------------------------------------------
export const PayComponentKind = z.enum(["allowance", "deduction"]);
export type PayComponentKind = z.infer<typeof PayComponentKind>;
export const PayAmountType = z.enum(["fixed", "percent_basic", "percent_gross", "per_day_worked", "per_hour_worked", "per_child"]);
export type PayAmountType = z.infer<typeof PayAmountType>;
export const PayConditionField = z.enum([
    "sex",
    "marital_status",
    "children",
    "years_of_service",
    "prior_experience",
    "employee_type",
    "job_position",
    "department",
    "branch",
    "wage_basis",
]);
export type PayConditionField = z.infer<typeof PayConditionField>;
export const PayConditionOp = z.enum(["eq", "ne", "gt", "gte", "lt", "lte", "in"]);
export type PayConditionOp = z.infer<typeof PayConditionOp>;
export const PayCondition = z.object({
    field: PayConditionField,
    op: PayConditionOp,
    /** `in` takes a comma separated list. */
    value: z.string().trim().min(1).max(500),
});
export type PayCondition = z.infer<typeof PayCondition>;
export const PayTargetMode = z.enum(["include", "exclude"]);
export type PayTargetMode = z.infer<typeof PayTargetMode>;
export const PayComponentStatus = z.enum(["active", "archived"]);
const ComponentFields = z.object({
    name: z.string().trim().min(1).max(80),
    kind: PayComponentKind,
    /** An allowance: whether it is taxed. */
    taxable: z.boolean(),
    /** An allowance: whether it counts in the contribution base. */
    inContributionBase: z.boolean(),
    /** A deduction: whether it is taken before tax. */
    beforeTax: z.boolean(),
    amountType: PayAmountType,
    amountRwf: Money.nullable(),
    /** A percentage, 0 to 100, two decimals at most. */
    rate: z.number().positive().max(100).multipleOf(0.01).nullable(),
    capRwf: Money.nullable(),
    condition: PayCondition.nullable(),
    appliesAllActive: z.boolean(),
    oneOffPeriod: PayPeriod.nullable(),
});
export const PayComponent = ComponentFields.extend({
    id: Uuid,
    code: z.string(),
    status: PayComponentStatus,
    targets: z.array(z.object({ employeeId: Uuid, displayName: z.string(), mode: PayTargetMode })),
    structureIds: z.array(Uuid),
});
export type PayComponent = z.infer<typeof PayComponent>;
export const PayComponentList = z.object({ components: z.array(PayComponent) });
export type PayComponentList = z.infer<typeof PayComponentList>;
function componentRefine(b: Partial<z.infer<typeof ComponentFields>>, ctx: z.RefinementCtx): void {
    const percent = b.amountType === "percent_basic" || b.amountType === "percent_gross";
    if (b.amountType !== undefined && percent && (b.rate === null || b.rate === undefined)) {
        ctx.addIssue({ code: "custom", path: ["rate"], message: "A percentage component says its percentage." });
    }
    if (b.amountType !== undefined && !percent && (b.amountRwf === null || b.amountRwf === undefined)) {
        ctx.addIssue({ code: "custom", path: ["amountRwf"], message: "Say the amount." });
    }
    if (b.kind === "allowance" && b.beforeTax) {
        ctx.addIssue({ code: "custom", path: ["beforeTax"], message: "Only a deduction is taken before tax." });
    }
}
const Targets = z.array(z.object({ employeeId: Uuid, mode: PayTargetMode })).max(500);
export const CreatePayComponentRequest = ComponentFields.extend({
    code: z.string().trim().regex(/^[a-z][a-z0-9_]{1,30}$/, "A code is lower case letters, digits and underscores."),
    targets: Targets.optional(),
}).superRefine(componentRefine);
export type CreatePayComponentRequest = z.infer<typeof CreatePayComponentRequest>;
/** Whole rule groups at once; `targets` replaces the list when present. */
export const UpdatePayComponentRequest = ComponentFields.extend({ status: PayComponentStatus, targets: Targets })
    .partial()
    .superRefine(componentRefine)
    .refine((b) => Object.keys(b).length > 0, { message: "Nothing to change." });
export type UpdatePayComponentRequest = z.infer<typeof UpdatePayComponentRequest>;
export const PayStructure = z.object({
    id: Uuid,
    name: z.string(),
    status: PayComponentStatus,
    componentIds: z.array(Uuid),
    /** Contracts that carry it now. */
    contractCount: z.number().int(),
});
export type PayStructure = z.infer<typeof PayStructure>;
export const PayStructureList = z.object({ structures: z.array(PayStructure) });
export type PayStructureList = z.infer<typeof PayStructureList>;
export const CreatePayStructureRequest = z.object({
    name: z.string().trim().min(1).max(80),
    componentIds: z.array(Uuid).max(100),
});
export type CreatePayStructureRequest = z.infer<typeof CreatePayStructureRequest>;
export const UpdatePayStructureRequest = CreatePayStructureRequest.extend({ status: PayComponentStatus })
    .partial()
    .refine((b) => Object.keys(b).length > 0, { message: "Nothing to change." });
export type UpdatePayStructureRequest = z.infer<typeof UpdatePayStructureRequest>;
// ---------------------------------------------------------------------------
// Loans and advances (AC-PY8)
// ---------------------------------------------------------------------------
export const LoanKind = z.enum(["loan", "advance"]);
export type LoanKind = z.infer<typeof LoanKind>;
export const LoanPaidOut = z.enum(["payslip", "outside"]);
export type LoanPaidOut = z.infer<typeof LoanPaidOut>;
export const LoanInstallment = z.object({
    id: Uuid,
    period: PayPeriod,
    amountRwf: z.number().int(),
    deferredFrom: PayPeriod.nullable(),
    paid: z.boolean(),
});
export type LoanInstallment = z.infer<typeof LoanInstallment>;
export const Loan = z.object({
    id: Uuid,
    employee: RosterCard,
    branchId: Uuid.nullable(),
    kind: LoanKind,
    amountRwf: z.number().int(),
    givenOn: IsoDate,
    installments: z.number().int(),
    firstPeriod: PayPeriod,
    paidOut: LoanPaidOut,
    reason: z.string().nullable(),
    paidRwf: z.number().int(),
    remainingRwf: z.number().int(),
    settledAt: z.string().nullable(),
    schedule: z.array(LoanInstallment),
    createdAt: z.string(),
});
export type Loan = z.infer<typeof Loan>;
export const CreateLoanRequest = z.object({
    employeeId: Uuid,
    kind: LoanKind,
    amountRwf: Money,
    givenOn: IsoDate,
    installments: z.number().int().min(1).max(120),
    firstPeriod: PayPeriod,
    paidOut: LoanPaidOut,
    reason: z.string().trim().max(300).nullable().optional(),
});
export type CreateLoanRequest = z.infer<typeof CreateLoanRequest>;
/** Deduct everything still owed in this month. */
export const SettleLoanRequest = z.object({ period: PayPeriod });
export type SettleLoanRequest = z.infer<typeof SettleLoanRequest>;
// ---------------------------------------------------------------------------
// Claims (AC-PY9)
// ---------------------------------------------------------------------------
export const PayClaimKind = z.enum(["reimbursement", "leave_encashment"]);
export type PayClaimKind = z.infer<typeof PayClaimKind>;
export const PayClaimStatus = z.enum(["requested", "approved", "rejected", "cancelled"]);
export type PayClaimStatus = z.infer<typeof PayClaimStatus>;
export const PayClaim = z.object({
    id: Uuid,
    employee: RosterCard,
    branchId: Uuid.nullable(),
    kind: PayClaimKind,
    /** A reimbursement's amount; an encashment's at the day rate once decided. */
    amountRwf: z.number().int().nullable(),
    leaveType: z.object({ id: Uuid, name: z.string() }).nullable(),
    days: z.number().nullable(),
    /** The month it is paid in. */
    period: PayPeriod,
    hasReceipt: z.boolean(),
    reason: z.string(),
    status: PayClaimStatus,
    decidedAt: z.string().nullable(),
    decidedByName: z.string().nullable(),
    decisionNote: z.string().nullable(),
    /** Paid with a confirmed payslip. */
    paid: z.boolean(),
    createdAt: z.string(),
});
export type PayClaim = z.infer<typeof PayClaim>;
const ClaimAsk = z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("reimbursement"), amountRwf: Money, receiptKey: z.string().trim().min(1).max(300).nullable().optional(), reason: Reason }),
    z.object({ kind: z.literal("leave_encashment"), leaveTypeId: Uuid, days: z.number().positive().max(366).multipleOf(0.5), reason: Reason }),
]);
export const CreatePayClaimRequest = z.intersection(ClaimAsk, z.object({ employeeId: Uuid }));
export type CreatePayClaimRequest = z.infer<typeof CreatePayClaimRequest>;
export const CreateMyPayClaimRequest = ClaimAsk;
export type CreateMyPayClaimRequest = z.infer<typeof CreateMyPayClaimRequest>;
export const PayDecisionRequest = z.object({ note: z.string().trim().max(300).nullable().optional() });
export type PayDecisionRequest = z.infer<typeof PayDecisionRequest>;
// ---------------------------------------------------------------------------
// Pay adjustments (AC-PY16, index contract 17)
// ---------------------------------------------------------------------------
export const PayAdjustmentSide = z.enum(["earning", "deduction"]);
export type PayAdjustmentSide = z.infer<typeof PayAdjustmentSide>;
export const PayAdjustmentSource = z.enum(["manual", "leave", "asset_fine", "held_payslip", "late_claim"]);
export type PayAdjustmentSource = z.infer<typeof PayAdjustmentSource>;
export const PayAdjustmentStatus = z.enum(["open", "waived", "paid"]);
export type PayAdjustmentStatus = z.infer<typeof PayAdjustmentStatus>;
export const PayAdjustment = z.object({
    id: Uuid,
    employee: RosterCard,
    branchId: Uuid.nullable(),
    side: PayAdjustmentSide,
    amountRwf: z.number().int(),
    taxable: z.boolean(),
    contributable: z.boolean(),
    correctsPeriod: PayPeriod,
    reason: z.string(),
    source: PayAdjustmentSource,
    status: PayAdjustmentStatus,
    /** The month whose payslip paid it. */
    paidInPeriod: PayPeriod.nullable(),
    createdAt: z.string(),
});
export type PayAdjustment = z.infer<typeof PayAdjustment>;
export const CreatePayAdjustmentRequest = z.object({
    employeeId: Uuid,
    side: PayAdjustmentSide,
    amountRwf: Money,
    taxable: z.boolean(),
    contributable: z.boolean(),
    correctsPeriod: PayPeriod,
    reason: Reason,
});
export type CreatePayAdjustmentRequest = z.infer<typeof CreatePayAdjustmentRequest>;
export const WaivePayAdjustmentRequest = z.object({ reason: Reason });
export type WaivePayAdjustmentRequest = z.infer<typeof WaivePayAdjustmentRequest>;
/** `POST /ops/pay-runs/:id/hold`: leave a person out of a draft, their month carried to the next (AC-PY7). */
export const HoldPayslipRequest = z.object({ employeeId: Uuid, reason: Reason });
export type HoldPayslipRequest = z.infer<typeof HoldPayslipRequest>;
// ---------------------------------------------------------------------------
// Payslips across runs and paid status (AC-PY10)
// ---------------------------------------------------------------------------
export const PaidMethod = z.enum(["bank", "momo", "cash"]);
export type PaidMethod = z.infer<typeof PaidMethod>;
export const PayslipRow = z.object({
    id: Uuid,
    payRunId: Uuid,
    period: PayPeriod,
    employee: RosterCard,
    employeeNumber: z.string(),
    branchId: Uuid.nullable(),
    grossRwf: z.number().int(),
    netRwf: z.number().int(),
    status: PayRunStatus,
    paidAt: z.string().nullable(),
    paidMethod: PaidMethod.nullable(),
    paidReference: z.string().nullable(),
    sentAt: z.string().nullable(),
});
export type PayslipRow = z.infer<typeof PayslipRow>;
export const MarkPaidParams = z.object({
    paidOn: IsoDate,
    method: PaidMethod,
    reference: z.string().trim().min(1).max(120),
});
export type MarkPaidParams = z.infer<typeof MarkPaidParams>;
export const UnmarkPaidRequest = z.object({ reason: Reason });
export type UnmarkPaidRequest = z.infer<typeof UnmarkPaidRequest>;
// ---------------------------------------------------------------------------
// Exports and declarations (AC-PY10, AC-PY12)
// ---------------------------------------------------------------------------
export const PayExportKind = z.enum(["bank", "momo"]);
export type PayExportKind = z.infer<typeof PayExportKind>;
export const PayDeclarationKind = z.enum(["paye", "rssb"]);
export type PayDeclarationKind = z.infer<typeof PayDeclarationKind>;
export const PayFile = z.object({
    id: Uuid,
    kind: z.union([PayExportKind, PayDeclarationKind]),
    rowCount: z.number().int().nullable(),
    totalRwf: z.number().int().nullable(),
    /** A declaration's format: `provisional` until the accountant's sheet names one. */
    formatVersion: z.string().nullable(),
    createdAt: z.string(),
    createdByName: z.string().nullable(),
});
export type PayFile = z.infer<typeof PayFile>;
export const PayFileList = z.object({ files: z.array(PayFile) });
export type PayFileList = z.infer<typeof PayFileList>;
export const CreatePayExportRequest = z.object({ kind: PayExportKind });
export type CreatePayExportRequest = z.infer<typeof CreatePayExportRequest>;
export const CreatePayDeclarationRequest = z.object({ kind: PayDeclarationKind });
export type CreatePayDeclarationRequest = z.infer<typeof CreatePayDeclarationRequest>;
/** A file just built: a five minute link to it, and who was left out and why. */
export const PayFileResult = z.object({
    file: PayFile,
    url: z.string(),
    expiresInSeconds: z.number().int(),
    leftOut: z.array(z.object({ employeeId: Uuid, displayName: z.string(), reason: z.string() })),
});
export type PayFileResult = z.infer<typeof PayFileResult>;
// ---------------------------------------------------------------------------
// The rules in force and the dashboard (AC-PY15)
// ---------------------------------------------------------------------------
export const PayrollRule = z.object({
    configType: z.string(),
    label: z.string(),
    inForce: z
        .object({ configEntryId: Uuid, version: z.number().int(), effectiveFrom: z.string().nullable(), value: z.unknown() })
        .nullable(),
    history: z.array(
        z.object({ configEntryId: Uuid, version: z.number().int(), effectiveFrom: z.string().nullable(), effectiveTo: z.string().nullable() }),
    ),
});
export type PayrollRule = z.infer<typeof PayrollRule>;
export const PayrollRules = z.object({ rules: z.array(PayrollRule) });
export type PayrollRules = z.infer<typeof PayrollRules>;
export const PayrollDashboard = z.object({
    months: z.array(
        z.object({
            period: PayPeriod,
            status: PayRunStatus,
            headcount: z.number().int(),
            grossRwf: z.number().int(),
            netRwf: z.number().int(),
            payeRwf: z.number().int(),
            employeeContributionsRwf: z.number().int(),
            employerContributionsRwf: z.number().int(),
        }),
    ),
    openLoansRwf: z.number().int(),
    claimsWaiting: z.number().int(),
    adjustmentsOpen: z.number().int(),
    unpaidPayslips: z.number().int(),
});
export type PayrollDashboard = z.infer<typeof PayrollDashboard>;
// ---------------------------------------------------------------------------
// Every contract (AC-PY15)
// ---------------------------------------------------------------------------
export const ContractRow = z.object({
    id: Uuid,
    employee: RosterCard,
    employeeNumber: z.string(),
    branchId: Uuid.nullable(),
    contractType: z.string(),
    startsOn: IsoDate,
    endsOn: IsoDate.nullable(),
    wageBasis: z.enum(["monthly", "daily", "hourly"]),
    wageRwf: z.number().int(),
    status: z.string(),
    payStructureId: Uuid.nullable(),
    noticeDays: z.number().int().nullable(),
});
export type ContractRow = z.infer<typeof ContractRow>;
/** `PATCH /ops/contracts/:id`: the pay terms a contract carries; its wage and dates change only by a new contract. */
export const UpdateContractPayTermsRequest = z
    .object({
        payStructureId: Uuid.nullable(),
        noticeDays: z.number().int().min(0).max(365).nullable(),
    })
    .partial()
    .refine((b) => Object.keys(b).length > 0, { message: "Nothing to change." });
export type UpdateContractPayTermsRequest = z.infer<typeof UpdateContractPayTermsRequest>;
// ---------------------------------------------------------------------------
// Self service (058-self-service AC-SS7, the routes marked 6)
// ---------------------------------------------------------------------------
export const MyPayslip = z.object({
    id: Uuid,
    period: PayPeriod,
    grossRwf: z.number().int(),
    netRwf: z.number().int(),
    paidAt: z.string().nullable(),
});
export type MyPayslip = z.infer<typeof MyPayslip>;
export const MyPayslipList = z.object({ payslips: z.array(MyPayslip) });
export type MyPayslipList = z.infer<typeof MyPayslipList>;
export const MyLoanList = z.object({ loans: z.array(Loan) });
export type MyLoanList = z.infer<typeof MyLoanList>;
export const MyPayClaimList = z.object({ claims: z.array(PayClaim) });
export type MyPayClaimList = z.infer<typeof MyPayClaimList>;
