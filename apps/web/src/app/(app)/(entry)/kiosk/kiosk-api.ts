/**
 * The kiosk's four calls (ADR-058, 058-time AC-TM10), each answered as an
 * outcome the screen draws rather than as an exception.
 *
 * Three of them go through `lib/api.ts` like every other call in this app. The
 * punch does not, and the reason is one field: when a number locks, the API's
 * 423 carries `lockedUntil`, and `apiFetch` keeps only a refusal's message and
 * code. The board names the minute the lock lifts, and working it back out of
 * the English ("Try again in 14 minutes") is the matching on a sentence that
 * `ApiResult.code` exists to stop. So the punch reads its own answer, with the
 * same address, the same ceiling and the same credentials as `apiFetch`.
 *
 * The device token is never in a body and this page never sees it: the API
 * sets it as an HttpOnly cookie scoped to `/api/v1/kiosk`, and
 * `credentials: "include"` is what sends it back.
 */
import { KioskPunchResult, KioskSession } from "@injishi/contracts";

import { API_URL, apiFetch, apiFetchParsed } from "@/lib/api";

/** The same ceiling `apiFetch` puts on one round trip. */
const PUNCH_TIMEOUT_MS = 12_000;

type SessionOutcome =
  | { kind: "paired"; session: KioskSession }
  /** No cookie, a revoked kiosk, or an address the kiosk was not set up for. */
  | { kind: "unpaired" }
  | { kind: "unreachable" };

/** `GET /kiosk/session`: which kiosk this tablet is, and never a list of people. */
export async function readSession(): Promise<SessionOutcome> {
  const result = await apiFetchParsed(KioskSession, "/api/v1/kiosk/session");
  if (result.status === "ok") return { kind: "paired", session: result.data };
  if (result.status === "unauthenticated") return { kind: "unpaired" };
  // A refusal here is a server in trouble (a 5xx, a throttle): either way
  // nothing could be recorded, which is what "cannot reach" tells a person.
  return { kind: "unreachable" };
}

type PairOutcome =
  | { kind: "paired"; session: KioskSession }
  | { kind: "refused"; message: string }
  | { kind: "unreachable" };

/** `POST /kiosk/pair`: the 8 digit code, traded once for the device cookie. */
export async function pairKiosk(code: string): Promise<PairOutcome> {
  const result = await apiFetchParsed(KioskSession, "/api/v1/kiosk/pair", { method: "POST", body: { code } });
  if (result.status === "ok") return { kind: "paired", session: result.data };
  // The API's own sentences ("That code is wrong or has run out. Ask for a new
  // one.", the address list, the throttle) are written for the person holding
  // the tablet, so they are shown as they come.
  if (result.status === "refused") return { kind: "refused", message: result.message };
  return { kind: "unreachable" };
}

/** `POST /kiosk/forget`: the tablet drops its cookie; the kiosk stays, for a new code. */
export async function forgetKiosk(): Promise<boolean> {
  const result = await apiFetch("/api/v1/kiosk/forget", { method: "POST" });
  return result.status === "ok";
}

type PunchOutcome =
  /** `offsetMs` is Injishi's clock minus this tablet's, measured on this answer. */
  | { kind: "recorded"; result: KioskPunchResult; offsetMs: number }
  /** A wrong PIN, an unknown number and a person of another branch, all alike. */
  | { kind: "mismatch" }
  /** Five wrong PINs in a row. `until` is null only if the API left it out. */
  | { kind: "locked"; until: Date | null }
  /** A right PIN within a minute of that person's last punch: not counted. */
  | { kind: "double" }
  /** The cookie no longer names an active kiosk. */
  | { kind: "unpaired" }
  | { kind: "refused"; message: string }
  /**
   * No answer. The request may still have landed: a timeout says nothing about
   * whether Injishi wrote the punch before the line dropped.
   */
  | { kind: "unreachable" };

/** `POST /kiosk/punch`: in when the person has no open record, else out. */
export async function punch(employeeNumber: string, pin: string): Promise<PunchOutcome> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PUNCH_TIMEOUT_MS);
  const sentAt = Date.now();
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1/kiosk/punch`, {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      signal: controller.signal,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ employeeNumber, pin }),
    });
  } catch {
    return { kind: "unreachable" };
  } finally {
    clearTimeout(timer);
  }
  const answeredAt = Date.now();
  if (res.status === 401) return { kind: "unpaired" };

  const body: unknown = await res.json().catch(() => undefined);
  if (res.ok) {
    const parsed = KioskPunchResult.safeParse(body);
    if (!parsed.success) {
      // The punch was written (the API said 200); only its answer is unreadable.
      return {
        kind: "refused",
        message: "Injishi answered in a way this kiosk could not read. Ask the front desk whether your time was recorded before you tap again.",
      };
    }
    const offsetMs = Date.parse(parsed.data.at) - (sentAt + answeredAt) / 2;
    return { kind: "recorded", result: parsed.data, offsetMs };
  }

  // An error the API did not write (no JSON body) is the gateway talking while
  // the API restarts: the "could not ask" case, as `apiFetch` reads it too.
  if (!body || typeof body !== "object") return { kind: "unreachable" };
  const { code, message, lockedUntil } = body as { code?: unknown; message?: unknown; lockedUntil?: unknown };

  if (code === "pin_mismatch") return { kind: "mismatch" };
  if (code === "double_tap") return { kind: "double" };
  if (code === "pin_locked" || res.status === 423) {
    const until = typeof lockedUntil === "string" ? new Date(lockedUntil) : null;
    return { kind: "locked", until: until && !Number.isNaN(until.getTime()) ? until : null };
  }
  if (res.status >= 500) {
    return { kind: "refused", message: "Something went wrong at Injishi, and nothing was recorded. Try again in a moment." };
  }
  // The throttle ("Too many tries on this kiosk. Wait 20 seconds and try
  // again.") and the rare conflict are sentences for the person at the tablet.
  if (typeof message === "string" && message.trim() && !/^(bad request|unprocessable entity|conflict|forbidden|validation failed)\.?$/i.test(message.trim())) {
    return { kind: "refused", message };
  }
  return { kind: "refused", message: "This kiosk could not record that, so nothing changed. Try again, or ask the front desk." };
}
