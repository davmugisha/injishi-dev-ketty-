import { existsSync } from 'node:fs';
import path from 'node:path';

/**
 * Which env file the API reads (2026-10-24). One file per environment, next to
 * this package's package.json:
 *
 *   .env.development   your laptop's API against the hosted dev services
 *   .env.test          the local disposable stack (`pnpm dev:stack`) and tests
 *   .env.production    never on a laptop: deployed stacks get their variables
 *                      from Dokploy (`infra/docker/dokploy.env.example`)
 *
 * `APP_ENV` picks the file. It is not `NODE_ENV`, which says how the code runs,
 * and not `INJISHI_ENVIRONMENT`, which says which platform this is (ADR-043).
 * Unset, it follows `NODE_ENV`, so Jest reads the test file and a production
 * image the production one, and anything else is development.
 *
 * Only that one file is read, never a second one underneath it, so a value
 * left in another environment's file can never leak in. A checkout that still
 * has only the old single `.env` keeps working on it until it is split.
 * Variables already in the process (Docker, Dokploy, the shell) always win.
 */

export const APP_ENVS = ['development', 'test', 'production'] as const;
export type AppEnv = (typeof APP_ENVS)[number];

/** The file the old setup used, read only when the environment has no file. */
export const LEGACY_ENV_FILE = '.env';

export function appEnv(env: NodeJS.ProcessEnv = process.env): AppEnv {
  const chosen = env.APP_ENV?.trim();
  if (chosen) {
    if ((APP_ENVS as readonly string[]).includes(chosen)) return chosen as AppEnv;
    throw new Error(
      `APP_ENV is "${chosen}". It must be one of ${APP_ENVS.join(', ')}: it picks ` +
        'which env file the API reads (.env.development, .env.test, .env.production).',
    );
  }
  const node = env.NODE_ENV?.trim();
  if (node === 'production' || node === 'test') return node;
  return 'development';
}

export function envFileName(name: AppEnv): string {
  return `.env.${name}`;
}

/**
 * The files to hand `ConfigModule.forRoot({ envFilePath })`: the environment's
 * own file, or the legacy `.env` when that is all there is. Empty when neither
 * exists, which is right for a container whose variables come from outside.
 */
export function envFilesFor(
  dir: string = process.cwd(),
  env: NodeJS.ProcessEnv = process.env,
  exists: (file: string) => boolean = existsSync,
): string[] {
  const own = path.join(dir, envFileName(appEnv(env)));
  if (exists(own)) return [own];
  const legacy = path.join(dir, LEGACY_ENV_FILE);
  return exists(legacy) ? [legacy] : [];
}
