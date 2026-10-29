"use client";

/**
 * Who the signed-in person is ON THE DEMO ROSTER, and their story.
 *
 * Two reads, both only once the platform has said `demo`:
 *
 * - the session's email, from Better Auth through `@injishi/auth/client` (the
 *   same builder `data/sign-out.ts` uses). `/me/profile` carries a name and no
 *   email, and a name is not an identity: two personas could share one;
 * - `GET /api/v1/demo/personas`, which is public, 404s off the demo, and is
 *   where each persona's story is written, so the web picker, web's `/demo`
 *   page and this guide all read one copy.
 *
 * Neither is ever fired on production: `enabled` is the platform answer, so a
 * real operator's browser never asks for a roster that does not exist there.
 */

import { makeAuthClient } from "@injishi/auth/client";
import { DemoPersona, type PlatformInfo } from "@injishi/contracts";
import { useQuery } from "@tanstack/react-query";

import { API_BASE, getJson } from "../../data/api";
import { findPersona, guideAllowed } from "./guide-logic";

const authClient = makeAuthClient(API_BASE);

/** The session's email, or null for no session / no answer. */
async function fetchSessionEmail(): Promise<string | null> {
  try {
    const res = await authClient.getSession();
    const user = (res.data as { user?: { email?: unknown } } | null)?.user;
    return typeof user?.email === "string" ? user.email : null;
  } catch {
    return null;
  }
}

/** The roster, or an empty list when it cannot be read. Never throws. */
async function fetchRoster(): Promise<DemoPersona[]> {
  const read = await getJson<unknown>("/demo/personas");
  if (read.outcome !== "ok") return [];
  if (!Array.isArray(read.data)) return [];
  // Row by row: one persona the contract rejects is left out, not the roster.
  return read.data.flatMap((row) => {
    const parsed = DemoPersona.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
}

export function useDemoPersona(platform: PlatformInfo | null): DemoPersona | null {
  const enabled = guideAllowed(platform);
  const { data: email } = useQuery({
    queryKey: ["demo-guide", "session-email"],
    queryFn: fetchSessionEmail,
    enabled,
    // Who is signed in does not change without a document navigation (sign
    // out is a hard navigation), so one read per page load is enough.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
  const { data: roster } = useQuery({
    queryKey: ["demo-guide", "personas"],
    queryFn: fetchRoster,
    enabled,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  if (!enabled || !roster) return null;
  return findPersona(roster, email ?? null);
}
