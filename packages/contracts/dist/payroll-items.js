"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateContractPayTermsRequest = exports.ContractRow = exports.PayrollDashboard = exports.PayrollRules = exports.PayrollRule = exports.PayFileResult = exports.CreatePayDeclarationRequest = exports.CreatePayExportRequest = exports.PayFileList = exports.PayFile = exports.PayDeclarationKind = exports.PayExportKind = exports.UnmarkPaidRequest = exports.MarkPaidParams = exports.PayslipRow = exports.PaidMethod = exports.HoldPayslipRequest = exports.WaivePayAdjustmentRequest = exports.CreatePayAdjustmentRequest = exports.PayAdjustment = exports.PayAdjustmentStatus = exports.PayAdjustmentSource = exports.PayAdjustmentSide = exports.PayDecisionRequest = exports.CreateMyPayClaimRequest = exports.CreatePayClaimRequest = exports.PayClaim = exports.PayClaimStatus = exports.PayClaimKind = exports.SettleLoanRequest = exports.CreateLoanRequest = exports.Loan = exports.LoanInstallment = exports.LoanPaidOut = exports.LoanKind = exports.UpdatePayStructureRequest = exports.CreatePayStructureRequest = exports.PayStructureList = exports.PayStructure = exports.UpdatePayComponentRequest = exports.CreatePayComponentRequest = exports.PayComponentList = exports.PayComponent = exports.PayComponentStatus = exports.PayTargetMode = exports.PayCondition = exports.PayConditionOp = exports.PayConditionField = exports.PayAmountType = exports.PayComponentKind = void 0;
exports.MyPayClaimList = exports.MyLoanList = exports.MyPayslipList = exports.MyPayslip = void 0;
const zod_1 = require("zod");
const booking_1 = require("./booking");
const payroll_1 = require("./payroll");
const people_1 = require("./people");
const primitives_1 = require("./primitives");
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
const Reason = zod_1.z.string().trim().min(3, "Say why.").max(500);
const Money = zod_1.z.number().int().positive().max(100000000000);
// ---------------------------------------------------------------------------
// Pay components and structures (AC-PY5)
// ---------------------------------------------------------------------------
exports.PayComponentKind = zod_1.z.enum(["allowance", "deduction"]);
exports.PayAmountType = zod_1.z.enum(["fixed", "percent_basic", "percent_gross", "per_day_worked", "per_hour_worked", "per_child"]);
exports.PayConditionField = zod_1.z.enum([
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
exports.PayConditionOp = zod_1.z.enum(["eq", "ne", "gt", "gte", "lt", "lte", "in"]);
exports.PayCondition = zod_1.z.object({
    field: exports.PayConditionField,
    op: exports.PayConditionOp,
    /** `in` takes a comma separated list. */
    value: zod_1.z.string().trim().min(1).max(500),
});
exports.PayTargetMode = zod_1.z.enum(["include", "exclude"]);
exports.PayComponentStatus = zod_1.z.enum(["active", "archived"]);
const ComponentFields = zod_1.z.object({
    name: zod_1.z.string().trim().min(1).max(80),
    kind: exports.PayComponentKind,
    /** An allowance: whether it is taxed. */
    taxable: zod_1.z.boolean(),
    /** An allowance: whether it counts in the contribution base. */
    inContributionBase: zod_1.z.boolean(),
    /** A deduction: whether it is taken before tax. */
    beforeTax: zod_1.z.boolean(),
    amountType: exports.PayAmountType,
    amountRwf: Money.nullable(),
    /** A percentage, 0 to 100, two decimals at most. */
    rate: zod_1.z.number().positive().max(100).multipleOf(0.01).nullable(),
    capRwf: Money.nullable(),
    condition: exports.PayCondition.nullable(),
    appliesAllActive: zod_1.z.boolean(),
    oneOffPeriod: payroll_1.PayPeriod.nullable(),
});
exports.PayComponent = ComponentFields.extend({
    id: primitives_1.Uuid,
    code: zod_1.z.string(),
    status: exports.PayComponentStatus,
    targets: zod_1.z.array(zod_1.z.object({ employeeId: primitives_1.Uuid, displayName: zod_1.z.string(), mode: exports.PayTargetMode })),
    structureIds: zod_1.z.array(primitives_1.Uuid),
});
exports.PayComponentList = zod_1.z.object({ components: zod_1.z.array(exports.PayComponent) });
function componentRefine(b, ctx) {
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
const Targets = zod_1.z.array(zod_1.z.object({ employeeId: primitives_1.Uuid, mode: exports.PayTargetMode })).max(500);
exports.CreatePayComponentRequest = ComponentFields.extend({
    code: zod_1.z.string().trim().regex(/^[a-z][a-z0-9_]{1,30}$/, "A code is lower case letters, digits and underscores."),
    targets: Targets.optional(),
}).superRefine(componentRefine);
/** Whole rule groups at once; `targets` replaces the list when present. */
exports.UpdatePayComponentRequest = ComponentFields.extend({ status: exports.PayComponentStatus, targets: Targets })
    .partial()
    .superRefine(componentRefine)
    .refine((b) => Object.keys(b).length > 0, { message: "Nothing to change." });
exports.PayStructure = zod_1.z.object({
    id: primitives_1.Uuid,
    name: zod_1.z.string(),
    status: exports.PayComponentStatus,
    componentIds: zod_1.z.array(primitives_1.Uuid),
    /** Contracts that carry it now. */
    contractCount: zod_1.z.number().int(),
});
exports.PayStructureList = zod_1.z.object({ structures: zod_1.z.array(exports.PayStructure) });
exports.CreatePayStructureRequest = zod_1.z.object({
    name: zod_1.z.string().trim().min(1).max(80),
    componentIds: zod_1.z.array(primitives_1.Uuid).max(100),
});
exports.UpdatePayStructureRequest = exports.CreatePayStructureRequest.extend({ status: exports.PayComponentStatus })
    .partial()
    .refine((b) => Object.keys(b).length > 0, { message: "Nothing to change." });
// ---------------------------------------------------------------------------
// Loans and advances (AC-PY8)
// ---------------------------------------------------------------------------
exports.LoanKind = zod_1.z.enum(["loan", "advance"]);
exports.LoanPaidOut = zod_1.z.enum(["payslip", "outside"]);
exports.LoanInstallment = zod_1.z.object({
    id: primitives_1.Uuid,
    period: payroll_1.PayPeriod,
    amountRwf: zod_1.z.number().int(),
    deferredFrom: payroll_1.PayPeriod.nullable(),
    paid: zod_1.z.boolean(),
});
exports.Loan = zod_1.z.object({
    id: primitives_1.Uuid,
    employee: people_1.RosterCard,
    branchId: primitives_1.Uuid.nullable(),
    kind: exports.LoanKind,
    amountRwf: zod_1.z.number().int(),
    givenOn: booking_1.IsoDate,
    installments: zod_1.z.number().int(),
    firstPeriod: payroll_1.PayPeriod,
    paidOut: exports.LoanPaidOut,
    reason: zod_1.z.string().nullable(),
    paidRwf: zod_1.z.number().int(),
    remainingRwf: zod_1.z.number().int(),
    settledAt: zod_1.z.string().nullable(),
    schedule: zod_1.z.array(exports.LoanInstallment),
    createdAt: zod_1.z.string(),
});
exports.CreateLoanRequest = zod_1.z.object({
    employeeId: primitives_1.Uuid,
    kind: exports.LoanKind,
    amountRwf: Money,
    givenOn: booking_1.IsoDate,
    installments: zod_1.z.number().int().min(1).max(120),
    firstPeriod: payroll_1.PayPeriod,
    paidOut: exports.LoanPaidOut,
    reason: zod_1.z.string().trim().max(300).nullable().optional(),
});
/** Deduct everything still owed in this month. */
exports.SettleLoanRequest = zod_1.z.object({ period: payroll_1.PayPeriod });
// ---------------------------------------------------------------------------
// Claims (AC-PY9)
// ---------------------------------------------------------------------------
exports.PayClaimKind = zod_1.z.enum(["reimbursement", "leave_encashment"]);
exports.PayClaimStatus = zod_1.z.enum(["requested", "approved", "rejected", "cancelled"]);
exports.PayClaim = zod_1.z.object({
    id: primitives_1.Uuid,
    employee: people_1.RosterCard,
    branchId: primitives_1.Uuid.nullable(),
    kind: exports.PayClaimKind,
    /** A reimbursement's amount; an encashment's at the day rate once decided. */
    amountRwf: zod_1.z.number().int().nullable(),
    leaveType: zod_1.z.object({ id: primitives_1.Uuid, name: zod_1.z.string() }).nullable(),
    days: zod_1.z.number().nullable(),
    /** The month it is paid in. */
    period: payroll_1.PayPeriod,
    hasReceipt: zod_1.z.boolean(),
    reason: zod_1.z.string(),
    status: exports.PayClaimStatus,
    decidedAt: zod_1.z.string().nullable(),
    decidedByName: zod_1.z.string().nullable(),
    decisionNote: zod_1.z.string().nullable(),
    /** Paid with a confirmed payslip. */
    paid: zod_1.z.boolean(),
    createdAt: zod_1.z.string(),
});
const ClaimAsk = zod_1.z.discriminatedUnion("kind", [
    zod_1.z.object({ kind: zod_1.z.literal("reimbursement"), amountRwf: Money, receiptKey: zod_1.z.string().trim().min(1).max(300).nullable().optional(), reason: Reason }),
    zod_1.z.object({ kind: zod_1.z.literal("leave_encashment"), leaveTypeId: primitives_1.Uuid, days: zod_1.z.number().positive().max(366).multipleOf(0.5), reason: Reason }),
]);
exports.CreatePayClaimRequest = zod_1.z.intersection(ClaimAsk, zod_1.z.object({ employeeId: primitives_1.Uuid }));
exports.CreateMyPayClaimRequest = ClaimAsk;
exports.PayDecisionRequest = zod_1.z.object({ note: zod_1.z.string().trim().max(300).nullable().optional() });
// ---------------------------------------------------------------------------
// Pay adjustments (AC-PY16, index contract 17)
// ---------------------------------------------------------------------------
exports.PayAdjustmentSide = zod_1.z.enum(["earning", "deduction"]);
exports.PayAdjustmentSource = zod_1.z.enum(["manual", "leave", "asset_fine", "held_payslip", "late_claim"]);
exports.PayAdjustmentStatus = zod_1.z.enum(["open", "waived", "paid"]);
exports.PayAdjustment = zod_1.z.object({
    id: primitives_1.Uuid,
    employee: people_1.RosterCard,
    branchId: primitives_1.Uuid.nullable(),
    side: exports.PayAdjustmentSide,
    amountRwf: zod_1.z.number().int(),
    taxable: zod_1.z.boolean(),
    contributable: zod_1.z.boolean(),
    correctsPeriod: payroll_1.PayPeriod,
    reason: zod_1.z.string(),
    source: exports.PayAdjustmentSource,
    status: exports.PayAdjustmentStatus,
    /** The month whose payslip paid it. */
    paidInPeriod: payroll_1.PayPeriod.nullable(),
    createdAt: zod_1.z.string(),
});
exports.CreatePayAdjustmentRequest = zod_1.z.object({
    employeeId: primitives_1.Uuid,
    side: exports.PayAdjustmentSide,
    amountRwf: Money,
    taxable: zod_1.z.boolean(),
    contributable: zod_1.z.boolean(),
    correctsPeriod: payroll_1.PayPeriod,
    reason: Reason,
});
exports.WaivePayAdjustmentRequest = zod_1.z.object({ reason: Reason });
/** `POST /ops/pay-runs/:id/hold`: leave a person out of a draft, their month carried to the next (AC-PY7). */
exports.HoldPayslipRequest = zod_1.z.object({ employeeId: primitives_1.Uuid, reason: Reason });
// ---------------------------------------------------------------------------
// Payslips across runs and paid status (AC-PY10)
// ---------------------------------------------------------------------------
exports.PaidMethod = zod_1.z.enum(["bank", "momo", "cash"]);
exports.PayslipRow = zod_1.z.object({
    id: primitives_1.Uuid,
    payRunId: primitives_1.Uuid,
    period: payroll_1.PayPeriod,
    employee: people_1.RosterCard,
    employeeNumber: zod_1.z.string(),
    branchId: primitives_1.Uuid.nullable(),
    grossRwf: zod_1.z.number().int(),
    netRwf: zod_1.z.number().int(),
    status: payroll_1.PayRunStatus,
    paidAt: zod_1.z.string().nullable(),
    paidMethod: exports.PaidMethod.nullable(),
    paidReference: zod_1.z.string().nullable(),
    sentAt: zod_1.z.string().nullable(),
});
exports.MarkPaidParams = zod_1.z.object({
    paidOn: booking_1.IsoDate,
    method: exports.PaidMethod,
    reference: zod_1.z.string().trim().min(1).max(120),
});
exports.UnmarkPaidRequest = zod_1.z.object({ reason: Reason });
// ---------------------------------------------------------------------------
// Exports and declarations (AC-PY10, AC-PY12)
// ---------------------------------------------------------------------------
exports.PayExportKind = zod_1.z.enum(["bank", "momo"]);
exports.PayDeclarationKind = zod_1.z.enum(["paye", "rssb"]);
exports.PayFile = zod_1.z.object({
    id: primitives_1.Uuid,
    kind: zod_1.z.union([exports.PayExportKind, exports.PayDeclarationKind]),
    rowCount: zod_1.z.number().int().nullable(),
    totalRwf: zod_1.z.number().int().nullable(),
    /** A declaration's format: `provisional` until the accountant's sheet names one. */
    formatVersion: zod_1.z.string().nullable(),
    createdAt: zod_1.z.string(),
    createdByName: zod_1.z.string().nullable(),
});
exports.PayFileList = zod_1.z.object({ files: zod_1.z.array(exports.PayFile) });
exports.CreatePayExportRequest = zod_1.z.object({ kind: exports.PayExportKind });
exports.CreatePayDeclarationRequest = zod_1.z.object({ kind: exports.PayDeclarationKind });
/** A file just built: a five minute link to it, and who was left out and why. */
exports.PayFileResult = zod_1.z.object({
    file: exports.PayFile,
    url: zod_1.z.string(),
    expiresInSeconds: zod_1.z.number().int(),
    leftOut: zod_1.z.array(zod_1.z.object({ employeeId: primitives_1.Uuid, displayName: zod_1.z.string(), reason: zod_1.z.string() })),
});
// ---------------------------------------------------------------------------
// The rules in force and the dashboard (AC-PY15)
// ---------------------------------------------------------------------------
exports.PayrollRule = zod_1.z.object({
    configType: zod_1.z.string(),
    label: zod_1.z.string(),
    inForce: zod_1.z
        .object({ configEntryId: primitives_1.Uuid, version: zod_1.z.number().int(), effectiveFrom: zod_1.z.string().nullable(), value: zod_1.z.unknown() })
        .nullable(),
    history: zod_1.z.array(zod_1.z.object({ configEntryId: primitives_1.Uuid, version: zod_1.z.number().int(), effectiveFrom: zod_1.z.string().nullable(), effectiveTo: zod_1.z.string().nullable() })),
});
exports.PayrollRules = zod_1.z.object({ rules: zod_1.z.array(exports.PayrollRule) });
exports.PayrollDashboard = zod_1.z.object({
    months: zod_1.z.array(zod_1.z.object({
        period: payroll_1.PayPeriod,
        status: payroll_1.PayRunStatus,
        headcount: zod_1.z.number().int(),
        grossRwf: zod_1.z.number().int(),
        netRwf: zod_1.z.number().int(),
        payeRwf: zod_1.z.number().int(),
        employeeContributionsRwf: zod_1.z.number().int(),
        employerContributionsRwf: zod_1.z.number().int(),
    })),
    openLoansRwf: zod_1.z.number().int(),
    claimsWaiting: zod_1.z.number().int(),
    adjustmentsOpen: zod_1.z.number().int(),
    unpaidPayslips: zod_1.z.number().int(),
});
// ---------------------------------------------------------------------------
// Every contract (AC-PY15)
// ---------------------------------------------------------------------------
exports.ContractRow = zod_1.z.object({
    id: primitives_1.Uuid,
    employee: people_1.RosterCard,
    employeeNumber: zod_1.z.string(),
    branchId: primitives_1.Uuid.nullable(),
    contractType: zod_1.z.string(),
    startsOn: booking_1.IsoDate,
    endsOn: booking_1.IsoDate.nullable(),
    wageBasis: zod_1.z.enum(["monthly", "daily", "hourly"]),
    wageRwf: zod_1.z.number().int(),
    status: zod_1.z.string(),
    payStructureId: primitives_1.Uuid.nullable(),
    noticeDays: zod_1.z.number().int().nullable(),
});
/** `PATCH /ops/contracts/:id`: the pay terms a contract carries; its wage and dates change only by a new contract. */
exports.UpdateContractPayTermsRequest = zod_1.z
    .object({
    payStructureId: primitives_1.Uuid.nullable(),
    noticeDays: zod_1.z.number().int().min(0).max(365).nullable(),
})
    .partial()
    .refine((b) => Object.keys(b).length > 0, { message: "Nothing to change." });
// ---------------------------------------------------------------------------
// Self service (058-self-service AC-SS7, the routes marked 6)
// ---------------------------------------------------------------------------
exports.MyPayslip = zod_1.z.object({
    id: primitives_1.Uuid,
    period: payroll_1.PayPeriod,
    grossRwf: zod_1.z.number().int(),
    netRwf: zod_1.z.number().int(),
    paidAt: zod_1.z.string().nullable(),
});
exports.MyPayslipList = zod_1.z.object({ payslips: zod_1.z.array(exports.MyPayslip) });
exports.MyLoanList = zod_1.z.object({ loans: zod_1.z.array(exports.Loan) });
exports.MyPayClaimList = zod_1.z.object({ claims: zod_1.z.array(exports.PayClaim) });
//# sourceMappingURL=payroll-items.js.map