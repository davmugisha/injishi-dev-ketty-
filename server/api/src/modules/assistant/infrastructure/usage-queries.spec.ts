import { describe, expect, it } from 'vitest';

import { PgDialect } from 'drizzle-orm/pg-core';

import { toSql } from './retention.repository';
import { insertTurn, textArray, type TurnRow } from './usage-queries';

/**
 * The per turn log's insert, as Drizzle will actually send it. The PGlite
 * oracle runs the SQL text directly and could not see that Drizzle expands a
 * JavaScript array into a list of parameters; the 2026-10-01 walk on a real
 * Postgres did, when every turn row failed to insert.
 */
const row: TurnRow = {
  conversationId: null,
  messageId: null,
  surface: 'web',
  callerRole: 'anonymous',
  route: 'ai:analysis',
  outcome: 'answered',
  modelCalls: 1,
  modelToolCalls: 0,
  tools: ['search_help', 'get_task_guide'],
  inputTokens: 1,
  outputTokens: 1,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  estimatedCostMicroUsd: 12,
  durationMs: 40,
  createdAt: new Date('2026-10-01T10:00:00Z'),
};

describe('the turn log insert (ADR-061 D-s)', () => {
  it('sends the tools as ONE bound array value, as Drizzle renders it', () => {
    const rendered = new PgDialect().sqlToQuery(toSql(insertTurn(row)));
    expect(rendered.params).toHaveLength(16);
    expect(rendered.sql).toContain('$9::text[]');
    expect(rendered.params[8]).toBe('{"search_help","get_task_guide"}');
  });

  it('writes an empty list and quotes what a literal must quote', () => {
    expect(textArray([])).toBe('{}');
    expect(textArray(['a"b', 'c\\d'])).toBe('{"a\\"b","c\\\\d"}');
  });
});
