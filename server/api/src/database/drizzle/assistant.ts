import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './auth';

/**
 * The support assistant's conversations (ADR-061, migration 0054_support_assistant).
 *
 * A conversation belongs to an account OR to an anonymous cookie, never to
 * neither (D-c). The cookie itself is never stored: `anon_token_hash` is its
 * SHA-256, so a read of this table cannot be replayed as somebody's session.
 *
 * `expires_at` is the retention promise (D-d): 7 days after the last message
 * for an anonymous conversation, 90 for an owned one. Every read filters on it,
 * so an expired conversation is already gone to the product before the slice H
 * job deletes its rows.
 *
 * `surface` and `role` are CHECKed text rather than pgEnums, so a new surface
 * is a constraint change in this file and not a type migration.
 */
export const assistantConversations = pgTable(
  'assistant_conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerUserId: uuid('owner_user_id').references(() => users.id, {
      onDelete: 'cascade',
    }),
    anonTokenHash: text('anon_token_hash'),
    surface: text('surface').notNull(),
    workspaceId: uuid('workspace_id'),
    // Recorded for Phase 2 page aware help (C13) and read by nothing yet.
    pageContext: text('page_context'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastMessageAt: timestamp('last_message_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    attachedAt: timestamp('attached_at', { withTimezone: true }),
    closedAt: timestamp('closed_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('assistant_conversations_anon_token_uk').on(t.anonTokenHash),
    index('assistant_conversations_owner_idx').on(t.ownerUserId, t.lastMessageAt.desc()),
    index('assistant_conversations_expires_idx').on(t.expiresAt),
    check(
      'assistant_conversations_has_holder',
      sql`${t.ownerUserId} IS NOT NULL OR ${t.anonTokenHash} IS NOT NULL`,
    ),
    check(
      'assistant_conversations_surface',
      sql`${t.surface} IN ('web', 'app', 'admin', 'mobile')`,
    ),
  ],
);

/**
 * One turn of a conversation.
 *
 * `display_text` is what the person reads. `model_content` is exactly what was
 * sent to or received from the model for this turn, already redacted (D-g),
 * and it is replayed unchanged on every later turn: history is append only,
 * because an edited turn invalidates the thinking the model left in it (D-a).
 * A user row holds one model message; an assistant row holds the whole run of
 * tool calls, tool results and the final answer.
 */
export const assistantMessages = pgTable(
  'assistant_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => assistantConversations.id, { onDelete: 'cascade' }),
    seq: integer('seq').notNull(),
    role: text('role').notNull(),
    displayText: text('display_text').notNull(),
    modelContent: jsonb('model_content').notNull(),
    // Which tools ran and how each ended (name, ok), for support and eval.
    toolCalls: jsonb('tool_calls').notNull().default(sql`'[]'::jsonb`),
    // What the answer cited, already checked against what a tool returned in
    // the same turn. Only these are shown as sources.
    sources: jsonb('sources').notNull().default(sql`'[]'::jsonb`),
    // How an assistant answer was produced (ADR-061 D-q): `direct:<intent>` by
    // the request router with no model call, `ai:<reason>` by the model, or
    // `fallback:<reason>` without it. Null on the person's own messages and on
    // answers stored before the router existed.
    route: text('route'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('assistant_messages_conversation_seq_uk').on(t.conversationId, t.seq),
    check('assistant_messages_role', sql`${t.role} IN ('user', 'assistant')`),
  ],
);

/**
 * A change the assistant PREPARED and the person has not yet approved
 * (ADR-061 D-k, migration 0054_support_assistant).
 *
 * The model can write a row here and nothing else. Approval is the person's
 * own request to `POST /api/v1/assistant/actions/:id/approve`, which moves a
 * row from `proposed` to `approved` in one conditional update (so a double
 * press acts once), re-reads the current value, executes through the screen's
 * own service, and ends at `executed` or `failed`. `current_value` is what the
 * card showed; approval refuses when the live value no longer matches it.
 *
 * `idempotency_key` is unique per user, so the same approve request sent twice
 * finds the first one's outcome instead of acting again.
 */
export const assistantActionProposals = pgTable(
  'assistant_action_proposals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id').notNull(),
    kind: text('kind').notNull(),
    targetId: uuid('target_id').notNull(),
    targetLabel: text('target_label').notNull(),
    // The property the target belongs to, which audit rows name as subject.
    propertyId: uuid('property_id').notNull(),
    currentValue: jsonb('current_value').notNull(),
    proposedValue: jsonb('proposed_value').notNull(),
    // What the person asked for, redacted, as the audit row's reason.
    requestText: text('request_text').notNull(),
    state: text('state').notNull().default('proposed'),
    idempotencyKey: text('idempotency_key'),
    error: text('error'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
  },
  (t) => [
    index('assistant_action_proposals_user_idx').on(t.userId, t.createdAt.desc()),
    uniqueIndex('assistant_action_proposals_idempotency_uk').on(t.userId, t.idempotencyKey),
    check('assistant_action_proposals_kind', sql`${t.kind} IN ('room_type.price')`),
    check(
      'assistant_action_proposals_state',
      sql`${t.state} IN ('proposed', 'approved', 'executed', 'failed', 'rejected', 'expired')`,
    ),
  ],
);

