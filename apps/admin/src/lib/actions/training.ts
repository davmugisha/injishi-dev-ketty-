"use server";

import {
  CancelAdminTrainingSession,
  CreateAdminTrainingCourse,
  CreateAdminTrainingSession,
  CreateAdminTrainingVenue,
  CreateTrainingWalkIn,
  PublishAdminTrainingCourse,
  RecordTrainingAttendance,
  RevokeTrainingCertificate,
  UpdateAdminTrainingCourse,
  UpdateAdminTrainingSession,
  UpdateAdminTrainingVenue,
  Uuid,
  type AdminTrainingCertificate,
  type AdminTrainingCourse,
  type AdminTrainingSession,
  type AdminTrainingVenue,
  type CancelAdminTrainingSessionResult,
  type CloseTrainingRosterResult,
  type RecordTrainingAttendanceResult,
  type RetireAdminTrainingVenueResult,
  type TrainingWalkInResult,
} from "@injishi/contracts";
import { revalidatePath } from "next/cache";

import {
  addTrainingWalkIn,
  cancelTrainingSession,
  closeTrainingRoster,
  createTrainingCourse,
  createTrainingSession,
  createTrainingVenue,
  publishTrainingCourse,
  publishTrainingSession,
  recordTrainingAttendance,
  retireTrainingVenue,
  revokeTrainingCertificate,
  updateTrainingCourse,
  updateTrainingSession,
  updateTrainingVenue,
} from "@/lib/api/training";

import {
  badInput,
  outcomeOf,
  type WriteOutcome,
  type WriteSpec,
} from "./outcome";

/**
 * The training writes (ADR-049), as Server Actions.
 *
 * Server Actions because the staffer's session cookie belongs to the API origin
 * and only a server-side call carries it. Each one names the permission its
 * route declares, so a refusal reads as the missing power rather than as a
 * generic 403.
 *
 * EVERY SUCCESS SENTENCE IS WORDED FROM THE PARSED RESPONSE, never from "we
 * called it". That matters most for the tick: a replayed call returns the FIRST
 * certificate with `issuedNow: false`, and a toast that said "certificate
 * issued" on a retry would tell a trainer a second one exists.
 *
 * REFUSALS ARE WORDED FROM THE API'S OWN SENTENCE (`inWords`, bottom of this
 * file). Almost every 409 and 422 in this section is a rule the staffer ran
 * into rather than a malformed request: a retired venue, a window that ends
 * before it starts, a session somebody already cancelled. The API writes those
 * sentences for a person, and "a bug on our side" would send a staffer looking
 * in the wrong place.
 */

const TICK: WriteSpec<RecordTrainingAttendanceResult> = {
  what: "recording that decision",
  permission: "training.attendance.mark",
  success: (r) => {
    if (r.certificateId === null) {
      return "Marked absent. Nothing was issued, and the earlier decisions are all still on record.";
    }
    return r.issuedNow
      ? `Marked present. Certificate ${r.certificateSerial} issued.`
      : `Marked present. Certificate ${r.certificateSerial} already existed, so nothing new was issued.`;
  },
};

/**
 * Mark one registrant present or absent.
 *
 * THE IDEMPOTENCY KEY IS DERIVED, not random. It is the registration, the
 * decision and the DAY, so a trainer who taps twice on a bad connection sends
 * the same key and the API returns the first answer. A random key per attempt
 * would make the retry a second distinct tick and mint a second certificate,
 * which is the exact failure the key exists to stop.
 *
 * The day is in it so that a genuine correction TOMORROW is a new decision
 * rather than a silent replay of today's. Correcting within the same day uses
 * the other decision value, which changes the key too.
 */
