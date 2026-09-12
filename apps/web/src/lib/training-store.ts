/**
 * The training course's demo state, held in `localStorage`.
 *
 * There is no Training module on the API: no enrolment row, no payment record,
 * no examiner and no certificate register. This file stands in for all four so
 * that a presenter can enrol, pay, work through the lessons and collect a
 * certificate in one sitting, close the tab, reopen it, and find the demo
 * exactly where they left it. `localStorage` rather than React state is the
 * whole point — a demo that resets on a reload cannot survive a question from
 * the room.
 *
 * NOTHING HERE IS A SECURITY BOUNDARY OR A RECORD. A learner can open the
 * console and mark themselves complete. That is fine: the real control is a
 * server this prototype does not have, and pretending otherwise in the browser
 * would only make the eventual API harder to fit.
 *
 * THIS MODULE IS SAFE TO IMPORT FROM A SERVER COMPONENT, and that is a
 * constraint rather than a nicety. `/training` is a Server Component and reads
 * the course from it, so every function guards `typeof window` and returns the
 * empty state on the server. It deliberately carries NO `"use client"`
 * directive: adding one would make a server page that merely imports a type
 * from here open a client boundary.
 *
 * It also does not export a hook. A hook forces `"use client"` on the module,
 * which is the thing above; `subscribeTraining` is the four lines a consumer
 * needs to build its own `useSyncExternalStore` or `useEffect` in its own file.
 *
 * HYDRATION. Every timestamp here is taken inside a writer, which only ever
 * runs from an event handler after mount. Nothing in this file is read during
 * a server render, so the server and the first client render always agree: both
 * see `EMPTY_TRAINING`, and the real state arrives on the effect that follows.
 */
import { TRAINING_LESSONS, TRAINING_PASS_MARK } from "@/data/training";

/** Who enrolled. Collected by `/training/enroll`. */
export interface TrainingEnrolment {
  fullName: string;
  email: string;
  phone: string;
  nationalId: string;
  /** ISO 8601, stamped by `setEnrolment`. */
  enrolledAt: string;
}

/**
 * The 25,000 RWF fee, as three states rather than a boolean.
 *
 * `declared` is the state a boolean cannot express and the demo needs most: the
 * learner says they have dialled the MoMo code, and nobody has checked. A real
 * build reconciles against MTN; here `confirmPayment` stands in for that, which
 * is why it is a separate call rather than something `declarePayment` does at
 * the end of a timer.
 */
export type TrainingPayment = {
  state: "unpaid" | "declared" | "confirmed";
  /** The MoMo transaction reference the learner typed in, when they did. */
  reference: string | null;
  declaredAt: string | null;
};

export interface TrainingCertificate {
  /** Human-readable, printed on the certificate. Derived, never random. */
  serial: string;
  issuedAt: string;
  /** The address the demo says it sent the certificate to. */
  emailedTo: string;
  /** The course mark, 0–100, at the moment of issue. */
  score: number;
}

/** Everything the demo remembers about one learner on one device. */
export interface TrainingState {
  enrolment: TrainingEnrolment | null;
  payment: TrainingPayment;
  /** Lesson slugs the learner has finished, in the order they finished them. */
  completed: string[];
  /** Lesson slug to quiz mark out of 100. */
  scores: Record<string, number>;
  certificate: TrainingCertificate | null;
}

/** One key, so a demo is cleared by deleting one entry. */
export const TRAINING_STORAGE_KEY = "injishi:training";

/**
 * Fired on every write.
 *
 * A plain `storage` event is not enough: the browser fires it in OTHER tabs
 * only, so the enrol form and the progress rail on the same page would not
 * re-read after a write. Both are subscribed to here, so a second tab still
 * follows along.
 */
export const TRAINING_CHANGE_EVENT = "injishi:training-change";

const EMPTY_PAYMENT: TrainingPayment = {
  state: "unpaid",
  reference: null,
  declaredAt: null,
};

/**
 * The state before anything happens, and the state on the server.
 *
 * Frozen because it is handed out by reference on every server render and on
 * every failed read; a consumer that pushed onto `completed` would otherwise
 * mutate the empty state for the life of the page.
 */
