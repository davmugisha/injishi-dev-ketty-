#!/usr/bin/env node
/**
 * Every app in one terminal, as dev servers on the host (hot reload).
 *
 * `pnpm docker:up` is the main way to run the whole product; this is for
 * working on the code with each app recompiling on save.
 *
 *   pnpm dev:all                      the whole product: the Docker services,
 *                                     then api, worker, web, app, mobile
 *   pnpm dev:all --skip mobile        everything except these (comma separated)
 *   pnpm dev:all --only web,api       just these
 *   pnpm dev:all --lan 192.168.1.68   the address a phone reaches this PC on
 *
 * Ctrl+C stops every app it started. Postgres, Redis and Mailpit (and MinIO,
 * when the API's env file stores through S3) keep running in Docker, because
 * they hold the data and are slow to come back; `pnpm dev:stack:down` stops
 * them.
 *
 * In order, it:
 *   1. runs `pnpm install --frozen-lockfile` when pnpm-lock.yaml no longer
 *      matches what is installed, which is what a pull that moved a dependency
 *      leaves behind;
 *   2. refuses to start while one of the apps' ports is taken, and names the
 *      process holding it. It never stops a process it did not start;
 *   3. starts Docker Desktop when its engine is not running, and waits for it;
 *   4. brings the services up and migrates through dev-stack.mjs, seeding only
 *      a database the sample recipe never finished on;
 *   5. starts each app through its own package script, so how an app runs is
 *      still defined once, in its package.json, and prefixes every line an app
 *      prints with its name;
 *   6. says where everything is once it answers, with a QR code for Expo Go.
 *
 * MOBILE STARTS FOR EXPO GO ON A PHONE (its `dev` script, `expo start`). A phone cannot reach
 * `localhost`, which is the phone itself, so Metro advertises this PC's LAN
 * address and the bundle inlines the API at that address too:
 * EXPO_PUBLIC_API_URL from the environment beats the one in apps/mobile/.env.
 * Hyper-V, WSL and other virtual adapters are passed over, because they hold
 * private addresses too and a phone handed one never connects. The address is
 * read once, at start, so after the PC changes network, restart this.
 *
 * Plain Node, no dependencies, like dev-stack.mjs.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  StackError,
  assertDockerReady,
  canConnect,
  isProductionProcess,
  printPreamble,
  readApiEnv,
  resolveApiDir,
  up,
  usesMinio,
  warnAboutEnv,
} from './dev-stack.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const IS_WINDOWS = process.platform === 'win32';
/** Node's own rule: FORCE_COLOR beats NO_COLOR, and either beats the TTY test. */
const COLOR = process.env.FORCE_COLOR
  ? process.env.FORCE_COLOR !== '0'
  : !('NO_COLOR' in process.env) && Boolean(process.stdout.isTTY);

const METRO_PORT = 8081;
const DOCKER_START_TIMEOUT_S = 240;
/** Metro's first start walks the whole node_modules tree: minutes, not seconds. */
const READY_TIMEOUT_MS = 10 * 60_000;
const STOP_GRACE_MS = 5_000;

/**
 * The apps, in start order. A Next app's port is read from its own dev script
 * (`dir`), so it stays defined in one place.
 */
