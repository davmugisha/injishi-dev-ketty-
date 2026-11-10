"use server";

import { screenHref } from "@injishi/data";
import { revalidatePath } from "next/cache";
import { requirePersona } from "@/lib/session";
import { ApiError, ApiUnreachableError } from "@/server/api";
import { requestContext } from "@/server/data";
import { askTicket, type HelpTopicId, replyTicket, sendSelfReview } from "@/server/mutations/hr-desk";
import * as me from "@/server/mutations/me";

/** What an ask on Me answers: done, or the refusal in words the page can show. */
export type MeResult = { ok: true } | { ok: false; error: string };

async function ask(act: (ctx: Awaited<ReturnType<typeof requestContext>>) => Promise<void>): Promise<MeResult> {
  await requirePersona("MyHr");
  try {
    await act(await requestContext());
    revalidatePath(screenHref("MyHr"));
    return { ok: true };
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, error: error.message };
    if (error instanceof me.MeInputError) return { ok: false, error: error.message };
    if (error instanceof ApiUnreachableError)
      return { ok: false, error: "The Injishi service did not answer. Try again." };
    throw error;
  }
}

export async function askLeave(
  employeeId: string,
  input: { leaveTypeId: string; startsOn: string; endsOn: string; reason: string },
): Promise<MeResult> {
  return ask((ctx) => me.askLeave(ctx, employeeId, input));
}

export async function askExtraDays(
  employeeId: string,
  input: { leaveTypeId: string; days: number; reason: string },
): Promise<MeResult> {
  return ask((ctx) => me.askExtraDays(ctx, employeeId, input));
}

export async function askSwap(employeeId: string, day: string, colleagueId: string): Promise<MeResult> {
  return ask((ctx) => me.askSwap(ctx, employeeId, day, colleagueId));
}

export async function answerSwap(
  employeeId: string,
  requestId: string,
  answer: "accept" | "decline",
): Promise<MeResult> {
  return ask((ctx) => me.answerSwap(ctx, employeeId, requestId, answer));
}

export async function askShiftChange(
  employeeId: string,
  day: string,
  shiftTemplateId: string,
  reason: string,
): Promise<MeResult> {
  return ask((ctx) => me.askShiftChange(ctx, employeeId, day, shiftTemplateId, reason));
}

export async function askRotation(
  employeeId: string,
  rotationPatternId: string,
  from: string,
  reason: string,
): Promise<MeResult> {
  return ask((ctx) => me.askRotation(ctx, employeeId, rotationPatternId, from, reason));
}

export async function cancelMine(employeeId: string, requestId: string): Promise<MeResult> {
  return ask((ctx) => me.cancelMine(ctx, employeeId, requestId));
}

export async function askClaim(employeeId: string, form: FormData): Promise<MeResult> {
  return ask((ctx) => me.askClaim(ctx, employeeId, form));
}

export async function cancelClaim(employeeId: string, claimId: string): Promise<MeResult> {
  return ask((ctx) => me.cancelClaim(ctx, employeeId, claimId));
}

export async function handInDocument(employeeId: string, form: FormData): Promise<MeResult> {
  return ask((ctx) => me.handInDocument(ctx, employeeId, form));
}

export async function tickTask(employeeId: string, taskId: string, done: boolean): Promise<MeResult> {
  return ask((ctx) => me.tickTask(ctx, employeeId, taskId, done));
}

export async function askFix(
  employeeId: string,
  input: { recordId: string | null; workDate: string; inAt: string; outAt: string; reason: string },
): Promise<MeResult> {
  return ask((ctx) => me.askFix(ctx, employeeId, input));
}

export async function changePin(employeeId: string, input: { currentPin: string; pin: string }): Promise<MeResult> {
  return ask((ctx) => me.changePin(ctx, employeeId, input));
}

/** Ask HR or IT a question; it shows under Help desk with HR's answer. */
export async function askHelp(input: { topic: HelpTopicId; body: string }): Promise<MeResult> {
  return ask(async (ctx) => {
    const body = input.body.trim();
    if (body.length < 2) throw new me.MeInputError("Write your question.");
    await askTicket(ctx, { topic: input.topic, subject: body.split(/\r?\n/)[0].slice(0, 80), body });
  });
}

/** Write again on a question to HR; a resolved one opens again. */
export async function replyHelp(employeeId: string, ticketId: string, text: string): Promise<MeResult> {
  return ask(async (ctx) => {
    const body = text.trim();
    if (body.length < 2) throw new me.MeInputError("Write your reply.");
    await replyTicket(ctx, ticketId, body, employeeId);
  });
}

/** The person's own part of their review. */
export async function sendReview(employeeId: string, reviewId: string, note: string): Promise<MeResult> {
  return ask(async (ctx) => {
    const words = note.trim();
    if (words.length < 3) throw new me.MeInputError("Write a few words.");
    await sendSelfReview(ctx, reviewId, words, employeeId);
  });
}

/** A clock-in or out: counted, or saved for HR to check, or refused with the reason. */
export type ClockResult = { ok: true; counted: boolean; message: string } | { ok: false; error: string };

export async function clockMe(
  employeeId: string,
  direction: "in" | "out",
  input: { fix: me.ClockFix | null; code?: string },
): Promise<ClockResult> {
  await requirePersona("MyHr");
  try {
    const answer = await me.clock(await requestContext(), employeeId, direction, input);
    revalidatePath(screenHref("MyHr"));
    const done = direction === "in" ? "You are clocked in." : "You are clocked out.";
    const why = (answer.pendingReason ?? "it needs a look.").replace(
      /^It was (\d+) m from the branch\.$/,
      (_, m: string) => {
        const metres = Number(m);
        return `you were ${metres < 1000 ? `${metres} m` : `${(metres / 1000).toFixed(1)} km`} from work.`;
      },
    );
    return answer.validated
      ? { ok: true, counted: true, message: done }
      : {
          ok: true,
          counted: false,
          message: `${done} HR will check it: ${why}`,
        };
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, error: error.message };
    if (error instanceof me.MeInputError) return { ok: false, error: error.message };
    if (error instanceof ApiUnreachableError)
      return { ok: false, error: "The Injishi service did not answer. Try again." };
    throw error;
  }
}