/**
 * Whether an answer helped, one row per answer (ADR-061 D-m, migration 0054_support_assistant).
 * Pulled forward from Phase 2 because it is how reliability is measured.
 * Deleted with the message, and so with the conversation at retention.
 */
export const assistantFeedback = pgTable(
  'assistant_feedback',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    messageId: uuid('message_id')
      .notNull()
      .references(() => assistantMessages.id, { onDelete: 'cascade' }),
    helpful: boolean('helpful').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex('assistant_feedback_message_uk').on(t.messageId)],
);

/**
 * One row per model call that reported usage (ADR-061 D-s, migration
 * 0055_assistant_data_first): the tokens it used and what it is estimated to
 * have cost, priced from configuration at the time of the call.
 *
 * It OUTLIVES its conversation on purpose: the month's cost must survive the
 * 7 and 90 day retention, so the conversation and message links are cleared,
 * not cascaded, and the retention sweep clears the person's id after 90 days.
 */
export const assistantModelUsage = pgTable(
  'assistant_model_usage',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id').references(() => assistantConversations.id, {
      onDelete: 'set null',
    }),
    messageId: uuid('message_id').references(() => assistantMessages.id, { onDelete: 'set null' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    surface: text('surface').notNull(),
    callerRole: text('caller_role').notNull(),
    requestType: text('request_type').notNull(),
    model: text('model').notNull(),
    inputTokens: integer('input_tokens').notNull(),
    outputTokens: integer('output_tokens').notNull(),
    cacheReadTokens: integer('cache_read_tokens').notNull().default(0),
    cacheWriteTokens: integer('cache_write_tokens').notNull().default(0),
    estimatedCostMicroUsd: bigint('estimated_cost_micro_usd', { mode: 'number' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('assistant_model_usage_created_idx').on(t.createdAt),
    index('assistant_model_usage_user_created_idx').on(t.userId, t.createdAt),
    index('assistant_model_usage_conversation_created_idx').on(t.conversationId, t.createdAt),
    check(
      'assistant_model_usage_caller_role',
      sql`${t.callerRole} IN ('anonymous', 'signed_in', 'operator', 'staff')`,
    ),
    check(
      'assistant_model_usage_tokens_nonnegative',
      sql`${t.inputTokens} >= 0 AND ${t.outputTokens} >= 0 AND ${t.cacheReadTokens} >= 0 AND ${t.cacheWriteTokens} >= 0 AND ${t.estimatedCostMicroUsd} >= 0`,
    ),
  ],
);

/**
 * One row per user turn (ADR-061 D-s, D-x, D-y, migration
 * 0055_assistant_data_first), whether or not an answer was stored: which path
 * answered (the route), how it ended (the outcome), the model calls it made
 * and the tool calls the model itself asked for, every tool run in the turn,
 * its tokens and estimated cost, and how long it took.
 *
 * No person and no text, so it outlives retention like the usage rows; the
 * conversation and message links are cleared with them. It is how an
 * unnecessary model call, a turn that needed more than two, a truncated
 * answer or a timeout is found.
 */
export const assistantTurns = pgTable(
  'assistant_turns',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id').references(() => assistantConversations.id, {
      onDelete: 'set null',
    }),
    messageId: uuid('message_id').references(() => assistantMessages.id, { onDelete: 'set null' }),
    surface: text('surface').notNull(),
    callerRole: text('caller_role').notNull(),
    route: text('route').notNull(),
    outcome: text('outcome').notNull(),
    modelCalls: integer('model_calls').notNull().default(0),
    modelToolCalls: integer('model_tool_calls').notNull().default(0),
    tools: text('tools').array().notNull().default(sql`'{}'::text[]`),
    inputTokens: integer('input_tokens').notNull().default(0),
    outputTokens: integer('output_tokens').notNull().default(0),
    cacheReadTokens: integer('cache_read_tokens').notNull().default(0),
    cacheWriteTokens: integer('cache_write_tokens').notNull().default(0),
    estimatedCostMicroUsd: bigint('estimated_cost_micro_usd', { mode: 'number' }).notNull().default(0),
    durationMs: integer('duration_ms').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('assistant_turns_created_idx').on(t.createdAt),
    check(
      'assistant_turns_caller_role',
      sql`${t.callerRole} IN ('anonymous', 'signed_in', 'operator', 'staff')`,
    ),
    check(
      'assistant_turns_outcome',
      sql`${t.outcome} IN ('answered', 'fallback', 'withheld', 'truncated', 'out_of_time', 'step_limit', 'refused', 'failed')`,
    ),
    check(
      'assistant_turns_counts_nonnegative',
      sql`${t.modelCalls} >= 0 AND ${t.modelToolCalls} >= 0 AND ${t.inputTokens} >= 0 AND ${t.outputTokens} >= 0 AND ${t.cacheReadTokens} >= 0 AND ${t.cacheWriteTokens} >= 0 AND ${t.estimatedCostMicroUsd} >= 0 AND ${t.durationMs} >= 0`,
    ),
  ],
);
