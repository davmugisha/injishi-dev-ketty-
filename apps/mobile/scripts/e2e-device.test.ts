/**
 * The device test rig's link check and settle check (ADR-062).
 *
 * `e2e.mjs` reads two things around each Maestro pass, and both fail quietly
 * when they are wrong. The transport id is how a failed pass says the adb link
 * dropped under it: read wrongly, every pass looks like a drop, or a real drop
 * is blamed on the app. The settle check is what stopped passes starting on a
 * saturated emulator on 2026-10-11: one that lets a busy device through brings
 * those failures back, and one that never stops waiting hangs the run.
 *
 * The emulator fixtures are real output from `injishi-lowend` on this Windows
 * machine, line endings included: adb on Windows ends every line with CRLF,
 * and `devices -l` pads the serial into a column. The phone lines are built the
 * same way, because no phone was attached to capture one.
 *
 * Traceability: ADR-062's AC-2 (the flow passes with the e2e command) and AC-3
 * (both themes from one command) are runs on a device, and `/check verify`
 * proves them there. `covers:` below names the criterion whose rig logic a
 * block pins, not a claim that the criterion is proven here.
 */
import {
  SETTLE_CEILING_MS,
  SETTLE_POLL_MS,
  coresFrom,
  loadFrom,
  transportIdFrom,
  waitForSettle,
} from './e2e-device.mjs';

/** `adb devices -l` with the rig's emulator attached, captured 2026-10-11. */
const EMULATOR =
  'emulator-5554          device product:sdk_gphone64_x86_64 model:sdk_gphone64_x86_64 device:emu64xa transport_id:13\r\n';

/** A Pixel 3a on wireless debugging, padded to the same column. */
const PHONE = '192.168.1.50:41235     device product:sargo model:Pixel_3a device:sargo transport_id:14\r\n';

/** What `adb devices -l` prints around the device lines. */
const listing = (...lines: string[]) => `List of devices attached\r\n${lines.join('')}\r\n`;

// covers: AC-2. A failed pass whose transport id changed is reported as the
// rig losing the device, so these reads decide who a failure is blamed on.
describe('transportIdFrom', () => {
  it('reads the transport id adb gave the emulator', () => {
    expect(transportIdFrom(listing(EMULATOR), 'emulator-5554')).toBe('13');
  });

  it('reads the named device when a phone is listed beside the emulator', () => {
    const both = listing(EMULATOR, PHONE);

    expect(transportIdFrom(both, '192.168.1.50:41235')).toBe('14');
    expect(transportIdFrom(both, 'emulator-5554')).toBe('13');
  });

  it('does not read a longer serial listed above the named one that begins the same way', () => {
    // Wireless debugging takes a new port on each connection, so one phone can
    // be listed twice, and port 41235 begins with the digits of port 4123.
    const otherPort = '192.168.1.50:4123      device product:sargo model:Pixel_3a device:sargo transport_id:15\r\n';

    expect(transportIdFrom(listing(PHONE, otherPort), '192.168.1.50:4123')).toBe('15');
  });

  it('returns null when the device is not listed or adb printed nothing', () => {
    // After a drop the emulator leaves the listing; when adb itself fails,
    // its stdout is empty, or null when it could not be started at all.
    expect(transportIdFrom(listing(), 'emulator-5554')).toBeNull();
    expect(transportIdFrom('', 'emulator-5554')).toBeNull();
    expect(transportIdFrom(null, 'emulator-5554')).toBeNull();
  });
});

// covers: AC-3. These feed the settle check that lets the second theme's pass
// start on a quiet device.
describe('loadFrom', () => {
  it('reads the one minute figure, the first of the three /proc/loadavg prints', () => {
    expect(loadFrom('0.22 0.31 1.00 1/1760 32623\r\n')).toBe(0.22);
  });
});

describe('coresFrom', () => {
  it('reads the core count nproc printed, line ending and all', () => {
    expect(coresFrom('2\r\n')).toBe(2);
    expect(coresFrom('8\r\n')).toBe(8);
  });

  it('assumes the two cores of the rig emulator when nproc printed nothing', () => {
    expect(coresFrom('')).toBe(2);
    expect(coresFrom(null)).toBe(2);
  });
});

/**
 * A clock that moves only when the code under test sleeps, so a three minute
 * wait runs in no time and the waits it asked for can be read back. It throws
 * rather than let a loop that never stops hang the test.
 */
function fakeClock() {
  let time = 0;
  const sleeps: number[] = [];
  return {
    now: () => time,
    sleep: (ms: number) => {
      if (sleeps.length >= 1000) throw new Error('slept 1000 times without stopping');
      sleeps.push(ms);
      time += ms;
    },
    sleeps,
  };
}

/** A device whose load reads `values` in order, then the last one forever. */
function loadsOf(...values: number[]) {
  let reads = 0;
  return () => values[Math.min(reads++, values.length - 1)];
}

// covers: AC-3. Switching to dark makes every app on the device redraw, and a
// pass started into that load is the one that used to fail.
describe('waitForSettle', () => {
  let clock: ReturnType<typeof fakeClock>;

  beforeEach(() => {
    clock = fakeClock();
  });

  const settle = (readLoad: () => number, cores: number) =>
    waitForSettle({ readLoad, cores, now: clock.now, sleep: clock.sleep });

  it('starts at once on a device that is already quiet', () => {
    const result = settle(loadsOf(0.22), 2);

    expect(result).toEqual({ settled: true, load: 0.22, waitedMs: 0 });
    expect(clock.sleeps).toEqual([]);
  });

  it('waits while the device is busy and starts once the load drops under the limit', () => {
    const result = settle(loadsOf(3.9, 3.2, 2.4), 2);

    expect(result).toEqual({ settled: true, load: 2.4, waitedMs: 2 * SETTLE_POLL_MS });
    expect(clock.sleeps).toEqual([SETTLE_POLL_MS, SETTLE_POLL_MS]);
  });

  it('counts a load of exactly one and a half per core as still busy', () => {
    const result = settle(loadsOf(3, 2.99), 2);

    expect(result.settled).toBe(true);
    expect(result.load).toBe(2.99);
    expect(clock.sleeps).toHaveLength(1);
  });

  it('allows a device with more cores a higher load', () => {
    expect(settle(loadsOf(5.5), 8).settled).toBe(true);
    expect(settle(loadsOf(5.5), 2).settled).toBe(false);
  });

  it('stops waiting at the ceiling and reports the device still busy, so the pass runs anyway', () => {
    // A slow device is still a device the flows have to work on, so the
    // ceiling ends the wait without failing the run.
    const result = settle(loadsOf(3.6), 2);

    expect(result.settled).toBe(false);
    expect(result.load).toBe(3.6);
    expect(result.waitedMs).toBeGreaterThanOrEqual(SETTLE_CEILING_MS);
    expect(result.waitedMs).toBeLessThan(SETTLE_CEILING_MS + SETTLE_POLL_MS);
  });

  it('does not take a load it could not read for a settled device', () => {
    // When adb cannot reach the device, `adb shell cat /proc/loadavg` prints
    // its error to stderr and nothing to stdout (seen 2026-10-11 against a
    // serial adb did not know). That is the moment the link is in doubt, so it
    // must not read as a quiet device and start the pass at once.
    const unreadable = () => loadFrom('');

    expect(settle(unreadable, 2).settled).toBe(false);
  });
});
