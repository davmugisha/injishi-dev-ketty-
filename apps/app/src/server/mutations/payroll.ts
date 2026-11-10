/**
 * Writes for the Pay run board, through the API (ADR-058, 058-payroll). Plain functions: the
 * server actions in features/payroll call them, and every refusal is the API's (an ApiError).
 *
 * The run is the hospitality business's, as the board reads it (`sources/payroll.ts`). HR prepares
 * the month (`payroll.draft`): computes it, pays a person next month, submits it; whoever confirms
 * it (`payroll.run`, the owner) confirms it or sends it back, and builds the files.
 */

import type {
  NewLoanInput,
  PastRun,
  PayAmountInput,
  PayClaimView,
  PayLoansData,
  PayLoanView,
  PayrollContribution,
  PayrollContributionList,
  PayrollSettingsView,
  SetPayrollContributionRequest,
  StaffFileFix,
} from "@injishi/product-hr";
import { ApiError } from "../api";
import { allPages } from "../sources/payroll";
import type { SourceContext } from "../sources/types";

export type {
  NewLoanInput,
  PastRun,
  PayClaimView,
  PayLoansData,
  PayrollContribution,
  PayrollContributionList,
  PayrollSettingsView,
  SetPayrollContributionRequest,
  StaffFileFix,
};

const run = (id: string) => `/api/v1/ops/pay-runs/${encodeURIComponent(id)}`;

/** Compute the month's draft (`POST /ops/pay-runs`). */
export async function preparePayRun(ctx: SourceContext, period: string): Promise<void> {
  await ctx.ops("hospitality").post("/api/v1/ops/pay-runs", { period });
}

/** Compute the draft again, from the rows as they are now. */
export async function recomputePayRun(ctx: SourceContext, id: string): Promise<void> {
  await ctx.ops("hospitality").post(`${run(id)}/recompute`);
}

/** Leave a person out of this month: their pay is carried to the next run (AC-PY7). */
export async function holdPayslip(ctx: SourceContext, id: string, employeeId: string, reason: string): Promise<void> {
  await ctx.ops("hospitality").post(`${run(id)}/hold`, { employeeId, reason });
}

/** Hand the draft to whoever confirms it, with a word if there is one. */
export async function submitPayRun(ctx: SourceContext, id: string, note: string | null): Promise<void> {
  await ctx.ops("hospitality").post(`${run(id)}/submit`, { note });
}

/** Take a submitted draft back to change it; whoever confirms sends it back the same way, saying why. */
export async function withdrawPayRun(ctx: SourceContext, id: string, reason: string | null): Promise<void> {
  await ctx.ops("hospitality").post(`${run(id)}/withdraw`, { reason });
}

/** Freeze the month (`payroll.run`): computed once more, refused with every blocker listed. */
export async function confirmPayRun(ctx: SourceContext, id: string): Promise<void> {
  await ctx.ops("hospitality").post(`${run(id)}/confirm`);
}

/**
 * Build a payment file or a declaration of a confirmed run, and answer a five minute link to it,
 * with who was left out of a payment file and why (a person with no pay account of that kind).
 */
export async function buildPayFile(
  ctx: SourceContext,
  id: string,
  kind: "bank" | "momo" | "paye" | "rssb",
): Promise<{ url: string; leftOut: { displayName: string; reason: string }[] }> {
  const api = ctx.ops("hospitality");
  const path = kind === "bank" || kind === "momo" ? "exports" : "declarations";
  const result = await api.post<{ url: string; leftOut: { displayName: string; reason: string }[] }>(
    `${run(id)}/${path}`,
    { kind },
  );
  return { url: result.url, leftOut: result.leftOut ?? [] };
}

// ── The API's shapes (`@injishi/contracts` payroll-contributions) ─────────────────────────────

const contributions = "/api/v1/ops/payroll-contributions";

/** The contributions on pay, with this business's optional ones (`GET /ops/payroll-contributions`). */
export function readContributions(ctx: SourceContext): Promise<PayrollContributionList> {
  return ctx.ops("hospitality").get<PayrollContributionList>(contributions);
}

/** Switch an optional contribution, or set the private health insurer (the owner's, `payroll.run`). */
export function setContribution(
  ctx: SourceContext,
  code: string,
  body: SetPayrollContributionRequest,
): Promise<PayrollContributionList> {
  return ctx.ops("hospitality").put<PayrollContributionList>(`${contributions}/${encodeURIComponent(code)}`, body);
}

const hrSettings = "/api/v1/ops/hr/settings";

