/**
 * `eas build` for this app, with the archive kept small.
 *
 * When the project sits inside a git checkout, EAS Build archives it in git
 * mode and ships the whole `.git` directory along, whatever `.easignore` says.
 * Here that is a 151 MB object pack, and the first upload of it died mid-way
 * with ECONNRESET. `EAS_NO_VCS=1` switches EAS to plain file collection, which
 * honours the root `.easignore` and leaves `.git` at home: the same build goes
 * from 152 MB to 24 MB.
 *
 * A script rather than a documented env var because `VAR=1 cmd` is not a thing
 * in PowerShell, and this repo is built from Windows. Extra flags pass through:
 *
 *   pnpm --filter @injishi/mobile build:dev
 *   pnpm --filter @injishi/mobile build:dev -- --platform ios
 *   pnpm --filter @injishi/mobile build:dev -- --profile preview
 *
 * `--profile` picks the `eas.json` profile, `development` by default. A
 * `preview` build is the release build the rig's release mode installs
 * (ADR-063); its Sentry upload needs `SENTRY_AUTH_TOKEN` in EAS.
 *
 * **A release profile without an API address is refused HERE, before EAS
 * spends a build on it.** `src/lib/env.ts` throws at launch when
 * `EXPO_PUBLIC_API_URL` is unset, so such a build compiled, installed, and then
 * crashed on its first frame with nothing able to report it (mobile audit
 * 2026-10-05, SA-28; scope feature 24: "a missing API address fails the build
 * rather than the launch"). `production` must also point at an https origin
 * that is not a LAN address. `development` reads a local `.env` and is exempt.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// pnpm hands the `--` separator through as a literal argument and eas rejects
// it as a stray positional, so it is dropped here.
const given = process.argv.slice(2).filter((arg) => arg !== '--');
const profileAt = given.indexOf('--profile');
const profile = profileAt >= 0 && given[profileAt + 1] ? given[profileAt + 1] : 'development';
const passthrough = profileAt >= 0 ? given.filter((_, i) => i !== profileAt && i !== profileAt + 1) : given;
const hasPlatform = passthrough.includes('--platform') || passthrough.includes('-p');

/** The profile's env, following `extends` the way EAS does (parent first). */
function profileEnv(build, name, seen = new Set()) {
  const entry = build?.[name];
  if (!entry || seen.has(name)) return {};
  seen.add(name);
  const parent = entry.extends ? profileEnv(build, entry.extends, seen) : {};
  return { ...parent, ...(entry.env ?? {}) };
}

if (profile !== 'development') {
  const easJson = JSON.parse(readFileSync(new URL('../eas.json', import.meta.url), 'utf8'));
  const apiUrl = (profileEnv(easJson.build, profile).EXPO_PUBLIC_API_URL ?? '').trim();
  const lan = /^https?:\/\/(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i;
  const problem = !apiUrl
    ? `the "${profile}" profile in eas.json sets no EXPO_PUBLIC_API_URL, so the app would crash on launch`
    : profile === 'production' && (!apiUrl.startsWith('https://') || lan.test(apiUrl))
      ? `the "production" profile points at ${apiUrl}, which is not a public https origin`
      : null;
  if (problem) {
    console.error(`Refusing to build: ${problem}. Set it in eas.json under build.${profile}.env.`);
    process.exit(1);
  }
}

const args = ['eas', 'build', '--profile', profile];
if (!hasPlatform) args.push('--platform', 'android');
args.push(...passthrough);

const result = spawnSync('npx', args, {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, EAS_NO_VCS: '1' },
});

process.exit(result.status ?? 1);
