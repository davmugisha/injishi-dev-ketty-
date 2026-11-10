import type { ProductDefinition } from "@injishi/product-contract";

/**
 * Injishi HR (ADR-074): what it is, and the shapes its views draw.
 *
 * Each module names the permissions its API routes declare (the `ops` HR controllers), so an app shows the
 * module when the workspace grant holds any one of them. That is an affordance only: the API refuses what the
 * grant does not hold. Self service is the person's own schedule, leave and payslips, behind a session and
 * nothing more, so it needs no permission. Talent and Staff services count under `people` until a call gives
 * them modules of their own (074-repository-and-boundaries.md, Stage 3).
 */
export const definition = {
  id: "hr",
  name: "Injishi HR",
  surfaces: ["web"],
  modules: [
    { id: "people", surfaces: ["web"], permissions: ["people.view", "people.manage"] },
    { id: "roster", surfaces: ["web"], permissions: ["roster.manage", "people.view", "attendance.record"] },
    { id: "attendance", surfaces: ["web"], permissions: ["attendance.record", "attendance.approve"] },
    { id: "leave", surfaces: ["web"], permissions: ["leave.approve", "people.manage"] },
    { id: "payroll", surfaces: ["web"], permissions: ["payroll.draft", "payroll.run"] },
    { id: "self-service", surfaces: ["web"], permissions: [] },
  ],
} as const satisfies ProductDefinition<"hr">;

// Three areas declare a name each other also uses for a different shape, so the second one is renamed here.
export type * from "./model/announcements.ts";
export type * from "./model/commands.ts";
export type {
  Candidate,
  FinalSettlement,
  HelpdeskTicket as PayrollHelpdeskTicket,
  Interview,
  OnboardingTask,
  PastRun,
  PayAmountInput,
  PayClaimView,
  PayLine,
  PayLoansData,
  PayLoanView,
  PaymentFile,
  PayRates,
  PayRunException,
  PayRunHistory,
  PayRunOutput,
  PayRunRule,
  PayRunStage,
  PayRunState,
  PayRunStep,
  PayRunTotal,
  PayrollContribution,
  PayrollContributionList,
  PayrollSettingsView,
  PipelineStage,
  ReviewCycleMetric,
  ReviewDepartment,
  RuleGovernanceStep,
  RuleSet,
  RuleSetStatus,
  StaffAsset,
  TicketMessage,
  Vacancy,
} from "./model/payroll.ts";
export type * from "./model/people.ts";
export type * from "./model/report.ts";
export type * from "./model/shared.ts";
export type {
  HelpTicket,
  HelpTopic,
  LeaveApprover,
  LeaveBalance as StaffLeaveBalance,
  LeaveType as StaffLeaveType,
  LoanedAsset,
  Payslip,
  PayslipLine,
  RequestStatus,
  Shift,
  ShiftChoices,
  StaffAnnouncement,
  StaffClaim,
  StaffDocument,
  StaffLoan,
  StaffOwnReview,
  StaffProfile,
  StaffRequest,
  StaffTone,
  SwapAsk,
  SwapColleague,
} from "./model/staff.ts";
export type * from "./model/talent.ts";
export type * from "./model/time.ts";
