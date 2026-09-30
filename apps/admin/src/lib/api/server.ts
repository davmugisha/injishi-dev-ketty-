import { cookies } from "next/headers";
import { STAFF_PERMISSION_LABEL, type StaffPermission } from "@injishi/contracts";

import { API_BASE_URL } from "./base-url";

/**
 * The one way the admin console talks to the API (F-A*, ADR-029).
 *
 * Every read happens HERE, on the server, during the render of the page that
 * needs it. That is the decision the whole console is built on, and it is not
 * a performance preference:
 *
 * - The staff check is a server concern. A sidebar listing Finance and
 *   Compliance is itself a disclosure, and a browser-side gate necessarily
 *   paints something before it can refuse. Deciding here means an unauthorised
 *   caller never receives the markup at all.
 * - It is provable without a browser. A server-rendered page puts the value in
 *   the HTML, so a gate can start the app against a stub API and assert with an
 *   ordinary `fetch` that the stub's value reached the page.
 *
 * Four contracts run through this file. Each one exists because breaking it
 * produced a real bug somewhere in this repo already:
 *
 * 1. **The caller's own cookie is forwarded.** The Better Auth session cookie
 *    belongs to the API origin (:8000) and this console runs on :3001. A
 *    server-side `fetch` carries no cookie jar of its own, so a call without
 *    this header is an ANONYMOUS call — the API answers 401 and the console
 *    reports "sign in" to somebody who already has.
 * 2. **Every request is bounded.** A fetch with no ceiling can stay pending
 *    when the API refuses the connection; a page awaiting it then hangs rather
 *    than failing. web fixed exactly this bug once (`lib/api.ts`,
 *    `lib/session.ts`); admin must not reintroduce it.
 * 3. **The body is parsed, never trusted.** A shape we cannot vouch for is not
 *    something to render half of. Reading a field off an unparsed body is how
 *    an `undefined` silently becomes a falsy "no".
 * 4. **The outcome is returned, not thrown.** Callers render every branch, so
 *    throwing would only move the same four cases into a catch block further
 *    from the screen that has to show them.
 */

/** Ceiling on one admin round trip. */
const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Why a read produced nothing, in the four flavours that need different words.
 *
 * `unreachable` is kept apart from `anonymous` and `denied` for the reason
 * `apps/web/src/lib/session.ts` states: a network failure is not a "no".
 * Rendering one as a refusal is a lie about the caller's access, and sending a
 * signed-in staffer back to the sign-in screen because the API blinked is a
 * loop they cannot get out of.
 *
 * `invalid` is separate again: the API answered, and we could not read it. That
 * is a platform bug, not an access decision, and it must never be worded as
 * either.
 *
 * `missing` is the fifth for the same reason the other four are separate. The
 * platform answered and said the record does not exist — a mistyped id in the
 * address bar. It was folded into `unreachable` at first, which made a detail
 * page report a network problem about a server that had just replied.
 *
 * `step_up` is the sixth. The platform knows who this is and would let them
 * in, but wants the emailed code first (F-S02). It is a 403 on the wire, so it
 * would read as `denied` if the body were ignored — telling a staffer who holds
 * the permission that they do not, with no way forward.
 */
export type ApiFailure =
  | "anonymous"
  | "denied"
  | "unreachable"
  | "invalid"
  | "missing"
  | "step_up";

/**
 * What a WRITE can answer that a read never does.
 *
 * `conflict` is a 409: the platform understood the request, knows who is
 * asking, and refused the move because the record is not in a state that
 * allows it — reinstating a business that is not suspended, ending your own
 * sessions. Before this existed a 409 fell through to `unreachable`, so an
 * illegal move read as "the platform didn't answer", which sent a staffer to
 * check their network over a business that had simply already been reinstated
 * by a colleague.
 *
 * `rejected` is a 400 or 422: the platform refused the request's shape. The
 * console validates before sending, so reaching it means the two sides
 * disagree about the contract — a bug, worded as one.
 *
 * They are kept OFF `ApiFailure` on purpose. No read route answers either, and
 * adding them there would make every read-only page carry a sentence for a
 * state it can never be in.
 */
export type ApiWriteFailure = ApiFailure | "conflict" | "rejected";

/**
 * `detail` is the API's own sentence for a `conflict`, `rejected` or `denied`
 * refusal, when the body carried one as a plain string. A 403 is included
 * because not every one is about a missing permission: ADR-049's
 * `assertMayManage` answers "That is not one of your sessions." to a trainer
 * who holds the permission and is not on that session. Nest's `ConflictException` and
 * `UnprocessableEntityException` bodies are written for a person ("That venue
 * is retired. Pick one that is still in use."), and a write whose refusals are
 * business rules rather than contract bugs can word itself from it. It is
 * never set for a Zod rejection, whose `message` is "Validation failed" plus an
 * `issues` array: that is a contract disagreement and keeps the bug wording.
 */
