/**
 * Runs the Maestro flows in `.maestro/flows` on an Android device (ADR-062).
 *
 *   pnpm --filter @injishi/mobile e2e                  # both themes
 *   pnpm --filter @injishi/mobile e2e -- --theme dark  # one theme
 *   pnpm --filter @injishi/mobile e2e -- --device emulator-5554 --flow .maestro/flows/sign-in-switch.yaml
 *
 * What it needs running first: the `injishi-lowend` emulator (or a phone on a
 * cable), the development build installed on it, the local API on :8000, and
 * Metro on :8081 started with `EXPO_PUBLIC_API_URL=http://localhost:8000`.
 *
 * **Why `adb reverse`.** It maps the device's own localhost:8081 and :8000 to
 * this machine's, so the emulator and a cabled phone reach Metro and the API
 * with the same settings. Without it an emulator needs 10.0.2.2 and a phone a
 * LAN address, and the API URL is baked into the bundle, so one bundle could not
 * serve both.
 *
 * **Why the theme is set from here.** `adb shell cmd uimode night` flips the
 * system scheme the app follows (its Appearance preference defaults to
 * `system`), so one flow proves both themes without a theme branch in the flow.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(here, '..');
const exe = process.platform === 'win32' ? '.exe' : '';

function arg(name, fallback) {
  const args = process.argv.slice(2).filter((a) => a !== '--');
  const at = args.indexOf(`--${name}`);
  return at >= 0 && args[at + 1] ? args[at + 1] : fallback;
}

function fail(message) {
  console.error(`e2e: ${message}`);
  process.exit(1);
}

/** adb from ANDROID_HOME when set, else whatever is on PATH. */
function adbPath() {
  const home = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT;
  const candidate = home ? path.join(home, 'platform-tools', `adb${exe}`) : null;
  return candidate && existsSync(candidate) ? candidate : `adb${exe}`;
}

/** Maestro from its per-user install on Windows, else whatever is on PATH. */
function maestroPath() {
  if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
    const candidate = path.join(process.env.LOCALAPPDATA, 'Programs', 'maestro', 'bin', 'maestro.bat');
    if (existsSync(candidate)) return candidate;
  }
  return 'maestro';
}

/**
 * Runs a command, quoting every argument for the Windows shell.
 *
 * Maestro is a `.bat` on Windows, and Node runs a `.bat` only through the
 * shell, which joins the arguments with spaces and quotes none of them. This
 * workspace's path has spaces in it, so an unquoted flow path arrives cut off at
 * the first one.
 */
function run(command, args, options = {}) {
  if (process.platform !== 'win32') return spawnSync(command, args, { encoding: 'utf8', ...options });
  const quote = (value) => (/[\s"&|<>^]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
  return spawnSync(quote(command), args.map(quote), { encoding: 'utf8', shell: true, ...options });
}

const adb = adbPath();
const devices = run(adb, ['devices']);
if (devices.status !== 0) fail('adb did not run. Is the Android SDK installed and ANDROID_HOME set?');
const attached = devices.stdout
  .split(/\r?\n/)
  .slice(1)
  .map((line) => line.trim().split(/\s+/))
  .filter(([id, state]) => id && state === 'device')
  .map(([id]) => id);
if (attached.length === 0) {
  fail('no device is attached. Start the emulator (emulator -avd injishi-lowend) or plug in a phone.');
}

const device = arg('device', attached[0]);
if (!attached.includes(device)) fail(`device ${device} is not attached (attached: ${attached.join(', ')}).`);
const onDevice = (args) => run(adb, ['-s', device, ...args]);

/**
 * Maps the device's 8081 and 8000 to this machine's, and checks they took.
 *
 * Run before EACH theme, not once. The rules live on the device's adb link and
 * can be lost while the device stays attached (on 2026-10-01 they vanished
 * between two runs, after another Maestro client lost its link), and an app
 * that cannot reach the API fails a flow with nothing on screen to say why.
 */
function reversePorts() {
  for (const port of ['8081', '8000']) {
    const reverse = onDevice(['reverse', `tcp:${port}`, `tcp:${port}`]);
    if (reverse.status !== 0) fail(`adb reverse for port ${port} failed: ${reverse.stderr.trim()}`);
  }
  const list = onDevice(['reverse', '--list']).stdout ?? '';
  for (const port of ['8081', '8000']) {
    if (!list.includes(`tcp:${port} tcp:${port}`)) fail(`adb reverse for port ${port} did not hold.`);
  }
}

const themeArg = arg('theme', 'both');
if (!['light', 'dark', 'both'].includes(themeArg)) fail('--theme is light, dark or both.');
const themes = themeArg === 'both' ? ['light', 'dark'] : [themeArg];
const flow = path.resolve(appDir, arg('flow', '.maestro/flows'));
const maestro = maestroPath();

const results = [];
for (const theme of themes) {
  reversePorts();
  onDevice(['shell', 'cmd', 'uimode', 'night', theme === 'dark' ? 'yes' : 'no']);
  const out = path.join(os.tmpdir(), 'injishi-maestro', theme);
  mkdirSync(out, { recursive: true });
  console.log(`\ne2e: ${theme} theme on ${device}, output in ${out}`);
  const test = run(
    maestro,
    ['--device', device, 'test', '--env', `THEME=${theme}`, '--test-output-dir', out, flow],
    { stdio: 'inherit', cwd: appDir },
  );
  results.push({ theme, ok: test.status === 0 });
}

onDevice(['shell', 'cmd', 'uimode', 'night', 'no']);
for (const { theme, ok } of results) console.log(`e2e: ${theme} ${ok ? 'passed' : 'FAILED'}`);
process.exit(results.every((r) => r.ok) ? 0 : 1);