/** The business's RSSB employer number (`GET /ops/hr/settings`), and whether this person may change it. */
export async function readPayrollSettings(ctx: SourceContext): Promise<PayrollSettingsView> {
  const api = ctx.ops("hospitality");
  const settings = await api.get<{ rssbEmployerNumber: string | null }>(hrSettings);
  return {
    rssbEmployerNumber: settings.rssbEmployerNumber,
    canEdit: new Set<string>(api.workspace.permissions).has("payroll.run"),
  };
}

/**
 * Record the business's RSSB employer number (`PATCH /ops/hr/settings`, `payroll.run`). A run's blockers are
 * worked out when it is read, so the one this clears goes without computing the month again.
 */
export async function setRssbEmployerNumber(ctx: SourceContext, value: string): Promise<void> {
  await ctx.ops("hospitality").patch(hrSettings, { rssbEmployerNumber: value });
}

/** Put a missing RSSB number or ID on a staff file (`PATCH /ops/employees/:id`). */
export async function fixStaffFile(ctx: SourceContext, employeeId: string, fix: StaffFileFix): Promise<void> {
  await ctx.ops("hospitality").patch(`/api/v1/ops/employees/${encodeURIComponent(employeeId)}`, fix);
}

/** Mark a clock record as checked (`POST /ops/attendance/:id/validate`). */
export async function validateClockRecord(ctx: SourceContext, recordId: string): Promise<void> {
  await ctx.ops("hospitality").post(`/api/v1/ops/attendance/${encodeURIComponent(recordId)}/validate`);
}

/**
 * Close a clock record with the times it should have had (`POST /ops/attendance/:id/correct`):
 * the record is kept and a checked one replaces it, at any age the month is still open to.
 */
export async function correctClockRecord(
  ctx: SourceContext,
  recordId: string,
  body: { clockInAt: string; clockOutAt: string; note: string },
): Promise<void> {
  await ctx.ops("hospitality").post(`/api/v1/ops/attendance/${encodeURIComponent(recordId)}/correct`, body);
}

