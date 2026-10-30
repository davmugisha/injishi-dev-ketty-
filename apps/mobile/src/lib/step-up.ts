// The emailed step up code (mobile spec 0003, D-b, AC-1): once per session, staff enter a second code
// before any room call, because the API asks for it. Every call needs only the session.

import { TwoFactorChallenge, TwoFactorSent } from "@injishi/contracts";
import { api } from "./api";
import { learnServerDate } from "./clock";

export type StepUpStart =
  /** A code is on its way to `sentTo`. */
  | { status: "sent"; sentTo: string }
  /** This session needs no code (any more). */
  | { status: "not-needed" }
  /** The API cannot be reached: the screen asks to connect for a code. */
  | { status: "offline" }
  | { status: "signed-out" }
  | { status: "refused"; message: string };

/** Where a code goes, then a fresh code. A resend refused for its cooldown means one is already on its way (D-at). */
export async function startStepUp(): Promise<StepUpStart> {
  const challenge = await api.requestParsed(TwoFactorChallenge, "/api/v1/me/two-factor");
  if (challenge.status === "unauthenticated") return { status: "signed-out" };
  if (challenge.status !== "ok") {
    return challenge.status === "failed"
      ? { status: "offline" }
      : { status: "refused", message: challenge.message ?? "Injishi couldn't start the code check." };
  }
  learnServerDate(challenge.serverDate);
  if (!challenge.data.required || challenge.data.verified) return { status: "not-needed" };
  return sendStepUpCode(challenge.data.sentTo);
}

/** Ask for a code (again). */
export async function sendStepUpCode(sentTo: string): Promise<StepUpStart> {
  const sent = await api.requestParsed(TwoFactorSent, "/api/v1/me/two-factor/send", { method: "POST", body: {} });
  if (sent.status === "ok") return { status: "sent", sentTo: sent.data.sentTo };
  if (sent.status === "unauthenticated") return { status: "signed-out" };
  if (sent.status === "failed") return { status: "offline" };
  if (sent.code === "resend_cooldown") return { status: "sent", sentTo };
  return { status: "refused", message: sent.message ?? "Injishi couldn't send a code." };
}

export type StepUpCheck =
  | { status: "verified" }
  | { status: "wrong"; message: string }
  | { status: "offline" }
  | { status: "signed-out" };

/** Check the six digits. */
export async function verifyStepUpCode(code: string): Promise<StepUpCheck> {
  const answer = await api.request("/api/v1/me/two-factor/verify", { method: "POST", body: { code } });
  if (answer.status === "ok") return { status: "verified" };
  if (answer.status === "unauthenticated") return { status: "signed-out" };
  if (answer.status === "failed") return { status: "offline" };
  return { status: "wrong", message: answer.message ?? "That code didn't work. Use the newest one we sent." };
}
