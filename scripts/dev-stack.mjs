#!/usr/bin/env node
/**
 * The local dev stack in one command: Postgres and Redis in Docker, on the
 * ports the API's own .env names, migrated, marked sample and seeded.
 *
 *   pnpm dev:stack           up + migrate + mark + seed (safe to re-run)
 *   pnpm dev:stack:down      stop the containers, keep the data
 *   pnpm dev:stack:reset     drop the volumes, then up + migrate + mark + seed
 *
 * Plain Node, no dependencies of its own. The API and the apps run on the host
 * (`pnpm api:dev`, `pnpm web:dev`, ...); infra/docker/README.md says why, and
 * how to install Docker Desktop on Windows.
 *
 * THE PORTS COME FROM THE API'S .env. infra/docker/docker-compose.yml used to
 * hard-code 5432 and 6379 while server/api/.env said 5434 and 6381, so the
 * two could never meet. This script parses DATABASE_URL and REDIS_PORT (or
 * REDIS_URL) out of that .env and hands them to compose, so whatever the API is
 * configured to reach is what gets started.
 *
 * YOUR LAPTOP IS THE DEMO SHAPE (ADR-043). After migrating, it marks the
 * database sample (`mark-sample-database.mjs --sample`) and runs the one sample
 * recipe staging and the demo also run (`seed-sample.mjs`: geography, content,
 * users, the demo roster, the catalogue). `pnpm api:dev` then boots as the
 * demo: the fixed code 123456, the seeded personas, the persona picker.
 *
 * Postgres refuses the mark on a database that already holds users, so a
 * database created before the marker existed stops this script at the mark
 * step. `pnpm dev:stack:reset` rebuilds it as a sample database; keeping it
 * means running the API with INJISHI_ENVIRONMENT=production instead.
 *
 * It also refuses to touch a DATABASE_URL or Redis that is not on this machine:
 * it brings up a LOCAL stack, and a .env still pointing at a hosted database
 * must not be migrated and seeded by a convenience script.
 *
 * `pnpm dev:all` (scripts/dev-all.mjs) imports this file rather than copying
 * it, so there is one reader of the API's .env and one way the stack comes up.
 * It asks `up()` to seed only a database that was never seeded, because
 * reseeding on every start would rewrite the rows somebody is working with.
 *
 * A SECOND STACK BESIDE THIS ONE (mobile spec 0001). A git worktree runs its own
 * stack while the main checkout's runs: its .env sets INJISHI_COMPOSE_PROJECT and
 * shifts every port (MinIO, Mailpit and Metro through INJISHI_* settings, SMTP
 * through SMTP_URL's port). Every one defaults to the main checkout's value, and
 * a worktree that sets no project is refused, because compose would otherwise
 * run it as the main checkout's project and share its volumes. With
 * INJISHI_SAMPLE_DATA=off the database is migrated and nothing more: never
 * marked sample, never seeded.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const COMPOSE_FILE = path.join(ROOT, 'infra', 'docker', 'docker-compose.yml');
const COMPOSE_REL = 'infra/docker/docker-compose.yml';
const README_REL = 'infra/docker/README.md';

/**
 * Where the API lives. The directory was renamed to `server/` on 2026-09-11,
 * and this briefly accepted both names so the stack kept working across the
 * move. It is one name now, and a second entry would only hide a checkout that
 * is half moved.
 */
const API_DIR_CANDIDATES = ['server/api'];

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

const DB_HEALTH_TIMEOUT_MS = 120_000;
const REDIS_HEALTH_TIMEOUT_MS = 60_000;
const PORT_TIMEOUT_MS = 30_000;

/**
 * After migrating: mark the database sample (so payments, SMS and identity may
 * stay on their mocks), then seed. Which seed is the env file's STACK_SEED
 * (2026-10-24):
 *   - `reference` (the default, the TESTING database): platform reference data
 *     (seed-reference.mjs, what production runs), test settings
 *     (seed-test-config.mjs) and the first admin (grant-staff.mjs, from
 *     TEST_ADMIN_EMAIL). No demo people, businesses or homes.
 *   - `sample`: the old demo world (seed-sample.mjs, ADR-043 AC-31).
 */
const MARK_STEP = {
  script: 'mark-sample-database.mjs',
  args: ['--sample'],
  what: 'mark the database as sample data',
  onFailure:
    '\nThis database already holds accounts from before the sample marker existed, so\n' +
    'Postgres will not mark it. Either:\n' +
    '  pnpm dev:stack:reset     rebuild it (deletes its data), or\n' +
    '  keep it, and run the API with INJISHI_DATABASE_KIND unset.',
};

