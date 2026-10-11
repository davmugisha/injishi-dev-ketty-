/**
 * Runs the Maestro flows in `.maestro/flows` on an Android device (ADR-062).
 *
 *   pnpm --filter @injishi/mobile e2e                  # both themes
 *   pnpm --filter @injishi/mobile e2e -- --theme dark  # one theme
 *   pnpm --filter @injishi/mobile e2e -- --device emulator-5554 --flow .maestro/flows/sign-in-switch.yaml
 *
 * **Release mode** (ADR-063 Build plan task 2), for what only a release build
 * can show, crash reporting first among them:
 *
 *   pnpm --filter @injishi/mobile e2e -- --release --apk path/to/preview.apk
 *   pnpm --filter @injishi/mobile e2e -- --release --flow .maestro/crash/js-error.yaml
 *
 * It installs an EAS `preview` APK with `adb install -r` (removing the
 * development build first when Android refuses the install over it), skips
 * Metro and `adb reverse` because a release build carries its own bundle and
 * talks to the demo API, and runs the flows in `.maestro/crash/`, which a
 * default run never touches. Light theme unless `--theme` says otherwise.
 * Without `--apk` it runs against whatever release build is installed.
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

// What a pass reads from the device lives beside this file so a test can import
// it. Everything there is a pure function; everything here runs adb and Maestro.
// See `scripts/e2e-device.mjs`.
import { coresFrom, loadFrom, transportIdFrom, waitForSettle } from './e2e-device.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(here, '..');
const exe = process.platform === 'win32' ? '.exe' : '';

function arg(name, fallback) {
  const args = process.argv.slice(2).filter((a) => a !== '--');
  const at = args.indexOf(`--${name}`);
  return at >= 0 && args[at + 1] ? args[at + 1] : fallback;
}

/** Whether a bare flag such as `--release` was passed. */
function flag(name) {
  return process.argv.slice(2).includes(`--${name}`);
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

/** Blocks for `ms`. The runner is synchronous from top to bottom. */
function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * The device's adb transport id, or null when it is not attached. The id is
 * new every time adb reconnects, so a change across a pass means the link
 * dropped during it.
 */
function transportId() {
  return transportIdFrom(run(adb, ['devices', '-l']).stdout, device);
}

/**
 * Clears the device's background, then waits for it to settle. Run before
 * EACH pass, after its theme is set.
 *
 * On the two core emulator the rig was failing passes for reasons that had
 * nothing to do with the app (2026-10-11): the emulator dropped its adb link
 * mid step and Maestro lost the device, System UI stopped responding, and the
 * app was killed for not finishing its startup. Every one of those passes had
 * started on a saturated device. Switching to dark makes every app on it
 * redraw, which kept the one minute load above 3 for 100 s, and Maestro used
 * to start straight into that. Expo Go, which previews the app on this same
 * emulator, sat in the background holding 650 MB of its 2.4 GB. Started on a
 * quiet device, both themes passed.
 *
 * Settled means a one minute load under 1.5 per core. A device that never
 * gets there runs anyway after three minutes, with a warning: a slow device is
 * still a device the flows have to work on.
 */
function quietDevice() {
  onDevice(['shell', 'am', 'force-stop', 'host.exp.exponent']);
  onDevice(['shell', 'am', 'kill-all']);
  const cores = coresFrom(onDevice(['shell', 'nproc']).stdout);
  const { settled, load, waitedMs } = waitForSettle({
    readLoad: () => loadFrom(onDevice(['shell', 'cat', '/proc/loadavg']).stdout),
    cores,
    sleep,
  });
  const waited = Math.round(waitedMs / 1000);
  console.log(
    settled
      ? `e2e: device settled in ${waited} s (load ${load} on ${cores} cores)`
      : `e2e: device still busy after ${waited} s (load ${load} on ${cores} cores); running anyway`,
  );
}

const APP_ID = 'rw.injishi.mobile';
const release = flag('release');

/**
 * Installs a release APK over whatever is on the device. Android refuses to
 * replace a build signed with another key (the development build) or to go
 * down a version, so on either refusal the old app is removed and the install
 * tried once more. Removing it wipes its data, which is the point: a release
 * run starts signed out.
 */
function installRelease(apk) {
  if (!existsSync(apk)) fail(`no APK at ${apk}.`);
  console.log(`e2e: installing ${apk} on ${device}`);
  let install = onDevice(['install', '-r', apk]);
  const refused = `${install.stdout ?? ''}${install.stderr ?? ''}`;
  if (install.status !== 0 && /INSTALL_FAILED_(UPDATE_INCOMPATIBLE|VERSION_DOWNGRADE)/.test(refused)) {
    console.log('e2e: the installed build will not be replaced; removing it first.');
    onDevice(['uninstall', APP_ID]);
    install = onDevice(['install', apk]);
  }
  if (install.status !== 0) fail(`adb install failed: ${`${install.stdout ?? ''}${install.stderr ?? ''}`.trim()}`);
}

if (release) {
  const apk = arg('apk', null);
  if (apk) installRelease(path.resolve(process.cwd(), apk));
} else if (arg('apk', null)) {
  fail('--apk installs a release build, so it needs --release.');
}

const themeArg = arg('theme', release ? 'light' : 'both');
if (!['light', 'dark', 'both'].includes(themeArg)) fail('--theme is light, dark or both.');
const themes = themeArg === 'both' ? ['light', 'dark'] : [themeArg];
const flow = path.resolve(appDir, arg('flow', release ? '.maestro/crash' : '.maestro/flows'));
const maestro = maestroPath();

const results = [];
for (const theme of themes) {
  // A release build has no Metro to reach and talks to the demo API itself.
  if (!release) reversePorts();
  onDevice(['shell', 'cmd', 'uimode', 'night', theme === 'dark' ? 'yes' : 'no']);
  const out = path.join(os.tmpdir(), 'injishi-maestro', theme);
  mkdirSync(out, { recursive: true });
  console.log(`\ne2e: ${theme} theme on ${device}, output in ${out}`);
  quietDevice();
  const linkBefore = transportId();
  const test = run(
    maestro,
    ['--device', device, 'test', '--env', `THEME=${theme}`, '--test-output-dir', out, flow],
    { stdio: 'inherit', cwd: appDir },
  );
  // Maestro reports a dropped link as whatever step it was on, or with no
  // reason at all, so say it here: that failure is the rig, not the app.
  const linkAfter = transportId();
  const dropped = linkBefore !== linkAfter;
  if (dropped) {
    console.log(
      `e2e: the device's adb link dropped during the ${theme} pass (transport ${linkBefore} to ${linkAfter ?? 'none'}). ` +
        'Maestro lost the device there, so this pass says nothing about the app.',
    );
  }
  results.push({ theme, ok: test.status === 0, dropped });
}

onDevice(['shell', 'cmd', 'uimode', 'night', 'no']);
for (const { theme, ok, dropped } of results) {
  console.log(`e2e: ${theme} ${ok ? 'passed' : dropped ? 'FAILED (adb link dropped)' : 'FAILED'}`);
}
process.exit(results.every((r) => r.ok) ? 0 : 1);
