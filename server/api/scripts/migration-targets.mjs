/**
 * Which database a deploy migrates: the one DATABASE_URL names.
 *
 * It used to be production then a second demo database from
 * DEMO_DATABASE_URL, because one API process served both. Each stack has its
 * own database and runs its own migration now (ADR-043), so there is one
 * target, and a stale DEMO_DATABASE_URL in an env file is ignored rather than
 * migrated.
 *
 * Kept apart from migrate.mjs, which connects on import, so the rule can be
 * checked without a database.
 *
 * @param {Record<string, string | undefined>} env
 * @returns {{ label: string, url: string }[]}
 */
export function migrationTargets(env) {
  const url = env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error('DATABASE_URL is required to run migrations.');
  }
  return [{ label: 'DATABASE_URL', url }];
}
