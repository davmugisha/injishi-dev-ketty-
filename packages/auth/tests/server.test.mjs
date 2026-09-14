// Runs against the committed dist/, which is what every image and app imports,
// so a src/ edit that nobody rebuilt fails here rather than on a device.
import assert from "node:assert/strict";
import { test } from "node:test";

import { createAuth } from "../dist/server.js";

function build(overrides = {}) {
  return createAuth({
    // Never queried: these tests read the configuration, not the tables.
    db: {},
    secret: "test-secret-that-is-long-enough-for-better-auth-0123456789",
    baseURL: "http://localhost:8000",
    sendOtp: async () => {},
    ...overrides,
  });
}

function plugin(auth, id) {
  return auth.options.plugins.find((p) => p.id === id);
}

test("the native app's session plugin is installed and refuses an unsigned token (ADR-038)", () => {
  const bearer = plugin(build(), "bearer");
  assert.ok(bearer, "bearer() is missing: mobile never receives set-auth-token and every signed-in call is a 401");
  assert.equal(bearer.options?.requireSignature, true);
});

test("the demo instance carries the same session plugin", () => {
  assert.ok(plugin(build({ demoOtpCode: "123456" }), "bearer"));
});

test("OTP codes are still stored hashed", () => {
  const otp = plugin(build(), "email-otp");
  assert.ok(otp, "emailOTP plugin missing");
  assert.equal(otp.options?.storeOTP, "hashed");
});
