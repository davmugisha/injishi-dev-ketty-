// Web preview build of the phone apps (used for A/B screenshots): the same API as store.ts, backed by an
// in-memory copy of the fixtures (expo-sqlite on the web needs cross-origin isolation headers a static
// preview cannot rely on). The session survives reloads in localStorage.
import { allCollections } from "@injishi/data/fixtures/index";
import { DEMO_OTP, personaByEmail, personas } from "@injishi/data/personas";
import type { Doc, PersonaId } from "@injishi/data/types";
import { newId, type OtpCheck, type OtpStart } from "./store-shared";

export type { OtpCheck, OtpStart } from "./store-shared";

let docs: Map<string, Doc[]> | null = null;
const challenges = new Map<
  string,
  { email: string; personaId: PersonaId; code: string; attempts: number; expiresAt: Date; consumed: boolean }
>();
const KEY = "injishi-mobile-session";

export function initStore(): void {
  if (docs) return;
  docs = new Map(Object.entries(allCollections()).map(([k, v]) => [k, v.map((d) => ({ ...d }))]));
}

const col = (name: string) => {
  initStore();
  return (docs as Map<string, Doc[]>).get(name) ?? [];
};

export function getCollection<T extends Doc>(collection: string): T[] {
  return col(collection) as T[];
}

export function getDocument<T extends Doc>(collection: string, id: string): T | undefined {
  return col(collection).find((d) => d.id === id) as T | undefined;
}

export function saveDocument<T extends Doc>(collection: string, doc: T): void {
  const list = col(collection);
  const i = list.findIndex((d) => d.id === doc.id);
  if (i >= 0) list[i] = doc;
  else (docs as Map<string, Doc[]>).set(collection, [...list, doc]);
}

export function deleteDocument(collection: string, id: string): void {
  (docs as Map<string, Doc[]>).set(
    collection,
    col(collection).filter((d) => d.id !== id),
  );
}

export function startOtp(email: string): OtpStart {
  const persona = personaByEmail(email);
  if (!persona) return { ok: false, reason: "unknown-email" };
  const id = newId();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  challenges.set(id, {
    email: persona.email,
    personaId: persona.id,
    code: DEMO_OTP,
    attempts: 0,
    expiresAt,
    consumed: false,
  });
  return { ok: true, challengeId: id, email: persona.email, expiresAt };
}

export function verifyOtp(challengeId: string, code: string): OtpCheck {
  const c = challenges.get(challengeId);
  if (!c || c.consumed) return { ok: false, reason: "not-found" };
  if (c.expiresAt.getTime() < Date.now()) return { ok: false, reason: "expired" };
  if (c.attempts >= 5) return { ok: false, reason: "locked" };
  if (code.replace(/\D/g, "") !== c.code) {
    c.attempts++;
    return c.attempts >= 5
      ? { ok: false, reason: "locked" }
      : { ok: false, reason: "wrong-code", attemptsLeft: 5 - c.attempts };
  }
  c.consumed = true;
  try {
    localStorage.setItem(KEY, c.personaId);
  } catch {}
  return { ok: true, personaId: c.personaId };
}

export function currentPersonaId(): PersonaId | null {
  try {
    const id = localStorage.getItem(KEY) as PersonaId | null;
    return id && id in personas ? id : null;
  } catch {
    return null;
  }
}

/** Preview-only: sign in without the code step (used by A/B captures through ?as=<persona>). */
export function signInDirect(personaId: PersonaId): void {
  try {
    localStorage.setItem(KEY, personaId);
  } catch {}
}

export function signOutStore(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}