const APPS = [
  { name: 'api', pkg: '@injishi/api', script: 'dev', color: 32, needsStack: true },
  { name: 'worker', pkg: '@injishi/api', script: 'worker:dev', color: 90, needsStack: true },
  { name: 'web', pkg: '@injishi/web', script: 'dev', dir: 'apps/web', color: 36 },
  { name: 'app', pkg: '@injishi/app', script: 'dev', dir: 'apps/app', color: 94 },
  { name: 'mobile', pkg: '@injishi/mobile', script: 'dev', color: 33 },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const paint = (code, text) => (COLOR ? `\x1b[${code}m${text}\x1b[0m` : text);

// --- Arguments ---------------------------------------------------------------

function usage() {
  return [
    'Usage: pnpm dev:all [--skip <apps>] [--only <apps>] [--lan <address>]',
    '',
    'Starts Postgres, Redis and Mailpit in Docker, migrates, then every app',
    `in this one terminal: ${APPS.map((a) => a.name).join(', ')}.`,
    '',
    '  --skip mobile,worker  everything except these',
    '  --only web,api        just these',
    "  --lan 192.168.1.68    the address your phone reaches this PC on (Expo Go).",
    "                        Default: this PC's Wi-Fi address",
    '',
    'Ctrl+C stops the apps. Docker keeps running; `pnpm dev:stack:down` stops it.',
  ].join('\n');
}

function parseArgs(argv) {
  const opts = { only: null, skip: new Set(), lan: null, help: false };
  const names = new Set(APPS.map((a) => a.name));
  const list = (value) =>
    value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const eq = arg.indexOf('=');
    const flag = eq > 0 ? arg.slice(0, eq) : arg;
    const value = () => {
      const v = eq > 0 ? arg.slice(eq + 1) : argv[++i];
      if (!v) throw new StackError(`${flag} needs a value.\n\n${usage()}`);
      return v;
    };
    if (flag === '--help' || flag === '-h') opts.help = true;
    else if (flag === '--only') opts.only = new Set(list(value()));
    else if (flag === '--skip') list(value()).forEach((n) => opts.skip.add(n));
    else if (flag === '--lan') opts.lan = value();
    else throw new StackError(`Unknown option: ${arg}\n\n${usage()}`);
  }

  for (const name of [...(opts.only ?? []), ...opts.skip]) {
    if (!names.has(name)) {
      throw new StackError(`There is no app called "${name}". The apps are: ${[...names].join(', ')}.`);
    }
  }
  if (opts.lan && !/^[A-Za-z0-9.:-]+$/.test(opts.lan)) {
    throw new StackError(`--lan takes an address such as 192.168.1.68, not "${opts.lan}".`);
  }
  return opts;
}

// --- pnpm ----------------------------------------------------------------------

/**
 * Run as `pnpm dev:all`, npm_execpath is pnpm's own entry script, so node runs
 * it directly and no cmd.exe shim sits between this process and an app.
 */
function pnpmCommand(args) {
  const cli = process.env.npm_execpath;
  if (cli && /[\\/]pnpm\.[cm]?js$/i.test(cli) && existsSync(cli)) {
    return { file: process.execPath, args: [cli, ...args], shell: false };
  }
  // Node refuses to spawn a .cmd without a shell (CVE-2024-27980).
  return { file: 'pnpm', args, shell: IS_WINDOWS };
}

/**
 * pnpm keeps a copy of the lockfile it last installed from. When the real one
 * no longer matches it, a pull moved a dependency and the apps would start on
 * the old tree. Compared without line endings: a Windows checkout may hold CRLF.
 */
function ensureInstalled() {
  // pnpm writes node_modules/.pnpm/lock.yaml on every install. Its content is not a copy of
  // pnpm-lock.yaml under pnpm 12 (no packageManager document, no other platforms' packages),
  // so the two are compared by age: a lockfile newer than the last install was changed since.
  const mtime = (file) => (existsSync(file) ? statSync(file).mtimeMs : null);
  const wanted = mtime(path.join(ROOT, 'pnpm-lock.yaml'));
  const installed = mtime(path.join(ROOT, 'node_modules', '.pnpm', 'lock.yaml'));
  if (wanted !== null && installed !== null && wanted <= installed) return;

  console.log(
    installed === null
      ? '\n→ Nothing is installed yet: pnpm install --frozen-lockfile'
      : '\n→ pnpm-lock.yaml changed since the last install: pnpm install --frozen-lockfile',
  );
  const cmd = pnpmCommand(['install', '--frozen-lockfile']);
  const r = spawnSync(cmd.file, cmd.args, { cwd: ROOT, stdio: 'inherit', shell: cmd.shell });
  if (r.status !== 0) {
    throw new StackError(
      'pnpm install failed; see its output above. If it says the lockfile is out of date,\n' +
        'a package.json was changed without installing: run `pnpm install` yourself.',
    );
  }
}

