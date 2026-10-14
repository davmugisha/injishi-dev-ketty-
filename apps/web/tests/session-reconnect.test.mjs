/**
 * A gate that waits on the session must outlast an API restart, and must not
 * blame the visitor's connection for one.
 *
 * `/register` used to ask for the session once, give up after six seconds, and
 * say "Check your connection and try again". The connection was fine every time
 * it was measured: `api:dev` respawns and is gone for about thirty seconds, and
 * a deployed API mid restart sits behind a gateway that answers a CORS-less
 * `404 page not found`, which the browser reports as a network failure. This
 * pins the two halves of the fix in `src/lib/session-reconnect.ts`: a schedule
 * long enough to outlast a restart but short enough to admit an outage, and a
 * choice of screen that names the visitor's network only when the browser says
 * it has none.
 *
 * Imports the real module (Node strips its types), so it tests the code the
 * page ships rather than a copy of it.
 *
 * Run: pnpm --filter @injishi/web test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const { RECONNECT_DELAYS_MS, nextReconnectDelay, gateView } = await import(
  "../src/lib/session-reconnect.ts"
);

const HERE = dirname(fileURLToPath(import.meta.url));

/** Read one `= 12_345;` style millisecond constant out of a source file. */
function msConstant(path, name) {
  const source = readFileSync(path, "utf8");
  const match = new RegExp(`${name}\\s*=\\s*([0-9_]+)`).exec(source);
  assert.ok(match, `${name} not found in ${path} — did it get renamed?`);
  return Number(match[1].replace(/_/g, ""));
}

const SESSION_TIMEOUT_MS = msConstant(
  resolve(HERE, "..", "src", "lib", "session.ts"),
  "SESSION_TIMEOUT_MS",
);

/** A dev restart, measured 2026-09-28: both Nest watchers respawned, ~30 s dark. */
const MEASURED_RESTART_MS = 30_000;

describe("the reconnect schedule", () => {
  test("gives one gap per retry, then stops", () => {
    for (let n = 0; n < RECONNECT_DELAYS_MS.length; n++) {
      const delay = nextReconnectDelay(n);
      assert.equal(typeof delay, "number");
      assert.ok(delay > 0, `retry ${n} has no gap`);
    }
    assert.equal(nextReconnectDelay(RECONNECT_DELAYS_MS.length), null);
    assert.equal(nextReconnectDelay(RECONNECT_DELAYS_MS.length + 5), null);
    assert.equal(nextReconnectDelay(-1), null);
  });

  test("backs off rather than hammering an API that is booting", () => {
    for (let n = 1; n < RECONNECT_DELAYS_MS.length; n++) {
      assert.ok(
        RECONNECT_DELAYS_MS[n] >= RECONNECT_DELAYS_MS[n - 1],
        `gap ${n} (${RECONNECT_DELAYS_MS[n]} ms) is shorter than gap ${n - 1}`,
      );
    }
  });

  test("outlasts a restart even when every lookup fails fast", () => {
    // The shortest the run can be: every lookup refused at once, so only the
    // gaps count. A CORS-less gateway 404 and ECONNREFUSED both fail fast.
    const fastest = RECONNECT_DELAYS_MS.reduce((a, b) => a + b, 0);
    assert.ok(
      fastest >= MEASURED_RESTART_MS,
      `the run gives up after ${fastest} ms, inside a ${MEASURED_RESTART_MS} ms restart`,
    );
  });

  test("admits an outage within a minute and a half, even when every lookup hangs", () => {
    // The longest the run can be: every lookup waits out the session ceiling.
    const slowest =
      RECONNECT_DELAYS_MS.reduce((a, b) => a + b, 0) +
      (RECONNECT_DELAYS_MS.length + 1) * SESSION_TIMEOUT_MS;
    assert.ok(slowest <= 90_000, `a person waits ${slowest} ms before being told`);
  });
});

describe("which screen the gate shows", () => {
  const spent = RECONNECT_DELAYS_MS.length;

  test("an answer wins over everything, even a browser that says offline", () => {
    assert.equal(gateView("anonymous", 0, true), "anonymous");
    assert.equal(gateView("authenticated", 0, true), "authenticated");
    assert.equal(gateView("anonymous", spent, false), "anonymous");
    assert.equal(gateView("authenticated", spent, false), "authenticated");
  });

  test("the first lookup is still checking", () => {
    assert.equal(gateView("loading", 0, true), "checking");
    assert.equal(gateView("loading", 0, false), "checking");
  });

  test("unreachable while online keeps reconnecting until the schedule is spent", () => {
    for (let n = 0; n < spent; n++) {
      assert.equal(gateView("unreachable", n, true), "reconnecting", `retry ${n}`);
    }
    assert.equal(gateView("unreachable", spent, true), "down");
  });

  test("unreachable while the browser reports no network is offline, at any point", () => {
    assert.equal(gateView("unreachable", 0, false), "offline");
    assert.equal(gateView("unreachable", spent, false), "offline");
  });
});
