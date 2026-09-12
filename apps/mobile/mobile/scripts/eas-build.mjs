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
 */
import { spawnSync } from 'node:child_process';

// pnpm hands the `--` separator through as a literal argument and eas rejects
// it as a stray positional, so it is dropped here.
const passthrough = process.argv.slice(2).filter((arg) => arg !== '--');
const hasPlatform = passthrough.includes('--platform') || passthrough.includes('-p');

const args = ['eas', 'build', '--profile', 'development'];
if (!hasPlatform) args.push('--platform', 'android');
args.push(...passthrough);

const result = spawnSync('npx', args, {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, EAS_NO_VCS: '1' },
});

process.exit(result.status ?? 1);