export function stackSeed(cfg) {
  const seed = cfg.env.STACK_SEED?.trim().toLowerCase() || 'reference';
  if (seed !== 'reference' && seed !== 'sample') {
    throw new StackError(`STACK_SEED in ${cfg.envRel} is "${seed}"; use reference or sample.`);
  }
  return seed;
}

export function stepsFor(cfg) {
  if (stackSeed(cfg) === 'sample') {
    return [MARK_STEP, { script: 'seed-sample.mjs', what: 'the sample recipe (seed-sample.mjs)' }];
  }
  const steps = [
    MARK_STEP,
    { script: 'seed-reference.mjs', what: 'platform reference data' },
    { script: 'seed-test-config.mjs', what: 'test settings (registration fees)' },
  ];
  const admin = cfg.env.TEST_ADMIN_EMAIL?.trim();
  if (admin) {
    steps.push({
      script: 'grant-staff.mjs',
      args: ['--email', admin, '--role', 'super_admin'],
      what: `the first admin, ${admin}`,
    });
  }
  return steps;
}

/** Variables the API no longer reads (ADR-043). A line left in .env does nothing. */
const RETIRED_VARIABLES = [
  'DEMO_HOSTNAMES',
  'DEMO_DATABASE_URL',
  'DEMO_AUTH_SECRET',
  'DEMO_AUTH_URL',
  'STORAGE_DEMO_BUCKET',
  'INJISHI_WORKER_ENVIRONMENT',
  'DEV_DATABASE_URL',
];

/** An expected failure: printed as a message, never as a stack trace. */
export class StackError extends Error {}

// --- Arguments ---------------------------------------------------------------

function parseArgs(argv) {
  const known = new Set(['--down', '--reset', '--help', '-h']);
  const unknown = argv.filter((a) => !known.has(a));
  if (unknown.length) {
    throw new StackError(`Unknown option: ${unknown.join(' ')}\n\n${usage()}`);
  }
  const down = argv.includes('--down');
  const reset = argv.includes('--reset');
  if (down && reset) throw new StackError('--down and --reset cannot be combined.');
  return { down, reset, help: argv.includes('--help') || argv.includes('-h') };
}

function usage() {
  return [
    'Usage: node scripts/dev-stack.mjs [--down | --reset]',
    '',
    '  (no option)  start Postgres + Redis, migrate, seed. Safe to re-run.',
    '  --down       stop the containers; the data is kept.',
    '  --reset      delete the data volumes, then start, migrate and seed.',
  ].join('\n');
}

// --- The API's .env ----------------------------------------------------------

export function resolveApiDir() {
  for (const rel of API_DIR_CANDIDATES) {
    const dir = path.join(ROOT, rel);
    if (existsSync(path.join(dir, 'scripts', 'migrate.mjs'))) return { dir, rel };
  }
  throw new StackError(
    `Could not find the API: neither ${API_DIR_CANDIDATES.join(' nor ')} has scripts/migrate.mjs.`,
  );
}

/** dotenv-compatible enough for this file: KEY=VALUE, quotes, `#` comments. */
function parseDotEnv(file) {
  const values = {};
  const seen = new Map();
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;
    const m = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m) return;
    let value = m[2];
    const quoted = /^(['"])(.*)\1$/.exec(value);
    if (quoted) value = quoted[2];
    else value = value.replace(/\s+#.*$/, '').trim();
    seen.set(m[1], [...(seen.get(m[1]) ?? []), i + 1]);
    values[m[1]] = value;
  });
  return { values, seen };
}

function isLocalHost(host) {
  return LOCAL_HOSTS.has(String(host).toLowerCase());
}

function parsePort(raw, name, envRel) {
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new StackError(`${name} in ${envRel} is not a valid port: "${raw}".`);
  }
  return port;
}

/**
 * The local stack is the TEST environment (2026-10-24): `.env.test`, the same
 * file `APP_ENV=test` gives the API and that scripts read by default. The
 * development file points at the hosted dev services, which this script must
 * never migrate or seed. A checkout that still has only the old single `.env`
 * keeps working on it.
 */
export const STACK_ENV_FILE = '.env.test';