// --- Ports ---------------------------------------------------------------------

function nextDevPort(app) {
  const manifest = JSON.parse(readFileSync(path.join(ROOT, app.dir, 'package.json'), 'utf8'));
  const m = /(?:--port|-p)[ =](\d+)/.exec(manifest.scripts?.[app.script] ?? '');
  if (!m) {
    throw new StackError(`${app.dir}/package.json: its ${app.script} script names no --port to wait on.`);
  }
  return Number(m[1]);
}

async function portTaken(port) {
  return (await canConnect(port)) || (await canConnect(port, '::1'));
}

/** "pid 1234: <command line>" for whatever listens on the port, when the OS says. */
function describeListener(port) {
  try {
    if (IS_WINDOWS) {
      const ns = spawnSync('netstat', ['-ano'], { encoding: 'utf8', windowsHide: true });
      const pid = (ns.stdout ?? '')
        .split(/\r?\n/)
        .map((line) => /^\s*TCP\s+\S*:(\d+)\s+\S+\s+LISTENING\s+(\d+)/.exec(line))
        .find((m) => m && Number(m[1]) === port)?.[2];
      if (!pid) return '';
      const ps = spawnSync(
        'powershell.exe',
        ['-NoProfile', '-Command', `(Get-CimInstance Win32_Process -Filter "ProcessId=${pid}").CommandLine`],
        { encoding: 'utf8', windowsHide: true, timeout: 15_000 },
      );
      return `pid ${pid}: ${(ps.stdout ?? '').trim() || '(command line not readable)'}`;
    }
    const lsof = spawnSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-Fp'], { encoding: 'utf8' });
    const pid = /^p(\d+)/m.exec(lsof.stdout ?? '')?.[1];
    if (!pid) return '';
    const ps = spawnSync('ps', ['-o', 'command=', '-p', pid], { encoding: 'utf8' });
    return `pid ${pid}: ${(ps.stdout ?? '').trim()}`;
  } catch {
    return '';
  }
}

async function assertPortsFree(apps) {
  const taken = [];
  for (const app of apps) {
    if (app.port && (await portTaken(app.port))) taken.push(app);
  }
  if (!taken.length) return;

  const clip = (s) => (s.length > 220 ? `${s.slice(0, 217)}...` : s);
  const lines = taken.map((app) => {
    const holder = describeListener(app.port);
    return `  ${app.port} (${app.name})${holder ? `  held by ${clip(holder)}` : ''}`;
  });
  throw new StackError(
    'These ports are already in use, so their apps cannot start:\n' +
      `${lines.join('\n')}\n\n` +
      'An earlier injishi dev server? Stop it and run this again:\n' +
      `  ${IS_WINDOWS ? 'taskkill /PID <pid> /T /F' : 'kill <pid>'}\n` +
      'Another project? Stop that, or leave the app out: pnpm dev:all --skip <name>.\n' +
      'web has to be on its port: sign-in, CORS and the other apps point at it.',
  );
}

// --- Docker --------------------------------------------------------------------

function dockerEngineUp() {
  const r = spawnSync('docker', ['info', '--format', '{{.ServerVersion}}'], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 20_000,
  });
  return r.status === 0 && Boolean(r.stdout?.trim());
}

