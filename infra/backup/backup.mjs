#!/usr/bin/env node
/**
 * Scheduled, verified PostgreSQL backups with a real restore drill and a guarded retention policy.
 *
 *   node backup.mjs --config <backup.config.json> [--target <name>] [--no-drill] [--retention-dry-run]
 *
 * Per target, every run:
 *   1. pg_dump -Fc into a `.partial` file, so a half-written dump can never look like a backup;
 *   2. checks it: pg_restore can list it, it holds table data, it is not suspiciously small;
 *   3. writes `<name>.dump.sha256` (the `sha256sum -c` format) and makes both files read-only;
 *   4. RESTORE DRILL: restores it into a scratch database on the drill server and compares the row count of every
 *      table with what the dump itself contains, then drops the scratch database;
 *   5. applies retention, and only to files this tool made (`<target>_<yyyymmdd>-<hhmmss>.dump`).
 *
 * Exit code: 0 all good; 1 a backup or a drill FAILED; 2 the backup is good but the drill could not run.
 * Credentials are read from files named in the config at run time, handed to the tools through the child
 * process environment only, and scrubbed from everything written to the log. It has no npm dependencies.
 */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, unlinkSync, writeFileSync, chmodSync, appendFileSync } from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { pathToFileURL } from 'node:url';

// ── pure helpers (unit tested) ─────────────────────────────────────────────────────────────────────

const NAME_RE = /^[a-z0-9][a-z0-9-]{0,40}$/;
const DUMP_RE = /^(?<target>[a-z0-9][a-z0-9-]{0,40})_(?<y>\d{4})(?<mo>\d{2})(?<d>\d{2})-(?<h>\d{2})(?<mi>\d{2})(?<s>\d{2})\.dump$/;