export function readApiEnv(apiDir, apiRel) {
  const own = path.join(apiDir, STACK_ENV_FILE);
  const legacy = path.join(apiDir, '.env');
  const envFile = existsSync(own) || !existsSync(legacy) ? own : legacy;
  const envRel = `${apiRel}/${path.basename(envFile)}`;
  if (!existsSync(envFile)) {
    throw new StackError(
      `${envRel} does not exist.\n` +
        `It is committed with the repo; restore it, then run this again:\n` +
        `  git checkout -- ${apiRel}/${STACK_ENV_FILE}`,
    );
  }
  const { values: env, seen } = parseDotEnv(envFile);

  // The seed scripts read the FIRST DATABASE_URL line, the API (dotenv) the
  // LAST. Two live lines would split them across two databases.
  for (const key of ['DATABASE_URL', 'REDIS_URL', 'REDIS_HOST', 'REDIS_PORT']) {
    const at = seen.get(key) ?? [];
    if (at.length > 1) {
      throw new StackError(
        `${envRel} sets ${key} more than once (lines ${at.join(', ')}). ` +
          'Keep one uncommented line: the seeds read the first and the API the last.',
      );
    }
  }

  // --- Postgres
  const databaseUrl = env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new StackError(`DATABASE_URL is not set in ${envRel}.`);
  let u;
  try {
    u = new URL(databaseUrl);
  } catch {
    throw new StackError(`DATABASE_URL in ${envRel} is not a valid URL.`);
  }
  if (!/^postgres(ql)?:$/.test(u.protocol)) {
    throw new StackError(`DATABASE_URL in ${envRel} is not a postgres:// URL.`);
  }
  if (!isLocalHost(u.hostname)) {
    throw new StackError(
      `DATABASE_URL in ${envRel} points at ${u.hostname}, not this machine.\n` +
        'The dev stack starts, migrates and seeds a LOCAL database only; it will not\n' +
        'touch a hosted one. Point DATABASE_URL at 127.0.0.1, e.g.\n' +
        '  DATABASE_URL=postgres://injishi:injishi@127.0.0.1:5434/injishi',
    );
  }
  const db = {
    url: databaseUrl,
    host: u.hostname,
    port: u.port ? parsePort(u.port, 'The DATABASE_URL port', envRel) : 5432,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    name: decodeURIComponent(u.pathname.replace(/^\//, '')),
  };
  if (!db.user || !db.name) {
    throw new StackError(`DATABASE_URL in ${envRel} must name a user and a database.`);
  }

  // --- Redis. The API prefers REDIS_URL when it is set, so this does too.
  let redis;
  const redisUrl = env.REDIS_URL?.trim();
  if (redisUrl) {
    let r;
    try {
      r = new URL(redisUrl);
    } catch {
      throw new StackError(`REDIS_URL in ${envRel} is not a valid URL.`);
    }
    if (!isLocalHost(r.hostname)) {
      throw new StackError(
        `REDIS_URL in ${envRel} points at ${r.hostname}, not this machine. ` +
          'Clear it and set REDIS_HOST=127.0.0.1 / REDIS_PORT to use the dev stack.',
      );
    }
    redis = {
      port: r.port ? parsePort(r.port, 'The REDIS_URL port', envRel) : 6379,
      hasPassword: Boolean(r.password),
    };
  } else {
    const host = env.REDIS_HOST?.trim() || '127.0.0.1';
    if (!isLocalHost(host)) {
      throw new StackError(`REDIS_HOST in ${envRel} is ${host}, not this machine.`);
    }
    redis = {
      port: env.REDIS_PORT?.trim() ? parsePort(env.REDIS_PORT.trim(), 'REDIS_PORT', envRel) : 6379,
      hasPassword: Boolean(env.REDIS_PASSWORD?.trim()),
    };
  }

  // --- The rest of the stack. Each setting is optional and defaults to the main
  // checkout's value; a second stack (a git worktree) sets them all.
  const optionalPort = (key, fallback) =>
    env[key]?.trim() ? parsePort(env[key].trim(), key, envRel) : fallback;
  const ports = {
    minio: optionalPort('INJISHI_MINIO_PORT', 9000),
    minioConsole: optionalPort('INJISHI_MINIO_CONSOLE_PORT', 9001),
    smtp: smtpPort(env.SMTP_URL, envRel),
    mailpit: optionalPort('INJISHI_MAILPIT_PORT', 8025),
    metro: optionalPort('INJISHI_METRO_PORT', 8081),
    api: optionalPort('PORT', 8000),
  };

  const byPort = new Map();
  for (const [label, port] of [
    ['Postgres', db.port],
    ['Redis', redis.port],
    ['MinIO', ports.minio],
    ['the MinIO console', ports.minioConsole],
    ['SMTP', ports.smtp],
    ['Mailpit', ports.mailpit],
    ['Metro', ports.metro],
    ['the API', ports.api],
  ]) {
    if (byPort.has(port)) {
      throw new StackError(`${envRel} gives ${byPort.get(port)} and ${label} the same port (${port}).`);
    }
    byPort.set(port, label);
  }

  const composeProject = env.INJISHI_COMPOSE_PROJECT?.trim() || null;
  if (composeProject && !/^[a-z0-9][a-z0-9_-]*$/.test(composeProject)) {
    throw new StackError(
      `INJISHI_COMPOSE_PROJECT in ${envRel} must be lowercase letters, digits, "-" and "_", not "${composeProject}".`,
    );
  }
  if (!composeProject && isLinkedWorktree()) {
    throw new StackError(
      `This checkout is a git worktree, and ${envRel} sets no INJISHI_COMPOSE_PROJECT.\n` +
        'Compose would run it as the main checkout\'s project ("docker"): its containers\n' +
        'would be recreated on these ports and its data volumes shared. Set\n' +
        'INJISHI_COMPOSE_PROJECT and shift the ports beside it; see the "second local\n' +
        `stack" section of ${apiRel}/.env.example.`,
    );
  }

  // Read by this script only, never by the API. `off` keeps the database
  // empty: migrated, never marked sample, never seeded.
  const sampleData = env.INJISHI_SAMPLE_DATA?.trim().toLowerCase() || 'on';
  if (sampleData !== 'on' && sampleData !== 'off') {
    throw new StackError(
      `INJISHI_SAMPLE_DATA in ${envRel} must be "on" or "off", not "${env.INJISHI_SAMPLE_DATA}".`,
    );
  }

  return { envRel, env, db, redis, ports, composeProject, sampleData: sampleData === 'on' };
}

/**
 * The port Mailpit takes SMTP on: SMTP_URL's own, when it names this machine
 * with a port, so the API's mail always reaches the Mailpit this stack starts.
 * A relay elsewhere leaves Mailpit on its usual 1025.
 */
function smtpPort(raw, envRel) {
  let u;
  try {
    u = new URL(raw?.trim() ?? '');
  } catch {
    return 1025;
  }
  if (!isLocalHost(u.hostname) || !u.port) return 1025;
  return parsePort(u.port, 'The SMTP_URL port', envRel);
}

/** A linked worktree has a `.git` FILE pointing at the main checkout's. */
function isLinkedWorktree() {
  try {
    return statSync(path.join(ROOT, '.git')).isFile();
  } catch {
    return false;
  }
}

// --- Docker ------------------------------------------------------------------

function installSteps() {
  return [
    'Install Docker Desktop (needs an administrator, once):',
    '  1. Admin PowerShell:  wsl --install --no-distribution   then reboot.',
    '     If wsl still fails with REGDB_E_CLASSNOTREG, enable the Windows features',
    '     "Windows Subsystem for Linux" and "Virtual Machine Platform", reboot,',
    '     then run  wsl --update',
    '  2. Admin PowerShell:  winget install -e --id Docker.DockerDesktop',
    '  3. Admin PowerShell:  net localgroup docker-users "<your DOMAIN\\user>" /add',
    '     (you are not the admin, so you must be in docker-users), then sign out and in.',
    '  4. Start Docker Desktop, wait for "Engine running", then:  pnpm dev:stack',
    '',
    `Full steps: injishi/${README_REL}`,
  ].join('\n');
}

function docker(args, options = {}) {
  return spawnSync('docker', args, { encoding: 'utf8', windowsHide: true, ...options });
}

function firstLine(text) {
  return (text ?? '').split(/\r?\n/).map((l) => l.trim()).find(Boolean) ?? '';
}

export function assertDockerReady() {
  const version = docker(['--version']);
  if (version.error) {
    if (version.error.code === 'ENOENT') {
      throw new StackError(
        'Docker is not installed: there is no `docker` command on PATH.\n\n' +
          'The dev stack runs Postgres and Redis in Docker.\n' +
          installSteps(),
      );
    }
    throw new StackError(`Could not run \`docker\`: ${version.error.message}`);
  }
  if (version.status !== 0) {
    throw new StackError(
      `\`docker --version\` failed: ${firstLine(version.stderr) || `exit code ${version.status}`}`,
    );
  }

  const info = docker(['info', '--format', '{{.ServerVersion}}'], { timeout: 30_000 });
  if (info.error?.code === 'ETIMEDOUT' || info.status !== 0 || !firstLine(info.stdout)) {
    throw new StackError(
      `Docker is installed (${firstLine(version.stdout)}) but its engine is not running.\n` +
        'Start Docker Desktop, wait until it says "Engine running", and run this again.\n' +
        (firstLine(info.stderr) ? `docker said: ${firstLine(info.stderr)}\n` : '') +
        'If Docker Desktop will not start, see the WSL section of ' +
        `injishi/${README_REL}.`,
    );
  }

  const compose = docker(['compose', 'version', '--short']);
  if (compose.error || compose.status !== 0) {
    throw new StackError(
      '`docker compose` (Compose v2) is not available. Docker Desktop ships it;\n' +
        'update Docker Desktop and run this again.',
    );
  }
  return { engine: firstLine(info.stdout), compose: firstLine(compose.stdout) };
}

/**
 * Variables compose interpolates into docker-compose.yml, and the project it
 * runs as. Left unset, the project is compose's default for the file's folder
 * (`docker`), exactly as before a second stack existed.
 */
export function composeEnv(cfg) {
  return {
    ...process.env,
    ...(cfg.composeProject ? { COMPOSE_PROJECT_NAME: cfg.composeProject } : {}),
    INJISHI_DB_PORT: String(cfg.db.port),
    INJISHI_DB_USER: cfg.db.user,
    INJISHI_DB_PASSWORD: cfg.db.password,
    INJISHI_DB_NAME: cfg.db.name,
    INJISHI_REDIS_PORT: String(cfg.redis.port),
    INJISHI_MINIO_PORT: String(cfg.ports.minio),
    INJISHI_MINIO_CONSOLE_PORT: String(cfg.ports.minioConsole),
    INJISHI_SMTP_PORT: String(cfg.ports.smtp),
    INJISHI_MAILPIT_PORT: String(cfg.ports.mailpit),
  };
}

function compose(cfg, args, { capture = false } = {}) {
  return docker(['compose', '-f', COMPOSE_FILE, ...args], {
    cwd: ROOT,
    env: composeEnv(cfg),
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  });
}

function composeOrThrow(cfg, args, what) {
  const r = compose(cfg, args);
  if (r.error) throw new StackError(`${what} failed: ${r.error.message}`);
  if (r.status !== 0) throw new StackError(`${what} failed (exit code ${r.status}); see the output above.`);
}

function containerId(cfg, service, { runningOnly = false } = {}) {
  const args = ['ps', '-q', ...(runningOnly ? ['--status', 'running'] : []), service];
  const r = compose(cfg, args, { capture: true });
  return r.status === 0 ? firstLine(r.stdout) : '';
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Poll the container's own healthcheck, bounded. */
async function waitHealthy(cfg, service, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let status = 'unknown';
  while (Date.now() < deadline) {
    const id = containerId(cfg, service);
    if (id) {
      const r = docker(['inspect', '--format', '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}', id]);
      status = firstLine(r.stdout) || 'unknown';
      if (status === 'healthy') return;
      if (status === 'unhealthy' || status === 'exited' || status === 'dead') break;
    }
    await sleep(1_500);
  }
  console.error(`\n--- last lines of the ${service} log ---`);
  compose(cfg, ['logs', '--tail', '40', service]);
  throw new StackError(
    `${service} did not become healthy within ${Math.round(timeoutMs / 1000)}s (last status: ${status}).`,
  );
}

export function canConnect(port, host = '127.0.0.1', timeoutMs = 1_000) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host });
    const done = (ok) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs, () => done(false));
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
  });
}

