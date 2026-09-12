import { toTwoFactorState, type TwoFactorState } from "../../data/me";
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
  /** Whether a second factor is still owed for this session (F-S02). */
  twoFactor: TwoFactorState | null;
}

interface OversightResponse {
  consoles?: {
    console?: unknown;
    body?: unknown;
    title?: unknown;
  }[];
  twoFactor?: unknown;
}

/** Which console an oversight function opens. `tax` has no surface here yet. */
function toOfficerKey(value: unknown): OfficerKey | null {
  if (value === "verification") return "verifier";
  if (value === "approval") return "approver";
  return null;
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
    if (res.status === 401) return { status: "anonymous", consoles: [], twoFactor: null };
    if (!res.ok) return { status: "unreachable", consoles: [], twoFactor: null };

    const body = (await res.json()) as OversightResponse;
    const consoles = (body.consoles ?? [])
      .map((c) => toOfficerKey(c.console))
      .filter((k): k is OfficerKey => k !== null);
    return { status: "resolved", consoles, twoFactor: toTwoFactorState(body.twoFactor) };
  } catch {
    // Abort, refused connection, DNS, malformed JSON. We learned nothing.
    return { status: "unreachable", consoles: [], twoFactor: null };
  } finally {
    clearTimeout(timer);
  }
}
