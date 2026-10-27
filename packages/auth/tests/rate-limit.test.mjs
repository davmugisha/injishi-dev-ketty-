// Runs against the committed dist/, like server.test.mjs.
//
// Its own file because Better Auth arms its rate limiter only under
// NODE_ENV=production, read when the instance is built, and node --test gives
// every file its own process: setting it here cannot leak into the other tests.
import assert from "node:assert/strict";
import { test } from "node:test";

process.env.NODE_ENV = "production";
const { createAuth } = await import("../dist/server.js");

const BASE = "http://localhost:8000";
const LIMITER_MESSAGE = "Too many requests. Please try again later.";

function build(overrides = {}) {
  return createAuth({
    db: {},
    secret: "test-secret-that-is-long-enough-for-better-auth-0123456789",
    baseURL: BASE,
    trustedOrigins: [BASE],
    sendOtp: async () => {},
    ...overrides,
  });
}

/** POST `path` n times from ONE client IP; returns how many the IP limiter refused. */
async function burst(auth, path, body, n, ip) {
  let refusedByLimiter = 0;
  for (let i = 0; i < n; i += 1) {
    const res = await auth.handler(
      new Request(`${BASE}/api/auth${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: BASE, "x-forwarded-for": ip },
        body: JSON.stringify(body),
      }),
    );
    const text = await res.text();
    if (res.status === 429 && text.includes(LIMITER_MESSAGE)) refusedByLimiter += 1;
  }
  return refusedByLimiter;
}

// Better Auth keeps its in-memory counts in one module-level map, shared by
// every instance in this process, so each test gets an IP no other test uses.
for (const [label, overrides, net] of [
  ["production", {}, 10],
  ["demo", { demoOtpCode: "123456" }, 20],
]) {
  test(`${label}: twenty people behind one IP can all verify a code inside a minute`, async () => {
    const auth = build(overrides);
    const refused = await burst(
      auth,
      "/sign-in/email-otp",
      { email: "someone@example.com", otp: "000000" },
      20,
      `203.0.113.${net}`,
    );
    assert.equal(refused, 0, `the IP limiter refused ${refused} of 20 sign-ins from one shared IP`);
  });

}

test("production: the IP backstop is still armed on sign-in", async () => {
  const auth = build();
  const refused = await burst(
    auth,
    "/sign-in/email-otp",
    { email: "someone@example.com", otp: "000000" },
    105,
    "203.0.113.11",
  );
  assert.ok(refused > 0, "105 sign-ins in a minute from one IP were never refused: the limiter is off");
});

// The demo's code is fixed and published, so it has no IP limiter at all.
test("demo: no IP limiter, even at 105 sign-ins a minute", async () => {
  const auth = build({ demoOtpCode: "123456" });
  const refused = await burst(
    auth,
    "/sign-in/email-otp",
    { email: "someone@example.com", otp: "000000" },
    105,
    "203.0.113.21",
  );
  assert.equal(refused, 0, `the demo refused ${refused} of 105 sign-ins: its limiter is still on`);
});
// A password can be guessed, so its route keeps Better Auth's own per-IP limit
// on `/sign-in/*` (3 in 10 seconds) in production.
test("production: password sign-in is limited per IP", async () => {
  const auth = build();
  const refused = await burst(
    auth,
    "/sign-in/email",
    { email: "someone@example.com", password: "not-the-password" },
    10,
    "203.0.113.12",
  );
  assert.ok(refused > 0, "10 password guesses in a few seconds from one IP were never refused");
});

test("production: changing a password is limited per IP too", async () => {
  const auth = build();
  const refused = await burst(
    auth,
    "/change-password",
    { currentPassword: "a-guess-123", newPassword: "another-1234" },
    10,
    "203.0.113.13",
  );
  assert.ok(refused > 0, "10 current-password guesses from one IP were never refused");
});
