// The phone's own database for real data (mobile spec 0003, D-p): `injishi-data.db`, apart from the
// fixture store in `lib/store.ts`, whose seed wipes its documents whenever the fixtures change. The
// schema version lives in `PRAGMA user_version`; each step below runs once, in order.

import { openDatabaseSync, type SQLiteDatabase } from "expo-sqlite";

const STEPS: readonly string[] = [
  // 1: the outbox (one row per write saved on the phone) and its small meta table.
  `CREATE TABLE IF NOT EXISTS outbox (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    id TEXT NOT NULL UNIQUE,
    lane TEXT NOT NULL,
    user_id TEXT NOT NULL,
    workspace_id TEXT,
    branch_id TEXT,
    kind TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    payload TEXT NOT NULL,
    occurred_at TEXT NOT NULL,
    occurred_mono REAL NOT NULL,
    process_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    state TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    next_attempt_at INTEGER,
    depends_on TEXT,
    server_message TEXT,
    result TEXT,
    sent_at INTEGER,
    server_at TEXT,
    file_uri TEXT,
    file_object_key TEXT
  );
  CREATE INDEX IF NOT EXISTS outbox_lane_idx ON outbox (user_id, lane, state, seq);
  CREATE TABLE IF NOT EXISTS outbox_meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);`,
];

let opened: SQLiteDatabase | null = null;

/** The database, opened and brought up to date on first use. */
export function dataDb(): SQLiteDatabase {
  if (opened) return opened;
  const db = openDatabaseSync("injishi-data.db");
  db.execSync("PRAGMA journal_mode = WAL;");
  const version = db.getFirstSync<{ user_version: number }>("PRAGMA user_version")?.user_version ?? 0;
  for (let step = version; step < STEPS.length; step += 1) {
    db.withTransactionSync(() => {
      db.execSync(STEPS[step]);
      db.execSync(`PRAGMA user_version = ${step + 1}`);
    });
  }
  opened = db;
  return db;
}

/** One value of `outbox_meta`. */
export function readMeta(key: string): string | null {
  return dataDb().getFirstSync<{ value: string }>("SELECT value FROM outbox_meta WHERE key = ?", key)?.value ?? null;
}

export function writeMeta(key: string, value: string): void {
  dataDb().runSync(
    "INSERT INTO outbox_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    key,
    value,
  );
}

export function deleteMeta(key: string): void {
  dataDb().runSync("DELETE FROM outbox_meta WHERE key = ?", key);
}
