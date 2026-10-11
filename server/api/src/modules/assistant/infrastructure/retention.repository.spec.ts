import { PgDialect } from 'drizzle-orm/pg-core';

import { closeStaleApproval, deleteExpiredConversations } from './retention-queries';
import { toSql } from './retention.repository';

/**
 * The retention SQL runs through Drizzle's `execute`, so `$n` text is turned
 * into Drizzle SQL first. What must hold: every value stays a bound parameter,
 * a repeated `$n` binds the same value, and the text around them is unchanged.
 */
describe('toSql (ADR-061 D-d)', () => {
  const dialect = new PgDialect();

  it('keeps every value a bound parameter, never spliced into the text', () => {
    const now = new Date('2026-09-30T12:00:00Z');
    const query = dialect.sqlToQuery(toSql(deleteExpiredConversations(now)));
    expect(query.params).toEqual([now]);
    expect(query.sql).toContain('WHERE expires_at < $1');
    expect(query.sql).not.toContain('2026');
  });

  it('binds a repeated placeholder to the same value and keeps casts and quotes intact', () => {
    const query = dialect.sqlToQuery(
      toSql(closeStaleApproval({ id: 'p1', state: 'failed', error: "it's stale", detail: 'why' })),
    );
    // In the order the text uses them: SET state = $2, error = $3 WHERE id = $1,
    // then the CASE reads $2 again and the detail is $4.
    expect(query.params).toEqual(['failed', "it's stale", 'p1', 'failed', 'why']);
    expect(query.sql).toContain("WHEN $4 = 'executed' THEN 'assistant.action.executed'");
    expect(query.sql).toContain('$5::text');
    expect(query.sql).not.toContain("it's stale");
  });
});
