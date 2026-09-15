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

  test(`${label}: the IP backstop is still armed on sign-in`, async () => {
    const auth = build(overrides);
    const refused = await burst(
      auth,
      "/sign-in/email-otp",
      { email: "someone@example.com", otp: "000000" },
      105,
      `203.0.113.${net + 1}`,
    );
    assert.ok(refused > 0, "105 sign-ins in a minute from one IP were never refused: the limiter is off");
  });
}
