/**
 * The local leader's reads (P5): the guest console, one guest, and the report, over the API client as the
 * signed-in person. Scope is the API's: a leader reads only their own area, and a person who holds no
 * leader post is refused (403), which these hand back as `null` so the page can say so. Server side only.
 */
import type {
  GuestReport,
  GuestReportQuery,
  LeaderGuest,
  LeaderGuestPage,
  LeaderGuestQuery,
  LeaderSummary,
} from "@injishi/contracts";
import { cache } from "react";
import { currentApi } from "@/lib/session";
import { ApiError } from "../api";

/** A read the person may not make (403: no leader post) comes back null; anything else throws. */
async function leaderOnly<T>(read: Promise<T>): Promise<T | null> {
  try {
    return await read;
  } catch (error) {
    if (error instanceof ApiError && error.forbidden) return null;
    throw error;
  }
}

type Query = Record<string, string | number | undefined>;

function clean(q: Query): Record<string, string | undefined> {
  return Object.fromEntries(
    Object.entries(q).map(([k, v]) => [k, v === undefined || v === "" ? undefined : String(v)]),
  );
}

export const leaderSummary = cache(async (): Promise<LeaderSummary | null> => {
  const api = await currentApi();
  return leaderOnly(api.get<LeaderSummary>("/api/v1/oversight/guests/summary"));
});

export async function leaderGuests(query: Partial<LeaderGuestQuery>): Promise<LeaderGuestPage | null> {
  const api = await currentApi();
  return leaderOnly(api.get<LeaderGuestPage>("/api/v1/oversight/guests", { query: clean(query) }));
}

/** One guest in the leader's area, or null when it is not theirs to read (404) or they hold no post. */
export async function leaderGuest(id: string): Promise<LeaderGuest | null> {
  const api = await currentApi();
  try {
    return await api.get<LeaderGuest>(`/api/v1/oversight/guests/${encodeURIComponent(id)}`);
  } catch (error) {
    if (error instanceof ApiError && (error.forbidden || error.notFound)) return null;
    throw error;
  }
}

export async function leaderReport(query: GuestReportQuery): Promise<GuestReport | null> {
  const api = await currentApi();
  return leaderOnly(api.get<GuestReport>("/api/v1/oversight/guests/reports", { query: clean(query) }));
}
