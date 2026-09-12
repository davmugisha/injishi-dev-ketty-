/**
 * The one rule every seed script follows (ADR-043): sample data goes only into
 * a database that carries the `sample` marker.
 *
 * The marker is a row in `database_identity` (migration 0030), and Postgres
 * refuses to write it while `users` holds a row. So a database that ever held a
 * real account can never be marked, and a seed that checks the marker first can
 * never write fixtures, fixed code personas included, beside real people.
 *
 * This replaces the old guard, which compared DEMO_DATABASE_URL or
 * DEV_DATABASE_URL with DATABASE_URL. That asked "is this URL a different
 * string", which a typo or a copied .env could satisfy. The marker asks the
 * database what it is.
 *
 * Kept apart from the scripts so all of them word the refusal the same way.
 */

/** Postgres `undefined_table`: the database predates migration 0030. */
const UNDEFINED_TABLE = '42P01';

/**
 * Refuse unless the connected database is marked sample. Call it as the first
 * thing a seed does after connecting.
 *
 * @param {{ query: (text: string) => Promise<{ rows: Array<Record<string, unknown>> }> }} client
 * @param {string} script the calling script's file name, for the message
 */
export async function assertSampleDatabase(client, script) {
  let rows;
  try {
    ({ rows } = await client.query('select kind from database_identity limit 1'));
  } catch (error) {
    if (error?.code === UNDEFINED_TABLE) {
      throw new Error(
        `${script} refuses: this database has no database_identity table, so it ` +
          'predates migration 0030. Run the migrations first (node scripts/migrate.mjs).',
      );
    }
    throw error;
  }
  if (rows[0]?.kind !== 'sample') {
    throw new Error(
      `${script} refuses: this database carries no sample marker, so it may hold ` +
        'real accounts. Sample data only goes into a database that was empty when ' +
        'it was marked.\n' +
        '  Locally: `pnpm dev:stack:reset` rebuilds your database as a sample one.\n' +
        '  Otherwise: create an EMPTY database, migrate it, then run\n' +
        '  `node scripts/mark-sample-database.mjs --sample` against it.',
    );
  }
}

/** `postgres://user:secret@host:5432/name` → `host:5432/name`, never the password. */
export function describeDatabase(url) {
  try {
    const u = new URL(url);
    return `${u.hostname}:${u.port || 5432}${u.pathname}`;
  } catch {
    return '(unparseable DATABASE_URL)';
  }
}
