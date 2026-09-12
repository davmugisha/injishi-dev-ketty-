/**
 * §4.1 AUTH.
 *
 * Carved out of the single 3,956-line `schema.ts` along the section headers
 * that file already carried. Every declaration below is byte-identical to the
 * one it replaced; only the import lines are new. `schema.ts` re-exports this
 * module, so `drizzle.config.ts`, every migration and every importer still see
 * one schema at one path.
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { timestamps } from './columns';
import { otpChannelEnum, phoneLinkStageEnum } from './enums';
import { workspaces } from './org';

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    emailVerified: boolean('email_verified').notNull().default(false),
    name: text('name'),
    image: text('image'),
    /**
     * The proved phone number, E.164, or null until one is proved (ADR-039).
     * Unique across accounts: a number MOVES to whoever proves it last, and
     * `injishiPhone()` clears it from the losing account in the same
     * transaction. `user_profiles.phone_e164` is the display copy.
     */
    phoneNumber: text('phone_number'),
    phoneNumberVerified: boolean('phone_number_verified').notNull().default(false),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('users_email_lower_uk').on(sql`lower(${t.email})`),
    uniqueIndex('users_phone_number_uk').on(t.phoneNumber),
  ],
);

/**
 * The send cap's ledger (ADR-039, `otpSendCap()` in @injishi/auth): one row per
 * identifier (a phone number or a lowercased email) per channel, counting sends
 * in two fixed windows. It stops SENDS when a window is spent and never locks
 * the account. Better Auth reaches it as the `authOtpRequest` model, which is
 * why the export must be named exactly this: every email and SMS sign-in code
 * is spent through it, and without it every send fails.
 */
export const authOtpRequests = pgTable(
  'auth_otp_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    identifier: text('identifier').notNull(),
    channel: otpChannelEnum('channel').notNull(),
    windowStartedAt: timestamp('window_started_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    countHour: integer('count_hour').notNull().default(0),
    dayStartedAt: timestamp('day_started_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    countDay: integer('count_day').notNull().default(0),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('auth_otp_requests_identifier_channel_uk').on(
      t.identifier,
      t.channel,
    ),
  ],
);

/**
 * One phone number's sign-in or claim in progress (ADR-039, `injishiPhone()`),
 * unique per number. `codeHash` and `linkTokenHash` are SHA-256, never the
 * code or the token, so a read of this table opens nothing.
 */
export const phoneLinkChallenges = pgTable(
  'phone_link_challenges',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    phoneE164: text('phone_e164').notNull(),
    stage: phoneLinkStageEnum('stage').notNull().default('sms_sent'),
    linkTokenHash: text('link_token_hash'),
    email: text('email'),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    codeHash: text('code_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    attempts: integer('attempts').notNull().default(0),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('phone_link_challenges_phone_uk').on(t.phoneE164),
    index('phone_link_challenges_link_token_idx').on(t.linkTokenHash),
  ],
);


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


export const accounts = pgTable(
  'accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    providerId: text('provider_id').notNull(),
    accountId: text('account_id').notNull(),
    password: text('password'),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', {
      withTimezone: true,
    }),
    scope: text('scope'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('accounts_provider_account_uk').on(t.providerId, t.accountId),
    index('accounts_user_id_idx').on(t.userId),
  ],
);


export const verifications = pgTable(
  'verifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (t) => [index('verifications_identifier_idx').on(t.identifier)],
);

// ===========================================================================
// §5.1  GEOGRAPHY  (ported from docs/rwot.sql; integer smart-code PKs, no RLS)
// ===========================================================================
