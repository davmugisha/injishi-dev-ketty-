/**
 * A short-stay business's reads (2026-10-29): who the request acts for, how the business is run, and the
 * period activity the home draws. `cache` makes the sidebar and the page share one summary per request.
 */
import type { StaysActivity, StaysSummary } from "@injishi/contracts";
import { cache } from "react";
import { currentAccount, currentApi } from "@/lib/session";
import { ApiError } from "../api";
import { type Workspace, workspaceFor } from "../auth";

export interface StaysScope {
  workspace: Workspace;
  permissions: readonly string[];
}

/** The hospitality business this request acts in, or null. */
export const staysScope = cache(async (): Promise<StaysScope | null> => {
  const account = await currentAccount();
  if (!account) return null;
  const workspace = workspaceFor(account, "hospitality");
  if (!workspace || workspace.domain !== "hospitality") return null;
  return { workspace, permissions: workspace.permissions };
});

async function get<T>(path: string, query?: Record<string, string | undefined>): Promise<T | null> {
  const [scope, api] = await Promise.all([staysScope(), currentApi()]);
  if (!scope) return null;
  try {
    return await api.get<T>(path, { workspaceId: scope.workspace.workspaceId, query });
  } catch (error) {
    // Not a stay business (a bar), or a role that reads neither: the caller falls back.
    if (error instanceof ApiError && (error.status === 404 || error.status === 403)) return null;
    throw error;
  }
}

/** How the business is run and today's counts; null for a business that lets no rooms. */
export const staysSummary = cache(() => get<StaysSummary>("/api/v1/ops/stays-overview/summary"));

/** A period's stays and money (last January to six weeks ahead when unset). */
export const staysActivity = cache((from?: string, to?: string) =>
  get<StaysActivity>("/api/v1/ops/stays-overview/activity", { from, to }),
);

export function can(scope: Pick<StaysScope, "permissions">, ...any: string[]): boolean {
  return any.some((p) => scope.permissions.includes(p));
}

/** Prices and availability by the day, for the calendar (28 days from `from` when unset). */
export const ratesCalendar = cache((from?: string, to?: string) =>
  get<import("@injishi/contracts").RatesCalendar>("/api/v1/ops/rates/calendar", { from, to }),
);
