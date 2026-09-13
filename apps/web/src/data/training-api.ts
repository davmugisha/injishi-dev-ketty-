import {
  CreateTrainingRegistration,
  TrainingCourseListResponse,
  TrainingMeResponse,
  TrainingVerification,
  type TrainingPublicCourse,
  type TrainingPublicSession,
  type TrainingRegistrationResult,
} from "@injishi/contracts";
import { apiFetch, type ApiResult } from "@/lib/api";

/**
 * The web client for `/api/v1/training/*` and `/api/v1/verify/*` (ADR-049).
 *
 * WHY THIS IS NOT `data/training.ts`. That path held the old fixture: a
 * hand-written curriculum, a pass mark, a MoMo code and a fee, all consumed by
 * six pages of browser-only make believe. ADR-049 AC-26 deletes it by name and
 * its verify checklist greps for the path, so the replacement cannot reuse it
 * even though the name would otherwise be the conventional one here.
 *
 * Every call goes through `apiFetch`, like every other client in this folder:
 * one definition of where the API is, `credentials: "include"` so a session
 * cookie crosses from :3000 to :8000, and a ceiling so no screen waits for
 * ever. Every answer is parsed against the contract's own schema, and a
 * response that does not match is reported as `failed` rather than rendered.
 * Half a session card with an undefined price is worse than an honest "we
 * could not load this".
 *
 * WHICH CALLS RUN WHERE, and it matters:
 *
 * - `fetchTrainingCourses` and `verifyCertificate` are PUBLIC. They carry no
 *   cookie and are called from Server Components, the same way
 *   `data/geography.ts` is.
 * - `fetchMyTraining`, `registerForSession` and `withdrawRegistration` need
 *   the caller's session, and
 *   `credentials: "include"` only attaches a cookie in a browser. They are
 *   called from Client Components, the same way `data/trips.ts` is.
 */

/** Every published course with its published sessions. Public (AC-1). */
export async function fetchTrainingCourses(): Promise<
  ApiResult<TrainingPublicCourse[]>
> {
  const result = await apiFetch<unknown>("/api/v1/training/courses");
  if (result.status !== "ok") return result;

  const parsed = TrainingCourseListResponse.safeParse(result.data);
  if (!parsed.success) return { status: "failed" };

  return { status: "ok", data: parsed.data.items };
}

/**
 * What a token says about a certificate. Public, and never throws (AC-15).
 *
 * A valid token, a withdrawn one and one that names nothing all come back as
 * `ok` carrying a `status`, because the API answers 200 for all three on
 * purpose: a 404 for an unknown token would confirm which guessed tokens are
 * real. So a caller renders from `data.status` and treats a non-`ok` result as
 * "we could not reach the API", never as "that certificate is fake".
 */
export async function verifyCertificate(
  token: string,
): Promise<ApiResult<TrainingVerification>> {
  const result = await apiFetch<unknown>(
    `/api/v1/verify/${encodeURIComponent(token)}`,
  );
  if (result.status !== "ok") return result;

  const parsed = TrainingVerification.safeParse(result.data);
  if (!parsed.success) return { status: "failed" };

  return { status: "ok", data: parsed.data };
}

/** My registrations and my certificates. Needs a session. */
export async function fetchMyTraining(): Promise<
  ApiResult<TrainingMeResponse>
> {
  const result = await apiFetch<unknown>("/api/v1/training/me");
  if (result.status !== "ok") return result;

  const parsed = TrainingMeResponse.safeParse(result.data);
  if (!parsed.success) return { status: "failed" };

  return { status: "ok", data: parsed.data };
}

/**
 * Register for a session. Needs a session cookie (AC-2).
 *
 * The body is validated against the contract BEFORE it is sent, so a form bug
 * shows up here as a refusal this code can word, rather than as a 400 from the
 * API carrying a Zod path the person reading the screen cannot use.
 *
 * There is no `email` field, deliberately: the API takes the address from the
 * session, because an address typed into a form is one the sender does not have
 * to own and this request is what a certificate eventually hangs from.
 */
export async function registerForSession(
  input: CreateTrainingRegistration,
): Promise<ApiResult<TrainingRegistrationResult>> {
  const checked = CreateTrainingRegistration.safeParse(input);
  if (!checked.success) {
    return {
      status: "refused",
      httpStatus: 422,
      message:
        checked.error.issues[0]?.message ??
        "Something on that form is not right yet.",
    };
  }

  const result = await apiFetch<unknown>("/api/v1/training/registrations", {
    method: "POST",
    body: checked.data,
  });
  if (result.status !== "ok") return result;

  return { status: "ok", data: result.data as TrainingRegistrationResult };
}

/**
 * Withdraw my own registration before its session starts (AC-29).
 *
 * The API refuses in three ways and each keeps its own `httpStatus`, because
 * the screen words them differently: 403 is somebody else's registration, 409
 * is a session that has started or a registration already withdrawn, 404 is a
 * row that no longer exists. The message is the API's own when it wrote one for
 * a person; the caller decides whether to use it.
 *
 * A 200 whose body is not `withdrawn` is `failed`, not `ok`. Telling somebody
 * they are off the list on the strength of an answer we could not read is the
 * one outcome worse than saying we could not reach the server.
 */
export async function withdrawRegistration(
  registrationId: string,
): Promise<ApiResult<{ status: "withdrawn" }>> {
  const result = await apiFetch<{ status?: unknown }>(
    `/api/v1/training/registrations/${encodeURIComponent(registrationId)}`,
    { method: "DELETE" },
  );
  if (result.status !== "ok") return result;

  if (result.data?.status !== "withdrawn") return { status: "failed" };
  return { status: "ok", data: { status: "withdrawn" } };
}

/**
 * A signed url for my own certificate PDF.
 *
 * Returned rather than followed, because the link expires inside 900 seconds
 * and the page should mint it when somebody asks for the file rather than at
 * render time. A url minted on page load is already stale by the time a person
 * finishes reading and clicks.
 */
export async function fetchCertificatePdfUrl(
  certificateId: string,
): Promise<ApiResult<string>> {
  const result = await apiFetch<{ url?: unknown }>(
    `/api/v1/training/certificates/${certificateId}/pdf`,
  );
  if (result.status !== "ok") return result;

  const url = result.data?.url;
  if (typeof url !== "string" || url.length === 0) {
    return { status: "failed" };
  }
  return { status: "ok", data: url };
}

/**
 * The soonest session across every course, for a page that wants one date.
 *
 * Sorted by start time rather than by course, because a person deciding whether
 * to attend is asking "when is the next one", and the API already orders each
 * course's sessions but has no opinion about the order ACROSS courses.
 */
export function nextSession(
  courses: readonly TrainingPublicCourse[],
): { course: TrainingPublicCourse; session: TrainingPublicSession } | null {
  const all = courses.flatMap((course) =>
    course.sessions.map((session) => ({ course, session })),
  );
  all.sort((a, b) => a.session.startsAt.localeCompare(b.session.startsAt));
  return all[0] ?? null;
}

/** Does any published course have a date somebody can register for? */
export function hasAnySession(
  courses: readonly TrainingPublicCourse[],
): boolean {
  return courses.some((course) => course.sessions.length > 0);
}
