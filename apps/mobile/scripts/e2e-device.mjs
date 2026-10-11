/**
 * What the device test rig reads from the device around each Maestro pass, and
 * how it decides the device is quiet enough to start one (ADR-062).
 *
 * Kept apart from `e2e.mjs` so it can be tested. That script talks to adb from
 * its first line and exits on a refusal, so a test cannot import it. Nothing
 * here runs a command: adb's output arrives as text, and the clock as
 * arguments. The tests are `e2e-device.test.ts`.
 */

/** How long a pass waits for the device to settle before it runs anyway. */
export const SETTLE_CEILING_MS = 180_000;

/** How long the settle check waits between two reads of the load. */
export const SETTLE_POLL_MS = 5_000;

/** Settled means a one minute load under this much per core. */
export const SETTLED_LOAD_PER_CORE = 1.5;

/**
 * The transport id `adb devices -l` prints for `device`, or null when the
 * device is not in the listing.
 *
 * The space after the serial is the column padding `-l` prints, and it is what
 * stops one serial matching a longer one that begins with it.
 */
export function transportIdFrom(listing, device) {
  const line = (listing ?? '').split(/\r?\n/).find((l) => l.startsWith(`${device} `));
  return /transport_id:(\d+)/.exec(line ?? '')?.[1] ?? null;
}

/**
 * The one minute load average: the first field of `/proc/loadavg`. NaN when
 * adb printed nothing, as it does when it cannot reach the device, so a load it
 * never read cannot pass for a quiet device. `Number` would read that empty
 * output, or a bare line ending, as 0.
 */
export function loadFrom(loadavg) {
  return Number.parseFloat(loadavg ?? '');
}

/** The core count `nproc` printed, or 2 when it printed nothing usable. */
export function coresFrom(nproc) {
  return Number((nproc ?? '').trim()) || 2;
}

/**
 * Reads the load until it is under `SETTLED_LOAD_PER_CORE` per core, waiting
 * `pollMs` between reads, and stops once `ceilingMs` has passed. It never fails
 * a run: at the ceiling it returns with `settled` false, and the caller runs
 * the pass anyway.
 *
 * `readLoad`, `sleep` and `now` are the device and the clock, passed in so the
 * loop can be tested without either.
 */
export function waitForSettle({
  readLoad,
  cores,
  sleep,
  now = Date.now,
  ceilingMs = SETTLE_CEILING_MS,
  pollMs = SETTLE_POLL_MS,
}) {
  const limit = cores * SETTLED_LOAD_PER_CORE;
  const started = now();
  let load = Number.NaN;
  for (;;) {
    load = readLoad();
    if (load < limit || now() - started >= ceilingMs) break;
    sleep(pollMs);
  }
  return { settled: load < limit, load, waitedMs: now() - started };
}