/** A healthy container is not proof the published port reaches it from here. */
async function waitForPort(port, label) {
  const deadline = Date.now() + PORT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (await canConnect(port)) return;
    await sleep(1_000);
  }
  throw new StackError(
    `${label} is healthy inside Docker but 127.0.0.1:${port} does not answer from this machine.`,
  );
}

/**
 * Before starting a service, make sure its port is not already held by
 * something that is not this stack (a Postgres installed on Windows, say).
 * Compose's own "port is already allocated" is much less clear about why.
 */
async function assertPortFree(cfg, service, port, label, key) {
  if (containerId(cfg, service, { runningOnly: true })) return; // ours: `up` reconciles it
  if (await canConnect(port)) {
    throw new StackError(
      `127.0.0.1:${port} is already in use by something that is not this stack ` +
        `(another ${label}?). Stop it, or change ${key} in ${cfg.envRel} to a free port.`,
    );
  }
}

// --- Migrations and seeds ----------------------------------------------------

/**
 * The environment every child script gets: the caller's, with DATABASE_URL
 * pinned to the one in the API's .env — the database this script just started.
 */
function childEnv(cfg) {
  return { ...process.env, DATABASE_URL: cfg.db.url };
}

function assertApiInstalled(api) {
  const missing = ['pg', 'drizzle-orm'].filter(
    (dep) => !existsSync(path.join(api.dir, 'node_modules', dep)),
  );
  if (missing.length) {
    throw new StackError(
      `The API's dependencies are not installed (${missing.join(', ')} missing in ${api.rel}/node_modules).\n` +
        'Run `pnpm install` in injishi/ first.',
    );
  }
}