export type ApiWriteResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      reason: ApiWriteFailure;
      /**
       * The platform's own sentence, when a refusal carried one written for a
       * person. A 409 overlap on an officer appointment and a 422 past-dated fee
       * are decisions with reasons, and "that isn't possible from the record's
       * current state" throws the reason away. Framework defaults ("Conflict",
       * "Validation failed") are never kept here.
       */
      message?: string;
      /**
       * The raw `message` of a 403, 409 or 422, for an action whose own
       * `refusal` wording reads it (training's roster writes). Not shown as is.
       */
      detail?: string;
      /**
       * The refusal body's machine `code`, when it carried one (`conversation_full`
       * from the support assistant). Read by an action that branches on it; it
       * is never shown.
       */
      code?: string;
    };

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: ApiFailure };

/**
 * What this file needs from a contract schema, expressed structurally.
 *
 * Every `Admin*` export in `@injishi/contracts` satisfies it, but admin does
 * not depend on `zod` itself — under pnpm's strict layout it cannot resolve
 * one — so the dependency here is on the SHAPE rather than on the library.
 */
export interface ResponseSchema<T> {
  safeParse(value: unknown): { success: true; data: T } | { success: false };
}

/** A query value the console may send; absent values are dropped. */
export type QueryValue = string | number | boolean | undefined | null;

/**
 * Paging, on every list route.
 *
 * `page` is 1-based and `pageSize` is capped at 100 by the contract. Sending
 * neither is legal and means "the first page at the API's default size" — the
 * console must not hold a second opinion about what that default is.
 */
export interface PageQuery {
  page?: number;
  pageSize?: number;
}

/**
 * Build the query string, dropping absent values.
 *
 * Absent must not become `?q=undefined`. The API parses its query with a Zod
 * schema, and a literal "undefined" is a value that fails validation rather
 * than a filter that was never applied.
 */
function queryString(query?: Record<string, QueryValue>): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const encoded = params.toString();
  return encoded ? `?${encoded}` : "";
}

/**
 * The caller's session cookie, as a header value.
 *
 * Built from `getAll()` rather than trusting a serialiser, and empty when the
 * request carried nothing — which is itself a valid state, answered by the API
 * with the 401 this file turns into `anonymous`.
 */
async function callerCookie(): Promise<string> {
  try {
    const jar = await cookies();
    return jar
      .getAll()
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");
  } catch {
    // Outside a request scope (a prerender pass, an error boundary) there is no
    // caller and therefore no cookie. An anonymous read is the correct outcome
    // there; crashing the render is not.
    return "";
  }
}

/**
 * Turn a refused response into the reason a screen can word.
 *
 * 401 and 403 are the only two statuses that say anything about the caller.
 * `SessionGuard` answers the first, `StaffGuard` the second, and they need
 * different sentences: one is "sign in", the other is "this is not yours".
 * Sending the second person to a sign-in screen they have already passed is the
 * loop this split exists to prevent.
 *
 * A 403 is read for its `code` because not every 403 is a "no". When
 * `StaffGuard` refuses for the emailed step-up (F-S02), the body carries
 * `code: "two_factor_required"`, and the right response is "enter your code",
 * not "this account doesn't hold the permission". Reading every 403 as `denied`
 * would tell a super_admin who simply has not typed their code yet that they
 * lack a power they hold — and would give them no way forward.
 */
async function refusalFor(res: Response): Promise<ApiWriteFailure | null> {
  if (res.status === 401) return "anonymous";
  if (res.status === 403) {
    try {
      const body = (await res.clone().json()) as { code?: unknown };
      if (body && body.code === "two_factor_required") return "step_up";
    } catch {
      // A 403 whose body is not JSON is still a refusal; only its reason is
      // unknown, and "denied" is the honest reading of an unexplained no.
    }
    return "denied";
  }

  // A 404 is an answer, not a failure to answer. The platform replied and said
  // this record does not exist — which is what a mistyped org id in the address
  // bar produces. Folding it into `unreachable` made that page say "can't reach
  // the platform" about a platform that had just answered.
  if (res.status === 404) return "missing";

  // Everything else that is not 2xx — a 500, a proxy's 502 — is the platform
  // failing to answer, NOT a decision about this caller.
  // A decision about the REQUEST rather than about the platform's health.
  if (res.status === 409) return "conflict";
  if (res.status === 400 || res.status === 422) return "rejected";

  if (!res.ok) return "unreachable";
  return null;
}

