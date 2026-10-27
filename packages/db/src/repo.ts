import { randomBytes, randomUUID } from "node:crypto";
import { DEMO_OTP, personaByEmail } from "@injishi/data/personas";
import type { Doc, PersonaId } from "@injishi/data/types";
import { and, asc, eq, gt, isNull, sql } from "drizzle-orm";
import { getDb } from "./client.ts";
import { assertFixtureWrite } from "./guard.ts";
import { documents, otpChallenges, sessions, users } from "./schema.ts";

// ── Documents ────────────────────────────────────────────────────────────────

/** All documents of a collection, in fixture order. Collection names are "<area>.<thing>". */
export async function getCollection<T extends Doc>(collection: string): Promise<T[]> {
  const db = await getDb();
  const rows = await db
    .select({ data: documents.data })
    .from(documents)
    .where(eq(documents.collection, collection))
    .orderBy(asc(documents.position));
  return rows.map((r) => r.data as T);
}

/** Several collections at once, keyed by name: `const { a, b } = await getCollections({ a: "x.a", b: "x.b" })`. */
export async function getCollections<K extends string>(names: Record<K, string>): Promise<Record<K, Doc[]>> {
  const entries = await Promise.all(
    Object.entries<string>(names).map(async ([key, name]) => [key, await getCollection(name)] as const),
  );
  return Object.fromEntries(entries) as Record<K, Doc[]>;
}

export async function getDocument<T extends Doc>(collection: string, id: string): Promise<T | undefined> {
  const db = await getDb();
  const [row] = await db
    .select({ data: documents.data })
    .from(documents)
    .where(and(eq(documents.collection, collection), eq(documents.id, id)))
    .limit(1);
  return row?.data as T | undefined;
}

/** Insert or replace a document (appended at the end of its collection when new). */
export async function saveDocument<T extends Doc>(collection: string, doc: T): Promise<void> {
  assertFixtureWrite();
  const db = await getDb();
  const [{ next }] = await db
    .select({ next: sql<number>`coalesce(max(${documents.position}), -1) + 1` })
    .from(documents)
    .where(eq(documents.collection, collection));
  await db
    .insert(documents)
    .values({ collection, id: doc.id, position: next, data: doc, updatedAt: new Date() })
    .onConflictDoUpdate({ target: [documents.collection, documents.id], set: { data: doc, updatedAt: new Date() } });
}

/** Shallow-merge fields into an existing document. Returns the updated document. */
export async function updateDocument<T extends Doc>(
  collection: string,
  id: string,
  patch: Partial<T>,
): Promise<T | undefined> {
  assertFixtureWrite();
  const current = await getDocument<T>(collection, id);
  if (!current) return undefined;
  const next = { ...current, ...patch, id } as T;
  await saveDocument(collection, next);
  return next;
}

export async function deleteDocument(collection: string, id: string): Promise<void> {
  assertFixtureWrite();
  const db = await getDb();
  await db.delete(documents).where(and(eq(documents.collection, collection), eq(documents.id, id)));
}

// ── Users ────────────────────────────────────────────────────────────────────

export async function getUser(id: PersonaId) {
  const db = await getDb();
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return row;
}

// ── One-time codes ───────────────────────────────────────────────────────────

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

export type OtpStart =
  | { ok: true; challengeId: string; email: string; expiresAt: Date }
  | { ok: false; reason: "unknown-email" };

/** Start a sign-in: the code is always the demo code (no message is sent). */
export async function startOtp(email: string): Promise<OtpStart> {
  assertFixtureWrite();
  const persona = personaByEmail(email);
  if (!persona) return { ok: false, reason: "unknown-email" };
  const db = await getDb();
  const now = new Date();
  const challenge = {
    id: randomUUID(),
    userId: persona.id,
    email: persona.email,
    code: DEMO_OTP,
    attempts: 0,
    createdAt: now,
    expiresAt: new Date(now.getTime() + OTP_TTL_MS),
  };
  await db.insert(otpChallenges).values(challenge);
  return { ok: true, challengeId: challenge.id, email: persona.email, expiresAt: challenge.expiresAt };
}

export type OtpCheck =
  | { ok: true; personaId: PersonaId }
  | { ok: false; reason: "wrong-code"; attemptsLeft: number }
  | { ok: false; reason: "expired" | "locked" | "not-found" };

export async function verifyOtp(challengeId: string, code: string): Promise<OtpCheck> {
  assertFixtureWrite();
  const db = await getDb();
  const [challenge] = await db.select().from(otpChallenges).where(eq(otpChallenges.id, challengeId)).limit(1);
  if (!challenge || challenge.consumedAt) return { ok: false, reason: "not-found" };
  if (challenge.expiresAt.getTime() < Date.now()) return { ok: false, reason: "expired" };
  if (challenge.attempts >= OTP_MAX_ATTEMPTS) return { ok: false, reason: "locked" };
  if (code.replace(/\D/g, "") !== challenge.code) {
    const attempts = challenge.attempts + 1;
    await db.update(otpChallenges).set({ attempts }).where(eq(otpChallenges.id, challengeId));
    return attempts >= OTP_MAX_ATTEMPTS
      ? { ok: false, reason: "locked" }
      : { ok: false, reason: "wrong-code", attemptsLeft: OTP_MAX_ATTEMPTS - attempts };
  }
  await db.update(otpChallenges).set({ consumedAt: new Date() }).where(eq(otpChallenges.id, challengeId));
  return { ok: true, personaId: challenge.userId as PersonaId };
}

/** The pending challenge's email, for the code screen ("We sent a 6-digit code to …"). */
export async function getOtpChallenge(challengeId: string) {
  const db = await getDb();
  const [row] = await db
    .select({ id: otpChallenges.id, email: otpChallenges.email, expiresAt: otpChallenges.expiresAt })
    .from(otpChallenges)
    .where(
      and(eq(otpChallenges.id, challengeId), isNull(otpChallenges.consumedAt), gt(otpChallenges.expiresAt, new Date())),
    )
    .limit(1);
  return row;
}

// ── Sessions ─────────────────────────────────────────────────────────────────

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export async function createSession(personaId: PersonaId): Promise<{ token: string; expiresAt: Date }> {
  assertFixtureWrite();
  const db = await getDb();
  const now = new Date();
  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  await db.insert(sessions).values({ id: token, userId: personaId, createdAt: now, expiresAt });
  return { token, expiresAt };
}

export async function getSession(
  token: string | undefined | null,
): Promise<{ personaId: PersonaId; expiresAt: Date } | null> {
  if (!token) return null;
  const db = await getDb();
  const [row] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.id, token), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return row ? { personaId: row.userId as PersonaId, expiresAt: row.expiresAt } : null;
}

export async function deleteSession(token: string): Promise<void> {
  assertFixtureWrite();
  const db = await getDb();
  await db.delete(sessions).where(eq(sessions.id, token));
}
