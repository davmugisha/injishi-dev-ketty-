import {
  AdminTrainingCertificate,
  AdminTrainingCertificateListResponse,
  AdminTrainingCourse,
  AdminTrainingCourseListResponse,
  AdminTrainingSession,
  AdminTrainingSessionListResponse,
  AdminTrainingTrainerListResponse,
  AdminTrainingVenue,
  AdminTrainingVenueListResponse,
  CancelAdminTrainingSessionResult,
  CloseTrainingRosterResult,
  RecordTrainingAttendanceResult,
  RetireAdminTrainingVenueResult,
  TrainingRosterResponse,
  TrainingWalkInResult,
  type AdminTrainingSessionListQuery,
  type CancelAdminTrainingSession,
  type CreateAdminTrainingCourse,
  type CreateAdminTrainingSession,
  type CreateAdminTrainingVenue,
  type CreateTrainingWalkIn,
  type RecordTrainingAttendance,
  type RevokeTrainingCertificate,
  type UpdateAdminTrainingCourse,
  type UpdateAdminTrainingSession,
  type UpdateAdminTrainingVenue,
} from "@injishi/contracts";

import {
  apiGet,
  apiPatch,
  apiPost,
  type ApiResult,
  type ApiWriteResult,
} from "./server";

/**
 * Training in the admin console (ADR-049) — `/api/v1/admin/training/*`.
 *
 * Server-side only, like every client in this folder: the session cookie
 * belongs to the API origin, so a browser-side fetch from this console would be
 * anonymous. A button that writes calls a Server Action, and the action calls
 * one of the writes below.
 *
 * NOT REASON-GATED, unlike `listOrgs` and `listObo`. A roster does carry other
 * people's names, e-mail addresses and phone numbers, which is personal data
 * under Law 058/2021, and the distinction those two draw still applies here:
 * they return identity the platform holds about somebody regardless of their
 * wishes, whereas a roster row exists because that person registered for a
 * session this staffer is running. Worth knowing rather than inferring, and
 * worth revisiting if the audit-trail feature widens what is reason-gated.
 *
 * THE PERMISSIONS ARE THE API'S TO ENFORCE and are listed here only so a reader
 * of this file knows which calls a `trainer` can make: everything except
 * creating a course, managing a venue, and publishing a session. Those three
 * are platform-admin-only (AC-24).
 */
const BASE = "/api/v1/admin/training";

// ---------------------------------------------------------------------------
// Courses. `training.course.manage` for every write.
// ---------------------------------------------------------------------------

export function listTrainingCourses(query: {
  page?: number;
  pageSize?: number;
} = {}): Promise<ApiResult<AdminTrainingCourseListResponse>> {
  return apiGet(`${BASE}/courses`, AdminTrainingCourseListResponse, {
    page: query.page,
    pageSize: query.pageSize,
  });
}

export function createTrainingCourse(
  body: CreateAdminTrainingCourse,
): Promise<ApiWriteResult<AdminTrainingCourse>> {
  return apiPost(`${BASE}/courses`, AdminTrainingCourse, body);
}

/**
 * Edit a course's title or summary, and optionally move its version.
 *
 * `bumpVersion` is the editor's statement that the syllabus changed. A typo fix
 * leaves it off, because the version is printed on every certificate issued
 * from now on and means "this is what they sat through".
 */
export function updateTrainingCourse(
  courseId: string,
  body: UpdateAdminTrainingCourse,
): Promise<ApiWriteResult<AdminTrainingCourse>> {
  return apiPatch(`${BASE}/courses/${courseId}`, AdminTrainingCourse, body);
}

export function publishTrainingCourse(
  courseId: string,
  published: boolean,
): Promise<ApiWriteResult<AdminTrainingCourse>> {
  return apiPost(`${BASE}/courses/${courseId}/publish`, AdminTrainingCourse, {
    published,
  });
}

// ---------------------------------------------------------------------------
// Venues. `training.venue.manage` for every write.
// ---------------------------------------------------------------------------