/** True when it asked Docker Desktop to start, false when it had no way to. */
function startDockerDesktop() {
  // Docker Desktop 4.37 and later ship `docker desktop start`, which waits.
  const hasCli = spawnSync('docker', ['desktop', 'version'], { stdio: 'ignore', windowsHide: true }).status === 0;
  if (hasCli) {
    spawnSync('docker', ['desktop', 'start', '--timeout', String(DOCKER_START_TIMEOUT_S)], {
      stdio: 'inherit',
      windowsHide: true,
    });
    return true;
  }
  if (IS_WINDOWS) {
    const exe = path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Docker', 'Docker', 'Docker Desktop.exe');
    if (!existsSync(exe)) return false;
    spawn(exe, [], { detached: true, stdio: 'ignore' }).unref();
    return true;
  }
  if (process.platform === 'darwin') {
    return spawnSync('open', ['-a', 'Docker'], { stdio: 'ignore' }).status === 0;
  }
  return false;
}

/**
 * Starts Docker Desktop when it is installed and not running. Anything it
 * cannot fix (not installed, will not start) is left to dev-stack.mjs's
 * assertDockerReady, which says what to do about each.
 */
async function ensureDockerEngine() {
  if (dockerEngineUp()) return;
  if (spawnSync('docker', ['--version'], { windowsHide: true }).error) return;

  console.log(`\n→ Docker is not running: starting Docker Desktop (up to ${DOCKER_START_TIMEOUT_S / 60} minutes)`);
  if (!startDockerDesktop()) return;
  const deadline = Date.now() + DOCKER_START_TIMEOUT_S * 1000;
  while (Date.now() < deadline) {
    if (dockerEngineUp()) return;
    await sleep(3_000);
  }
}

// --- Mobile --------------------------------------------------------------------

const VIRTUAL_ADAPTER = /vEthernet|WSL|Hyper-V|VirtualBox|VMware|Docker|Loopback|Bluetooth|^br-|^veth|^vmnet|^utun|^awdl|^llw/i;

/** This PC's address on the network a phone shares with it: Wi-Fi first. */
function lanAddress() {
  const found = [];
  for (const [name, addresses] of Object.entries(os.networkInterfaces())) {
    if (VIRTUAL_ADAPTER.test(name)) continue;
    for (const a of addresses ?? []) {
      const ipv4 = a.family === 'IPv4' || a.family === 4;
      if (!ipv4 || a.internal || a.address.startsWith('169.254.')) continue;
      const rank = /wi-?fi|wlan|wireless|^wl|^en0$/i.test(name) ? 0 : /ethernet|^eth|^en\d/i.test(name) ? 1 : 2;
      found.push({ name, address: a.address, rank });
    }
  }
  return found.sort((a, b) => a.rank - b.rank)[0] ?? null;
}

/** A QR code drawn with half blocks, dark on light whatever the terminal theme. */
function qrLines(text) {
  let encodeQr;
  try {
    ({ encodeQr } = createRequire(import.meta.url)('../packages/qr/dist/index.js'));
  } catch {
    return [];
  }
  const { size, modules } = encodeQr(text);
  const quiet = 2;
  const dark = (r, c) => r >= 0 && c >= 0 && r < size && c < size && modules[r][c] === 1;
  const lines = [];
  for (let r = -quiet; r < size + quiet; r += 2) {
    let row = '';
    for (let c = -quiet; c < size + quiet; c++) {
      const top = dark(r, c);
      const bottom = dark(r + 1, c);
      row += top && bottom ? '█' : top ? '▀' : bottom ? '▄' : ' ';
    }
    lines.push(`  \x1b[30;107m${row}\x1b[0m`);
  }
  return lines;
}

// --- Running the apps ----------------------------------------------------------

