/**
 * The landlord's reads (blueprint 3.3): typed calls over the API client, in the residence business the
 * person works in (the session's choice, else their first running one; `workspaceFor`). Each is cached
 * for the request, so a layout and a page asking for the same thing ask the API once. Server side only.
 */
import type {
  BlockList,
  LandlordProfileView,
  OperatorStaffInvitation,
  OperatorStaffInvitationList,
  OperatorTeamList,
  OperatorTeamMember,
  PayoutAccountList,
  PayoutList,
  RentalPropertyList,
  RentalsMoney,
  RentalsOverview,
  RentalsSetupView,
  RentalsSummary,
  RentalUnitList,
  UnitListQuery,
  UnitMediaView,
} from "@injishi/contracts";
import { cache } from "react";
import { currentAccount, currentApi } from "@/lib/session";
import { type ApiClient, ApiError } from "../api";
import { type Workspace, workspaceFor } from "../auth";

/** The person has no running residence business to act in. */
export class NoRentalsBusinessError extends Error {
  constructor() {
    super("There is no rentals business here.");
    this.name = "NoRentalsBusinessError";
  }
}

export interface LandlordScope {
  api: ApiClient;
  workspace: Workspace;
  permissions: readonly string[];
}

/** The residence business this request acts in, or null. */
export const landlordScope = cache(async (): Promise<LandlordScope | null> => {
  const [account, api] = await Promise.all([currentAccount(), currentApi()]);
  if (!account) return null;
  const workspace = workspaceFor(account, "residence");
  if (workspace?.domain !== "residence") return null;
  return { api, workspace, permissions: workspace.permissions };
});

/**
 * One hospitality business the person holds, by its workspace, or null: a host
 * is paid out through the same payout accounts as a landlord (0116), so the
 * Getting paid screen and its writes reuse the rentals ones with this scope.
 */
export const hostScope = cache(async (workspaceId: string): Promise<LandlordScope | null> => {
  const [account, api] = await Promise.all([currentAccount(), currentApi()]);
  const workspace = account?.workspaces.find(
    (w) => w.workspaceId === workspaceId && w.kind === "business" && w.domain === "hospitality",
  );
  return workspace ? { api, workspace, permissions: workspace.permissions } : null;
});

async function scope(): Promise<LandlordScope> {
  const s = await landlordScope();
  if (!s) throw new NoRentalsBusinessError();
  return s;
}

async function get<T>(path: string, query?: Record<string, string | undefined>): Promise<T> {
  const { api, workspace } = await scope();
  return api.get<T>(path, { workspaceId: workspace.workspaceId, query });
}

/** Whether the person may do something here (presentation only: the API decides). */
export function can(s: Pick<LandlordScope, "permissions">, ...any: string[]): boolean {
  return any.some((p) => s.permissions.includes(p));
}

/** A read the person may not make (403) or that is not there (404) comes back null; anything else throws. */
export async function orNull<T>(read: Promise<T>): Promise<T | null> {
  try {
    return await read;
  } catch (error) {
    if (error instanceof ApiError && (error.forbidden || error.notFound)) return null;
    throw error;
  }
}

export const rentalsSummary = cache(() => get<RentalsSummary>("/api/v1/ops/rentals/summary"));
export const rentalsOverview = cache(() => get<RentalsOverview>("/api/v1/ops/rentals/overview"));
export const rentalsMoney = cache(() => get<RentalsMoney>("/api/v1/ops/rentals/money"));
export const rentalsSetup = cache(() => get<RentalsSetupView>("/api/v1/ops/rentals/setup"));
export const rentalsProfile = cache(() => get<LandlordProfileView>("/api/v1/ops/rentals/profile"));
export const payoutAccounts = cache(() => get<PayoutAccountList>("/api/v1/ops/payout-accounts"));
export const rentPayouts = cache(() => get<PayoutList>("/api/v1/ops/payouts"));
export const rentalProperties = cache(() => get<RentalPropertyList>("/api/v1/ops/properties"));
export const rentalBlocks = cache(() => get<BlockList>("/api/v1/ops/blocks"));
export const rentalUnits = cache((tab?: UnitListQuery["tab"], blockId?: string, q?: string) =>
  get<RentalUnitList>("/api/v1/ops/units", { tab, blockId, q }),
);
export const unitMedia = cache((unitId: string) => get<UnitMediaView>(`/api/v1/ops/units/${unitId}/media`));

/** The business's team and the invitations it sent (`team.manage` only). */
export const rentalsTeam = cache(
  async (): Promise<{ members: OperatorTeamMember[]; invitations: OperatorStaffInvitation[] }> => {
    const [{ members }, { invitations }] = await Promise.all([
      get<OperatorTeamList>("/api/v1/ops/team"),
      get<OperatorStaffInvitationList>("/api/v1/ops/team/invitations"),
    ]);
    return { members, invitations };
  },
);
