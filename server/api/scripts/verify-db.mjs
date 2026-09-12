// Quick post-migration verification of the Neon database.
import pg from 'pg';

const q = {
  tables: `SELECT count(*)::int n FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`,
  enums: `SELECT count(*)::int n FROM pg_type WHERE typtype='e' AND typnamespace='public'::regnamespace`,
  checks: `SELECT count(*)::int n FROM pg_constraint WHERE contype='c' AND connamespace='public'::regnamespace`,
  fks: `SELECT count(*)::int n FROM pg_constraint WHERE contype='f' AND connamespace='public'::regnamespace`,
  indexes: `SELECT count(*)::int n FROM pg_indexes WHERE schemaname='public'`,
  migrations: `SELECT count(*)::int n FROM drizzle.__drizzle_migrations`,
};

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  for (const [k, sql] of Object.entries(q)) {
    const { rows } = await client.query(sql);
    console.log(`${k.padEnd(12)} ${rows[0].n}`);
  }
  const named = await client.query(
    `SELECT conname FROM pg_constraint
     WHERE contype='c' AND connamespace='public'::regnamespace
       AND conname IN ('money_overrides_dual_auth','ebm_invoices_source_shape',
                       'workspaces_kind_shape','threads_scope_exactly_one','orgs_domain_shape')
     ORDER BY conname`,
  );
  console.log('key checks  ', named.rows.map((r) => r.conname).join(', '));
  const sample = await client.query(
    `SELECT id, name FROM districts ORDER BY id LIMIT 3`,
  );
  console.log('districts   ', JSON.stringify(sample.rows));
} finally {
  await client.end();
}
