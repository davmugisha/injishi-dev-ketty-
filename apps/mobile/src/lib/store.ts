// Embedded database for the phone apps (iOS/Android): SQLite via expo-sqlite + Drizzle, using the same schema
// as the web app (@injishi/db/schema) and seeded from the same fixtures (@injishi/data). Synchronous on purpose:
// reads are local and tiny, so screens can render from it directly. The web build uses store.web.ts instead.
// Sign-in is not here: a phone signs in through the API (auth.ts).

import { allCollections } from "@injishi/data/fixtures/index";
import { personas } from "@injishi/data/personas";
import { screens } from "@injishi/data/screens";
import type { Doc } from "@injishi/data/types";
import { BOOTSTRAP_SQL, documents, meta, schema, users } from "@injishi/db/schema";
import { and, asc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/expo-sqlite";
import { openDatabaseSync } from "expo-sqlite";
import { fnv1a } from "./store-shared";

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
