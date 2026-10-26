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
export type * from "./model/people.ts";
export type { Candidate, FinalSettlement, HrAutomation, HrReport, Interview, OnboardingTask, PayLine, PayRates, PayRunException, PayRunHistory, PayRunOutput, PayRunRule, PayRunStage, PayRunStep, PayRunTotal, PaymentFile, PipelineStage, ReviewCycleMetric, ReviewDepartment, RuleGovernanceStep, RuleSet, RuleSetStatus, StaffAsset, TicketMessage, Vacancy, HelpdeskTicket as PayrollHelpdeskTicket } from "./model/payroll.ts";
export type * from "./model/shared.ts";
export type { HelpTicket, HelpTopic, LeaveApprover, LoanedAsset, Payslip, PayslipLine, RequestStatus, Shift, StaffDocument, StaffProfile, StaffRequest, StaffTone, SwapColleague, LeaveBalance as StaffLeaveBalance, LeaveType as StaffLeaveType } from "./model/staff.ts";