function runNodeScript(api, cfg, step, label) {
  const script = path.join(api.dir, 'scripts', step.script);
  if (!existsSync(script)) {
    throw new StackError(`${api.rel}/scripts/${step.script} does not exist.`);
  }
  console.log(`\n→ ${label}`);
  const r = spawnSync(process.execPath, [script, ...(step.args ?? [])], {
    cwd: api.dir,
    env: childEnv(cfg),
    stdio: 'inherit',
  });
  if (r.error) throw new StackError(`${step.script} could not start: ${r.error.message}`);
  if (r.status !== 0) {
    throw new StackError(
      `${step.script} failed with exit code ${r.status}; see its output above.` +
        (step.script === 'migrate.mjs'
          ? '\nIf it says "password authentication failed": the database volume was created with\n' +
            'other credentials than DATABASE_URL now names. `pnpm dev:stack:reset` recreates it.'
          : (step.onFailure ?? '')),
    );
  }
}

/**
 * The sample marker row, or null on a real (unmarked) database. Its
 * `seeded_at` is when the sample recipe last FINISHED: a fresh volume has no
 * row, and a seed that stopped half way leaves it empty on purpose
 * (seed-sample.mjs). Read through the API's own `pg`, the driver the seeds use,
 * after migrate.mjs has created the table.
 */
