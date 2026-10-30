/**
 * The landlord's fault, expense and tax reads (P4): typed calls over the API client in the residence
 * business this request acts in (`landlordScope`), each cached for the request. Server side only.
 */
import type {
  ExpenseCategory,
  ExpenseList,
  FaultCounts,
  FaultDetail,
  FaultListPage,
  FaultTab,
  LeaseFilingList,
  OperatorTeamList,
  TaxpayerView,
  TaxYearView,
} from "@injishi/contracts";
import { cache } from "react";
import { landlordScope, NoRentalsBusinessError } from "./client";

async function get<T>(path: string, query?: Record<string, string | number | undefined>): Promise<T> {
  const s = await landlordScope();
  if (!s) throw new NoRentalsBusinessError();
  return s.api.get<T>(path, { workspaceId: s.workspace.workspaceId, query });
}

export const faultList = cache((tab?: FaultTab, unitId?: string, q?: string, page?: number) =>
  get<FaultListPage>("/api/v1/ops/faults", {
    tab,
    unitId,
    q: q || undefined,
    page: page && page > 1 ? page : undefined,
  }),
);
/** How many faults each tab holds (the list answers them with any page). */
export const faultCounts = cache(async (): Promise<FaultCounts> => (await faultList()).counts);
export const faultDetail = cache((id: string) => get<FaultDetail>(`/api/v1/ops/faults/${id}`));
/** The business's team, for "Assign" (owners and whoever manages the team). */
export const teamMembers = cache(() => get<OperatorTeamList>("/api/v1/ops/team"));

export const expenseList = cache((year: number, propertyId?: string, category?: ExpenseCategory) =>
  get<ExpenseList>("/api/v1/ops/expenses", { year, propertyId, category }),
);

export const taxpayer = cache(() => get<TaxpayerView>("/api/v1/ops/taxes/taxpayer"));
export const taxYear = cache((year: number) => get<TaxYearView>(`/api/v1/ops/taxes/${year}`));
export const leaseFilings = cache((year?: number) => get<LeaseFilingList>("/api/v1/ops/filings", { year }));
