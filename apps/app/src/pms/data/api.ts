/**
 * The one way this app talks to the API (ADR-012).
 *
 * Every read and every command goes through here, so the two things that must
 * be true of a call in a hotel are true once rather than per call site: it has
 * a ceiling, and a refusal is a typed value rather than a thrown string.
 *
 * Nothing in this file decides a permission. The server decides; this is the
 * wire.
 */

import { branchHeader } from "./branch";

/**
 * Where the API lives.
 *
 * A default of "" (same origin) is wrong here — the API is a separate Nest
 * service — and with no env file present every page load fired at the Next
 * server and took a 404. `apps/web` has always defaulted to the API's dev
 * origin, and one variable must not mean two things across two apps.
 * Override via NEXT_PUBLIC_API_URL; `.env.example` documents it.
 */
export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/**
 * How long to wait before giving up.
 *
 * Not a nicety. A request with no ceiling can stay pending when the API refuses
 * the connection, and anything gating render on it then hangs forever instead
 * of failing. A front desk needs a definite answer, including a definite "no
 * answer".
 */
export const REQUEST_TIMEOUT_MS = 6_000;

/**
 * A refusal the caller can branch on.
 *
 * `status` is what matters: a 403 is the server telling us our capability
 * picture is stale, and that is the strongest freshness signal this app gets
 * (ADR-012, AC-15). The query client watches for exactly this.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /**
     * The refusal's parsed body, when it had one. `message` is already the
     * sentence to show; this is for a screen that needs a refusal's machine
     * readable detail as well, such as the `blockers` a publish refusal lists.
     */
    readonly body: unknown = null,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Was this failure the server refusing, rather than the network dying? */
export function isForbidden(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403;
}

/**
 * Did we learn nothing about the outcome, rather than learning it failed?
 *
 * A dead socket, a timeout and a gateway that gave up all leave the command's
 * fate unknown: it may well have run. That is a different sentence from "it was
 * refused", and a money command especially must not be told to retry as if
 * nothing happened.
 */
export function isUnconfirmed(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 0 || error.status === 502 || error.status === 504);
}

interface ErrorBody {
  message?: string | string[];
}

/* ── What a person is told when something fails ──────────────────────────── */

/**
 * Our own words, by what actually happened.
 *
 * They exist because the API's words are not always FOR a person. Most of its
 * refusals are written sentences ("This deposit has already been settled.") and
 * those are better than anything invented here — they know the case. But a
 * guard that simply returns false yields Nest's "Forbidden resource", a failed
 * schema check yields "Validation failed" or an array of validator fragments,
 * and an unhandled throw yields "Internal server error". None of those are
 * something to put in front of a receptionist with a guest at the desk.
 *
 * Every sentence says what happened to the WORK, not what happened to the
 * request, because that is the only part the operator can act on.
 */
const OWNED = {
  conflict:
    "That changed while you were looking at it — reload to see where it stands. Nothing was changed.",
  forbidden:
    "You don't have permission to do that here. An owner or manager can change what your role allows.",
  gone: "That isn't here any more. Reload to see where things stand.",
  refused: "That didn't go through, and nothing was changed. Check what you entered and try again.",
  server: "Something went wrong on our side and nothing was changed. Try again in a moment.",
  signedOut: "Your session has ended. Sign in again to carry on.",
  tooFast: "That was a lot of requests at once. Wait a moment and try again.",
  unconfirmed:
    "We couldn't confirm that — the server didn't answer. Check the screen before trying again, it may have gone through.",
  unknown:
    "Something went wrong on our side, and we can't tell whether it went through. Check the screen before trying again.",
} as const;

/** Nest's and Fastify's own words for a status. Never shown to a person. */
const FRAMEWORK_WORDS = new Set([
  "Bad Request",
  "Conflict",
  "Forbidden",
  "Forbidden resource",
  "Gone",
  "Internal server error",
  "Not Found",
  "Payload Too Large",
  "Service Unavailable",
  "Too Many Requests",
  "Unauthorized",
  "Unprocessable Entity",
  "Validation failed",
]);

