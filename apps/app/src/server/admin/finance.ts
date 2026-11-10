/**
 * Admin's finance reads (2026-11-09): payouts, failed charges, the ledger and reconciliation runs, one page
 * at a time. `admin.finance.view`; a refusal comes back as the API's status. Server side only.
 */
import type {
  AdminFailedChargeResponse,
  AdminLedgerResponse,
  AdminPayoutResponse,
  AdminPayoutStatus,
  AdminReconRunResponse,
} from "@injishi/contracts";
import { currentApi } from "@/lib/session";

export const FINANCE_PAGE_SIZE = 50;

const q = (page: number, extra: Record<string, string | undefined> = {}) =>
  Object.fromEntries(
    Object.entries({ page: String(page), pageSize: String(FINANCE_PAGE_SIZE), ...extra }).filter(([, v]) => v),
  ) as Record<string, string>;

export async function payouts(page: number, status?: AdminPayoutStatus): Promise<AdminPayoutResponse> {
  return (await currentApi()).get<AdminPayoutResponse>("/api/v1/admin/finance/payouts", { query: q(page, { status }) });
}

export async function failedCharges(page: number): Promise<AdminFailedChargeResponse> {
  return (await currentApi()).get<AdminFailedChargeResponse>("/api/v1/admin/finance/failed-charges", {
    query: q(page),
  });
}

export async function ledger(page: number): Promise<AdminLedgerResponse> {
  return (await currentApi()).get<AdminLedgerResponse>("/api/v1/admin/finance/ledger", { query: q(page) });
}

export async function reconRuns(page: number): Promise<AdminReconRunResponse> {
  return (await currentApi()).get<AdminReconRunResponse>("/api/v1/admin/finance/reconciliation-runs", {
    query: q(page),
  });
}
