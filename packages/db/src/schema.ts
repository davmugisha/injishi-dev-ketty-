import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Embedded database schema (SQLite / libSQL). Shared by the web app (libSQL file) and,
 * later, the Expo app (expo-sqlite). Identity and auth are relational; screen data lives in
 * document collections so the frontend can evolve before the backend's domain model is fixed.
 */

/** People who can sign in — seeded from @injishi/data personas. */
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone").notNull(),
  role: text("role").notNull(),
  org: text("org").notNull(),
  home: text("home").notNull(),
});

/** One-time sign-in codes. In this frontend-first build every code is the demo code. */
export const otpChallenges = sqliteTable("otp_challenges", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  email: text("email").notNull(),
  code: text("code").notNull(),
  attempts: integer("attempts").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  consumedAt: integer("consumed_at", { mode: "timestamp_ms" }),
});

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

/** Screen data: collection "<area>.<thing>" → documents (JSON), ordered by position. */
export const documents = sqliteTable(
  "documents",
  {
    collection: text("collection").notNull(),
    id: text("id").notNull(),
    position: integer("position").notNull(),
    data: text("data", { mode: "json" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.collection, t.id] }),
    index("documents_collection_idx").on(t.collection, t.position),
  ],
);

/** Key/value bookkeeping (seed hash, seeded-at). */
export const meta = sqliteTable("meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const schema = { users, otpChallenges, sessions, documents, meta };

/** DDL applied on first use (mirrors the Drizzle tables above; drizzle-kit can generate migrations later). */
export const BOOTSTRAP_SQL = [
  `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, phone TEXT NOT NULL, role TEXT NOT NULL, org TEXT NOT NULL, home TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS otp_challenges (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), email TEXT NOT NULL, code TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, consumed_at INTEGER)`,
  `CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id)`,
  `CREATE TABLE IF NOT EXISTS documents (collection TEXT NOT NULL, id TEXT NOT NULL, position INTEGER NOT NULL, data TEXT NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY (collection, id))`,
  `CREATE INDEX IF NOT EXISTS documents_collection_idx ON documents(collection, position)`,
  `CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
];