export async function markAttendance(
  registrationId: string,
  decision: "present" | "absent",
  reason?: string,
): Promise<WriteOutcome<RecordTrainingAttendanceResult>> {
  const id = Uuid.safeParse(registrationId);
  if (!id.success) return badInput(TICK);

  const day = new Date().toISOString().slice(0, 10);
  const body = RecordTrainingAttendance.safeParse({
    decision,
    reason: reason?.trim() ? reason.trim() : undefined,
    idempotencyKey: `admin:${id.data}:${decision}:${day}`,
  });
  if (!body.success) return badInput(TICK);

  const result = await recordTrainingAttendance(id.data, body.data);
  if (result.ok) revalidatePath("/training");
  return outcomeOf(result, TICK);
}

const CLOSE: WriteSpec<CloseTrainingRosterResult> = {
  what: "closing the roster",
  permission: "training.attendance.mark",
  success: (r) =>
    r.markedAbsent === 0
      ? "Roster closed. Everybody already had a decision, so nothing changed."
      : `Roster closed. ${r.markedAbsent} ${
          r.markedAbsent === 1 ? "person was" : "people were"
        } marked absent, and no certificates were issued.`,
};

export async function closeRoster(
  sessionId: string,
): Promise<WriteOutcome<CloseTrainingRosterResult>> {
  const id = Uuid.safeParse(sessionId);
  if (!id.success) return badInput(CLOSE);

  const result = await closeTrainingRoster(id.data);
  if (result.ok) revalidatePath("/training");
  return outcomeOf(result, CLOSE);
}

const WALK_IN: WriteSpec<TrainingWalkInResult> = {
  what: "adding them to the roster",
  permission: "training.attendance.mark",
  success: (r) =>
    r.linkedExistingUser
      ? "Added. That e-mail already had an Injishi account, so the certificate will land on the account they already sign in to."
      : "Added. No account had that e-mail, so one was created with no password. They claim it with the usual e-mail code.",
};

export async function addWalkIn(
  sessionId: string,
  input: { fullName: string; email: string; phone: string; businessName: string },
): Promise<WriteOutcome<TrainingWalkInResult>> {
  const id = Uuid.safeParse(sessionId);
  if (!id.success) return badInput(WALK_IN);

  const body = CreateTrainingWalkIn.safeParse({
    fullName: input.fullName,
    email: input.email,
    phone: input.phone,
    businessName: input.businessName,
  });
  if (!body.success) return badInput(WALK_IN);

  const result = await addTrainingWalkIn(id.data, body.data);
  if (result.ok) revalidatePath("/training");
  return outcomeOf(result, WALK_IN);
}

const PUBLISH: WriteSpec<AdminTrainingSession> = {
  what: "publishing that session",
  // Platform admin only (AC-24). A `trainer` reaching this is refused by the
  // API and told, in words, which power they are missing.
  permission: "training.session.publish",
  // 409 already published, and 409 at a retired venue (AC-32).
  refusal: inWords,
  success: () =>
    "Published. It is on the public training page now and people can register.",
};

export async function publishSession(
  sessionId: string,
): Promise<WriteOutcome<AdminTrainingSession>> {
  const id = Uuid.safeParse(sessionId);
  if (!id.success) return badInput(PUBLISH);

  const result = await publishTrainingSession(id.data);
  if (result.ok) revalidatePath("/training");
  return outcomeOf(result, PUBLISH);
}

const DRAFT: WriteSpec<AdminTrainingSession> = {
  what: "drafting that session",
  permission: "training.session.manage",
  // 422 bad window, 422 no lead, 422 venue retired.
  refusal: inWords,
  success: () =>
    "Drafted. It is invisible to the public until a platform admin publishes it.",
};

export async function draftSession(input: {
  courseId: string;
  venueId: string;
  startsAt: string;
  endsAt: string;
  feeRwf: number;
  seatCount: number;
  leadTrainerId: string;
}): Promise<WriteOutcome<AdminTrainingSession>> {
  const body = CreateAdminTrainingSession.safeParse(input);
  if (!body.success) return badInput(DRAFT);

  const result = await createTrainingSession(body.data);
  if (result.ok) revalidatePath("/training");
  return outcomeOf(result, DRAFT);
}

