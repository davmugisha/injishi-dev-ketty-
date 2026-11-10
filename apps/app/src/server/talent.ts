/**
 * Talent through the API (058-talent): the hiring board, review cycles and the joining checklists
 * of new starters, and every write the Talent screen makes. The shapes mirror `@injishi/contracts`
 * talent.ts and checklists.ts, which the app does not import.
 */

import type {
  CandidateStage,
  OfferRound,
  Onboarding,
  TalentBoardView,
  TalentCandidate,
  TalentInterview,
  TalentReview,
  TalentReviewCycle,
  TalentVacancy,
} from "@injishi/product-hr";
import { ApiError } from "./api";
import type { SourceContext } from "./sources/types";

export type {
  CandidateStage,
  OfferRound,
  Onboarding,
  TalentBoardView,
  TalentCandidate,
  TalentInterview,
  TalentReview,
  TalentReviewCycle,
  TalentVacancy,
};

const ops = (ctx: SourceContext) => ctx.ops("hospitality");

/** A read the person may not hold answers nothing rather than failing the screen. */
async function orEmpty<T>(read: Promise<T>, empty: T): Promise<T> {
  try {
    return await read;
  } catch (error) {
    if (error instanceof ApiError && (error.forbidden || error.notFound)) return empty;
    throw error;
  }
}

export function readTalentBoard(ctx: SourceContext): Promise<TalentBoardView> {
  return orEmpty(ops(ctx).get<TalentBoardView>("/api/v1/ops/talent"), {
    vacancies: [],
    candidates: [],
    interviews: [],
  });
}

export async function readReviewCycle(ctx: SourceContext): Promise<TalentReviewCycle | null> {
  return (
    await orEmpty(ops(ctx).get<{ cycle: TalentReviewCycle | null }>("/api/v1/ops/review-cycles/current"), {
      cycle: null,
    })
  ).cycle;
}

/** Joining checklists still open, newest first. */
export async function readOnboarding(ctx: SourceContext): Promise<Onboarding[]> {
  const board = await orEmpty(
    ops(ctx).get<{ checklists: (Onboarding & { kind: string; startedAt: string })[] }>("/api/v1/ops/hr/checklists"),
    { checklists: [] },
  );
  return board.checklists
    .filter((c) => c.kind === "onboarding" && c.doneCount < c.tasks.length)
    .sort((a, b) => b.anchorOn.localeCompare(a.anchorOn))
    .map(({ id, employee, anchorOn, doneCount, tasks }) => ({ id, employee, anchorOn, doneCount, tasks }));
}

export async function openVacancy(
  ctx: SourceContext,
  body: {
    title: string;
    branchId: string | null;
    openings: number;
    wageFromRwf: number | null;
    wageToRwf: number | null;
    closesOn: string | null;
    managerEmployeeId: string | null;
    note: string | null;
    documents: string[];
  },
): Promise<void> {
  await ops(ctx).post("/api/v1/ops/vacancies", body);
}

export async function changeVacancy(
  ctx: SourceContext,
  id: string,
  body: { status?: "open" | "closed" | "filled"; closesOn?: string | null; documents?: string[] },
): Promise<void> {
  await ops(ctx).patch(`/api/v1/ops/vacancies/${encodeURIComponent(id)}`, body);
}

export async function addCandidate(
  ctx: SourceContext,
  body: {
    vacancyId: string;
    fullName: string;
    phone: string | null;
    email: string | null;
    source: string;
    note: string | null;
    talentPool: boolean;
    expectedWageRwf: number | null;
  },
): Promise<void> {
  await ops(ctx).post("/api/v1/ops/candidates", body);
}

/** The business offers again, or the candidate asks back. */
export async function addOfferRound(
  ctx: SourceContext,
  id: string,
  body: { side: OfferRound["side"]; amountRwf: number; startsOn: string | null; note: string | null },
): Promise<void> {
  await ops(ctx).post(`/api/v1/ops/candidates/${encodeURIComponent(id)}/offer-rounds`, body);
}

/** Both sides settle on a wage. */
export async function agreeOffer(ctx: SourceContext, id: string, body: { amountRwf: number }): Promise<void> {
  await ops(ctx).post(`/api/v1/ops/candidates/${encodeURIComponent(id)}/offer/agree`, body);
}

export async function moveCandidate(
  ctx: SourceContext,
  id: string,
  body: { stage: CandidateStage; offerWageRwf?: number; offerStartsOn?: string; reason?: string },
): Promise<void> {
  await ops(ctx).post(`/api/v1/ops/candidates/${encodeURIComponent(id)}/stage`, body);
}

export async function scoreCandidate(
  ctx: SourceContext,
  id: string,
  body: { what: string; score: number; note: string | null },
): Promise<void> {
  await ops(ctx).post(`/api/v1/ops/candidates/${encodeURIComponent(id)}/scores`, body);
}

export async function bookInterview(
  ctx: SourceContext,
  body: { candidateId: string; startsAt: string; place: string | null; interviewerName: string | null },
): Promise<void> {
  await ops(ctx).post("/api/v1/ops/interviews", body);
}

export async function setInterviewStatus(
  ctx: SourceContext,
  id: string,
  status: "scheduled" | "done" | "cancelled",
): Promise<void> {
  await ops(ctx).post(`/api/v1/ops/interviews/${encodeURIComponent(id)}/status`, { status });
}

export async function openReviewCycle(
  ctx: SourceContext,
  body: { name: string; startsOn: string; endsOn: string },
): Promise<void> {
  await ops(ctx).post("/api/v1/ops/review-cycles", body);
}

export async function closeReviewCycle(ctx: SourceContext, id: string): Promise<void> {
  await ops(ctx).post(`/api/v1/ops/review-cycles/${encodeURIComponent(id)}/close`);
}

export async function updateReview(
  ctx: SourceContext,
  id: string,
  body: { selfDone?: boolean; managerDone?: boolean; rating?: number | null },
): Promise<void> {
  await ops(ctx).patch(`/api/v1/ops/reviews/${encodeURIComponent(id)}`, body);
}