/**
 * Is this message a sentence somebody wrote for a person to read?
 *
 * The test is deliberately strict, because the cost of being wrong runs one
 * way: a human sentence mistaken for machinery is replaced by our own slightly
 * vaguer one, while machinery mistaken for a sentence puts "property
 * amountRwf should not exist" on the front desk. The API's own refusals are
 * written as sentences — a capital, a full stop, more than a couple of words —
 * and class-validator fragments, Nest defaults and Fastify's parser errors are
 * not.
 */
function looksWrittenForAPerson(message: string): boolean {
  const text = message.trim();
  if (text.length < 12 || text.length > 400) return false;
  if (FRAMEWORK_WORDS.has(text)) return false;
  if (!/^[A-Z“"']/.test(text)) return false;
  if (!/[.!?”"]$/.test(text)) return false;
  // Anything addressed to whoever wrote the route rather than to the operator.
  if (/Exception|Guard|@UseGuards|@CurrentUser|undefined|Cannot (GET|POST|PUT|PATCH|DELETE)/.test(text)) {
    return false;
  }
  return true;
}

/** The one custom sentence in an error body, when there is one. */
function customSentence(body: ErrorBody | null): string | null {
  const raw = body?.message;
  // An ARRAY is class-validator's field-by-field report. Joined, it reads as a
  // paragraph of schema; it is only ever worth showing when it holds a single
  // sentence somebody wrote.
  const one = Array.isArray(raw) ? (raw.length === 1 ? raw[0] : null) : raw;
  if (typeof one !== "string") return null;
  return looksWrittenForAPerson(one) ? one.trim() : null;
}

/**
 * What to tell a person about a failed call.
 *
 * The server's own sentence wins wherever it has one, EXCEPT on a 500 and on a
 * gateway failure: a 500 is as likely to be a developer's assertion as a
 * refusal, and a gateway failure is not the API talking at all.
 */
export function humanMessage(status: number, body: ErrorBody | null): string {
  const custom = customSentence(body);
  if (status === 0 || status === 502 || status === 504) return OWNED.unconfirmed;
  if (status === 401) return OWNED.signedOut;
  if (status === 429) return OWNED.tooFast;
  if (status >= 500) return custom && status !== 500 ? custom : OWNED.server;
  if (custom) return custom;
  if (status === 403) return OWNED.forbidden;
  if (status === 404 || status === 410) return OWNED.gone;
  if (status === 409) return OWNED.conflict;
  return OWNED.refused;
}

/**
 * The sentence to show for anything a command or a mutation threw.
 *
 * `ApiError` is already humanised at the wire, so this mostly passes it
 * through; everything else is a fault in this app — a response that would not
 * parse, a bug — and gets owned wording rather than its own `message`, which
 * was written for a stack trace.
 */
export function humanError(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return OWNED.unknown;
}

/** Nest sends `message` as a string or an array of them. Read both. */
export async function readRefusal(res: Response): Promise<ApiError> {
  let body: ErrorBody | null = null;
  try {
    body = (await res.json()) as ErrorBody;
  } catch {
    // A non JSON error body is not worth failing over.
  }
  return new ApiError(res.status, humanMessage(res.status, body), body);
}

/**
 * Send one file as multipart/form-data, and read the answer.
 *
 * A sibling of `command` rather than an option on it: an upload carries no
 * workspace (the bytes go up before the write that gives them a home, which is
 * the call that names the workspace), no JSON body, and a longer ceiling,
 * because a photograph from a phone camera is megabytes, not a form.
 */
export async function upload<T>(path: string, file: File): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);
  const form = new FormData();
  form.append("file", file, file.name);
  try {
    const res = await fetch(`${API_BASE}/api/v1${path}`, {
      method: "POST",
      credentials: "include",
      body: form,
      signal: controller.signal,
    });
    if (!res.ok) throw await readRefusal(res);
    return (await res.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(0, humanMessage(0, null));
  } finally {
    clearTimeout(timer);
  }
}

/** How long one upload may take before it is treated as unconfirmed. */
const UPLOAD_TIMEOUT_MS = 60_000;

/**
 * The three outcomes of a read that does not throw.
 *
 * `unauthenticated` is split out from `failed` on purpose, and it is the whole
 * point of this type. This function used to return `T | null`, which collapsed
 * a 401, a 500 and a dead socket into the same value — so `me.ts` could not
 * tell "nobody is signed in" from "the server is down" and guessed by counting
 * the rows it got back. An empty workspace list was then reported as
 * `anonymous`, which is a different sentence: it says the person is not signed
 * in when in fact they are signed in and hold nothing yet, which is the normal
 * state of an owner waiting on registration approval.
 *
 * With a gate in front of the app that guess becomes a loop: the middleware
 * sees a session cookie and lets the person in, the app reads `anonymous` and
 * sends them to sign in, they are already signed in, and round it goes.
 */
export type ReadResult<T> =
  /** The server answered. `data` may still be empty — empty is an answer. */
  | { outcome: "ok"; data: T }
  /** 401. There is no session, whatever the browser is still holding. */
  | { outcome: "unauthenticated" }
  /**
   * We learned nothing. `status` is 0 for a timeout or a dead connection, and
   * the HTTP status otherwise. Never to be rendered as "you have no access".
   */
  | { outcome: "failed"; status: number };

/**
 * A read that never throws.
 *
 * Used where the caller's job is to report a state rather than to act — the
 * workspace list settles into a status rather than exploding the shell.
 */
export async function getJson<T>(path: string): Promise<ReadResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}/api/v1${path}`, {
      credentials: "include",
      signal: controller.signal,
    });
    if (res.status === 401) return { outcome: "unauthenticated" };
    if (!res.ok) return { outcome: "failed", status: res.status };
    return { outcome: "ok", data: (await res.json()) as T };
  } catch {
    // A timeout or a dead connection. Status 0 says "we never heard back".
    return { outcome: "failed", status: 0 };
  } finally {
    clearTimeout(timer);
  }
}

export interface CommandOptions {
  /** The workspace this command acts in. The guard refuses without it. */
  workspaceId: string;
  body?: unknown;
  /**
   * A client generated UUID for a command that moves money (ADR-012, AC-14).
   *
   * The server stores it on the row and returns the first result unchanged for
   * a repeat. A front desk on a property network retries, and a retried payment
   * that charges twice is the worst failure this system can produce.
   */
  idempotencyKey?: string;
  /**
   * `PUT` replaces a whole small record in one go (the EBM item mapping), where
   * `PATCH` edits part of one. The server names the verb; this only carries it.
   */
  method?: "POST" | "PUT" | "PATCH" | "DELETE";
  /**
   * Act on the whole business, ignoring the branch the switcher shows (ADR-054).
   * The Branches screen manages every branch, so its commands must not be
   * narrowed to the one in view.
   */
  allBranches?: boolean;
}

/**
 * A command: a named action, one permission, one call.
 *
 * Throws `ApiError` on refusal so a mutation's error path is typed, which is
 * what lets the query client spot a 403 and refresh what we may do.
 */
export async function command<T>(
  path: string,
  { workspaceId, body, idempotencyKey, method = "POST", allBranches = false }: CommandOptions,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const headers: Record<string, string> = {
    // The guard reads the workspace from here first. Naming it in a header
    // rather than a body means a command with no body still names it.
    "x-workspace-id": workspaceId,
    // And the branch in view, when one is chosen (ADR-054 AC-S2).
    ...branchHeader(allBranches),
  };
  // ONLY with a body. Fastify refuses `application/json` with an empty body
  // (400, "Body cannot be empty"), before any route runs, so sending the
  // header unconditionally broke every bodyless command from the browser:
  // approve, decline, checkout, close a bill, release a room.
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

  try {
    const res = await fetch(`${API_BASE}/api/v1${path}`, {
      method,
      credentials: "include",
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw await readRefusal(res);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    // A timeout or a dead connection. Status 0 says "we never heard back",
    // which is not the same as a refusal and must not be read as one — the
    // command may have run. The wording says exactly that rather than
    // inviting a retry that could be a second payment.
    throw new ApiError(0, humanMessage(0, null));
  } finally {
    clearTimeout(timer);
  }
}