const REVOKE: WriteSpec<AdminTrainingCertificate> = {
  what: "withdrawing that certificate",
  permission: "training.certificate.revoke",
  success: (r) =>
    `Withdrawn. The public page for ${r.serial} says so from the next load, and the row and its serial are kept.`,
};

/**
 * Withdraw a certificate, with a reason.
 *
 * The reason is required by the contract and is written to the audit log. It is
 * validated here so an empty box is refused with words rather than as a 422
 * carrying a Zod path.
 */
export async function revokeCertificate(
  certificateId: string,
  reason: string,
): Promise<WriteOutcome<AdminTrainingCertificate>> {
  const id = Uuid.safeParse(certificateId);
  if (!id.success) return badInput(REVOKE);

  const body = RevokeTrainingCertificate.safeParse({ reason });
  if (!body.success) return badInput(REVOKE);

  const result = await revokeTrainingCertificate(id.data, body.data);
  if (result.ok) revalidatePath("/training");
  return outcomeOf(result, REVOKE);
}

// ---------------------------------------------------------------------------
// Shared by the venue, course and session writes below
// ---------------------------------------------------------------------------

/**
 * A 403, 409 or 422 in the API's words, then what the staffer can rely on.
 *
 * `undefined` without a sentence, so the generic wording in `outcome.ts` still
 * covers a refusal the API did not explain. The 403 matters for trainers: one
 * holding `training.session.manage` who opens a session they are not on is
 * told "That is not one of your sessions.", which is true, rather than that
 * they lack a permission they hold (AC-7).
 */
function inWords(
  _reason: "conflict" | "rejected" | "denied",
  detail: string | undefined,
): string | undefined {
  return detail ? `${detail} Nothing changed.` : undefined;
}

/**
 * Refused before sending, with a sentence about THIS form.
 *
 * `badInput` in `outcome.ts` speaks of an audit reason of 4 to 500 characters,
 * which is the console's other forms. A venue with no address is not that.
 */
function notSent<T>(sentence: string): WriteOutcome<T> {
  return {
    ok: false,
    reason: "bad_input",
    message: `Nothing was sent: ${sentence}`,
    tone: "danger",
  };
}

/** Every training screen hangs off `/training`, so one revalidation reaches all. */
function refreshTraining(): void {
  revalidatePath("/training", "layout");
}

/**
 * A Kigali wall-clock time from a `datetime-local` field, as an ISO instant.
 *
 * `2026-10-01T09:00` means nine in the morning in Kigali, because that is when
 * the people attending arrive, whatever zone the staffer's laptop is in.
 * Rwanda keeps UTC+2 all year with no daylight saving, so the offset is a
 * constant rather than a lookup. `null` for anything that is not that shape.
 */
function kigaliInstant(local: string): string | null {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/.exec(local.trim());
  if (!match) return null;
  const iso = `${match[1]}T${match[2]}:00+02:00`;
  return Number.isNaN(new Date(iso).getTime()) ? null : iso;
}

// ---------------------------------------------------------------------------
// Venues. `training.venue.manage`, platform admin only (AC-24, AC-32).
// ---------------------------------------------------------------------------

export interface VenueInput {
  name: string;
  address: string;
  districtId: number;
  isOffice: boolean;
}

const VENUE_NEEDS =
  "a venue needs a name and an address of at least two characters, and a district.";

const VENUE_CREATE: WriteSpec<AdminTrainingVenue> = {
  what: "adding that venue",
  permission: "training.venue.manage",
  success: (v) =>
    `Added ${v.name} in ${v.districtName}, ${v.provinceName}. Trainers can pick it for a session now.`,
  // 422 unknown district.
  refusal: inWords,
};

export async function createVenue(
  input: VenueInput,
): Promise<WriteOutcome<AdminTrainingVenue>> {
  const body = CreateAdminTrainingVenue.safeParse(input);
  if (!body.success) return notSent(VENUE_NEEDS);
  const result = await createTrainingVenue(body.data);
  if (result.ok) refreshTraining();
  return outcomeOf(result, VENUE_CREATE);
}

