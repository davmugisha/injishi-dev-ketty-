/**
 * §4.1 AUTH, the two tables that name a workspace: a session and its step-up.
 *
 * Moved out of `auth.ts` with their declarations byte-identical. `sessions`
 * holds the workspace switcher's choice (`active_workspace_id` references
 * `workspaces`), and that one reference was the only thing `auth.ts` imported
 * from `org.ts`. Every table that references `users` and is referenced from
 * `org.ts` (the PSF catalogue, hospitality, inventory and the rest) therefore
 * closed an import cycle through it, which the API's cycle ratchet refuses.
 * Here, `auth.ts` imports nothing from `org.ts`, so those cycles are gone, and
 * this file is a leaf over both: nothing it imports imports it back.
 * `twoFactorChallenges` comes with `sessions` because it references it.
 *
 * `schema.ts` re-exports this module, so `drizzle.config.ts`, every migration
 * and every importer of the schema still see one schema at one path; moving a
 * table between modules changes no SQL.
 */
import { index, integer, pgTable, text, timestamp, uniqueIndex, uuid, type AnyPgColumn } from 'drizzle-orm/pg-core';
import { users } from './auth';
import { timestamps } from './columns';
import { workspaces } from './org';

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  // persists the workspace switcher (resolves O-3); FK added lazily.
  activeWorkspaceId: uuid('active_workspace_id').references(
    (): AnyPgColumn => workspaces.id,
    { onDelete: 'set null' },
  ),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  /**
   * When THIS session passed the emailed step-up, or null while it has not.
   * Per session on purpose: a new device signs in and must ask for a fresh
   * code before any operator or officer route answers (F-S02).
   * `WorkspaceGuard` and `OversightGuard` read it.
   */
  twoFactorVerifiedAt: timestamp('two_factor_verified_at', {
    withTimezone: true,
  }),
  ...timestamps,
});

/**
 * The step-up code currently outstanding for a session (F-S02).
 *
 * KEYED BY SESSION, not by person, and unique on it: a code emailed to a phone
 * cannot be typed into a laptop that never asked for one, and a resend replaces
 * the row so the newest code is the only one that works.
 *
 * `codeHash` is SHA-256 of the six digits, never the digits, so a read of this
 * table is not a working step-up for every pending session. The row is deleted
 * the moment it is spent, expired, or exhausted.
 */
export const twoFactorChallenges = pgTable(
  'two_factor_challenges',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    codeHash: text('code_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    /** Wrong guesses so far. The code dies at OTP_MAX_ATTEMPTS. */
    attempts: integer('attempts').notNull().default(0),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('two_factor_challenges_session_uk').on(t.sessionId),
    index('two_factor_challenges_user_id_idx').on(t.userId),
  ],
);