export const EMPTY_TRAINING: TrainingState = Object.freeze({
  enrolment: null,
  payment: EMPTY_PAYMENT,
  completed: [],
  scores: {},
  certificate: null,
}) as TrainingState;

/** `true` only in a browser that will actually let us touch storage. */
function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    // Reading the property itself throws when the browser is set to block site
    // data, which is why this is inside the try rather than beside it.
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Rebuild a state from whatever JSON was on disk, field by field.
 *
 * `JSON.parse` returns `any`, and the value came from a previous version of
 * this file, from another tab, or from somebody typing in the console. Casting
 * it would push the failure into a component that renders `state.payment.state`
 * and finds `undefined`, so every field is checked here and anything unreadable
 * falls back to its empty value rather than being dropped.
 */
function parse(raw: string): TrainingState {
  const value: unknown = JSON.parse(raw);
  if (!isRecord(value)) return EMPTY_TRAINING;

  const enrolment = isRecord(value.enrolment)
    ? {
        fullName: String(value.enrolment.fullName ?? ""),
        email: String(value.enrolment.email ?? ""),
        phone: String(value.enrolment.phone ?? ""),
        nationalId: String(value.enrolment.nationalId ?? ""),
        enrolledAt: String(value.enrolment.enrolledAt ?? ""),
      }
    : null;

  const paymentRaw = isRecord(value.payment) ? value.payment : null;
  const paymentState =
    paymentRaw?.state === "declared" || paymentRaw?.state === "confirmed"
      ? paymentRaw.state
      : "unpaid";

  const certificateRaw = isRecord(value.certificate) ? value.certificate : null;

  const scores: Record<string, number> = {};
  if (isRecord(value.scores)) {
    for (const [slug, mark] of Object.entries(value.scores)) {
      if (typeof mark === "number" && Number.isFinite(mark)) scores[slug] = mark;
    }
  }

  return {
    enrolment,
    payment: {
      state: paymentState,
      reference:
        typeof paymentRaw?.reference === "string" ? paymentRaw.reference : null,
      declaredAt:
        typeof paymentRaw?.declaredAt === "string" ? paymentRaw.declaredAt : null,
    },
    completed: Array.isArray(value.completed)
      ? value.completed.filter((slug): slug is string => typeof slug === "string")
      : [],
    scores,
    certificate: certificateRaw
      ? {
          serial: String(certificateRaw.serial ?? ""),
          issuedAt: String(certificateRaw.issuedAt ?? ""),
          emailedTo: String(certificateRaw.emailedTo ?? ""),
          score:
            typeof certificateRaw.score === "number" ? certificateRaw.score : 0,
        }
      : null,
  };
}

/**
 * The whole demo state.
 *
 * Returns `EMPTY_TRAINING` on the server, in a private window that refuses
 * storage, and when what is on disk cannot be read. All three are the same
 * answer on purpose: a page that cannot recover the demo shows the start of the
 * course, which is a working screen, rather than an error nobody can act on.
 */
export function readTraining(): TrainingState {
  const store = storage();
  if (store === null) return EMPTY_TRAINING;
  try {
    const raw = store.getItem(TRAINING_STORAGE_KEY);
    return raw ? parse(raw) : EMPTY_TRAINING;
  } catch {
    return EMPTY_TRAINING;
  }
}

/** Persist and announce. Returns what was written so a caller can render it. */
function write(next: TrainingState): TrainingState {
  const store = storage();
  if (store === null) return next;
  try {
    store.setItem(TRAINING_STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(TRAINING_CHANGE_EVENT));
  } catch {
    // A full or blocked quota must not take the screen down with it. The caller
    // still gets the new state and the demo carries on for this page view; it
    // simply will not survive the reload.
  }
  return next;
}

/**
 * Subscribe to every change, in this tab and in others.
 *
 * Returns the unsubscribe function, which is the shape `useEffect` and
 * `useSyncExternalStore` both want.
 */