const VENUE_EDIT: WriteSpec<AdminTrainingVenue> = {
  what: "saving that venue",
  permission: "training.venue.manage",
  success: (v) =>
    `Saved ${v.name}. Certificates already issued keep the venue name they were issued with.`,
  // 409 retired (retiring is one way, so a retired venue is not edited), 422
  // unknown district.
  refusal: inWords,
};

export async function editVenue(
  venueId: string,
  input: VenueInput,
): Promise<WriteOutcome<AdminTrainingVenue>> {
  const id = Uuid.safeParse(venueId);
  const body = UpdateAdminTrainingVenue.safeParse(input);
  if (!id.success || !body.success) return notSent(VENUE_NEEDS);
  const result = await updateTrainingVenue(id.data, body.data);
  if (result.ok) refreshTraining();
  return outcomeOf(result, VENUE_EDIT);
}

const VENUE_RETIRE: WriteSpec<RetireAdminTrainingVenueResult> = {
  what: "retiring that venue",
  permission: "training.venue.manage",
  // The count is the point of the answer (AC-32): retiring is one way and
  // otherwise silent, and a draft waiting at the hall can no longer go out.
  success: (r) =>
    r.draftsNowBlocked === 0
      ? `Retired ${r.venue.name}. No draft was waiting there, and sessions already published at it still run.`
      : `Retired ${r.venue.name}. ${r.draftsNowBlocked} ${
          r.draftsNowBlocked === 1 ? "draft session is" : "draft sessions are"
        } now blocked from publishing until moved to another venue. Sessions already published there still run.`,
  successTone: (r) => (r.draftsNowBlocked === 0 ? "success" : "warning"),
  // 409 already retired.
  refusal: inWords,
};

export async function retireVenue(
  venueId: string,
): Promise<WriteOutcome<RetireAdminTrainingVenueResult>> {
  const id = Uuid.safeParse(venueId);
  if (!id.success) return notSent("that is not a venue id.");
  const result = await retireTrainingVenue(id.data);
  if (result.ok) refreshTraining();
  return outcomeOf(result, VENUE_RETIRE);
}

// ---------------------------------------------------------------------------
// Courses. `training.course.manage`, platform admin only (AC-24, AC-30).
// ---------------------------------------------------------------------------

const COURSE_CREATE: WriteSpec<AdminTrainingCourse> = {
  what: "creating that course",
  permission: "training.course.manage",
  success: (c) =>
    `Created ${c.title} as a draft at version ${c.version}. It stays off the public page until you publish it.`,
  // 409 slug taken.
  refusal: inWords,
};

export async function createCourse(input: {
  slug: string;
  title: string;
  summary: string;
}): Promise<WriteOutcome<AdminTrainingCourse>> {
  const body = CreateAdminTrainingCourse.safeParse(input);
  if (!body.success) {
    return notSent(
      "a course needs a slug of lower case words joined by single hyphens, a title and a summary.",
    );
  }
  const result = await createTrainingCourse(body.data);
  if (result.ok) refreshTraining();
  return outcomeOf(result, COURSE_CREATE);
}

export async function editCourse(
  courseId: string,
  input: { title: string; summary: string; bumpVersion: boolean },
): Promise<WriteOutcome<AdminTrainingCourse>> {
  // Worded per call, because the sentence depends on which kind of edit the
  // staffer said this was: a version the certificates will print, or a typo.
  const spec: WriteSpec<AdminTrainingCourse> = {
    what: "saving that course",
    permission: "training.course.manage",
    success: (c) =>
      input.bumpVersion
        ? `Saved ${c.title} as version ${c.version}. Certificates issued from now on print version ${c.version}; ones already issued keep theirs.`
        : `Saved ${c.title}. Still version ${c.version}, so certificates keep printing the same version.`,
    refusal: inWords,
  };
  const id = Uuid.safeParse(courseId);
  const body = UpdateAdminTrainingCourse.safeParse({
    title: input.title,
    summary: input.summary,
    bumpVersion: input.bumpVersion || undefined,
  });
  if (!id.success || !body.success) {
    return notSent("a course needs a title and a summary of at least two characters.");
  }
  const result = await updateTrainingCourse(id.data, body.data);
  if (result.ok) refreshTraining();
  return outcomeOf(result, spec);
}