async function readMarker(api, cfg) {
  const pg = createRequire(path.join(api.dir, 'package.json'))('pg');
  const client = new pg.Client({ connectionString: cfg.db.url });
  try {
    await client.connect();
    const { rows } = await client.query('select seeded_at from database_identity limit 1');
    return rows[0] ?? null;
  } catch (error) {
    throw new StackError(`Could not read the sample marker: ${error?.message ?? error}`);
  } finally {
    await client.end().catch(() => {});
  }
}

/**
 * INJISHI_SAMPLE_DATA=off leaves the database unmarked, and a demo process
 * refuses an unmarked database, so it needs the API to run as production.
 * Said before anything starts. INJISHI_DATABASE_KIND stays unset: `real` is a
 * deployed stack's promise, and the API then demands a payment mode too.
 */
function assertMigrateOnlyRunnable(cfg) {
  if (!cfg.sampleData && !isProductionProcess(cfg)) {
    throw new StackError(
      `${cfg.envRel} sets INJISHI_SAMPLE_DATA=off, which keeps the database empty, but\n` +
        'the API would run as the demo, and a demo process refuses a database with no\n' +
        'sample marker. Set INJISHI_ENVIRONMENT=production beside it.',
    );
  }
}

// --- Commands ----------------------------------------------------------------

export function printPreamble(cfg, dockerInfo) {
  console.log(`Docker engine ${dockerInfo.engine}, Compose ${dockerInfo.compose}`);
  console.log(
    `Ports from ${cfg.envRel}: Postgres ${cfg.db.port}, Redis ${cfg.redis.port}, ` +
      `MinIO ${cfg.ports.minio} (console ${cfg.ports.minioConsole}), SMTP ${cfg.ports.smtp}, Mailpit ${cfg.ports.mailpit}`,
  );
  if (cfg.composeProject) console.log(`Compose project: ${cfg.composeProject}`);
}

export function warnAboutEnv(cfg) {
  const warnings = [];
  const shellDb = process.env.DATABASE_URL?.trim();
  if (shellDb && shellDb !== cfg.db.url) {
    warnings.push(
      'DATABASE_URL is also set in this shell, to a different value. `pnpm api:dev:test` gives\n' +
        '  the shell precedence over .env.test, so it would serve THAT database, not this stack. Unset it\n' +
        '  in the terminal you start the API from.',
    );
  }
  const retired = RETIRED_VARIABLES.filter((key) => cfg.env[key] !== undefined);
  if (retired.length) {
    warnings.push(
      `${cfg.envRel} still sets ${retired.join(', ')}. The API no longer reads\n` +
        '  them (ADR-043: the demo is its own stack); delete those lines.',
    );
  }
  if (cfg.redis.hasPassword) {
    warnings.push(`${cfg.envRel} gives Redis a password; the dev stack Redis has none.`);
  }
  // A worktree's stack is usually wanted empty (mobile spec 0001, D-ac), and
  // unset means `on`, so say it before the database is marked and seeded.
  if (!cfg.env.INJISHI_SAMPLE_DATA?.trim() && isLinkedWorktree()) {
    warnings.push(
      `This checkout is a git worktree, and ${cfg.envRel} leaves INJISHI_SAMPLE_DATA unset,\n` +
        '  so its database will be marked sample and seeded. For an empty, migrated\n' +
        '  database set INJISHI_SAMPLE_DATA=off, with INJISHI_ENVIRONMENT=production beside it.',
    );
  }
  // INJISHI_SAMPLE_DATA=off asks for exactly this, so it is no surprise.
  if (isProductionProcess(cfg) && cfg.sampleData) {
    warnings.push(
      `${cfg.envRel} makes the API a production process (INJISHI_ENVIRONMENT or NODE_ENV).\n` +
        '  It still runs on this sample database, but issues random codes (read them in\n' +
        '  Mailpit) and lists no personas. Unset both for the demo shape.',
    );
  }
  for (const w of warnings) console.warn(`\nWARNING: ${w}`);
}

/** Storage goes through S3 (MinIO locally) unless the env file says `local`. */
export function usesMinio(cfg) {
  return (cfg.env.STORAGE_ADAPTER_MODE?.trim().toLowerCase() || 'live') !== 'local';
}