/** Screen clears from a watcher would wipe every other app's lines too. */
const SCREEN_CLEAR = /\x1bc|\x1b\[[0-3]?J|\x1b\[[0-9;]*[Hf]/g;

let stopping = false;

function pipeLines(stream, write) {
  let buffer = '';
  const emit = (raw) => {
    if (stopping) return; // shutdown chatter, "Terminate batch job (Y/N)?" among it
    const line = raw.replace(/\r$/, '').split('\r').pop().replace(SCREEN_CLEAR, '');
    if (!line.trim() && raw.trim()) return; // the line was only a screen clear
    write(line);
  };
  stream.setEncoding('utf8');
  stream.on('data', (chunk) => {
    buffer += chunk;
    const parts = buffer.split('\n');
    buffer = parts.pop();
    parts.forEach(emit);
  });
  stream.on('end', () => {
    if (buffer) emit(buffer);
    buffer = '';
  });
}

function startApp(app, ctx, width) {
  const label = app.name.padEnd(width);
  const tag = COLOR ? `${paint(app.color, label)} │ ` : `${label} | `;
  const write = (line) => process.stdout.write(`${tag}${line}\n`);

  // The apps print into a pipe, so tell them the colour this terminal takes.
  // NO_COLOR goes with it, or every node in the tree warns that it lost.
  const env = { ...process.env };
  if (COLOR) {
    env.FORCE_COLOR = '1';
    delete env.NO_COLOR;
  }
  // pnpm (10.33) hands every script `pnpm_config_verify_deps_before_run=false`
  // as a STRING, which a nested pnpm reads as on. Each app's pnpm then checks
  // the install and rewrites node_modules/.pnpm-workspace-state-v1.json, and
  // six of them starting together read it mid write: "Unexpected end of JSON
  // input", and that app never starts. ensureInstalled() already checked.
  delete env.pnpm_config_verify_deps_before_run;
  delete env.npm_config_verify_deps_before_run;
  // `dev:all` brings up the LOCAL stack, so the API and worker read .env.test
  // (2026-10-24), the file that stack is configured from, not .env.development.
  if (app.needsStack) env.APP_ENV = 'test';
  if (app.name === 'mobile' && ctx.lan) {
    env.EXPO_PUBLIC_API_URL = `http://${ctx.lan.address}:${ctx.apiPort}`;
    env.REACT_NATIVE_PACKAGER_HOSTNAME = ctx.lan.address;
  }

  const cmd = pnpmCommand(['--filter', app.pkg, 'run', app.script]);
  const child = spawn(cmd.file, cmd.args, {
    cwd: ROOT,
    env,
    shell: cmd.shell,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    // Its own process group on POSIX, so a stop reaches the whole tree. Never
    // on Windows: there a detached child opens a console window of its own.
    detached: !IS_WINDOWS,
  });
  app.child = child;
  pipeLines(child.stdout, write);
  pipeLines(child.stderr, write);

  child.on('error', (error) => {
    app.exited = true;
    write(paint(31, `could not start: ${error.message}`));
  });
  child.on('exit', (code, signal) => {
    app.exited = true;
    app.exitCode = code;
    if (stopping) return;
    write(
      paint(31, `exited ${signal ? `on ${signal}` : `with code ${code}`}. `) +
        'The other apps keep running; Ctrl+C stops them.',
    );
    if (ctx.apps.every((a) => a.exited)) {
      console.log('\nEvery app has exited.');
      process.exit(1);
    }
  });
}

async function httpOk(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5_000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function httpText(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5_000) });
    return res.ok ? await res.text() : '';
  } catch {
    return '';
  }
}

function probe(app, ctx) {
  if (app.name === 'api') return httpOk(`http://127.0.0.1:${ctx.apiPort}/api/v1/health`);
  if (app.name === 'mobile') {
    return httpText(`http://127.0.0.1:${METRO_PORT}/status`).then((t) => t.includes('packager-status:running'));
  }
  if (app.name === 'worker') return Promise.resolve(true); // no port: running is all there is to see
  return portTaken(app.port);
}

async function waitReady(app, ctx) {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (!stopping && !app.exited && Date.now() < deadline) {
    if (await probe(app, ctx)) return true;
    await sleep(2_000);
  }
  return false;
}

function stateOf(app, ready) {
  if (app.exited) return paint(31, `exited (code ${app.exitCode ?? '?'}); see its lines above`);
  if (!ready) return paint(31, `not answering after ${READY_TIMEOUT_MS / 60_000} minutes; see its lines above`);
  return null;
}