export async function setCoursePublished(
  courseId: string,
  published: boolean,
): Promise<WriteOutcome<AdminTrainingCourse>> {
  const spec: WriteSpec<AdminTrainingCourse> = {
    what: published ? "publishing that course" : "unpublishing that course",
    permission: "training.course.manage",
    success: (c) =>
      c.isPublished
        ? `${c.title} is published. Its published sessions show on the public training page.`
        : `${c.title} is unpublished. It and every session under it are off the public page, and nothing was cancelled.`,
    refusal: inWords,
  };
  const id = Uuid.safeParse(courseId);
  const body = PublishAdminTrainingCourse.safeParse({ published });
  if (!id.success || !body.success) return notSent("that is not a course id.");
  const result = await publishTrainingCourse(id.data, body.data.published);
  if (result.ok) refreshTraining();
  return outcomeOf(result, spec);
}

// ---------------------------------------------------------------------------
// Sessions: edit, reschedule, cancel. `training.session.manage`, plus being a
// trainer on the session or a platform admin (AC-7). Drafting is
// `draftSession` above, which no screen offers yet: nothing lists the staff a
// lead trainer may be picked from. progress-tracker.md, F-S15, records it.
// ---------------------------------------------------------------------------

const SESSION_EDIT: WriteSpec<AdminTrainingSession> = {
  what: "saving that session",
  permission: "training.session.manage",
  success: () =>
    "Saved. Nobody was mailed: only a reschedule or a cancellation is news to registrants.",
  // 409 cancelled, 422 bad window, 422 retired venue.
  refusal: inWords,
};

/**
 * Edit a session's venue, fee and seats, and a DRAFT's times.
 *
 * A published session's times are not edited here; they are rescheduled, with
 * a reason, by `rescheduleSession`. The screen offers the two separately so a
 * staffer moving a published session is always asked why.
 */
export async function editSession(
  sessionId: string,
  input: {
    venueId: string;
    feeRwf: number;
    seatCount: number;
    startsAt?: string;
    endsAt?: string;
  },
): Promise<WriteOutcome<AdminTrainingSession>> {
  const id = Uuid.safeParse(sessionId);
  if (!id.success) return notSent("that is not a session id.");

  const startsAt =
    input.startsAt === undefined ? undefined : kigaliInstant(input.startsAt);
  const endsAt =
    input.endsAt === undefined ? undefined : kigaliInstant(input.endsAt);
  if (startsAt === null || endsAt === null) {
    return notSent("the start and the end each need a date and a time.");
  }

  const body = UpdateAdminTrainingSession.safeParse({
    venueId: input.venueId,
    feeRwf: input.feeRwf,
    seatCount: input.seatCount,
    startsAt,
    endsAt,
  });
  if (!body.success) {
    return notSent(
      "pick a venue, and give the fee and the seat count as whole numbers of zero or more.",
    );
  }
  const result = await updateTrainingSession(id.data, body.data);
  if (result.ok) refreshTraining();
  return outcomeOf(result, SESSION_EDIT);
}

/**
 * NAMES THE TIME THE API SAVED, read off the response, rather than saying
 * "rescheduled" because the call succeeded. A request carrying the time the
 * session already had succeeds too and moves nothing; a sentence that only
 * said "Rescheduled" would then claim a move and a round of mail that never
 * happened. The staffer reads the time and can see.
 *
 * "BEING MAILED" ONLY WHEN THE START MOVED. The API mails registrants, and moves
 * the reminder, only when `startsAt` changes on a published session. A form
 * sent with only the end moved used to be answered "Every registrant is being
 * mailed" while nothing was queued. `previousStartsAt` is the start the form
 * was showing, so the sentence can tell the two apart.
 */