/**
 * Mirrors `processEnvironment` in server/api/src/shared/config/platform.ts:
 * INJISHI_ENVIRONMENT when set, else production only under NODE_ENV=production.
 */
export function isProductionProcess(cfg) {
  const explicit = cfg.env.INJISHI_ENVIRONMENT?.trim().toLowerCase();
  if (explicit) return explicit === 'production';
  return cfg.env.NODE_ENV?.trim() === 'production';
}

function printSummary(cfg) {
  const apiPort = cfg.ports.api;
  const fixedCode = !isProductionProcess(cfg);
  const mailpit = `http://localhost:${cfg.ports.mailpit}`;

  if (!cfg.sampleData) {
    console.log(`
Dev stack is up and migrated. The database is empty: never marked sample, never seeded.

  Postgres  127.0.0.1:${cfg.db.port}   database "${cfg.db.name}", user "${cfg.db.user}"
  Redis     127.0.0.1:${cfg.redis.port}
  Mailpit   ${mailpit}     every mail the API sends, sign in codes included
  MinIO     http://localhost:${cfg.ports.minioConsole}     object storage console
  Data survives \`pnpm dev:stack:down\`; \`pnpm dev:stack:reset\` empties it again.

Start the API, the worker and Metro in this one terminal with:  pnpm dev:all
The API (http://localhost:${apiPort}) runs as production: sign in with any email
and read the random code in Mailpit. Every account and record is one you make.`);
    return;
  }

  console.log(`
Dev stack is up, migrated, marked sample and seeded.

  Postgres  127.0.0.1:${cfg.db.port}   database "${cfg.db.name}", user "${cfg.db.user}"
  Redis     127.0.0.1:${cfg.redis.port}
  Data survives \`pnpm dev:stack:down\`; \`pnpm dev:stack:reset\` wipes and re-seeds it.

Start every app in this one terminal (mobile included) with:  pnpm dev:all
Or start what you need, each in its own terminal, from injishi/:
  pnpm api:dev:test                   API on THIS stack  http://localhost:${apiPort}  (health: /api/v1/health)
                                      (\`pnpm api:dev\` is the hosted dev services, .env.development)
  pnpm web:dev                        web       http://localhost:3000
  pnpm app:dev                        app       http://localhost:3002  (sign-in, operator screens, /admin)
  pnpm api:worker:dev                 BullMQ worker. Booking and training mail
                                      is QUEUED and waits in Redis until this runs.
                                      It builds into dist-worker/, so it runs beside api:dev.

  Mailpit   ${mailpit}     every mail the API sends
${usesMinio(cfg) ? `  MinIO     http://localhost:${cfg.ports.minioConsole}     object storage console\n` : '  Storage   on disk (STORAGE_ADAPTER_MODE=local), no MinIO\n'}
${
  stackSeed(cfg) === 'reference'
    ? 'This is the TESTING database: reference data and settings, no demo accounts.\n' +
      'Sign in at http://localhost:3002/sign-in (web\'s :3000/sign-in hands off there) as\n' +
      `${cfg.env.TEST_ADMIN_EMAIL?.trim() || 'an admin you grant with scripts/grant-staff.mjs'} (Injishi admin), or with any new email to create an\n` +
      `account. Codes are real: read them in Mailpit at ${mailpit}.`
    : 'Sign in at http://localhost:3002/sign-in (web\'s :3000/sign-in hands off there)\n' +
      'with a seeded account, or pick one of the demo personas listed there:\n' +
      '  host@injishi.com      owner of the seeded hotel\n' +
      '  landlord@injishi.com  owner of the seeded residence\n' +
      '  admin@injishi.com     platform super_admin (the app\'s /admin)\n' +
      '  guest@injishi.com     marketplace only\n' +
      (fixedCode
        ? `  Code: 123456. The API runs as the demo, and every code also lands in Mailpit at ${mailpit}.`
        : `  Code: random, since the API runs as production. Read it in Mailpit at ${mailpit}.`)
}}`);
}

/**
 * `seed: 'always'` is `pnpm dev:stack`: the recipe runs every time.
 * `seed: 'if-needed'` is `pnpm dev:all`: it runs only on a database the recipe
 * never finished on, so a daily start never rewrites rows somebody is using.
 */
export async function up(api, cfg, { reset = false, seed = 'always', summary = true } = {}) {
  assertApiInstalled(api);
  assertMigrateOnlyRunnable(cfg);

  if (reset) {
    console.log('\n→ Removing the dev stack and its data volumes');
    composeOrThrow(cfg, ['down', '--volumes', '--remove-orphans'], 'docker compose down --volumes');
  }

  await assertPortFree(cfg, 'db', cfg.db.port, 'Postgres', 'the port in DATABASE_URL');
  await assertPortFree(cfg, 'redis', cfg.redis.port, 'Redis', 'REDIS_PORT');
  await assertPortFree(cfg, 'minio', cfg.ports.minio, 'MinIO', 'INJISHI_MINIO_PORT');
  await assertPortFree(cfg, 'minio', cfg.ports.minioConsole, 'MinIO console', 'INJISHI_MINIO_CONSOLE_PORT');
  await assertPortFree(cfg, 'mailpit', cfg.ports.smtp, 'SMTP server', 'the port in SMTP_URL');
  await assertPortFree(cfg, 'mailpit', cfg.ports.mailpit, 'Mailpit', 'INJISHI_MAILPIT_PORT');

  // Mailpit and MinIO too (demo-comms, 2026-09-14). The summary promised codes
  // in Mailpit, and `.env.example` points SMTP_URL and live storage at them,
  // but only db and redis were started: every mail then failed, a queued one
  // retried into the failed set, and uploads refused.
  // MinIO only when the env file stores through S3 (2026-10-24): with
  // STORAGE_ADAPTER_MODE=local nothing reads it, and its image registry is not
  // reachable from every network, which used to stop the whole stack.
  const services = usesMinio(cfg) ? ['db', 'redis', 'mailpit', 'minio'] : ['db', 'redis', 'mailpit'];
  console.log(`\n→ Starting ${usesMinio(cfg) ? 'Postgres, Redis, Mailpit and MinIO' : 'Postgres, Redis and Mailpit'}`);
  composeOrThrow(cfg, ['up', '-d', '--remove-orphans', ...services], 'docker compose up');

  console.log('\n→ Waiting for Postgres and Redis to report healthy');
  await waitHealthy(cfg, 'db', DB_HEALTH_TIMEOUT_MS);
  await waitHealthy(cfg, 'redis', REDIS_HEALTH_TIMEOUT_MS);
  await waitForPort(cfg.db.port, 'Postgres');
  await waitForPort(cfg.redis.port, 'Redis');

  runNodeScript(api, cfg, { script: 'migrate.mjs' }, 'Migrating (the API\'s own scripts/migrate.mjs)');

  if (!cfg.sampleData) {
    if (await readMarker(api, cfg)) {
      throw new StackError(
        `This database carries the sample marker, so it may hold sample data, and ${cfg.envRel}\n` +
          'sets INJISHI_SAMPLE_DATA=off. `pnpm dev:stack:reset` empties it (deletes its data).',
      );
    }
    console.log('\n→ INJISHI_SAMPLE_DATA=off: migrated only. Nothing is marked sample or seeded.');
    if (summary) printSummary(cfg);
    return;
  }

  const seededAt = seed === 'if-needed' ? ((await readMarker(api, cfg))?.seeded_at ?? null) : null;
  if (seededAt) {
    console.log(
      `\n→ Sample data already seeded (${seededAt.toISOString()}); keeping it. ` +
        '`pnpm dev:stack` reseeds.',
    );
  } else {
    for (const step of stepsFor(cfg)) {
      runNodeScript(api, cfg, step, `${step.script}: ${step.what}`);
    }
  }

  if (summary) printSummary(cfg);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(usage());
    return;
  }

  const api = resolveApiDir();
  const cfg = readApiEnv(api.dir, api.rel);
  const dockerInfo = assertDockerReady();
  printPreamble(cfg, dockerInfo);

  if (opts.down) {
    console.log('\n→ Stopping the dev stack (data is kept)');
    composeOrThrow(cfg, ['down', '--remove-orphans'], 'docker compose down');
    console.log('\nStopped. `pnpm dev:stack` brings it back with the same data.');
    return;
  }

  warnAboutEnv(cfg);
  await up(api, cfg, { reset: opts.reset });
}

/**
 * True when node was asked to run THIS file, false when dev-all.mjs imports it.
 * Compared by real path, case blind on Windows: an import.meta.url built from
 * `C:\` never equals an argv[1] typed from a `c:\` working directory.
 */
function isEntryPoint() {
  if (!process.argv[1]) return false;
  try {
    const self = realpathSync(fileURLToPath(import.meta.url));
    const entry = realpathSync(path.resolve(process.argv[1]));
    return process.platform === 'win32' ? self.toLowerCase() === entry.toLowerCase() : self === entry;
  } catch {
    return false;
  }
}

if (isEntryPoint()) {
  main().catch((err) => {
    if (err instanceof StackError) {
      console.error(`\ndev-stack: ${err.message}`);
    } else {
      // Unexpected: still one readable line first, the detail after it.
      console.error(`\ndev-stack: unexpected error: ${err?.message ?? err}`);
      if (process.env.DEV_STACK_DEBUG) console.error(err);
    }
    process.exit(1);
  });
}