/**
 * The venue list.
 *
 * `includeRetired` DEFAULTS TO FALSE at the API, and that default is what keeps
 * a retired hall out of the session form's picker (AC-32). A screen that wants
 * to show the history asks for it explicitly.
 */
export function listTrainingVenues(query: {
  includeRetired?: boolean;
  page?: number;
  pageSize?: number;
} = {}): Promise<ApiResult<AdminTrainingVenueListResponse>> {
  return apiGet(`${BASE}/venues`, AdminTrainingVenueListResponse, {
    includeRetired: query.includeRetired,
    page: query.page,
    pageSize: query.pageSize,
  });
}

export function createTrainingVenue(
  body: CreateAdminTrainingVenue,
): Promise<ApiWriteResult<AdminTrainingVenue>> {
  return apiPost(`${BASE}/venues`, AdminTrainingVenue, body);
}

/** Edit a venue. A retired venue answers 409: retiring is one way. */
export function updateTrainingVenue(
  venueId: string,
  body: UpdateAdminTrainingVenue,
): Promise<ApiWriteResult<AdminTrainingVenue>> {
  return apiPatch(`${BASE}/venues/${venueId}`, AdminTrainingVenue, body);
}

export function retireTrainingVenue(
  venueId: string,
): Promise<ApiWriteResult<RetireAdminTrainingVenueResult>> {
  return apiPost(
    `${BASE}/venues/${venueId}/retire`,
    RetireAdminTrainingVenueResult,
  );
}

// ---------------------------------------------------------------------------
// Sessions. Drafting and editing is `training.session.manage`; publishing is
// `training.session.publish`, which a trainer does not hold.
// ---------------------------------------------------------------------------

/**
 * Staff holding the `trainer` role, for a session form's lead and co trainer
 * pickers (AC-7). `training.view`, so a trainer can read it.
 *
 * Id, name and email only; `name` can be null, so a picker labels by email
 * then. It lists who holds the role, which is narrower than what the API
 * accepts as a lead: any account passes `POST /sessions`.
 */
export function listTrainingTrainers(query: {
  page?: number;
  pageSize?: number;
} = {}): Promise<ApiResult<AdminTrainingTrainerListResponse>> {
  return apiGet(`${BASE}/trainers`, AdminTrainingTrainerListResponse, {
    page: query.page,
    pageSize: query.pageSize,
  });
}

export function listTrainingSessions(
  query: AdminTrainingSessionListQuery | Record<string, never> = {},
): Promise<ApiResult<AdminTrainingSessionListResponse>> {
  return apiGet(`${BASE}/sessions`, AdminTrainingSessionListResponse, {
    status: "status" in query ? query.status : undefined,
    courseId: "courseId" in query ? query.courseId : undefined,
    page: "page" in query ? query.page : undefined,
    pageSize: "pageSize" in query ? query.pageSize : undefined,
  });
}

/**
 * One session by id, found by paging the list.
 *
 * The decided API surface has no `GET /admin/training/sessions/:id`, and the
 * list is ordered by start time, so a session is not reliably on the first
 * page once the platform holds more than a page of them. This walks pages of
 * 100 until it finds the id or runs out, capped so a runaway total cannot turn
 * one screen render into an unbounded crawl. `data: null` is "not there",
 * which the caller words as a missing record, never as a failed read.
 */
export async function findTrainingSession(
  sessionId: string,
): Promise<ApiResult<AdminTrainingSession | null>> {
  const PAGE_SIZE = 100;
  const MAX_PAGES = 20;
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const result = await listTrainingSessions({ page, pageSize: PAGE_SIZE });
    if (!result.ok) return result;
    const found = result.data.items.find((item) => item.id === sessionId);
    if (found) return { ok: true, data: found };
    if (page * PAGE_SIZE >= result.data.meta.total) break;
  }
  return { ok: true, data: null };
}

export function createTrainingSession(
  body: CreateAdminTrainingSession,
): Promise<ApiWriteResult<AdminTrainingSession>> {
  return apiPost(`${BASE}/sessions`, AdminTrainingSession, body);
}