function sessionReschedule(previousStartsAt: string): WriteSpec<AdminTrainingSession> {
  return {
    what: "rescheduling that session",
    permission: "training.session.manage",
    success: (s) => {
      const startMoved = Date.parse(s.startsAt) !== Date.parse(previousStartsAt);
      if (s.status !== "published") {
        return `Moved to ${kigaliLabel(s.startsAt)} Kigali time. It is still a draft, so nobody was mailed.`;
      }
      return startMoved
        ? `Rescheduled to ${kigaliLabel(s.startsAt)} Kigali time. Every registrant is being mailed the new time with your reason, and their reminder moves with it.`
        : `The end moved to ${kigaliLabel(s.endsAt)} Kigali time. The start did not move, so nobody was mailed and reminders stay as they were.`;
    },
    // 409 cancelled, 422 bad window.
    refusal: inWords,
  };
}

/** "Thu 12 Nov 2026, 09:30", in Kigali. The server's own zone is not the session's. */
function kigaliLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-RW", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Africa/Kigali",
  }).format(new Date(iso));
}

/**
 * Move a session in time, with the reason registrants are told (AC-21).
 *
 * THE WINDOW IS NOT PRE-CHECKED HERE. An end before the start is refused by the
 * API in its own sentence, and that sentence is what reaches the screen; a
 * second copy of the rule here would be one more place for the two to disagree.
 */
export async function rescheduleSession(
  sessionId: string,
  input: { startsAt: string; endsAt: string; reason: string; previousStartsAt: string },
): Promise<WriteOutcome<AdminTrainingSession>> {
  const id = Uuid.safeParse(sessionId);
  if (!id.success) return notSent("that is not a session id.");
  const startsAt = kigaliInstant(input.startsAt);
  const endsAt = kigaliInstant(input.endsAt);
  if (startsAt === null || endsAt === null) {
    return notSent("the new start and end each need a date and a time.");
  }
  const reason = input.reason.trim();
  if (reason.length < 3 || reason.length > 500) {
    return notSent(
      "a reschedule needs a reason of 3 to 500 characters, because every registrant is mailed it.",
    );
  }
  const body = UpdateAdminTrainingSession.safeParse({
    startsAt,
    endsAt,
    rescheduleReason: reason,
  });
  if (!body.success) return notSent("the new time could not be read.");
  const result = await updateTrainingSession(id.data, body.data);
  if (result.ok) refreshTraining();
  return outcomeOf(result, sessionReschedule(input.previousStartsAt));
}

const SESSION_CANCEL: WriteSpec<CancelAdminTrainingSessionResult> = {
  what: "cancelling that session",
  permission: "training.session.manage",
  success: (r) => {
    const released = `${r.releasedCount} ${
      r.releasedCount === 1 ? "registration was" : "registrations were"
    } released`;
    const kept =
      r.keptAttendedCount === 0
        ? ""
        : ` ${r.keptAttendedCount} ${
            r.keptAttendedCount === 1
              ? "person already marked present keeps their certificate."
              : "people already marked present keep their certificates."
          }`;
    return `Cancelled. ${released}, and everybody registered is being mailed your reason.${kept}`;
  },
  // 409 already cancelled.
  refusal: inWords,
};

export async function cancelSession(
  sessionId: string,
  reason: string,
): Promise<WriteOutcome<CancelAdminTrainingSessionResult>> {
  const id = Uuid.safeParse(sessionId);
  if (!id.success) return notSent("that is not a session id.");
  const body = CancelAdminTrainingSession.safeParse({ reason });
  if (!body.success) {
    return notSent(
      "a cancellation needs a reason of 3 to 500 characters, because every registrant is mailed it.",
    );
  }
  const result = await cancelTrainingSession(id.data, body.data);
  if (result.ok) refreshTraining();
  return outcomeOf(result, SESSION_CANCEL);
}