/** A pay run by its id (`GET /ops/pay-runs/:id`). */
export async function readPastRun(ctx: SourceContext, id: string): Promise<PastRun> {
  const d = await ctx.ops("hospitality").get<{
    run: Omit<PastRun, "payslips">;
    payslips: {
      id: string;
      employeeId: string;
      displayName: string;
      payableDays: number;
      grossRwf: number;
      payeRwf: number;
      employeeContributionsRwf: number;
      otherDeductionsRwf: number;
      netRwf: number;
      confidential?: boolean;
    }[];
  }>(run(id));
  const r = d.run;
  return {
    id: r.id,
    period: r.period,
    status: r.status,
    headcount: r.headcount,
    grossRwf: r.grossRwf,
    netRwf: r.netRwf,
    payeRwf: r.payeRwf,
    employeeContributionsRwf: r.employeeContributionsRwf,
    employerContributionsRwf: r.employerContributionsRwf,
    submittedByName: r.submittedByName,
    submittedAt: r.submittedAt,
    confirmedByName: r.confirmedByName,
    confirmedAt: r.confirmedAt,
    payslips: d.payslips
      .map((p) => ({
        id: p.id,
        employeeId: p.employeeId,
        name: p.displayName,
        days: p.payableDays,
        gross: p.grossRwf,
        paye: p.payeRwf,
        rssb: p.employeeContributionsRwf,
        other: p.otherDeductionsRwf,
        net: p.netRwf,
        confidential: p.confidential ?? false,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

// ── Loans and advances (`/ops/loans`, `payroll.run`) ───────────────────────────────────────────

interface ApiPayLoan {
  id: string;
  employee: { employeeId: string; displayName: string; jobPositionTitle: string | null };
  kind: "loan" | "advance";
  amountRwf: number;
  givenOn: string;
  installments: number;
  paidOut: "payslip" | "outside";
  reason: string | null;
  remainingRwf: number;
  settledAt: string | null;
  schedule: { period: string; amountRwf: number; paid: boolean }[];
}

function loanView(l: ApiPayLoan): PayLoanView {
  const next = l.settledAt
    ? undefined
    : l.schedule.filter((s) => !s.paid).sort((a, b) => a.period.localeCompare(b.period))[0];
  return {
    id: l.id,
    employeeId: l.employee.employeeId,
    name: l.employee.displayName,
    title: l.employee.jobPositionTitle,
    kind: l.kind,
    amountRwf: l.amountRwf,
    remainingRwf: l.remainingRwf,
    givenOn: l.givenOn,
    installments: l.installments,
    nextPeriod: next?.period ?? null,
    nextAmountRwf: next?.amountRwf ?? null,
    paidOut: l.paidOut,
    reason: l.reason,
    settled: l.settledAt !== null,
  };
}

/** The business's loans, newest first, and the people still working here, who can be given one. */
export async function readLoans(ctx: SourceContext): Promise<PayLoansData> {
  const api = ctx.ops("hospitality");
  const [loans, staff] = await Promise.all([
    api.get<{ items: ApiPayLoan[] }>("/api/v1/ops/loans", { query: { size: "100", page: "1" } }),
    allPages<{ id: string; displayName: string; jobPositionTitle: string | null; offboardedOn: string | null }>(
      api,
      "/api/v1/ops/employees",
    ),
  ]);
  return {
    loans: loans.items.map(loanView),
    people: staff
      .filter((p) => !p.offboardedOn)
      .map((p) => ({ id: p.id, name: p.displayName, title: p.jobPositionTitle }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

/** Record a loan or advance, and let an open draft take its first installment or its pay out at once. */
/** An amount on top of, or off, a person's month (`POST /ops/pay-adjustments`); one key per press. */
export async function addPayAmount(ctx: SourceContext, input: PayAmountInput, key: string): Promise<void> {
  await ctx.ops("hospitality").post(
    "/api/v1/ops/pay-adjustments",
    {
      employeeId: input.employeeId,
      side: input.side,
      amountRwf: input.amountRwf,
      taxable: input.side === "earning" && input.taxed,
      contributable: input.side === "earning" && input.taxed,
      correctsPeriod: input.period,
      reason: input.reason,
    },
    { idempotencyKey: key },
  );
}

export async function createLoan(ctx: SourceContext, input: NewLoanInput, key: string): Promise<void> {
  await ctx.ops("hospitality").post("/api/v1/ops/loans", input, { idempotencyKey: key });
  await recomputeOpenDrafts(ctx);
}

// ── Claims (`/ops/pay-claims`) ─────────────────────────────────────────────────────────────────

interface ApiClaim extends Omit<PayClaimView, "employeeId" | "name" | "title" | "leaveType"> {
  employee: { employeeId: string; displayName: string; jobPositionTitle: string | null };
  leaveType: { id: string; name: string } | null;
}

/** Every claim of the business, newest first (`GET /ops/pay-claims`). */
export async function readClaims(ctx: SourceContext): Promise<PayClaimView[]> {
  const page = await ctx
    .ops("hospitality")
    .get<{ items: ApiClaim[] }>("/api/v1/ops/pay-claims", { query: { size: "100", page: "1" } });
  return page.items.map(({ employee, leaveType, ...c }) => ({
    ...c,
    employeeId: employee.employeeId,
    name: employee.displayName,
    title: employee.jobPositionTitle,
    leaveType: leaveType?.name ?? null,
  }));
}

/**
 * Approve a claim into the next open month, or decline it (`POST /ops/pay-claims/:id/approve|reject`).
 * An approved claim joins that month's draft at once: an open draft is computed again.
 */
export async function decideClaim(
  ctx: SourceContext,
  id: string,
  decision: "approve" | "reject",
  note: string | null,
): Promise<void> {
  await ctx.ops("hospitality").post(`/api/v1/ops/pay-claims/${encodeURIComponent(id)}/${decision}`, { note });
  if (decision === "approve") await recomputeOpenDrafts(ctx);
}

/** Compute every draft not yet confirmed again, so a change that feeds pay shows on it now. */
async function recomputeOpenDrafts(ctx: SourceContext): Promise<void> {
  const api = ctx.ops("hospitality");
  const { items } = await api.get<{ items: { id: string; status: string }[] }>("/api/v1/ops/pay-runs", {
    query: { size: "25", page: "1" },
  });
  for (const r of items.filter((x) => x.status === "draft")) {
    try {
      await api.post(`${run(r.id)}/recompute`);
    } catch (error) {
      // A submitted month waits for the owner and is not computed again from here.
      if (!(error instanceof ApiError)) throw error;
    }
  }
}

/** A five minute link to a claim's receipt (`GET /ops/pay-claims/:id/receipt`). */
export async function claimReceipt(ctx: SourceContext, id: string): Promise<string> {
  const r = await ctx
    .ops("hospitality")
    .get<{ url: string }>(`/api/v1/ops/pay-claims/${encodeURIComponent(id)}/receipt`);
  return r.url;
}
