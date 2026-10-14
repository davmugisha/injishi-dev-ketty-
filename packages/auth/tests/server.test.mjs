// Runs against the committed dist/, which is what every image and app imports,
// so a src/ edit that nobody rebuilt fails here rather than on a device.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
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

// Resolved through the context Better Auth builds, which is where its default
// (`enabled ?? isProduction`) is applied. Better Auth reads NODE_ENV once, when
// its module loads, so this runs in a fresh process under the NODE_ENV every
// image runs rather than flipping the variable in this one.
async function rateLimitEnabled(overrides) {
  const script = `
    import { createAuth } from ${JSON.stringify(new URL("../dist/server.js", import.meta.url).href)};
    const auth = createAuth({
      db: {},
      secret: "test-secret-that-is-long-enough-for-better-auth-0123456789",
      baseURL: "http://localhost:8000",
      sendOtp: async () => {},
      ...${JSON.stringify(overrides)},
    });
    process.stdout.write(JSON.stringify((await auth.$context).rateLimit.enabled));
  `;
  const out = execFileSync(process.execPath, ["--input-type=module", "-e", script], {
    env: { ...process.env, NODE_ENV: "production" },
    encoding: "utf8",
  });
  return JSON.parse(out.trim().split("\n").pop());
}

test("production keeps Better Auth's per-IP sign-in limiter", async () => {
  assert.equal(await rateLimitEnabled({}), true);
});

test("the demo instance has no per-IP sign-in limiter, so a training room is not refused", async () => {
  assert.equal(await rateLimitEnabled({ demoOtpCode: "123456" }), false);
});

test("OTP codes are still stored hashed", () => {
  const otp = plugin(build(), "email-otp");
  assert.ok(otp, "emailOTP plugin missing");
  assert.equal(otp.options?.storeOTP, "hashed");
});

// ADR-063 AC-12: Better Auth's routes are mounted outside Nest, so their faults
// reach the API's crash reporter only through this hook.
import { APIError } from "better-auth/api";

function hookWith(onServerError) {
  return build({ onServerError }).options.onAPIError?.onError;
}

function recordingLogger() {
  const lines = [];
  return { lines, logger: { error: (...args) => lines.push(args) } };
}

test("with no reporter, Better Auth's own error handling is left alone", () => {
  assert.equal(build().options.onAPIError, undefined);
});

test("a fault reaches the reporter, after Better Auth's own log line", () => {
  const seen = [];
  const { lines, logger } = recordingLogger();
  const fault = new TypeError("sendOtp failed");
  hookWith((error) => seen.push(error))(fault, { logger });
  assert.deepEqual(seen, [fault]);
  assert.deepEqual(lines, [["TypeError", fault]]);
});

test("a 500 APIError is a fault; an answer below 500 never is", () => {
  const seen = [];
  const { lines, logger } = recordingLogger();
  const onError = hookWith((error) => seen.push(error));
  const internal = new APIError("INTERNAL_SERVER_ERROR");
  onError(new APIError("BAD_REQUEST", { message: "Invalid OTP" }), { logger });
  onError(new APIError("TOO_MANY_REQUESTS"), { logger });
  onError(new APIError("FORBIDDEN", { message: "Invalid origin" }), { logger });
  onError(internal, { logger });
  assert.deepEqual(seen, [internal]);
  assert.deepEqual(lines, [["INTERNAL_SERVER_ERROR", internal]]);
});

test("a schema error logs its message, as Better Auth does, and is reported", () => {
  const seen = [];
  const { lines, logger } = recordingLogger();
  const fault = new Error('relation "verifications" does not exist');
  hookWith((error) => seen.push(error))(fault, { logger });
  assert.deepEqual(lines, [['relation "verifications" does not exist']]);
  assert.deepEqual(seen, [fault]);
});

test("a reporter that throws never makes the hook throw", () => {
  const onError = hookWith(() => {
    throw new Error("reporter down");
  });
  assert.doesNotThrow(() => onError(new Error("fault"), { logger: { error: () => {} } }));
});
