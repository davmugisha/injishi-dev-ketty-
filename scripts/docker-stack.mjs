#!/usr/bin/env node
/**
 * The whole stack in Docker: Postgres, Redis and Mailpit, then the API, the
 * worker, web and the operator app built from the release Dockerfiles.
 *
 *   pnpm docker:up                  start everything; build any image that is missing
 *   pnpm docker:up --build          rebuild every image first
 *   pnpm docker:rebuild <service>   rebuild and restart api, worker, web or app
 *   pnpm docker:logs [service]      follow the logs
 *   pnpm docker:ps                  what is running
 *   pnpm docker:down                stop everything, keep the data
 *   pnpm docker:down --apps         stop the four apps, keep db, redis, mailpit
 *
 * The services are the `apps` profile of infra/docker/docker-compose.yml, in
 * the same compose project as `pnpm dev:stack`, whose code this reuses: the
 * ports and Postgres credentials come from server/api/.env.test through the
 * same reader, and `up` brings the backing services up, migrates and seeds a
 * database that was never seeded exactly as `pnpm dev:all` does.
 *
 * Builds run one at a time: two `next build`s at once do not fit in a 4 GB
 * Docker VM. web and app need HeroUI Pro's CI/CD token (HEROUI_AUTH_TOKEN),
 * read from the shell or the root .env and handed to compose as a BuildKit
 * secret. It is never printed. Compose needs the buildx plugin to pass it
 * (`brew install docker-buildx` with Colima).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  StackError,
  assertDockerReady,
  canConnect,
  composeEnv,
  printPreamble,
  readApiEnv,
  resolveApiDir,
  up as stackUp,
  warnAboutEnv,
} from './dev-stack.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const COMPOSE_FILE = 'infra/docker/docker-compose.yml';
const PROFILE = 'apps';

/** Every container of the profile; `net` holds the namespace and the ports. */
const APP_CONTAINERS = ['net', 'api', 'worker', 'web', 'app'];
/** What a person names on the command line. */
const SERVICES = ['api', 'worker', 'web', 'app'];
/** The service that builds each one's image: the worker runs the API's. */
const BUILDER = { api: 'api', worker: 'api', web: 'web', app: 'app' };
/** The containers a new image replaces. */
const RUNS_IMAGE = { api: ['api', 'worker'], web: ['web'], app: ['app'] };
const IMAGE = { api: 'injishi-api:local', web: 'injishi-web:local', app: 'injishi-app:local' };
const PORTS = { 'the API': 8000, web: 3000, app: 3002 };
const WAIT_TIMEOUT_S = 300;
/**
 * Below this, a build and the running apps do not fit together. A `next build`
 * peaked at 3.3 GB of Colima's default 4 GB VM (2026-10-24). A FIRST build peaks
 * higher still: copying the freshly installed dependency tree between stages
 * leaves dockerd itself holding about 1.2 GB when `next build` starts, and twice
 * the VM ran out, and the kernel killed Postgres, Mailpit and the ssh that
 * carries Colima's Docker socket. So on a small VM the apps stop while an image
 * builds, and a build that takes Docker down says how to resume (build()).
 */
const ROOMY_VM_BYTES = 6 * 1024 ** 3;

// --- Arguments ---------------------------------------------------------------

function usage() {
  return [
    'Usage: node scripts/docker-stack.mjs <command>',
    '',
    '  up [--build]            start everything; --build rebuilds every image first',
    '  rebuild <service...>    rebuild and restart: api, worker, web, app',
    '  logs [service...]       follow the logs (all four apps when none is named)',
    '  ps                      list the containers',
    '  down [--apps]           stop everything (data kept); --apps keeps db, redis, mailpit',
  ].join('\n');
}

function parseArgs(argv) {
  const [command = 'up', ...rest] = argv;
  const flags = new Set(rest.filter((a) => a.startsWith('-')));
  const names = rest.filter((a) => !a.startsWith('-'));
  const allowed = { up: ['--build'], down: ['--apps'], rebuild: [], logs: [], ps: [], help: [] };
  if (command === '--help' || command === '-h') return { command: 'help', flags, names };
  if (!(command in allowed)) throw new StackError(`Unknown command "${command}".\n\n${usage()}`);
  const unknownFlags = [...flags].filter((f) => !allowed[command].includes(f));
  if (unknownFlags.length) throw new StackError(`Unknown option for ${command}: ${unknownFlags.join(' ')}`);
  const badNames = names.filter((n) => !SERVICES.includes(n));
  if (badNames.length) {
    throw new StackError(`Unknown service: ${badNames.join(' ')}. Choose from ${SERVICES.join(', ')}.`);
  }
  if (names.length && !['rebuild', 'logs'].includes(command)) {
    throw new StackError(`${command} takes no service names.\n\n${usage()}`);
  }
  if (command === 'rebuild' && !names.length) {
    throw new StackError(`Say which service to rebuild: ${SERVICES.join(', ')}.`);
  }
  return { command, flags, names };
}

