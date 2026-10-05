"use client";

/**
 * The client for payroll in full (ADR-058, 058-payroll): the dashboard and the
 * rules in force, payslips across runs with their paid status, every contract,
 * loans, claims, adjustments, pay components and structures, holding a payslip,
 * and the files a confirmed run produces.
 *
 * The run list, one run and computing or confirming it stay in `people.ts`,
 * where slice 1 put them. The same rules as there: a read throws, every
 * response is parsed against its contract, and each read asks `useMayRead`
 * with the permissions its route declares (`OPS_READ`), so nobody fires a read
 * they would be refused. Keys follow `["ops", noun, workspaceId, …]`.
 *
 * A loan, a claim and an adjustment each send an `Idempotency-Key`, minted
 * once per press: a retry answers the first record rather than paying twice.
 * Marking a payslip paid sends none, because the bank's reference is its key.
 */

import {
  ContractPage,
  ContractRow,
  Loan,
  LoanPage,
  PayAdjustment,
  PayAdjustmentPage,
  PayClaim,
  PayClaimPage,
  PayComponent,
  PayComponentList,
  PayFileList,
  PayFileResult,
  PayrollDashboard,
  PayrollRules,
  PayRunDetail,
  PayslipPage,
  PayslipRow,
  PayStructure,
  PayStructureList,
  type CreateLoanRequest,
  type CreatePayAdjustmentRequest,
  type CreatePayClaimRequest,
  type CreatePayComponentRequest,
  type CreatePayStructureRequest,
  type ListPage,
  type ListQuery,
  type MarkPaidParams,
  type PayDeclarationKind,
  type PayExportKind,
  type UpdateContractPayTermsRequest,
  type UpdatePayComponentRequest,
  type UpdatePayStructureRequest,
} from "@injishi/contracts";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";

import { API_BASE, REQUEST_TIMEOUT_MS, command, readRefusal } from "./api";
import { branchHeader } from "./branch";
import { useListPage } from "./lists";
import { newIdempotencyKey, OPS_READ, read, useMayRead } from "./ops";
import { peopleKeys } from "./people";

export const payrollKeys = {
  dashboard: (ws: string | null) => ["ops", "payroll-dashboard", ws] as const,
  rules: (ws: string | null) => ["ops", "payroll-rules", ws] as const,
  components: (ws: string | null) => ["ops", "pay-components", ws] as const,
  structures: (ws: string | null) => ["ops", "pay-structures", ws] as const,
  loan: (ws: string | null, id: string) => ["ops", "loan", ws, id] as const,
  files: (ws: string | null, runId: string) => ["ops", "pay-files", ws, runId] as const,
};

/**
 * What a change to pay moves: the run's draft is computed from all of these,
 * so a run on screen, the dashboard and every list refetch together.
 */
const PAY_NOUNS = ["pay-runs", "pay-run", "payroll-dashboard", "payslips", "loans", "loan", "pay-claims", "pay-adjustments"];

function refresh(client: QueryClient, ...nouns: string[]): void {
  for (const noun of nouns) void client.invalidateQueries({ queryKey: ["ops", noun] });
}

// --- The dashboard, the rules in force and every contract (AC-PY15) --------------------------

export function usePayrollDashboard(ws: string | null): UseQueryResult<PayrollDashboard> {
  const mayRead = useMayRead(OPS_READ.payroll);
  return useQuery({
    queryKey: payrollKeys.dashboard(ws),
    queryFn: () => read("/ops/payroll/dashboard", ws as string, PayrollDashboard),
    enabled: ws !== null && mayRead,
  });
}

/** The national rules, read only: a rule changes by a new config version, never here. */
export function usePayrollRules(ws: string | null): UseQueryResult<PayrollRules> {
  const mayRead = useMayRead(OPS_READ.payroll);
  return useQuery({
    queryKey: payrollKeys.rules(ws),
    queryFn: () => read("/ops/payroll/rules", ws as string, PayrollRules),
    enabled: ws !== null && mayRead,
    staleTime: 10 * 60_000,
  });
}

export function useContractPage(ws: string | null, query: ListQuery): UseQueryResult<ListPage<ContractRow>> {
  return useListPage(ws, "contracts", "/ops/contracts", query, ContractPage, OPS_READ.contracts);
}

/** A contract's structure and notice; its wage and dates change only by a new contract. */
export function useUpdateContractPayTerms(
  ws: string | null,
): UseMutationResult<ContractRow, Error, { id: string } & UpdateContractPayTermsRequest> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }) =>
      ContractRow.parse(await command<unknown>(`/ops/contracts/${id}`, { workspaceId: ws as string, body, method: "PATCH" })),
    onSuccess: () => refresh(client, "contracts", "pay-structures", "employee", ...PAY_NOUNS),
  });
}

