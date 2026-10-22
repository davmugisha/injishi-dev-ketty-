// Web preview build of the phone apps (A/B screenshots), standing in for auth.ts: no API, the fixture
// personas, the demo code. It exists so a static preview needs no backend; nobody signs in to it for real.
// It exports what auth.ts exports, so the screens cannot tell the two apart.

import { personas } from "@injishi/data/personas";
import type { PersonaId } from "@injishi/data/types";
import type * as Native from "./auth";
import { currentPersonaId, signInDirect, signOutStore, startOtp, verifyOtp } from "./store.web";

export type { GoogleOutcome, SendOutcome, SessionState, SignInOptions, VerifyOutcome } from "./auth";

/** The challenge each address is waiting on, for the code step. */
const pending = new Map<string, string>();

export const signInOptions: typeof Native.signInOptions = async () => ({ demo: true, seededAt: null, google: false });

export const requestCode: typeof Native.requestCode = async (email) => {
  const started = startOtp(email.trim());
  if (!started.ok) return { ok: false, reason: "invalid-email" };
  pending.set(started.email, started.challengeId);
  return { ok: true };
};

export const verifyCode: typeof Native.verifyCode = async (email, code) => {
  const challenge = pending.get(email.trim().toLowerCase()) ?? pending.get(email.trim());
  if (!challenge) return { ok: false, reason: "expired" };
  const result = verifyOtp(challenge, code);
  if (result.ok) return { ok: true };
  if (result.reason === "wrong-code") return { ok: false, reason: "wrong-code" };
  if (result.reason === "locked") return { ok: false, reason: "too-many" };
  return { ok: false, reason: "expired" };
};

export const signInWithGoogle: typeof Native.signInWithGoogle = async () => ({ ok: false, reason: "failed" });

export const loadSession: typeof Native.loadSession = async () => {
  const id = currentPersonaId();
  return id ? { status: "signed-in", persona: personas[id] } : { status: "signed-out" };
};

export const signOut: typeof Native.signOut = async () => {
  signOutStore();
};

/** `/sign-in?as=<persona>` for captures: signed in without the code step. */
export const signInAs: typeof Native.signInAs = (personaId: PersonaId) => {
  signInDirect(personaId);
  return true;
};