/** `2026-11-05T03:09:27` local time -> `20261105-030927`. */
export function stamp(date) {
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`;
}

/** A backup's own file name -> its target and the time it was made, or null for anything else. */
export function parseDumpName(file) {
  const m = DUMP_RE.exec(file);
  if (!m) return null;
  const { target, y, mo, d, h, mi, s } = m.groups;
  return { target, at: new Date(+y, +mo - 1, +d, +h, +mi, +s) };
}

function isoWeekKey(date) {
  const t = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return `${t.getUTCFullYear()}-W${Math.ceil(((t - yearStart) / 86_400_000 + 1) / 7)}`;
}
const dayKey = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

/**
 * Which backups to remove. Everything newer than `keepAllDays` stays; then the newest of each day for `keepDailyDays`;
 * then the newest of each ISO week for `keepWeeklyWeeks`; older goes. The newest `minimumToKeep` are never removed,
 * whatever their age, so a long outage can never leave you with nothing.
 * @param {{ file: string, at: Date }[]} backups
 */
export function planRetention(backups, now, policy) {
  const sorted = [...backups].sort((a, b) => b.at - a.at);
  const keep = new Set(sorted.slice(0, policy.minimumToKeep).map((b) => b.file));
  const seenDay = new Set();
  const seenWeek = new Set();
  const dayMs = 86_400_000;
  for (const b of sorted) {
    const age = (now - b.at) / dayMs;
    if (age < policy.keepAllDays) keep.add(b.file);
    if (age < policy.keepDailyDays && !seenDay.has(dayKey(b.at))) {
      seenDay.add(dayKey(b.at));
      keep.add(b.file);
    }
    if (age < policy.keepWeeklyWeeks * 7 && !seenWeek.has(isoWeekKey(b.at))) {
      seenWeek.add(isoWeekKey(b.at));
      keep.add(b.file);
    }
  }
  return { keep: sorted.filter((b) => keep.has(b.file)).map((b) => b.file), remove: sorted.filter((b) => !keep.has(b.file)).map((b) => b.file) };
}

/** `COPY public.pos_orders (id, ...) FROM stdin;` -> `public.pos_orders`, with quoting removed. */
export function copyTarget(line) {
  const m = /^COPY (?<t>(?:"[^"]+"|[^\s(]+)\.(?:"[^"]+"|[^\s(]+)) /.exec(line);
  return m ? m.groups.t.replace(/"/g, '') : null;
}

/** Replace every known secret in a string. */
export function scrub(text, secrets) {
  let out = String(text);
  for (const s of secrets) if (s && s.length >= 4) out = out.split(s).join('***');
  return out;
}

/** Compare expected and restored row counts; returns the differences. */
export function diffCounts(expected, actual) {
  const problems = [];
  for (const [t, n] of expected) if (!actual.has(t)) problems.push(`${t}: missing after restore`);
  else if (actual.get(t) !== n) problems.push(`${t}: dump has ${n}, restore has ${actual.get(t)}`);
  return problems;
}

// ── running things ────────────────────────────────────────────────────────────────────────────────

function readCredential(cred) {
  const text = readFileSync(cred.file, 'utf8');
  const line = text.split(/\r?\n/).filter((l) => l.startsWith(`${cred.key}=`)).pop();
  if (!line) throw new Error(`credential key ${cred.key} not found in ${cred.file}`);
  const value = line.slice(cred.key.length + 1).trim().replace(/^["']|["']$/g, '');
  if (cred.from === 'databaseUrl') {
    const u = new URL(value);
    return { user: decodeURIComponent(u.username), password: decodeURIComponent(u.password) };
  }
  return { user: undefined, password: value };
}

function run(cmd, args, { env = {}, timeoutMs = 600_000, onLine } = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { env: { ...process.env, ...env }, windowsHide: true });
    let stderr = '';
    const timer = setTimeout(() => child.kill(), timeoutMs);
    child.stderr.on('data', (d) => (stderr += d));
    let stdout = '';
    if (onLine) readline.createInterface({ input: child.stdout }).on('line', onLine);
    else child.stdout.on('data', (d) => (stdout += d));
    child.on('error', (e) => resolve({ code: -1, stdout, stderr: String(e) }));
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}

function sha256(file) {
  return new Promise((resolve, reject) => {
    const h = createHash('sha256');
    createReadStream(file).on('data', (d) => h.update(d)).on('end', () => resolve(h.digest('hex'))).on('error', reject);
  });
}

async function main() {
  const args = process.argv.slice(2);
  const opt = (f) => args.includes(f);
  const val = (f) => (args.includes(f) ? args[args.indexOf(f) + 1] : undefined);
  const configPath = val('--config');
  if (!configPath) throw new Error('usage: backup.mjs --config <file> [--target name] [--no-drill] [--retention-dry-run]');
  const cfg = JSON.parse(readFileSync(configPath, 'utf8'));
  const root = path.resolve(cfg.backupRoot);
  mkdirSync(path.join(root, 'logs'), { recursive: true });

  const secrets = [];
  const creds = new Map();
  const credOf = (c) => {
    const key = `${c.file}|${c.key}`;
    if (!creds.has(key)) {
      const v = readCredential(c);
      creds.set(key, v);
      secrets.push(v.password);
    }
    return creds.get(key);
  };
  const logFile = path.join(root, 'logs', `backup-${stamp(new Date()).slice(0, 8)}.log`);
  const log = (level, msg) => {
    const line = `${new Date().toISOString()} ${level} ${scrub(msg, secrets)}`;
    console.log(line);
    appendFileSync(logFile, `${line}\n`);
  };

  const bin = (name) => path.join(cfg.pgBin, process.platform === 'win32' ? `${name}.exe` : name);
  const policy = { keepAllDays: 3, keepDailyDays: 14, keepWeeklyWeeks: 8, minimumToKeep: 6, ...cfg.retention };
  const only = val('--target');
  const statusPath = path.join(root, 'status.json');
  const status = existsSync(statusPath) ? JSON.parse(readFileSync(statusPath, 'utf8')) : {};
  let failed = false;
  let drillSkipped = false;

  for (const target of cfg.targets.filter((t) => !only || t.name === only)) {
    if (!NAME_RE.test(target.name)) throw new Error(`bad target name ${target.name}`);
    const dir = path.join(root, target.name);
    mkdirSync(dir, { recursive: true });
    const startedAt = new Date();
    const result = { startedAt: startedAt.toISOString(), ok: false };
    try {
      const c = credOf(target.credential);
      const env = { PGPASSWORD: c.password };
      const user = target.user ?? c.user;
      const conn = ['-h', target.host, '-p', String(target.port), '-U', user];
      const finalName = `${target.name}_${stamp(startedAt)}.dump`;
      const finalPath = path.join(dir, finalName);
      const partial = `${finalPath}.partial`;

      // A run killed mid-dump (power cut, logoff) leaves its `.partial` behind. The task may not run longer than an
      // hour and never overlaps itself, so anything older than that is certainly dead: sweep it, only our own names.
      for (const f of readdirSync(dir)) {
        if (!f.endsWith('.dump.partial') || !f.startsWith(`${target.name}_`)) continue;
        if (Date.now() - statSync(path.join(dir, f)).mtimeMs > 60 * 60 * 1000) {
          unlinkSync(path.join(dir, f));
          log('WARN', `${target.name}: removed stale partial dump ${f} (an earlier run was interrupted)`);
        }
      }

      log('INFO', `${target.name}: dumping ${target.database} from ${target.host}:${target.port}`);
      const dump = await run(bin('pg_dump'), [...conn, '-Fc', '-Z', '6', '-d', target.database, '--file', partial], { env });
      if (dump.code !== 0) throw new Error(`pg_dump failed (exit ${dump.code}): ${dump.stderr.trim().split('\n').pop()}`);

      const size = statSync(partial).size;
      let tableData = 0;
      const list = await run(bin('pg_restore'), ['--list', partial], { onLine: (l) => { if (/ TABLE DATA /.test(l)) tableData++; } });
      if (list.code !== 0) throw new Error(`pg_restore cannot read the dump (exit ${list.code})`);
      if (size < (cfg.minBytes ?? 4096)) throw new Error(`dump is only ${size} bytes`);
      if (tableData < (target.minTables ?? 5)) throw new Error(`dump holds only ${tableData} tables of data`);

      const hash = await sha256(partial);
      renameSync(partial, finalPath);
      writeFileSync(`${finalPath}.sha256`, `${hash}  ${finalName}\n`);
      chmodSync(finalPath, 0o444);
      chmodSync(`${finalPath}.sha256`, 0o444);
      Object.assign(result, { file: finalName, bytes: size, tables: tableData, sha256: hash });
      log('INFO', `${target.name}: wrote ${finalName} (${size} bytes, ${tableData} tables, sha256 ${hash.slice(0, 12)}...)`);

      // ── restore drill ──
      if (opt('--no-drill') || !cfg.drill) result.drill = { skipped: 'disabled' };
      else {
        const d = cfg.drill;
        if (!/^injishi_backup_verify$/.test(d.database) || d.database === target.database) throw new Error('drill database name is not the protected scratch name');
        const dc = credOf(d.credential);
        const denv = { PGPASSWORD: dc.password };
        const dconn = ['-h', d.host, '-p', String(d.port), '-U', d.user ?? dc.user];
        const ping = await run(bin('psql'), [...dconn, '-d', 'postgres', '-Atc', 'select 1'], { env: denv, timeoutMs: 15_000 });
        if (ping.code !== 0) {
          result.drill = { skipped: 'the drill server did not answer' };
          drillSkipped = true;
          log('WARN', `${target.name}: restore drill SKIPPED (the drill server ${d.host}:${d.port} did not answer)`);
        } else {
          // What the dump itself contains: the rows of each COPY block, counted as the file is streamed out.
          const expected = new Map();
          let current = null;
          await run(bin('pg_restore'), ['--data-only', '-f', '-', finalPath], {
            onLine: (l) => {
              if (current === null) { if (l.startsWith('COPY ')) { current = copyTarget(l); if (current) expected.set(current, 0); } }
              else if (l === '\\.') current = null;
              else expected.set(current, expected.get(current) + 1);
            },
          });
          const psql = (sql, db = 'postgres') => run(bin('psql'), [...dconn, '-d', db, '-v', 'ON_ERROR_STOP=1', '-Atc', sql], { env: denv, timeoutMs: 120_000 });
          await psql(`DROP DATABASE IF EXISTS ${d.database}`);
          const made = await psql(`CREATE DATABASE ${d.database} TEMPLATE template0 ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C'`);
          if (made.code !== 0) throw new Error('could not create the scratch database');
          const restore = await run(bin('pg_restore'), [...dconn, '-d', d.database, '--exit-on-error', '--no-owner', finalPath], { env: denv, timeoutMs: 1_200_000 });
          const actual = new Map();
          if (restore.code === 0) {
            const q = `select table_schema||'.'||table_name, (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text::bigint from information_schema.tables where table_type='BASE TABLE' and table_schema in ('public','drizzle')`;
            const counts = await run(bin('psql'), [...dconn, '-d', d.database, '-At', '-F', '|', '-c', q], { env: denv });
            for (const row of counts.stdout.split('\n').filter(Boolean)) { const [t, n] = row.split('|'); actual.set(t, Number(n)); }
          }
          await psql(`DROP DATABASE IF EXISTS ${d.database}`);
          if (restore.code !== 0) throw new Error(`restore drill FAILED: pg_restore exit ${restore.code}`);
          const problems = diffCounts(expected, actual);
          if (problems.length) throw new Error(`restore drill FAILED: ${problems.slice(0, 5).join('; ')}`);
          const rows = [...actual.values()].reduce((a, b) => a + b, 0);
          result.drill = { ok: true, tables: actual.size, rows };
          log('INFO', `${target.name}: restore drill passed (${actual.size} tables, ${rows} rows, every count equals the dump's)`);
        }
      }
      result.ok = true;

      // ── retention (this tool's own files only) ──
      const mine = readdirSync(dir).map((f) => ({ f, p: parseDumpName(f) })).filter((x) => x.p && x.p.target === target.name).map((x) => ({ file: x.f, at: x.p.at }));
      const plan = planRetention(mine, new Date(), policy);
      for (const f of plan.remove) {
        const p = path.resolve(dir, f);
        if (path.dirname(p) !== path.resolve(dir) || !DUMP_RE.test(f)) continue; // paranoia
        if (opt('--retention-dry-run')) { log('INFO', `${target.name}: retention would remove ${f}`); continue; }
        for (const victim of [p, `${p}.sha256`]) if (existsSync(victim)) { chmodSync(victim, 0o666); unlinkSync(victim); }
        log('INFO', `${target.name}: retention removed ${f}`);
      }
      result.kept = plan.keep.length;
    } catch (error) {
      result.error = scrub(error instanceof Error ? error.message : error, secrets);
      failed = true;
      log('ERROR', `${target.name}: ${result.error}`);
    }
    result.finishedAt = new Date().toISOString();
    status[target.name] = result;
  }
  writeFileSync(statusPath, JSON.stringify(status, null, 2));
  const code = failed ? 1 : drillSkipped ? 2 : 0;
  log(code === 0 ? 'INFO' : code === 2 ? 'WARN' : 'ERROR', `finished with exit code ${code}`);
  process.exitCode = code;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(`backup failed: ${e instanceof Error ? e.message : e}`);
    process.exitCode = 1;
  });
}