// --- Environment -------------------------------------------------------------

/** DATABASE_URL from .env.test, as the containers reach it: host `db`, port 5432. */
function dockerDatabaseUrl(cfg) {
  const u = new URL(cfg.db.url);
  u.hostname = 'db';
  u.port = '5432';
  return u.toString();
}

function gitCommit() {
  const r = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : '';
}

/** HEROUI_AUTH_TOKEN from the shell, else the root .env. Never printed. */
function herouiToken() {
  const fromShell = process.env.HEROUI_AUTH_TOKEN?.trim();
  if (fromShell) return fromShell;
  const file = path.join(ROOT, '.env');
  if (existsSync(file)) {
    for (const raw of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = /^\s*(?:export\s+)?HEROUI_AUTH_TOKEN\s*=\s*(.*)$/.exec(raw);
      if (!m) continue;
      const value = m[1].trim().replace(/^(['"])(.*)\1$/, '$2').replace(/\s+#.*$/, '').trim();
      if (value) return value;
    }
  }
  throw new StackError(
    'HEROUI_AUTH_TOKEN is not set. web and app cannot build without HeroUI Pro.\n' +
      'Copy .env.example to .env at the repo root and fill in the CI/CD token\n' +
      '(https://heroui.pro/dashboard), or export it in this shell.',
  );
}

function stackEnv(cfg, { token = false } = {}) {
  const env = {
    ...composeEnv(cfg),
    INJISHI_DOCKER_DATABASE_URL: dockerDatabaseUrl(cfg),
    INJISHI_COMMIT: process.env.INJISHI_COMMIT ?? gitCommit(),
  };
  if (token) env.HEROUI_AUTH_TOKEN = herouiToken();
  return env;
}

// --- Docker ------------------------------------------------------------------

function compose(cfg, args, { token = false, capture = false } = {}) {
  return spawnSync('docker', ['compose', '-f', COMPOSE_FILE, '--profile', PROFILE, ...args], {
    cwd: ROOT,
    env: stackEnv(cfg, { token }),
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  });
}

function composeOrThrow(cfg, args, what, options) {
  const r = compose(cfg, args, options);
  if (r.error) throw new StackError(`${what} failed: ${r.error.message}`);
  if (r.status !== 0) throw new StackError(`${what} failed (exit code ${r.status}); see the output above.`);
  return r;
}

function imageExists(tag) {
  return spawnSync('docker', ['image', 'inspect', '--format', '{{.Id}}', tag], { stdio: 'ignore' }).status === 0;
}

function imageSize(tag) {
  const r = spawnSync('docker', ['image', 'ls', '--format', '{{.Size}}', tag], { encoding: 'utf8' });
  return r.stdout?.trim().split('\n')[0] || '?';
}

function dockerMemoryBytes() {
  const r = spawnSync('docker', ['info', '--format', '{{.MemTotal}}'], { encoding: 'utf8' });
  return Number(r.stdout?.trim()) || 0;
}

/** On a small VM, stop the apps before a build (ROOMY_VM_BYTES says why). */
function makeRoomForBuild(cfg) {
  const bytes = dockerMemoryBytes();
  if (!bytes || bytes >= ROOMY_VM_BYTES) return;
  const running = APP_CONTAINERS.filter((s) => isRunning(cfg, s));
  if (!running.length) return;
  const gb = (bytes / 1024 ** 3).toFixed(1);
  console.log(
    `\n→ Stopping ${running.join(', ')} while building: this Docker VM has ${gb} GB, and a build\n` +
      '  needs most of it. Postgres, Redis and Mailpit keep running. To keep the apps up\n' +
      '  during builds, give the VM 6 GB (Colima: colima stop && colima start --memory 6).',
  );
  composeOrThrow(cfg, ['stop', ...running], 'docker compose stop');
}

function isRunning(cfg, service) {
  const r = compose(cfg, ['ps', '-q', '--status', 'running', service], { capture: true });
  return r.status === 0 && Boolean(r.stdout.trim());
}

/** One image at a time, then drop the images the new tags left dangling. */
function build(cfg, builders) {
  for (const service of builders) {
    const started = Date.now();
    console.log(`\n→ Building ${IMAGE[service]} (infra/docker/Dockerfile.${service})`);
    const r = compose(cfg, ['build', service], { token: service !== 'api' });
    if (r.status !== 0) {
      const daemonGone = spawnSync('docker', ['info'], { stdio: 'ignore' }).status !== 0;
      throw new StackError(
        daemonGone
          ? `Building ${service} stopped and Docker no longer answers: the VM most likely ran out of\n` +
              'memory (a first build peaks highest). Restart it and run the same command again; it\n' +
              'resumes from the cached install:  colima restart   (or restart Docker Desktop)\n' +
              'For good: give the VM 6 GB (colima stop && colima start --memory 6).'
          : `Building ${service} failed (exit code ${r.status}); see the output above.`,
      );
    }
    const minutes = ((Date.now() - started) / 60_000).toFixed(1);
    console.log(`  ${IMAGE[service]} built in ${minutes} min, ${imageSize(IMAGE[service])}`);
  }
  spawnSync('docker', ['image', 'prune', '-f'], { stdio: 'ignore' });
}

/** A port held by something outside this stack, usually `pnpm dev` on the host. */
async function assertPortsFree(cfg) {
  if (isRunning(cfg, 'net')) return; // ours: `up` reconciles it
  for (const [what, port] of Object.entries(PORTS)) {
    if (await canConnect(port)) {
      throw new StackError(
        `127.0.0.1:${port} (${what}) is already in use. Stop whatever serves it on the host ` +
          '(`pnpm dev`, `pnpm api:dev:test`, ...) and run this again.',
      );
    }
  }
}

function startApps(cfg, services) {
  console.log(`\n→ Starting ${services.join(', ')} (waiting up to ${WAIT_TIMEOUT_S}s for health)`);
  const r = compose(cfg, ['up', '-d', '--no-build', '--wait', '--wait-timeout', String(WAIT_TIMEOUT_S), ...services]);
  if (r.status !== 0) {
    compose(cfg, ['ps', '-a', ...APP_CONTAINERS]);
    compose(cfg, ['logs', '--tail', '40', ...services.filter((s) => s !== 'net')]);
    throw new StackError('Not every container became healthy; the logs above say why.');
  }
}

function printSummary() {
  console.log(`
Running in Docker (compose project "docker", profile "${PROFILE}"):

  web       http://localhost:3000     marketplace, sign-in, registration; /w/... is the operator zone
  app       http://localhost:3002     the operator app: its screens (/residence, /owner, ...), /admin
  API       http://localhost:8000     health: http://localhost:8000/api/v1/health
  Mailpit   http://localhost:8025     every mail, sign-in codes included

Code 123456 for every seeded account (landlord@injishi.com, host@injishi.com, ...) and
the demo personas. Operators: sign in at http://localhost:3002/sign-in to land in
their screens; guests at http://localhost:3000/sign-in.

After a code change:  pnpm docker:rebuild web   (or api, app)
Logs:                 pnpm docker:logs api
Stop:                 pnpm docker:down          (the data is kept)`);
}

// --- Commands ----------------------------------------------------------------

async function main() {
  const { command, flags, names } = parseArgs(process.argv.slice(2));
  if (command === 'help') {
    console.log(usage());
    return;
  }

  const api = resolveApiDir();
  const cfg = readApiEnv(api.dir, api.rel);
  const dockerInfo = assertDockerReady();

  if (command === 'ps') {
    compose(cfg, ['ps', '-a']);
    return;
  }
  if (command === 'logs') {
    compose(cfg, ['logs', '-f', '--tail', '200', ...(names.length ? names : SERVICES)]);
    return;
  }
  if (command === 'down') {
    if (flags.has('--apps')) {
      composeOrThrow(cfg, ['stop', ...APP_CONTAINERS], 'docker compose stop');
      composeOrThrow(cfg, ['rm', '-f', ...APP_CONTAINERS], 'docker compose rm');
      console.log('\nThe apps are stopped. Postgres, Redis and Mailpit are still running.');
    } else {
      composeOrThrow(cfg, ['down'], 'docker compose down');
      console.log('\nStopped. The data is kept; `pnpm docker:up` brings it all back.');
    }
    return;
  }

  mkdirSync(path.join(api.dir, '.storage'), { recursive: true });

  if (command === 'rebuild') {
    const builders = [...new Set(names.map((n) => BUILDER[n]))];
    const wasRunning = APP_CONTAINERS.filter((s) => isRunning(cfg, s));
    makeRoomForBuild(cfg);
    build(cfg, builders);
    // The rebuilt ones, and whatever had to stop to make room for the build.
    const restart = new Set([...builders.flatMap((b) => RUNS_IMAGE[b]), ...wasRunning]);
    startApps(cfg, APP_CONTAINERS.filter((s) => restart.has(s)));
    return;
  }

  // up
  printPreamble(cfg, dockerInfo);
  warnAboutEnv(cfg);
  await assertPortsFree(cfg);

  // Images first: a build fails fast, and nothing else holds memory meanwhile.
  const builders = Object.keys(IMAGE).filter((b) => flags.has('--build') || !imageExists(IMAGE[b]));
  if (builders.length) {
    makeRoomForBuild(cfg);
    build(cfg, builders);
  }

  // Postgres, Redis and Mailpit, migrated, and seeded only if never seeded.
  await stackUp(api, cfg, { seed: 'if-needed', summary: false });
  startApps(cfg, APP_CONTAINERS);
  printSummary();
}

main().catch((err) => {
  console.error(`\ndocker-stack: ${err instanceof StackError ? err.message : (err?.message ?? err)}`);
  process.exit(1);
});