/** Nest's and Fastify's own words for a status. Never shown to a staffer. */
const FRAMEWORK_WORDS = new Set([
  "Bad Request",
  "Conflict",
  "Forbidden",
  "Forbidden resource",
  "Not Found",
  "Unprocessable Entity",
  "Unauthorized",
  "Validation failed",
  "Internal server error",
]);

/**
 * The refusal's `message`, when it is a sentence somebody wrote for a person.
 *
 * Kept strict for the reason the operator app's twin is: a sentence mistaken for
 * machinery costs a vaguer toast, while machinery mistaken for a sentence puts a
 * schema path in front of a staffer. A 5xx body is never read, because a server
 * error's message is as likely to be a developer's assertion as a decision.
 */
async function personSentence(res: Response): Promise<string | undefined> {
  if (res.status >= 500) return undefined;
  try {
    const body = (await res.clone().json()) as { message?: unknown };
    const raw = Array.isArray(body?.message)
      ? body.message.length === 1
        ? body.message[0]
        : undefined
      : body?.message;
    if (typeof raw !== "string") return undefined;
    const text = raw.trim();
    if (text.length < 12 || text.length > 400 || FRAMEWORK_WORDS.has(text)) return undefined;
    if (!/^[A-Z“"']/.test(text) || !/[.!?”"]$/.test(text)) return undefined;
    if (/Exception|Guard|undefined|Cannot (GET|POST|PATCH|DELETE)/.test(text)) return undefined;
    return text;
  } catch {
    return undefined;
  }
}

/**
 * The API's sentence for a 403, 409 or 422, when there is exactly one.
 *
 * A string `message` only. An array (class-validator) or the Zod pipe's
 * "Validation failed" is a contract disagreement, not a rule a staffer broke,
 * and must keep reading as a bug on our side.
 */
async function refusalDetail(res: Response): Promise<string | undefined> {
  try {
    const body = (await res.clone().json()) as { message?: unknown };
    const message = body?.message;
    if (typeof message !== "string") return undefined;
    if (message.length === 0 || message === "Validation failed") return undefined;
    return message;
  } catch {
    return undefined;
  }
}

/** The refusal body's `code`, when it is a plain string. */
async function refusalCode(res: Response): Promise<string | undefined> {
  try {
    const body = (await res.clone().json()) as { code?: unknown };
    return typeof body?.code === "string" ? body.code : undefined;
  } catch {
    return undefined;
  }
}

/**
 * One bounded, cookie-forwarding round trip, parsed against its contract.
 *
 * Shared by reads and writes so the five outcomes are decided in one place.
 * A write that decided them differently would be the second copy this file
 * exists to prevent.
 */