function printServerSummary(servers, results, ctx) {
  const portOf = (name) => servers.find((a) => a.name === name)?.port;
  const where = {
    api: `http://localhost:${ctx.apiPort}/api/v1/health`,
    worker: 'running (queues, no port)',
    web: `http://localhost:${portOf('web')}`,
    app: `http://localhost:${portOf('app')}   the app (its screens, /admin; sign in here)`,
  };
  const order = ['web', 'app', 'api', 'worker'];
  const rows = order
    .map((name) => servers.findIndex((a) => a.name === name))
    .filter((i) => i !== -1)
    .map((i) => `  ${servers[i].name.padEnd(8)}${stateOf(servers[i], results[i]) ?? where[servers[i].name]}`);
  if (ctx.stackStarted) {
    rows.push('  mailpit http://localhost:8025   every mail the API sends');
    if (ctx.minio) rows.push('  minio   http://localhost:9001   object storage console');
  }

  const rule = paint(90, '─'.repeat(72));
  const lines = ['', rule, paint(1, '  injishi is running'), '', ...rows];
  if (servers.some((a) => a.name === 'web')) {
    lines.push(
      '',
      `  Sign in at ${where.web}/sign-in (it hands you to the app) as landlord@injishi.com,`,
      '  host@injishi.com, admin@injishi.com or guest@injishi.com, or pick a demo persona.',
      ctx.fixedCode
        ? '  The code is 123456.'
        : '  The code is random (the API runs as production): read it in Mailpit.',
    );
  }
  lines.push('');
  if (servers.some((a) => a.dir)) lines.push("  A page's first load compiles it, so give it ~20 seconds.");
  lines.push(
    `  Ctrl+C stops ${ctx.apps.length === 1 ? 'it' : 'the apps'}.` +
      (ctx.stackStarted ? ' Docker keeps running: `pnpm dev:stack:down` stops it.' : ''),
    rule,
    '',
  );
  console.log(lines.join('\n'));
}

function printMobileSummary(mobile, ready, ctx) {
  const rule = paint(90, '─'.repeat(72));
  const problem = stateOf(mobile, ready);
  if (problem) {
    console.log(`\n${rule}\n  mobile  ${problem}\n${rule}\n`);
    return;
  }
  const host = ctx.lan?.address ?? 'localhost';
  const url = `exp://${host}:${METRO_PORT}`;
  const lines = ['', rule, paint(1, '  mobile is ready for Expo Go'), '', `  ${url}`];
  if (COLOR) lines.push('', ...qrLines(url));
  lines.push(
    '',
    ctx.lan
      ? `  Scan it with the phone's camera (iOS) or in Expo Go (Android). The phone must be\n` +
          `  on the same network as this PC (${ctx.lan.name}, ${ctx.lan.address}).`
      : '  No LAN address was found, so only an emulator or simulator on this PC can\n' +
          '  reach it. Pass --lan <address> for a phone.',
    '  The first open builds the bundle; that can take two minutes.',
    rule,
    '',
  );
  console.log(lines.join('\n'));
}

async function announce(apps, ctx) {
  const servers = apps.filter((a) => a.name !== 'mobile');
  const mobile = apps.find((a) => a.name === 'mobile');
  const mobileDone = mobile
    ? waitReady(mobile, ctx).then((ready) => !stopping && printMobileSummary(mobile, ready, ctx))
    : Promise.resolve();
  if (servers.length) {
    const results = await Promise.all(servers.map((a) => waitReady(a, ctx)));
    if (!stopping) printServerSummary(servers, results, ctx);
  }
  await mobileDone;
}

// --- Stopping ------------------------------------------------------------------

