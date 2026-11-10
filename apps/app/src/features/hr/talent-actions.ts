"use server";

import { screenHref } from "@injishi/data";
import { revalidatePath } from "next/cache";
import { requirePersona } from "@/lib/session";
import { ApiError, ApiUnreachableError } from "@/server/api";
import { requestContext } from "@/server/data";
import { setChecklistStep } from "@/server/mutations/people";
import { NoWorkspaceError } from "@/server/sources/types";
import * as talent from "@/server/talent";

export type TalentResult = { ok: true } | { ok: false; error: string };

/** Run a Talent write as the person, refresh the screen, and answer a refusal or an outage in words. */
async function act(run: (ctx: Awaited<ReturnType<typeof requestContext>>) => Promise<unknown>): Promise<TalentResult> {
  try {
    await requirePersona("Talent");
    await run(await requestContext());
    return { ok: true };
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, error: error.message };
    if (error instanceof ApiUnreachableError) {
      return { ok: false, error: "The Injishi service did not answer. Try again." };
    }
    if (error instanceof NoWorkspaceError) return { ok: false, error: error.message };
    throw error;
  } finally {
    revalidatePath(screenHref("Talent"));
  }
}

const num = (s: string) => {
  const n = Number(s.replace(/[^0-9]/g, ""));
  return s.trim() && Number.isFinite(n) && n > 0 ? n : null;
};

export async function openVacancyAction(input: {
  title: string;
  branchId: string;
  openings: string;
  wageFrom: string;
  wageTo: string;
  closesOn: string;
  managerEmployeeId: string;
  note: string;
  documents: string[];
}): Promise<TalentResult> {
  return act((ctx) =>
    talent.openVacancy(ctx, {
      title: input.title.trim(),
      branchId: input.branchId || null,
      openings: num(input.openings) ?? 1,
      wageFromRwf: num(input.wageFrom),
      wageToRwf: num(input.wageTo),
      closesOn: input.closesOn || null,
      managerEmployeeId: input.managerEmployeeId || null,
      note: input.note.trim() || null,
      documents: input.documents,
    }),
  );
}

/** The documents a role asks its applicants for. */
export async function setVacancyDocumentsAction(id: string, documents: string[]): Promise<TalentResult> {
  return act((ctx) => talent.changeVacancy(ctx, id, { documents }));
}

export async function closeVacancyAction(id: string, status: "closed" | "filled" | "open"): Promise<TalentResult> {
  return act((ctx) => talent.changeVacancy(ctx, id, { status }));
}

export async function addCandidateAction(input: {
  vacancyId: string;
  fullName: string;
  phone: string;
  email: string;
  source: string;
  note: string;
  talentPool: boolean;
  expectedWage: string;
}): Promise<TalentResult> {
  return act((ctx) =>
    talent.addCandidate(ctx, {
      vacancyId: input.vacancyId,
      fullName: input.fullName.trim(),
      phone: input.phone.trim() || null,
      email: input.email.trim() || null,
      source: input.source,
      note: input.note.trim() || null,
      talentPool: input.talentPool,
      expectedWageRwf: num(input.expectedWage),
    }),
  );
}

/** One more round of the salary talk: "business" offers again, "candidate" notes what they ask back. */
export async function addOfferRoundAction(
  id: string,
  side: "business" | "candidate",
  wage: string,
  note: string,
): Promise<TalentResult> {
  return act((ctx) =>
    talent.addOfferRound(ctx, id, { side, amountRwf: num(wage) ?? 0, startsOn: null, note: note.trim() || null }),
  );
}

/** Both sides settle on this wage. */
export async function agreeOfferAction(id: string, amountRwf: number): Promise<TalentResult> {
  return act((ctx) => talent.agreeOffer(ctx, id, { amountRwf }));
}

export async function moveCandidateAction(
  id: string,
  stage: talent.CandidateStage,
  extra: { offerWage?: string; offerStartsOn?: string; reason?: string } = {},
): Promise<TalentResult> {
  return act((ctx) =>
    talent.moveCandidate(ctx, id, {
      stage,
      ...(stage === "offer"
        ? { offerWageRwf: num(extra.offerWage ?? "") ?? 0, offerStartsOn: extra.offerStartsOn }
        : {}),
      ...(stage === "rejected" ? { reason: extra.reason?.trim() } : {}),
    }),
  );
}

export async function scoreCandidateAction(
  id: string,
  what: string,
  score: number,
  note: string,
): Promise<TalentResult> {
  return act((ctx) => talent.scoreCandidate(ctx, id, { what: what.trim(), score, note: note.trim() || null }));
}

/** `when` is a local Kigali "2026-10-28T10:00" from the form. */
export async function bookInterviewAction(input: {
  candidateId: string;
  when: string;
  place: string;
  interviewer: string;
}): Promise<TalentResult> {
  return act((ctx) =>
    talent.bookInterview(ctx, {
      candidateId: input.candidateId,
      startsAt: `${input.when}:00+02:00`,
      place: input.place.trim() || null,
      interviewerName: input.interviewer.trim() || null,
    }),
  );
}

export async function interviewStatusAction(id: string, status: "done" | "cancelled"): Promise<TalentResult> {
  return act((ctx) => talent.setInterviewStatus(ctx, id, status));
}

export async function openReviewCycleAction(name: string, startsOn: string, endsOn: string): Promise<TalentResult> {
  return act((ctx) => talent.openReviewCycle(ctx, { name: name.trim(), startsOn, endsOn }));
}

export async function closeReviewCycleAction(id: string): Promise<TalentResult> {
  return act((ctx) => talent.closeReviewCycle(ctx, id));
}

export async function updateReviewAction(
  id: string,
  patch: { selfDone?: boolean; managerDone?: boolean; rating?: number | null },
): Promise<TalentResult> {
  return act((ctx) => talent.updateReview(ctx, id, patch));
}

export async function tickOnboardingAction(taskId: string, done: boolean): Promise<TalentResult> {
  return act((ctx) => setChecklistStep(ctx, taskId, done));
}
