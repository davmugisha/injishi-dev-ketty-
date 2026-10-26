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

test("the phone app's sign-in plugin is installed, so its origin and Google return are honoured", () => {
  assert.ok(
    plugin(build(), "expo"),
    "expo() is missing: the phone app's requests carry no Origin and are refused, and Google never returns to it",
  );
});

test("a native request's expo-origin stands in for the Origin it cannot send", async () => {
  const expo = plugin(build(), "expo");
  const request = new Request("http://localhost:8000/api/auth/sign-in/email-otp", {
    method: "POST",
    headers: { "expo-origin": "injishi://" },
  });
  const result = await expo.onRequest(request, {});
  assert.equal((result?.request ?? request).headers.get("origin"), "injishi://");
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
// Passwords, as an option beside the code (2026-10-22).
import { STEPPED_UP_PATHS } from "../dist/server.js";
import {
  PASSWORD_MESSAGES,

  newPasswordProblem,
  passwordFailure,
  passwordStrength,
} from "../dist/password.js";

test("passwords are on, but only an email code makes an account", () => {
  const options = build().options.emailAndPassword;
  assert.equal(options.enabled, true);
  assert.equal(options.disableSignUp, true, "sign up by password would let an unproved address hold an account");
  assert.equal(options.minPasswordLength, 8);
  assert.equal(options.maxPasswordLength, 128);
  assert.notEqual(options.revokeSessionsOnPasswordReset, true, "setting a first password would sign the person out");
});

test("signing up with a password is refused", async () => {
  // Every route runs inside a transaction; the refusal comes before any query.
  const db = { transaction: async (work) => work(db) };
  const auth = build({ db, trustedOrigins: ["http://localhost:8000"] });
  const res = await auth.handler(
    new Request("http://localhost:8000/api/auth/sign-up/email", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost:8000" },
      body: JSON.stringify({ email: "new@example.com", password: "long-enough-1", name: "New" }),
    }),
  );
  assert.equal(res.status, 400);
  assert.equal((await res.json()).code, "EMAIL_PASSWORD_SIGN_UP_DISABLED");
});

test("a session lasts 30 days and is extended once a day while in use", () => {
  const session = build().options.session;
  assert.equal(session.expiresIn, 60 * 60 * 24 * 30);
  assert.equal(session.updateAge, 60 * 60 * 24);
});

function steppedUp(path) {
  const before = build().options.databaseHooks.session.create.before;
  const session = { id: "s", userId: "u", token: "t", createdAt: new Date(), updatedAt: new Date(), expiresAt: new Date() };
  return before(session, { path }).then((r) => r.data.twoFactorVerifiedAt instanceof Date);
}

test("a code, a password and a password change are stepped up; Google and phone are not", async () => {
  assert.equal(await steppedUp("/sign-in/email-otp"), true);
  assert.equal(await steppedUp("/sign-in/email"), true);
  assert.equal(await steppedUp("/change-password"), true);
  assert.equal(await steppedUp("/callback/:id"), false);
  assert.equal(await steppedUp("/phone/verify"), false);
  assert.equal(await steppedUp(""), false);
  assert.deepEqual([...STEPPED_UP_PATHS].sort(), ["/change-password", "/sign-in/email", "/sign-in/email-otp"]);
});

test("the password rule: 8 to 128 characters, typed twice the same", () => {
  assert.equal(newPasswordProblem("short", "short"), PASSWORD_MESSAGES.tooShort);
  assert.equal(newPasswordProblem("x".repeat(129), "x".repeat(129)), PASSWORD_MESSAGES.tooLong);
  assert.equal(newPasswordProblem("long-enough", "long-enougH"), PASSWORD_MESSAGES.mismatch);
  assert.equal(newPasswordProblem("long-enough", "long-enough"), null);
});

test("the strength hint grows with length and variety", () => {
  assert.equal(passwordStrength("abc"), "too-short");
  assert.equal(passwordStrength("aaaaaaaa"), "weak");
  assert.equal(passwordStrength("abcdefgh"), "weak");
  assert.equal(passwordStrength("abcdefgh12"), "fair");
  assert.equal(passwordStrength("Kigali-Hills-2026"), "strong");
});

test("a refusal is worded by us, and never says whether an address exists", () => {
  assert.equal(passwordFailure({ code: "INVALID_EMAIL_OR_PASSWORD", status: 401 }), PASSWORD_MESSAGES.wrong);
  assert.equal(passwordFailure({ code: "INVALID_PASSWORD", status: 400 }), PASSWORD_MESSAGES.wrongCurrent);
  assert.equal(passwordFailure({ code: "INVALID_OTP" }), PASSWORD_MESSAGES.codeWrong);
  assert.equal(passwordFailure({ status: 429 }), PASSWORD_MESSAGES.throttled);
  assert.equal(passwordFailure(null), PASSWORD_MESSAGES.failed);
  assert.ok(!/no account|not found|registered/i.test(PASSWORD_MESSAGES.wrong));
});

// Passwords are for tenants only (2026-10-23).
import { credentialGuard, passwordGate, PASSWORD_NOT_OFFERED } from "../dist/password-gate.js";

const tenantsOnly = async (userId) => userId === "tenant";

function refusal(promise) {
  return promise.then(
    () => null,
    (e) => e?.body?.code ?? String(e),
  );
}

test("a first password row is refused unless the user is a tenant", async () => {
  const guard = build({ mayHoldPassword: tenantsOnly }).options.databaseHooks.account.create.before;
  const row = (userId, providerId = "credential") => ({ userId, providerId, accountId: userId });
  assert.equal(await refusal(guard(row("landlord"))), PASSWORD_NOT_OFFERED);
  assert.deepEqual(await guard(row("tenant")), { data: row("tenant") });
  // Google and phone are not passwords, and stay open to everybody.
  assert.deepEqual(await guard(row("landlord", "google")), { data: row("landlord", "google") });
});

test("with no tenancy check, nobody can set a first password", async () => {
  const guard = build().options.databaseHooks.account.create.before;
  assert.equal(await refusal(guard({ userId: "tenant", providerId: "credential" })), PASSWORD_NOT_OFFERED);
  // A check that fails is a no, never a password.
  const broken = credentialGuard(async () => {
    throw new Error("db down");
  });
  assert.equal(await refusal(broken({ userId: "tenant", providerId: "credential" })), PASSWORD_NOT_OFFERED);
});

function gateContext(path, found) {
  return {
    path,
    body: { email: "Someone@Example.rw " },
    context: { internalAdapter: { findUserByEmail: async () => found } },
  };
}

test("a password code is mailed only to a tenant or somebody with a password", async () => {
  const [send] = passwordGate(tenantsOnly).hooks.before;
  // A landlord with no password: the answer an unknown address gets, nothing mailed.
  assert.deepEqual(await send.handler(gateContext("/email-otp/request-password-reset", { user: { id: "landlord" }, accounts: [] })), {
    success: true,
  });
  // A tenant, or anybody who already has a password: through to the real send.
  assert.equal(await send.handler(gateContext("/email-otp/request-password-reset", { user: { id: "tenant" }, accounts: [] })), undefined);
  assert.equal(
    await send.handler(gateContext("/email-otp/request-password-reset", { user: { id: "landlord" }, accounts: [{ providerId: "credential" }] })),
    undefined,
  );
  // An unknown address is Better Auth's to answer, the same way.
  assert.equal(await send.handler(gateContext("/email-otp/request-password-reset", null)), undefined);
  assert.equal(send.matcher({ path: "/forget-password/email-otp" }), true);
  assert.equal(send.matcher({ path: "/email-otp/send-verification-otp" }), false);
});

test("a password reset for a non-tenant with no password reads as a wrong code", async () => {
  const [, reset] = passwordGate(tenantsOnly).hooks.before;
  assert.equal(reset.matcher({ path: "/email-otp/reset-password" }), true);
  assert.equal(await refusal(reset.handler(gateContext("/email-otp/reset-password", { user: { id: "landlord" }, accounts: [] }))), "INVALID_OTP");
  assert.equal(await reset.handler(gateContext("/email-otp/reset-password", { user: { id: "tenant" }, accounts: [] })), undefined);
});

test("the password gate is installed on every instance", () => {
  assert.ok(plugin(build(), "injishi-password-gate"));
  assert.ok(plugin(build({ demoOtpCode: "123456" }), "injishi-password-gate"));
});