async function send<T>(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  schema: ResponseSchema<T>,
  query?: Record<string, QueryValue>,
  body?: unknown,
  timeoutMs: number = REQUEST_TIMEOUT_MS,
): Promise<ApiWriteResult<T>> {
  const cookie = await callerCookie();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers: Record<string, string> = {};
    if (cookie) headers.cookie = cookie;
    if (body !== undefined) headers["content-type"] = "application/json";

    let res: Response;
    try {
      res = await fetch(`${API_BASE_URL}${path}${queryString(query)}`, {
        method,
        cache: "no-store",
        signal: controller.signal,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      // Refused, DNS-dead, or past the ceiling above. All three mean the same
      // thing to a screen: we could not ask.
      return { ok: false, reason: "unreachable" };
    }

    const refusal = await refusalFor(res);
    if (refusal) {
      const message = await personSentence(res);
      const detail =
        refusal === "conflict" || refusal === "rejected" || refusal === "denied"
          ? await refusalDetail(res)
          : undefined;
      const code = await refusalCode(res);
      return {
        ok: false,
        reason: refusal,
        ...(message ? { message } : {}),
        ...(detail !== undefined ? { detail } : {}),
        ...(code !== undefined ? { code } : {}),
      };
    }

    let parsed: unknown;
    try {
      // A write may answer 204 with no body. Parse an empty body as `null` so a
      // schema that expects nothing can say so, rather than failing to read.
      const text = await res.text();
      parsed = text.length === 0 ? null : JSON.parse(text);
    } catch {
      // A body that stalled past the ceiling is a transport failure; a body
      // that arrived and would not parse is a platform bug. Different words.
      return {
        ok: false,
        reason: controller.signal.aborted ? "unreachable" : "invalid",
      };
    }

    const result = schema.safeParse(parsed);
    if (!result.success) return { ok: false, reason: "invalid" };
    return { ok: true, data: result.data };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Read one admin endpoint as the signed-in staffer.
 *
 * `cache: "no-store"` on purpose. A control tower showing yesterday's review
 * queue is worse than one showing a spinner: the whole point of the screen is
 * that the number on it is the number right now.
 */
export function apiGet<T>(
  path: string,
  schema: ResponseSchema<T>,
  query?: Record<string, QueryValue>,
): Promise<ApiResult<T>> {
  return send("GET", path, schema, query).then(asRead);
}

/**
 * Narrow a result to what a read may report.
 *
 * A read answered with 409 or 400 means this console asked for something the
 * API will not serve in that shape — a bug on our side. `invalid` is the read
 * outcome already worded as exactly that, so the two collapse onto it here
 * rather than every page learning two sentences it should never need.
 */
function asRead<T>(result: ApiWriteResult<T>): ApiResult<T> {
  if (result.ok) return result;
  if (result.reason === "conflict" || result.reason === "rejected") {
    return { ok: false, reason: "invalid" };
  }
  return { ok: false, reason: result.reason };
}

/**
 * Perform one admin write as the signed-in staffer.
 *
 * Server-side only, like every read: the session cookie belongs to the API
 * origin, so a browser-side `fetch` from this console would be anonymous. A
 * button that writes calls a Server Action, and the action calls this.
 *
 * Returns the same five outcomes as a read, so a button can say "enter your
 * code" or "can't reach the platform" instead of assuming the write went
 * through. Assuming it went through is precisely the bug the `notBuilt`
 * sentence was written to stop.
 */
export function apiPost<T>(
  path: string,
  schema: ResponseSchema<T>,
  body?: unknown,
  /**
   * A longer ceiling for the one write that legitimately outlasts ten seconds:
   * a support assistant turn, which the API bounds at 55 s (ADR-061 D-p).
   */
  options?: { timeoutMs?: number },
): Promise<ApiWriteResult<T>> {
  return send("POST", path, schema, undefined, body ?? {}, options?.timeoutMs);
}

/**
 * A removal, as the signed-in staffer. A `DELETE` carries no body, because not
 * every proxy forwards one; routes that need a reason take it on the query.
 */
export function apiDelete<T>(
  path: string,
  schema: ResponseSchema<T>,
  query?: Record<string, QueryValue>,
): Promise<ApiWriteResult<T>> {
  return send("DELETE", path, schema, query);
}

/**
 * A partial edit (`PATCH`), with the same five outcomes as `apiPost`.
 *
 * Separate rather than a `method` argument on `apiPost`, so a call site says
 * which verb it is at a glance: the API's edit routes (ADR-049 courses, venues
 * and sessions, ADR-053 government bodies) are PATCH, and a POST to them is a
 * 404.
 */
export function apiPatch<T>(
  path: string,
  schema: ResponseSchema<T>,
  body: unknown,
): Promise<ApiWriteResult<T>> {
  return send("PATCH", path, schema, undefined, body);
}

/**
 * The sentence for a failed read, so the four outcomes cannot drift into three.
 *
 * `anonymous` gets copy too, because a section can fail that way mid-session
 * while the shell around it still stands; whether to redirect instead is the
 * caller's decision, not this file's.
 */
export function apiFailureMessage(reason: ApiFailure): string {
  switch (reason) {
    case "anonymous":
      return "Your session has ended. Sign in again to carry on.";
    case "denied":
      return "This account doesn't hold the staff permission this section needs. Ask a Super Admin if your work calls for it.";
    case "unreachable":
      return "The platform didn't answer, which says nothing about your access. Nothing you did caused this. Try again in a moment.";
    case "invalid":
      return "The platform answered with something this console couldn't read. That's a bug on our side, not a problem with your account.";
    case "step_up":
      return "This console needs the code we emailed you before it will open. Your access is intact — enter the code to carry on.";
    case "missing":
      return "That record doesn't exist. Check the address, or it may have been removed since this link was made.";
  }
}

/**
 * The HEADING over that sentence, in the caller's own terms.
 *
 * One copy, because eight pages each held their own and every one of them
 * printed the raw permission key at a staffer ("This account doesn't hold
 * admin.finance.view"). A permission key is the model's name for a power, not
 * a person's, so the human label from `@injishi/contracts` is used instead and
 * the key never reaches a screen.
 *
 * `permission` is the one the section's route declares. Without it the refusal
 * is still worded, just not named — better than naming the wrong power.
 */
export function failureHeading(
  reason: ApiFailure,
  permission?: StaffPermission,
): string {
  switch (reason) {
    case "anonymous":
      return "Your session has ended";
    case "denied":
      return permission
        ? `This account can't ${STAFF_PERMISSION_LABEL[permission]}`
        : "This account can't open this";
    case "unreachable":
      return "Can't reach the platform";
    case "invalid":
      return "We couldn't read the platform's answer";
    case "missing":
      return "That record isn't here";
    case "step_up":
      return "Enter the code we emailed you to carry on";
  }
}
