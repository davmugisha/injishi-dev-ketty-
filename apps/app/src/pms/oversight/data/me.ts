import { OversightConsoleGrant } from "@injishi/contracts";

import { toTwoFactorState, type TwoFactorState } from "../../data/two-factor";
import { officerKeyForConsole } from "./officer";
import type { OfficerKey } from "./types";

/**
 * The client for `/api/v1/me/oversight` (ADR-018 move 2, superseded by ADR-029).
 *
 * WHICH CONSOLE A PERSON MAY OPEN IS A SERVER FACT. An officer's authority is a
 * row in `oversight_assignments`, and a revoked grant is simply absent, which is
 * why "no assignment" and "no console" are the same answer here. The app renders
 * that answer; it never decides it.
 *
 * IT ASKS THE MARKETPLACE API NOW, and that is the whole of ADR-029. The console
 * used to talk to a separate API origin, one listed in the API's
 * `OVERSIGHT_HOSTNAMES`, so the request carried a session minted by a Better
 * Auth instance that only this console could reach. Living inside pms it carries
 * the OPERATOR's session instead. `/api/v1/me/oversight` is guarded by
 * `SessionGuard` alone with no surface restriction, so it answers that session
 * exactly as readily — which is why a hotelier's own cookie can now open the
 * queue that reviews their hotel. That separation was the point of ADR-018 and
 * it is gone; `OversightGuard` on the API is the only control left, and it asks
 * about an ASSIGNMENT, never about which door the session came through.
 *
 * The queues themselves are live now: `data/queue.ts` reads
 * `/api/v1/oversight/verification-queue` and `/approval-queue`, and posts the
 * gate verbs on `/api/v1/registrations/:id/*`.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/**
 * How long to wait before giving up.
 *
 * Not a nicety. A request with no ceiling can stay pending when the API refuses
 * the connection, and anything gating render on it then hangs forever instead of
 * failing. A console needs a definite answer, including a definite "no answer".
 */
const REQUEST_TIMEOUT_MS = 6_000;

/**
 * Every "we are not rendering a console" answer, in one place.
 *
 * Spread into each early return rather than repeated, because the four fields have
 * to stay in step: a return that forgot `grants` would hand the shell an undefined
 * to build an officer from, on the one screen where a blank posting is worst.
 */
const NO_ACCESS = {
  consoles: [] as OfficerKey[],
  grants: [] as OversightConsoleGrant[],
  membership: null,
  unbuiltConsoles: [] as OversightConsoleGrant[],
  twoFactor: null,
} as const;

export type OfficerStatus =
  /** Still asking. Render neither branch yet. */
  | "loading"
  /** The API answered with this person's grants. */
  | "resolved"
  /** The API answered, and nobody is signed in. */
  | "anonymous"
  /** The API could not be reached. Says nothing either way about the session. */
  | "unreachable";

export interface OfficerAccess {
  status: OfficerStatus;
  /** The consoles this person may open. Empty is a real answer, not an error. */
  consoles: OfficerKey[];
  /**
   * The grants themselves (ADR-053, AC-G5).
   *
   * This used to be thrown away — the response was read for its `console` field
   * and nothing else, so the officer's body, title and region came from a fixture
   * of two invented officers. Every one of them is on the grant now.
   */
  grants: OversightConsoleGrant[];
  /**
   * The PSF membership officer posting (ADR-056), when this person holds one.
   * Its console is its own route with its own data, not one of the two
   * registration gates `consoles` lists, so it is carried apart from them.
   */
  membership: OversightConsoleGrant | null;
  /**
   * A posting whose console is NOT BUILT, and is refused honestly (AC-G7).
   *
   * `tax_compliance_officer` is a real appointment admin can record and has no
   * surface here. Carrying it separately is what lets the boundary say so, instead
   * of showing an empty queue that answers 403 to every action — which reads as
   * "your access is broken" rather than "this does not exist yet".
   */
  unbuiltConsoles: OversightConsoleGrant[];
  /** Whether a second factor is still owed for this session (F-S02). */
  twoFactor: TwoFactorState | null;
}

interface OversightResponse {
  consoles?: unknown[];
  twoFactor?: unknown;
}

/**
 * Every console this person may open.
 *
 * Settles into exactly one of three answers, and callers must not merge any two
 * of them. `anonymous` means there is no session. `unreachable` means we could
 * not ask, which is not the same fact and must never be read as "no access".
 * `resolved` with an EMPTY list means they are signed in and hold no assignment
 * — a normal place to be, and not an error.
 */
export async function fetchMyConsoles(): Promise<OfficerAccess> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}/api/v1/me/oversight`, {
      credentials: "include",
      cache: "no-store",
      signal: controller.signal,
    });
    if (res.status === 401) return { ...NO_ACCESS, status: "anonymous" };
    if (!res.ok) return { ...NO_ACCESS, status: "unreachable" };

    const body = (await res.json()) as OversightResponse;
    // Parsed against the CONTRACT rather than duck-typed. The officer's body,
    // title and region are rendered straight onto a government console now, so a
    // response that has drifted should read as unreachable rather than as a seat
    // with blank fields.
    const grants = (body.consoles ?? [])
      .map((raw) => OversightConsoleGrant.safeParse(raw))
      .filter((r) => r.success)
      .map((r) => r.data);

    const consoles = grants
      .map((g) => officerKeyForConsole(g.console))
      .filter((k): k is OfficerKey => k !== null);

    return {
      status: "resolved",
      consoles,
      grants: grants.filter((g) => officerKeyForConsole(g.console) !== null),
      membership: grants.find((g) => g.console === "membership") ?? null,
      unbuiltConsoles: grants.filter(
        (g) => officerKeyForConsole(g.console) === null && g.console !== "membership",
      ),
      twoFactor: toTwoFactorState(body.twoFactor),
    };
  } catch {
    // Abort, refused connection, DNS, malformed JSON. We learned nothing.
    return { ...NO_ACCESS, status: "unreachable" };
  } finally {
    clearTimeout(timer);
  }
}
