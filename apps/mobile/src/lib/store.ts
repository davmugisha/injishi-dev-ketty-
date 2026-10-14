// Embedded database for the phone apps (iOS/Android): SQLite via expo-sqlite + Drizzle, using the same schema
// as the web app (@injishi/db/schema) and seeded from the same fixtures (@injishi/data). Synchronous on purpose:
// reads are local and tiny, so screens can render from it directly. The web build uses store.web.ts instead.

import { allCollections } from "@injishi/data/fixtures/index";
import { DEMO_OTP, personaByEmail, personas } from "@injishi/data/personas";
import { screens } from "@injishi/data/screens";
import type { Doc, PersonaId } from "@injishi/data/types";
import { BOOTSTRAP_SQL, documents, meta, otpChallenges, schema, sessions, users } from "@injishi/db/schema";
import { and, asc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/expo-sqlite";
import { openDatabaseSync } from "expo-sqlite";
import { fnv1a, newId, type OtpCheck, type OtpStart } from "./store-shared";

export type { OtpCheck, OtpStart } from "./store-shared";

const sqlite = openDatabaseSync("injishi.db");
const db = drizzle(sqlite, { schema });

function seed(hash: string): void {
  const now = new Date();
  db.transaction((tx) => {
    tx.delete(documents).run();
    for (const p of Object.values(personas)) {
      const row = {
        id: p.id,
        name: p.name,
        email: p.email,
        phone: p.phone,
        role: p.role,
        org: p.org,
        home: screens[p.home].href,
      };
      tx.insert(users).values(row).onConflictDoUpdate({ target: users.id, set: row }).run();
    }
    for (const [collection, docs] of Object.entries(allCollections())) {
      docs.forEach((doc, position) => {
        tx.insert(documents)
          .values({ collection, id: String(doc.id), position, data: doc, updatedAt: now })
          .run();
      });
    }
    tx.insert(meta)
      .values({ key: "seed_hash", value: hash })
      .onConflictDoUpdate({ target: meta.key, set: { value: hash } })
      .run();
  });
}

/** Create tables and (re)seed when the fixtures changed. Call once at app start. */
export function initStore(): void {
  sqlite.execSync("PRAGMA journal_mode = WAL");
  for (const statement of BOOTSTRAP_SQL) sqlite.execSync(statement);
  const hash = fnv1a(JSON.stringify({ collections: allCollections(), personas }));
  const row = db.select().from(meta).where(eq(meta.key, "seed_hash")).get();
  if (row?.value !== hash) seed(hash);
}

export function getCollection<T extends Doc>(collection: string): T[] {
  return db
    .select({ data: documents.data })
    .from(documents)
    .where(eq(documents.collection, collection))
    .orderBy(asc(documents.position))
    .all()
    .map((r) => r.data as T);
}

export function getDocument<T extends Doc>(collection: string, id: string): T | undefined {
  const row = db
    .select({ data: documents.data })
    .from(documents)
    .where(and(eq(documents.collection, collection), eq(documents.id, id)))
    .get();
  return row?.data as T | undefined;
}

export function saveDocument<T extends Doc>(collection: string, doc: T): void {
  const next = db
    .select({ n: sql<number>`coalesce(max(${documents.position}), -1) + 1` })
    .from(documents)
    .where(eq(documents.collection, collection))
    .get();
  db.insert(documents)
    .values({ collection, id: doc.id, position: next?.n ?? 0, data: doc, updatedAt: new Date() })
    .onConflictDoUpdate({ target: [documents.collection, documents.id], set: { data: doc, updatedAt: new Date() } })
    .run();
}

export function deleteDocument(collection: string, id: string): void {
  db.delete(documents)
    .where(and(eq(documents.collection, collection), eq(documents.id, id)))
    .run();
}

// ── One-time codes and sessions (same rules as the web app: the demo code is 123456) ──

export function startOtp(email: string): OtpStart {
  const persona = personaByEmail(email);
  if (!persona) return { ok: false, reason: "unknown-email" };
  const now = new Date();
  const challenge = {
    id: newId(),
    userId: persona.id,
    email: persona.email,
    code: DEMO_OTP,
    attempts: 0,
    createdAt: now,
    expiresAt: new Date(now.getTime() + 10 * 60 * 1000),
  };
  db.insert(otpChallenges).values(challenge).run();
  return { ok: true, challengeId: challenge.id, email: persona.email, expiresAt: challenge.expiresAt };
}

export function verifyOtp(challengeId: string, code: string): OtpCheck {
  const c = db.select().from(otpChallenges).where(eq(otpChallenges.id, challengeId)).get();
  if (!c || c.consumedAt) return { ok: false, reason: "not-found" };
  if (c.expiresAt.getTime() < Date.now()) return { ok: false, reason: "expired" };
  if (c.attempts >= 5) return { ok: false, reason: "locked" };
  if (code.replace(/\D/g, "") !== c.code) {
    const attempts = c.attempts + 1;
    db.update(otpChallenges).set({ attempts }).where(eq(otpChallenges.id, challengeId)).run();
    return attempts >= 5
      ? { ok: false, reason: "locked" }
      : { ok: false, reason: "wrong-code", attemptsLeft: 5 - attempts };
  }
  db.update(otpChallenges).set({ consumedAt: new Date() }).where(eq(otpChallenges.id, challengeId)).run();
  const token = newId();
  const now = new Date();
  db.insert(sessions)
    .values({ id: token, userId: c.userId, createdAt: now, expiresAt: new Date(now.getTime() + 30 * 24 * 3600 * 1000) })
    .run();
  db.insert(meta)
    .values({ key: "current_session", value: token })
    .onConflictDoUpdate({ target: meta.key, set: { value: token } })
    .run();
  return { ok: true, personaId: c.userId as PersonaId };
}

/** The signed-in persona on this device, if any. */
export function currentPersonaId(): PersonaId | null {
  const cur = db.select().from(meta).where(eq(meta.key, "current_session")).get();
  if (!cur?.value) return null;
  const s = db.select().from(sessions).where(eq(sessions.id, cur.value)).get();
  if (!s || s.expiresAt.getTime() < Date.now()) return null;
  return s.userId as PersonaId;
}

export function signOutStore(): void {
  const cur = db.select().from(meta).where(eq(meta.key, "current_session")).get();
  if (cur?.value) db.delete(sessions).where(eq(sessions.id, cur.value)).run();
  db.delete(meta).where(eq(meta.key, "current_session")).run();
}

/** Development/preview only: sign in as a persona without the code step. */
export function signInDirect(personaId: PersonaId): void {
  const token = newId();
  const now = new Date();
  db.insert(sessions)
    .values({
      id: token,
      userId: personaId,
      createdAt: now,
      expiresAt: new Date(now.getTime() + 30 * 24 * 3600 * 1000),
    })
    .run();
  db.insert(meta)
    .values({ key: "current_session", value: token })
    .onConflictDoUpdate({ target: meta.key, set: { value: token } })
    .run();
}
