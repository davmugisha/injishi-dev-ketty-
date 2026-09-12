/**
 * The browser's give-up ceiling has to sit above what the API is allowed to
 * spend, and this pins the one way that breaks.
 *
 * `AUTH_TIMEOUT_MS` in `src/lib/otp-core.ts` is the only thing standing between
 * a visitor and an infinite spinner, so it exists for a good reason. But it was
 * chosen by watching a HUNG port — ADR-017's check blocks 8000 and waits for the
 * button to come back — and never by adding up what a HEALTHY send costs. Those
 * are different numbers, nothing linked them, and at 12 s the ceiling had drifted
 * under the API's own budget.
 *
 * What that looked like: `/email-otp/send-verification-otp` answered 200 with the
 * code delivered, 17.7 s after a cold start, while the browser had already given
 * up at 12 s and told the visitor the sign-in service was not responding. The
 * message was false, and it stranded them on /sign-in holding a live code with
 * no screen to type it into.
 *
 * So the ceiling is not a free number. It has to clear every part of the round
 * trip the API may legitimately spend time in, and this test adds those parts up
 * from where they are actually defined. Lower the web ceiling, or raise the mail
 * ceiling on the API, and one side silently starts calling the other broken —
 * unless this fails first.
 *
 * Run: pnpm --filter @injishi/web test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

const OTP_CORE = resolve(HERE, "..", "src", "lib", "otp-core.ts");
const OTP_MAILER = resolve(
  HERE,
  "..",
  "..",
  "..",
  "server",
  "api",
  "src",
  "modules",
  "auth",
  "infrastructure",
  "otp-mailer.ts",
);

/** Read one `= 12_345;` style millisecond constant out of a source file. */
function msConstant(path, name) {
  const source = readFileSync(path, "utf8");
  const match = new RegExp(`${name}\\s*=\\s*([0-9_]+)`).exec(source);
  assert.ok(match, `${name} not found in ${path} — did it get renamed?`);
  return Number(match[1].replace(/_/g, ""));
}

/**
 * The parts of the round trip the API may legitimately spend, measured against
 * the dev stack rather than guessed.
 *
 * The database wake is the one that broke this. Neon suspends its compute after
 * roughly five minutes idle and drops the connections it was holding, so the
 * next query pays the full wake — and on a sign-in page the sign-in IS the first
 * query anyone makes. One measured wake took 15.7 s against 0.4 s warm. It is
 * written here rather than imported because nothing in either app declares it:
 * it is a property of the hosted database, not of our code.
 */
const DATABASE_WAKE_MS = 15_722;

/** Better Auth's own reads and writes: a few remote round trips at ~0.4 s. */
const AUTH_QUERY_BUDGET_MS = 2_000;

describe("auth timeout budget", () => {
  test("the web ceiling clears the API's whole budget for the same request", () => {
    const webCeiling = msConstant(OTP_CORE, "AUTH_TIMEOUT_MS");
    const mailCeiling = msConstant(OTP_MAILER, "SEND_TIMEOUT_MS");

    // Better Auth awaits the delivery hook inside the request, so the mailer's
    // own ceiling is spent before the endpoint can answer at all. It is not a
    // parallel cost.
    const apiWorstCase =
      DATABASE_WAKE_MS + AUTH_QUERY_BUDGET_MS + mailCeiling;

    assert.ok(
      webCeiling > apiWorstCase,
      `AUTH_TIMEOUT_MS is ${webCeiling} ms but the API may legitimately spend ` +
        `${apiWorstCase} ms (${DATABASE_WAKE_MS} database wake + ` +
        `${AUTH_QUERY_BUDGET_MS} auth queries + ${mailCeiling} mail). A ceiling ` +
        `under that sum makes a working API report as a dead one, and sends the ` +
        `visitor a code they are then told does not exist.`,
    );
  });

  test("the ceiling is still one number, and lib/otp.ts has no copy", () => {
    // AC-13: both transports import the ceiling, neither restates it. A second
    // copy is how the two halves of sign-in start disagreeing.
    for (const file of ["otp.ts", "otp.server.ts"]) {
      const source = readFileSync(resolve(HERE, "..", "src", "lib", file), "utf8");
      assert.equal(
        /AUTH_TIMEOUT_MS\s*=/.test(source),
        false,
        `${file} declares its own AUTH_TIMEOUT_MS — it must import the one in otp-core.ts`,
      );
    }
  });
});
