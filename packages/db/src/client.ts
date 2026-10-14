import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { allCollections } from "@injishi/data/fixtures/index";
import { personas } from "@injishi/data/personas";
import { screens } from "@injishi/data/screens";
import { type Client, createClient } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { BOOTSTRAP_SQL, documents, meta, schema, users } from "./schema.ts";

export type Db = LibSQLDatabase<typeof schema>;

/** Walk up from the working directory to the monorepo root (the folder with pnpm-workspace.yaml). */
function repoRoot(): string {
  let dir = process.cwd();
  for (;;) {
    if (fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return process.cwd();
    dir = parent;
  }
}

export function databaseUrl(): string {
  if (process.env.INJISHI_DB_URL) return process.env.INJISHI_DB_URL;
  const dir = path.join(repoRoot(), ".data");
  fs.mkdirSync(dir, { recursive: true });
  return `file:${path.join(dir, "injishi.db").replace(/\\/g, "/")}`;
}

/** Hash of everything the seed writes; a change re-seeds the database on next use. */
export function seedHash(): string {
  const payload = JSON.stringify({ collections: allCollections(), personas });
  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

export async function seed(db: Db, client: Client): Promise<{ users: number; collections: number; documents: number }> {
  const now = new Date();
  const collections = allCollections();
  const userRows = Object.values(personas).map((p) => ({
    id: p.id,
    name: p.name,
    email: p.email,
    phone: p.phone,
    role: p.role,
    org: p.org,
    home: screens[p.home].href,
  }));
  const docRows = Object.entries(collections).flatMap(([collection, docs]) =>
    docs.map((doc, position) => ({ collection, id: String(doc.id), position, data: doc, updatedAt: now })),
  );
  await client.execute("PRAGMA foreign_keys = OFF");
  await db.transaction(async (tx) => {
    await tx.delete(documents);
    for (const u of userRows) {
      await tx.insert(users).values(u).onConflictDoUpdate({ target: users.id, set: u });
    }
    for (let i = 0; i < docRows.length; i += 200) {
      await tx.insert(documents).values(docRows.slice(i, i + 200));
    }
    const hash = seedHash();
    for (const [key, value] of [
      ["seed_hash", hash],
      ["seeded_at", now.toISOString()],
    ]) {
      await tx.insert(meta).values({ key, value }).onConflictDoUpdate({ target: meta.key, set: { value } });
    }
  });
  await client.execute("PRAGMA foreign_keys = ON");
  return { users: userRows.length, collections: Object.keys(collections).length, documents: docRows.length };
}

interface DbState {
  client: Client;
  db: Db;
  ready: Promise<void>;
  /** Fixture hash this process last verified the database against. */
  hash: string | null;
}

const globalForDb = globalThis as unknown as { __injishiDb?: DbState };

async function bootstrap(client: Client): Promise<void> {
  await client.execute("PRAGMA journal_mode = WAL");
  await client.execute("PRAGMA busy_timeout = 5000");
  for (const sql of BOOTSTRAP_SQL) await client.execute(sql);
}

async function reseedIfStale(state: DbState, hash: string): Promise<void> {
  const row = await state.client.execute({ sql: "SELECT value FROM meta WHERE key = 'seed_hash'", args: [] });
  if (row.rows[0]?.value !== hash) await seed(state.db, state.client);
  state.hash = hash;
}

/**
 * The process-wide database, bootstrapped and seeded on first use. Fixture files are hashed on
 * every call, so editing fixtures during `next dev` re-seeds on the next request (the singleton
 * survives hot reloads). Mutations made through the app persist until the fixtures change or
 * `pnpm db:reset` runs.
 */
export async function getDb(): Promise<Db> {
  let state = globalForDb.__injishiDb;
  if (!state) {
    const client = createClient({ url: databaseUrl() });
    state = { client, db: drizzle(client, { schema }), ready: Promise.resolve(), hash: null };
    const s = state;
    s.ready = bootstrap(client);
    globalForDb.__injishiDb = s;
  }
  const s = state;
  const hash = seedHash();
  if (hash !== s.hash) s.ready = s.ready.then(() => reseedIfStale(s, hash));
  try {
    await s.ready;
  } catch (error) {
    globalForDb.__injishiDb = undefined;
    throw error;
  }
  return s.db;
}

export async function getClient(): Promise<Client> {
  await getDb();
  return (globalForDb.__injishiDb as DbState).client;
}
