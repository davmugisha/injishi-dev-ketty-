"use client";

/**
 * Who the signed-in person actually is (ADR-035, D-f wave 2).
 *
 * **This exists because the app was greeting people under someone else's
 * name.** The sidebar read `people[state.role]` out of `data/demo.ts` — a
 * fixture keyed by ROLE — so every receptionist in the system was "Denise
 * Iribagiza", and the name changed when the ROLE changed rather than when the
 * human did. It was the last fixture in the chrome and the only one that
 * misidentified somebody.
 *
 * `GET /api/v1/me/profile` was already served and already mapped; nothing read
 * it. This is that reader.
 *
 * WHAT IT DELIBERATELY DOES NOT DO. It never invents a name. A profile with a
 * null `fullName` is a real state — an account that signed in and has not
 * completed Step 1 — and it renders as "Your account" rather than as a guess
 * from the email address. Guessing a person's name from the left half of their
 * email is how "j.doe" ends up on a payslip.
 */

import { MyProfile } from "@injishi/contracts";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { getJson } from "./api";
import { queryKeys } from "./queries";

/**
 * The profile, or null.
 *
 * Null covers all three unhappy answers on purpose. The chrome's job here is to
 * fall back to a neutral label, and it would do the same thing for "not signed
 * in", "could not reach the API" and "the shape drifted". The gate above the
 * app is what handles a dead session; a name is not the place to discover it.
 */
export async function fetchMyProfile(): Promise<MyProfile | null> {
  const res = await getJson<unknown>("/me/profile");
  if (res.outcome !== "ok") return null;
  const parsed = MyProfile.safeParse(res.data);
  return parsed.success ? parsed.data : null;
}

export function useMyProfile(): UseQueryResult<MyProfile | null> {
  return useQuery({
    queryKey: queryKeys.meProfile,
    queryFn: fetchMyProfile,
    /*
     * A name does not go stale the way a permission does.
     *
     * `me.workspaces` refetches on focus and after 60 seconds because a
     * revoked permission has to stop enabling its button quickly (ADR-012,
     * AC-15). Nobody is renamed mid shift, so this one is left alone: an hour
     * is long enough that the chrome costs one request per session, and short
     * enough that editing your own profile shows up the same day.
     */
    staleTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