function killTree(app) {
  return new Promise((resolve) => {
    if (!app.child || app.exited) return resolve();
    app.child.once('exit', () => resolve());
    if (IS_WINDOWS) {
      spawn('taskkill', ['/pid', String(app.child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    } else {
      try {
        process.kill(-app.child.pid, 'SIGTERM');
      } catch {}
      setTimeout(() => {
        try {
          process.kill(-app.child.pid, 'SIGKILL');
        } catch {}
      }, STOP_GRACE_MS).unref();
    }
    setTimeout(resolve, STOP_GRACE_MS + 2_000).unref();
  });
}

function installStopHandlers(apps, minio) {
  const stop = async (signal) => {
    if (stopping) return;
    stopping = true;
    const running = apps.filter((a) => a.child && !a.exited);
    console.log(`\n${signal}: stopping ${running.map((a) => a.name).join(', ') || 'nothing'}`);
    await Promise.all(running.map(killTree));
    const stackStarted = apps.some((a) => a.needsStack);
    console.log(
      stackStarted
        ? `Stopped. Postgres, Redis${minio ? ', MinIO' : ''} and Mailpit are still running in Docker;\n` +
            '`pnpm dev:stack:down` stops them.'
        : 'Stopped.',
    );
    process.exit(0);
  };
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGBREAK']) {
    process.on(signal, () => stop(signal));
  }
  // Last resort when this process dies some other way: leave nothing behind.
  process.on('exit', () => {
    for (const app of apps) {
      if (!app.child || app.exited) continue;
      if (IS_WINDOWS) {
        spawnSync('taskkill', ['/pid', String(app.child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
      } else {
        try {
          process.kill(-app.child.pid, 'SIGKILL');
        } catch {}
      }
    }
  });
}

// --- Main ----------------------------------------------------------------------

async function main() {
  // `pnpm dev:all | more` closed early: nothing left to show, which is no crash.
  process.stdout.on('error', () => {});
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(usage());
    return;
  }

  const apps = APPS.filter((a) => (opts.only ? opts.only.has(a.name) : true) && !opts.skip.has(a.name)).map(
    (a) => ({ ...a }),
  );
  if (!apps.length) throw new StackError('Nothing to start: --only and --skip left no app.');

  const api = resolveApiDir();
  const cfg = readApiEnv(api.dir, api.rel);
  const apiPort = Number(cfg.env.PORT?.trim() || 8000);
  for (const app of apps) {
    if (app.name === 'api') app.port = apiPort;
    else if (app.name === 'mobile') app.port = METRO_PORT;
    else if (app.dir) app.port = nextDevPort(app);
  }

  ensureInstalled();
  await assertPortsFree(apps);

  const stackStarted = apps.some((a) => a.needsStack);
  if (stackStarted) {
    await ensureDockerEngine();
    printPreamble(cfg, assertDockerReady());
    warnAboutEnv(cfg);
    await up(api, cfg, { seed: 'if-needed', summary: false });
  }

  let lan = null;
  if (apps.some((a) => a.name === 'mobile')) {
    lan = opts.lan ? { name: '--lan', address: opts.lan } : lanAddress();
    if (!lan) {
      console.warn(
        "\nWARNING: no LAN address found, so Metro advertises localhost: an emulator on this PC\n" +
          'can open the app, a phone cannot. Pass --lan <address> once you are on a network.',
      );
    }
  }

  const minio = usesMinio(cfg);
  const ctx = { apps, apiPort, lan, stackStarted, minio, fixedCode: !isProductionProcess(cfg) };
  const width = Math.max(...apps.map((a) => a.name.length));
  console.log(
    `\n→ Starting ${apps.map((a) => a.name).join(', ')}. Ctrl+C stops ${apps.length === 1 ? 'it' : 'them all'}.\n`,
  );
  installStopHandlers(apps, minio);
  for (const app of apps) startApp(app, ctx, width);
  await announce(apps, ctx);
}

main().catch((err) => {
  if (err instanceof StackError) {
    console.error(`\ndev-all: ${err.message}`);
  } else {
    console.error(`\ndev-all: unexpected error: ${err?.message ?? err}`);
    if (process.env.DEV_STACK_DEBUG) console.error(err);
  }
  process.exit(1);
});