export function publishTrainingSession(
  sessionId: string,
): Promise<ApiWriteResult<AdminTrainingSession>> {
  return apiPost(
    `${BASE}/sessions/${sessionId}/publish`,
    AdminTrainingSession,
  );
}

/**
 * Edit a session, or reschedule it.
 *
 * ONE ROUTE FOR BOTH, as the API has it. Moving `startsAt` on a PUBLISHED
 * session is a reschedule and must carry `rescheduleReason`, because every
 * registrant is mailed it; the API refuses the move without one (422). A
 * cancelled session answers 409.
 */
export function updateTrainingSession(
  sessionId: string,
  body: UpdateAdminTrainingSession,
): Promise<ApiWriteResult<AdminTrainingSession>> {
  return apiPatch(`${BASE}/sessions/${sessionId}`, AdminTrainingSession, body);
}

/**
 * Cancel a session, with the reason every registrant is mailed.
 *
 * Parsed against its schema since the cancel button started wording its toast
 * from `releasedCount` and `keptAttendedCount` (AC-21): the people marked
 * present keep their certificates, and the staffer should read that number.
 */
export function cancelTrainingSession(
  sessionId: string,
  body: CancelAdminTrainingSession,
): Promise<ApiWriteResult<CancelAdminTrainingSessionResult>> {
  return apiPost(
    `${BASE}/sessions/${sessionId}/cancel`,
    CancelAdminTrainingSessionResult,
    body,
  );
}

// ---------------------------------------------------------------------------
// The roster and the tick. `training.attendance.mark`, plus being a trainer on
// the session or a platform admin.
// ---------------------------------------------------------------------------

export function readTrainingRoster(
  sessionId: string,
  query: { page?: number; pageSize?: number } = {},
): Promise<ApiResult<TrainingRosterResponse>> {
  return apiGet(`${BASE}/sessions/${sessionId}/roster`, TrainingRosterResponse, {
    page: query.page,
    pageSize: query.pageSize,
  });
}

export function addTrainingWalkIn(
  sessionId: string,
  body: CreateTrainingWalkIn,
): Promise<ApiWriteResult<TrainingWalkInResult>> {
  return apiPost(
    `${BASE}/sessions/${sessionId}/attendees`,
    TrainingWalkInResult,
    body,
  );
}

/**
 * The tick.
 *
 * `idempotencyKey` is required by the contract, and the caller has to mint one
 * that is STABLE for the intent rather than fresh per attempt: a key generated
 * inside a retry would make the retry a second, distinct tick, which is exactly
 * the duplicate certificate the key exists to prevent.
 */
export function recordTrainingAttendance(
  registrationId: string,
  body: RecordTrainingAttendance,
): Promise<ApiWriteResult<RecordTrainingAttendanceResult>> {
  return apiPost(
    `${BASE}/registrations/${registrationId}/attendance`,
    RecordTrainingAttendanceResult,
    body,
  );
}

export function closeTrainingRoster(
  sessionId: string,
): Promise<ApiWriteResult<CloseTrainingRosterResult>> {
  return apiPost(
    `${BASE}/sessions/${sessionId}/close-roster`,
    CloseTrainingRosterResult,
  );
}

// ---------------------------------------------------------------------------
// Certificates. Withdrawing is `training.certificate.revoke`, plus being the
// issuer or a platform admin.
// ---------------------------------------------------------------------------

export function listTrainingCertificates(query: {
  sessionId?: string;
  page?: number;
  pageSize?: number;
} = {}): Promise<ApiResult<AdminTrainingCertificateListResponse>> {
  return apiGet(
    `${BASE}/certificates`,
    AdminTrainingCertificateListResponse,
    {
      sessionId: query.sessionId,
      page: query.page,
      pageSize: query.pageSize,
    },
  );
}

export function revokeTrainingCertificate(
  certificateId: string,
  body: RevokeTrainingCertificate,
): Promise<ApiWriteResult<AdminTrainingCertificate>> {
  return apiPost(
    `${BASE}/certificates/${certificateId}/revoke`,
    AdminTrainingCertificate,
    body,
  );
}
