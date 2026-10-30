/**
 * The shared idempotency store (mobile spec 0003, D-r).
 *
 * One row per write a client keyed, scoped to the user who sent it, so a resend
 * after a timeout or a crash has its effect once and gets the first answer
 * back. `IdempotencyInterceptor` owns every read and write; the worker's daily
 * sweep deletes rows older than 30 days. Tables that already carry their own
 * `idempotency_key` column (money, pay, the POS) keep it.
 */
import { index, jsonb, pgTable, primaryKey, smallint, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './auth';

export const idempotencyKeys = pgTable(
  'idempotency_keys',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    key: uuid('key').notNull(),
    method: text('method').notNull(),
    /** The route template, `POST /api/v1/me/work/:employeeId/clock-in`. */
    route: text('route').notNull(),
    /** sha256 of the method, the resolved path and the canonical body without the reported time pair. */
    requestHash: text('request_hash').notNull(),
    /** Null while the first request is still running. */
    statusCode: smallint('status_code'),
    responseBody: jsonb('response_body'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.key] }),
    index('idempotency_keys_created_idx').on(t.createdAt),
  ],
);