export function subscribeTraining(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(TRAINING_CHANGE_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(TRAINING_CHANGE_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

/**
 * Record who enrolled.
 *
 * `enrolledAt` is stamped here rather than taken from the caller so that every
 * enrolment carries a timestamp and no page has to remember to make one.
 */
export function setEnrolment(
  details: Omit<TrainingEnrolment, "enrolledAt">,
): TrainingState {
  const current = readTraining();
  return write({
    ...current,
    enrolment: {
      fullName: details.fullName,
      email: details.email,
      phone: details.phone,
      nationalId: details.nationalId,
      enrolledAt: new Date().toISOString(),
    },
  });
}

/**
 * The learner says they have paid the fee with the MoMo code.
 *
 * Nothing has been verified at this point and the wording on screen must say
 * so. The reference is whatever they read off their phone; it is stored as
 * typed because a demo that rejects a plausible reference has nothing to
 * validate it against.
 */
export function declarePayment(reference: string): TrainingState {
  const current = readTraining();
  return write({
    ...current,
    payment: {
      state: "declared",
      reference: reference.trim() || null,
      declaredAt: new Date().toISOString(),
    },
  });
}

/**
 * The fee is treated as received.
 *
 * In a real build this is what the MTN reconciliation would trigger. It is
 * separate from `declarePayment` so that the demo can show the two states
 * apart, and so that the eventual server call replaces one function rather
 * than being unpicked from the middle of another.
 */
export function confirmPayment(): TrainingState {
  const current = readTraining();
  return write({
    ...current,
    payment: { ...current.payment, state: "confirmed" },
  });
}

/** Mark one lesson finished. Idempotent — re-reading a lesson is not progress. */
export function completeLesson(slug: string): TrainingState {
  const current = readTraining();
  if (current.completed.includes(slug)) return current;
  return write({ ...current, completed: [...current.completed, slug] });
}

/**
 * Record a quiz mark out of 100 for one lesson.
 *
 * The BEST mark is kept, not the latest. A learner who retakes a quiz to
 * understand a question they got wrong should not be punished for it, and a
 * score that can fall makes the certificate threshold feel arbitrary.
 */
export function recordQuizScore(slug: string, score: number): TrainingState {
  const current = readTraining();
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const previous = current.scores[slug];
  if (previous !== undefined && previous >= clamped) return current;
  return write({ ...current, scores: { ...current.scores, [slug]: clamped } });
}

/**
 * A stable serial from the enrolment.
 *
 * FNV-1a over the e-mail and the issue date, the same technique
 * `data/demo-commerce.ts` uses for the same reason: a random serial differs
 * between two renders, and a presenter who reloads the certificate page must
 * not watch its number change.
 */
function serialFor(email: string, issuedAt: string): string {
  let h = 0x811c9dc5;
  const material = `${email}|${issuedAt.slice(0, 10)}`;
  for (let i = 0; i < material.length; i += 1) {
    h ^= material.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  const year = issuedAt.slice(0, 4);
  return `INJ-TRN-${year}-${(h >>> 0).toString(36).toUpperCase().padStart(7, "0")}`;
}

/**
 * Issue the certificate, if the course has actually been passed.
 *
 * Refuses — by returning the state unchanged — when nobody has enrolled, when
 * the fee is not confirmed, when a lesson is outstanding, or when the mark is
 * below the pass threshold. The refusal is silent here on purpose: the page
 * knows which of the four conditions is missing (it can read the same state)
 * and can say so far better than a thrown error could.
 *
 * Issuing twice returns the certificate already held, so the serial a learner
 * was shown is the serial they keep.
 */
export function issueCertificate(): TrainingState {
  const current = readTraining();
  if (current.certificate !== null) return current;
  if (current.enrolment === null) return current;
  if (current.payment.state !== "confirmed") return current;

  const progress = trainingProgress(current);
  if (!progress.allLessonsDone) return current;
  if (progress.mark < TRAINING_PASS_MARK) return current;

  const issuedAt = new Date().toISOString();
  return write({
    ...current,
    certificate: {
      serial: serialFor(current.enrolment.email, issuedAt),
      issuedAt,
      emailedTo: current.enrolment.email,
      score: progress.mark,
    },
  });
}

/**
 * WHY `issueCertificate` REFUSES, when it does.
 *
 * `issueCertificate()` answers the state unchanged in five different
 * situations and cannot say which, because a store that threw would make every
 * caller catch. The certificate screen has to tell the holder which one it is
 * and where to go about it, and the only honest way to do that is to ask the
 * same questions in the same order the issuer asks them — so they are asked
 * HERE, beside it, rather than re-derived on a page that would drift the first
 * time either changed.
 *
 * `null` means it would issue. A reader of this type gets the five refusals as
 * five names rather than as a boolean plus a guess, which is the difference
 * between "you cannot have this yet" and a sentence somebody can act on.
 */
export type TrainingCertificateBlock =
  | "not-enrolled"
  | "fee-unpaid"
  | "fee-unreconciled"
  | "lessons-outstanding"
  | "mark-below-pass";

/**
 * The first reason the certificate cannot be issued, or `null`.
 *
 * Ordered the way the course is walked, not the way `issueCertificate` happens
 * to be written: a learner with no enrolment and no marks is told to enrol,
 * because that is the step in front of them. Returning the FIRST block rather
 * than all of them is deliberate — a screen listing four refusals at once
 * reads as a wall, and clearing the first one is the only move available
 * anyway.
 *
 * The fee is two blocks rather than one. `declared` means the learner has
 * already done everything asked of them and is waiting on a reconciliation
 * that does not exist in this build; `unpaid` means they have not paid. Those
 * need different sentences, and `CourseAccessNotice` on `/training/learn`
 * already draws the same distinction.
 */
export function certificateBlock(
  state: TrainingState,
): TrainingCertificateBlock | null {
  if (state.certificate !== null) return null;
  if (state.enrolment === null) return "not-enrolled";
  if (state.payment.state === "unpaid") return "fee-unpaid";
  if (state.payment.state !== "confirmed") return "fee-unreconciled";

  const progress = trainingProgress(state);
  if (!progress.allLessonsDone) return "lessons-outstanding";
  if (progress.mark < TRAINING_PASS_MARK) return "mark-below-pass";
  return null;
}

/** Wipe the demo. The reset a presenter needs between two run-throughs. */
export function resetTraining(): TrainingState {
  const store = storage();
  if (store !== null) {
    try {
      store.removeItem(TRAINING_STORAGE_KEY);
      window.dispatchEvent(new Event(TRAINING_CHANGE_EVENT));
    } catch {
      // Same reasoning as `write`: a browser that refuses storage still gets a
      // working screen, it just does not get persistence.
    }
  }
  return EMPTY_TRAINING;
}

export interface TrainingProgress {
  /** Lessons finished. */
  completed: number;
  /** Lessons in the course. */
  total: number;
  /** Completion as a whole percentage, for a progress bar. */
  percent: number;
  /** The course mark out of 100: the mean of the quiz marks actually taken. */
  mark: number;
  allLessonsDone: boolean;
  /** True when `issueCertificate()` would succeed. */
  eligibleForCertificate: boolean;
}

/**
 * Derived progress, in one place.
 *
 * Every screen in the course needs some part of this — the landing rail, the
 * lesson list, the certificate gate — and each of them computing "how far along
 * am I" from `completed` and `scores` is how three screens end up disagreeing
 * about whether the learner has finished.
 *
 * The mark averages the quizzes ATTEMPTED rather than all of them, so a learner
 * halfway through sees a real mark for the half they have done instead of a
 * number that starts at zero and looks like failure.
 */
export function trainingProgress(state: TrainingState): TrainingProgress {
  const total = TRAINING_LESSONS.length;
  const completed = TRAINING_LESSONS.filter((lesson) =>
    state.completed.includes(lesson.slug),
  ).length;

  const marks = Object.values(state.scores);
  const mark =
    marks.length === 0
      ? 0
      : Math.round(marks.reduce((sum, m) => sum + m, 0) / marks.length);

  const allLessonsDone = total > 0 && completed === total;

  return {
    completed,
    total,
    percent: total === 0 ? 0 : Math.round((completed / total) * 100),
    mark,
    allLessonsDone,
    eligibleForCertificate:
      allLessonsDone &&
      mark >= TRAINING_PASS_MARK &&
      state.payment.state === "confirmed" &&
      state.enrolment !== null,
  };
}