// --- Payslips across runs, paid status and printing (AC-PY10, AC-PY11) ---------------------------

export function usePayslipPage(ws: string | null, query: ListQuery): UseQueryResult<ListPage<PayslipRow>> {
  return useListPage(ws, "payslips", "/ops/payslips", query, PayslipPage, OPS_READ.payroll);
}

export function useMarkPaid(ws: string | null): UseMutationResult<PayslipRow, Error, { id: string } & MarkPaidParams> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }) =>
      PayslipRow.parse(await command<unknown>(`/ops/payslips/${id}/mark-paid`, { workspaceId: ws as string, body })),
    onSuccess: () => refresh(client, "payslips", "payroll-dashboard"),
  });
}

/** To correct a wrong reference; the reason lands on the trail. */
export function useUnmarkPaid(ws: string | null): UseMutationResult<PayslipRow, Error, { id: string; reason: string }> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }) =>
      PayslipRow.parse(await command<unknown>(`/ops/payslips/${id}/unmark-paid`, { workspaceId: ws as string, body: { reason } })),
    onSuccess: () => refresh(client, "payslips", "payroll-dashboard"),
  });
}

/**
 * Download a PDF the API draws (one payslip, or a whole run). A plain link
 * cannot carry the workspace header, so the file is fetched and handed to the
 * browser as a blob, named by the server.
 */
export async function downloadPayPdf(ws: string, path: string): Promise<void> {
  const controller = new AbortController();
  // A whole run is a page a person: it gets more time than a page of a list.
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS * 5);
  try {
    const res = await fetch(`${API_BASE}/api/v1${path}`, {
      credentials: "include",
      headers: { "x-workspace-id": ws, ...branchHeader() },
      signal: controller.signal,
    });
    if (!res.ok) throw await readRefusal(res);
    const name = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? "payslips.pdf";
    const url = URL.createObjectURL(await res.blob());
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
  } finally {
    clearTimeout(timer);
  }
}

// --- Holding a payslip, and the files a confirmed run produces (AC-PY7, AC-PY10, AC-PY12) ---------

export function useHoldPayslip(
  ws: string | null,
): UseMutationResult<PayRunDetail, Error, { runId: string; employeeId: string; reason: string }> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ runId, ...body }) =>
      PayRunDetail.parse(await command<unknown>(`/ops/pay-runs/${runId}/hold`, { workspaceId: ws as string, body })),
    onSuccess: (detail) => {
      client.setQueryData(peopleKeys.payRun(ws, detail.run.id), detail);
      refresh(client, ...PAY_NOUNS);
    },
  });
}

export function usePayFiles(ws: string | null, runId: string, confirmed: boolean): UseQueryResult<PayFileList> {
  const mayRead = useMayRead(OPS_READ.payroll);
  return useQuery({
    queryKey: payrollKeys.files(ws, runId),
    queryFn: () => read(`/ops/pay-runs/${runId}/files`, ws as string, PayFileList),
    enabled: ws !== null && mayRead && confirmed,
  });
}

/** Build a bank or MoMo file, or a declaration: the answer carries a five minute link and who was left out. */
export function useBuildPayFile(
  ws: string | null,
): UseMutationResult<PayFileResult, Error, { runId: string; kind: PayExportKind | PayDeclarationKind }> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ runId, kind }) => {
      const declaration = kind === "paye" || kind === "rssb";
      return PayFileResult.parse(
        await command<unknown>(`/ops/pay-runs/${runId}/${declaration ? "declarations" : "exports"}`, {
          workspaceId: ws as string,
          body: { kind },
        }),
      );
    },
    onSuccess: (_out, { runId }) => void client.invalidateQueries({ queryKey: payrollKeys.files(ws, runId) }),
  });
}

// --- Loans and advances (AC-PY8) ------------------------------------------------------------------

export function useLoanPage(ws: string | null, query: ListQuery): UseQueryResult<ListPage<Loan>> {
  return useListPage(ws, "loans", "/ops/loans", query, LoanPage, OPS_READ.payroll);
}

export function useCreateLoan(ws: string | null): UseMutationResult<Loan, Error, CreateLoanRequest> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (body) =>
      Loan.parse(await command<unknown>("/ops/loans", { workspaceId: ws as string, body, idempotencyKey: newIdempotencyKey() })),
    onSuccess: () => refresh(client, ...PAY_NOUNS),
  });
}

