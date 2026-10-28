/**
 * Which env file a script reads (2026-10-24): the scripts' half of
 * src/shared/config/env-files.ts, kept in plain JS because these run with
 * `node`, not through Nest.
 *
 *   .env.development   the hosted dev services
 *   .env.test          the local disposable stack (`pnpm dev:stack`)
 *   .env.production    never on a laptop
 *
 * `APP_ENV` picks the file, as it does for the API. ONE DIFFERENCE, on
 * purpose: unset, a script reads the TEST file, never development. Seeds and
 * verify scripts write rows, and the development file points at a database
 * the whole team shares, so aiming one there has to be said out loud:
 *
 *   APP_ENV=development node scripts/seed-content.mjs
 *
 * As in the API, only that one file is read; the old single `.env` is the
 * fallback while a checkout still has nothing else. Variables already in the
 * process always win.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const API_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const APP_ENVS = ['development', 'test', 'production'];

/** The environment a script runs against: APP_ENV, else test. */
export function scriptEnv(env = process.env) {
  const chosen = env.APP_ENV?.trim();
  if (!chosen) return 'test';
  if (!APP_ENVS.includes(chosen)) {
    throw new Error(`APP_ENV is "${chosen}". It must be one of ${APP_ENVS.join(', ')}.`);
  }
  return chosen;
}

/** The absolute path of the file a script reads, or null when there is none. */
export function apiEnvFile(env = process.env, dir = API_DIR) {
  const own = path.join(dir, `.env.${scriptEnv(env)}`);
  if (existsSync(own)) return own;
  const legacy = path.join(dir, '.env');
  return existsSync(legacy) ? legacy : null;
}

/** KEY=VALUE lines, `#` comments, optional quotes and `export`. */
export function parseEnvText(text) {
  const values = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    let value = m[2];
    const quoted = /^(['"])(.*)\1$/.exec(value);
    value = quoted ? quoted[2] : value.replace(/\s+#.*$/, '').trim();
    values[m[1]] = value;
  }
  return values;
}

/**
 * Fill `process.env` from the script's env file without overriding anything
 * already set. Returns the file read (or null), for a script that says so.
 */
export function loadApiEnv(env = process.env) {
  const file = apiEnvFile(env);
  if (!file) return null;
  for (const [key, value] of Object.entries(parseEnvText(readFileSync(file, 'utf8')))) {
    if (env[key] === undefined) env[key] = value;
  }
  return file;
}

/** One variable: the process's, else the env file's, else undefined. */
export function apiEnvValue(key, env = process.env) {
  if (env[key]) return env[key];
  const file = apiEnvFile(env);
  return file ? parseEnvText(readFileSync(file, 'utf8'))[key] : undefined;
}
