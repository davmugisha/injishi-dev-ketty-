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
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
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
 * After migrating: mark the database sample, then run the one recipe. The same
 * two steps the first bring up of a deployed sample stack runs (ADR-043 AC-31).
 */
const STEPS = [
  {
    script: 'mark-sample-database.mjs',
    args: ['--sample'],
    what: 'mark the database as sample data',
    onFailure:
      '\nThis database already holds accounts from before the sample marker existed, so\n' +
      'Postgres will not mark it. Either:\n' +
      '  pnpm dev:stack:reset     rebuild it as a sample database (deletes its data), or\n' +
      '  keep it, and run the API with INJISHI_ENVIRONMENT=production (random codes, in Mailpit).',
  },
  { script: 'seed-sample.mjs', what: 'the sample recipe (seed-sample.mjs)' },
];

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
class StackError extends Error {}

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

function resolveApiDir() {
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

function readApiEnv(apiDir, apiRel) {
  const envFile = path.join(apiDir, '.env');
  const envRel = `${apiRel}/.env`;
  if (!existsSync(envFile)) {
    throw new StackError(
      `${envRel} does not exist.\n` +
        `Create it from the template (from injishi/), then run this again:\n` +
        `  copy ${apiRel.replace(/\//g, '\\')}\\.env.example ${apiRel.replace(/\//g, '\\')}\\.env     (PowerShell/cmd)\n` +
        `  cp ${apiRel}/.env.example ${apiRel}/.env       (bash)`,
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

  if (db.port === redis.port) {
    throw new StackError(`${envRel} gives Postgres and Redis the same port (${db.port}).`);
  }

  return { envRel, env, db, redis };
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

function assertDockerReady() {
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

/** Variables compose interpolates into docker-compose.yml. */
function composeEnv(cfg) {
  return {
    ...process.env,
    INJISHI_DB_PORT: String(cfg.db.port),
    INJISHI_DB_USER: cfg.db.user,
    INJISHI_DB_PASSWORD: cfg.db.password,
    INJISHI_DB_NAME: cfg.db.name,
    INJISHI_REDIS_PORT: String(cfg.redis.port),
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

function canConnect(port, host = '127.0.0.1', timeoutMs = 1_000) {
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

// --- Commands ----------------------------------------------------------------

function printPreamble(cfg, dockerInfo) {
  console.log(`Docker engine ${dockerInfo.engine}, Compose ${dockerInfo.compose}`);
  console.log(`Ports from ${cfg.envRel}: Postgres ${cfg.db.port}, Redis ${cfg.redis.port}`);
}

function warnAboutEnv(cfg) {
  const warnings = [];
  const shellDb = process.env.DATABASE_URL?.trim();
  if (shellDb && shellDb !== cfg.db.url) {
    warnings.push(
      'DATABASE_URL is also set in this shell, to a different value. `pnpm api:dev` gives the\n' +
        '  shell precedence over .env, so it would serve THAT database, not this stack. Unset it\n' +
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
    warnings.push('Your .env gives Redis a password; the dev stack Redis has none.');
  }
  if (isProductionProcess(cfg)) {
    warnings.push(
      `${cfg.envRel} makes the API a production process (INJISHI_ENVIRONMENT or NODE_ENV).\n` +
        '  It still runs on this sample database, but issues random codes (read them in\n' +
        '  Mailpit) and lists no personas. Unset both for the demo shape.',
    );
  }
  for (const w of warnings) console.warn(`\nWARNING: ${w}`);
}

/**
 * Mirrors `processEnvironment` in server/api/src/shared/config/platform.ts:
 * INJISHI_ENVIRONMENT when set, else production only under NODE_ENV=production.
 */
function isProductionProcess(cfg) {
  const explicit = cfg.env.INJISHI_ENVIRONMENT?.trim().toLowerCase();
  if (explicit) return explicit === 'production';
  return cfg.env.NODE_ENV?.trim() === 'production';
}

function printSummary(cfg) {
  const apiPort = cfg.env.PORT?.trim() || '8000';
  const fixedCode = !isProductionProcess(cfg);

  console.log(`
Dev stack is up, migrated, marked sample and seeded.

  Postgres  127.0.0.1:${cfg.db.port}   database "${cfg.db.name}", user "${cfg.db.user}"
  Redis     127.0.0.1:${cfg.redis.port}
  Data survives \`pnpm dev:stack:down\`; \`pnpm dev:stack:reset\` wipes and re-seeds it.

Start what you need, each in its own terminal, from injishi/:
  pnpm api:dev                        API       http://localhost:${apiPort}  (health: /api/v1/health)
  pnpm web:dev                        web       http://localhost:3000
  pnpm app:dev                        operator  http://localhost:3002
  pnpm --filter @injishi/admin dev    admin     http://localhost:3001
  pnpm --filter @injishi/api worker:dev   BullMQ worker (only for queued jobs)

Sign in at http://localhost:3000/sign-in with a seeded account, or pick one of
the demo personas listed there (*@demo.injishi.com):
  host@injishi.com      owner of the seeded hotel (operator app)
  landlord@injishi.com  owner of the seeded residence
  admin@injishi.com     platform super_admin (admin console, :3001)
  guest@injishi.com     marketplace only
${
  fixedCode
    ? '  Code: 123456. The API runs as the demo (INJISHI_ENVIRONMENT unset), and every\n' +
      '  code also lands in Mailpit at http://localhost:8025.'
    : '  Code: random, since the API runs as production. Read it in Mailpit at\n' +
      '  http://localhost:8025, or in the `pnpm api:dev` log when OTP_DEBUG_LOG=true.'
}`);
}

async function up(api, cfg, { reset }) {
  assertApiInstalled(api);

  if (reset) {
    console.log('\n→ Removing the dev stack and its data volumes');
    composeOrThrow(cfg, ['down', '--volumes', '--remove-orphans'], 'docker compose down --volumes');
  }

  await assertPortFree(cfg, 'db', cfg.db.port, 'Postgres', 'the port in DATABASE_URL');
  await assertPortFree(cfg, 'redis', cfg.redis.port, 'Redis', 'REDIS_PORT');

  console.log('\n→ Starting Postgres and Redis');
  composeOrThrow(cfg, ['up', '-d', '--remove-orphans', 'db', 'redis'], 'docker compose up');

  console.log('\n→ Waiting for Postgres and Redis to report healthy');
  await waitHealthy(cfg, 'db', DB_HEALTH_TIMEOUT_MS);
  await waitHealthy(cfg, 'redis', REDIS_HEALTH_TIMEOUT_MS);
  await waitForPort(cfg.db.port, 'Postgres');
  await waitForPort(cfg.redis.port, 'Redis');

  runNodeScript(api, cfg, { script: 'migrate.mjs' }, 'Migrating (the API\'s own scripts/migrate.mjs)');
  for (const step of STEPS) {
    runNodeScript(api, cfg, step, `${step.script}: ${step.what}`);
  }

  printSummary(cfg);
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