/** Defer one month's installment, or settle everything owed in one month. */
export function useLoanCommand(
  ws: string | null,
): UseMutationResult<Loan, Error, { id: string; action: "defer" | "settle"; period: string }> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, action, period }) =>
      Loan.parse(
        await command<unknown>(action === "defer" ? `/ops/loans/${id}/installments/${period}/defer` : `/ops/loans/${id}/settle`, {
          workspaceId: ws as string,
          body: action === "settle" ? { period } : undefined,
        }),
      ),
    onSuccess: () => refresh(client, ...PAY_NOUNS),
  });
}

// --- Claims (AC-PY9) ------------------------------------------------------------------------------

export function usePayClaimPage(ws: string | null, query: ListQuery): UseQueryResult<ListPage<PayClaim>> {
  return useListPage(ws, "pay-claims", "/ops/pay-claims", query, PayClaimPage, OPS_READ.payroll);
}

export function useCreatePayClaim(ws: string | null): UseMutationResult<PayClaim, Error, CreatePayClaimRequest> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (body) =>
      PayClaim.parse(await command<unknown>("/ops/pay-claims", { workspaceId: ws as string, body, idempotencyKey: newIdempotencyKey() })),
    onSuccess: () => refresh(client, ...PAY_NOUNS, "leave-balances"),
  });
}

export function useDecidePayClaim(
  ws: string | null,
): UseMutationResult<PayClaim, Error, { id: string; decision: "approve" | "reject"; note?: string }> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, decision, note }) =>
      PayClaim.parse(await command<unknown>(`/ops/pay-claims/${id}/${decision}`, { workspaceId: ws as string, body: { note: note ?? null } })),
    // An approved encashment takes days off a balance as it is decided.
    onSuccess: () => refresh(client, ...PAY_NOUNS, "leave-balances", "leave-balance-list"),
  });
}

// --- Adjustments (AC-PY16) ------------------------------------------------------------------------

export function usePayAdjustmentPage(ws: string | null, query: ListQuery): UseQueryResult<ListPage<PayAdjustment>> {
  return useListPage(ws, "pay-adjustments", "/ops/pay-adjustments", query, PayAdjustmentPage, OPS_READ.payroll);
}

export function useCreatePayAdjustment(ws: string | null): UseMutationResult<PayAdjustment, Error, CreatePayAdjustmentRequest> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (body) =>
      PayAdjustment.parse(
        await command<unknown>("/ops/pay-adjustments", { workspaceId: ws as string, body, idempotencyKey: newIdempotencyKey() }),
      ),
    onSuccess: () => refresh(client, ...PAY_NOUNS),
  });
}

export function useWaivePayAdjustment(ws: string | null): UseMutationResult<PayAdjustment, Error, { id: string; reason: string }> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }) =>
      PayAdjustment.parse(await command<unknown>(`/ops/pay-adjustments/${id}/waive`, { workspaceId: ws as string, body: { reason } })),
    onSuccess: () => refresh(client, ...PAY_NOUNS),
  });
}

// --- Pay components and structures (AC-PY5) -----------------------------------------------------------

export function usePayComponents(ws: string | null): UseQueryResult<PayComponent[]> {
  const mayRead = useMayRead(OPS_READ.payroll);
  return useQuery({
    queryKey: payrollKeys.components(ws),
    queryFn: async () => (await read("/ops/pay-components", ws as string, PayComponentList)).components,
    enabled: ws !== null && mayRead,
  });
}

export function useSavePayComponent(
  ws: string | null,
): UseMutationResult<PayComponent, Error, { id: null; body: CreatePayComponentRequest } | { id: string; body: UpdatePayComponentRequest }> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }) =>
      PayComponent.parse(
        await command<unknown>(id ? `/ops/pay-components/${id}` : "/ops/pay-components", {
          workspaceId: ws as string,
          body,
          method: id ? "PATCH" : "POST",
        }),
      ),
    onSuccess: () => refresh(client, "pay-components", "pay-structures", ...PAY_NOUNS),
  });
}

export function usePayStructures(ws: string | null): UseQueryResult<PayStructure[]> {
  const mayRead = useMayRead(OPS_READ.payroll);
  return useQuery({
    queryKey: payrollKeys.structures(ws),
    queryFn: async () => (await read("/ops/pay-structures", ws as string, PayStructureList)).structures,
    enabled: ws !== null && mayRead,
  });
}

export function useSavePayStructure(
  ws: string | null,
): UseMutationResult<PayStructure, Error, { id: null; body: CreatePayStructureRequest } | { id: string; body: UpdatePayStructureRequest }> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }) =>
      PayStructure.parse(
        await command<unknown>(id ? `/ops/pay-structures/${id}` : "/ops/pay-structures", {
          workspaceId: ws as string,
          body,
          method: id ? "PATCH" : "POST",
        }),
      ),
    onSuccess: () => refresh(client, "pay-structures", "pay-components", ...PAY_NOUNS),
  });
}
