/**
 * Sign-in's pure decisions: where a person lands, the writes that clear a session cookie without the API,
 * and the session rows the account screen shows.
 *
 *   pnpm --filter @injishi/app exec tsx --test tests/*.test.ts
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { homeHref, personas, screens } from "@injishi/data";
import { destinationAfterSignIn, homeAfterSignIn, WEB_HOME, WEB_URL } from "../src/lib/return-to";
import { describeDevice, lastActive, sessionRow } from "../src/lib/sessions";
import { expiredAuthCookies } from "../src/server/session-cookies";

test("a real person with no business grant lands on web's personal workspace, not the demo guest's trip", () => {
  assert.equal(WEB_HOME, `${WEB_URL}/trips`);
  assert.equal(homeAfterSignIn("guest", "alice@example.com"), WEB_HOME);
  assert.equal(homeAfterSignIn("guest", null), WEB_HOME);
  assert.equal(destinationAfterSignIn("guest", "", "alice@example.com"), WEB_HOME);
});

test("the demo's own guest keeps her story, and business people keep their workspace", () => {
  assert.equal(homeAfterSignIn("guest", personas.guest.email), homeHref("guest"));
  assert.equal(homeAfterSignIn("guest", personas.guest.email.toUpperCase()), homeHref("guest"));
  assert.equal(homeAfterSignIn("owner", "owner@example.com"), homeHref("owner"));
  assert.equal(destinationAfterSignIn("owner", "", "owner@example.com"), homeHref("owner"));
});

test("a floor role borrowing the waiter's shell lands on its own live screen", () => {
  // A real cashier lands on the live floor, a cook on the station board (the home `accountFor` works out
  // from the role and its grants); the demo waiter keeps her home.
  assert.equal(homeAfterSignIn("waiter", "cashier1@pos.demo.injishi.com", screens.PosFloor.href), "/pos/floor");
  assert.equal(
    destinationAfterSignIn("waiter", "", "kitchen1@pos.demo.injishi.com", { home: screens.PosStations.href }),
    "/pos/stations",
  );
  assert.equal(homeAfterSignIn("waiter", personas.waiter.email), homeHref("waiter"));
  // A return target the shell may open still wins over the role's landing.
  assert.equal(
    destinationAfterSignIn("waiter", "/pos/shift", "cashier1@pos.demo.injishi.com", { home: screens.PosFloor.href }),
    "/pos/shift",
  );
});

test("each role lands on its own home: broker on /broker, never the account page", () => {
  assert.equal(homeAfterSignIn("broker", "broker@injishi.test"), "/broker");
  assert.equal(homeAfterSignIn("landlord", "amani.landlord@injishi.test"), "/residence");
  assert.equal(homeAfterSignIn("tenant", "tenant@injishi.test"), "/home");
  assert.equal(homeAfterSignIn("owner", "guesthouse.owner@injishi.test"), "/owner");
  assert.equal(homeAfterSignIn("officer", "leader@injishi.test"), "/officer");
  assert.equal(homeAfterSignIn("ops", "admin@injishi.test"), "/admin");
});

test("an explicit return target still wins over the home", () => {
  // `next=` paths are this app's screens: one the person may open is honoured as it stands.
  assert.equal(destinationAfterSignIn("guest", "/trips", "alice@example.com"), "/trips");
  assert.equal(
    destinationAfterSignIn("guest", `${WEB_URL}/claim-org?token=x`, "a@b.co"),
    `${WEB_URL}/claim-org?token=x`,
  );
  assert.equal(destinationAfterSignIn("guest", "https://evil.example/x", "a@b.co"), WEB_HOME);
});

test("a property setup page is honoured although it is no screen, and only that exact shape", () => {
  // web's "Set up your property" sends the owner here; the page itself refuses a workspace not theirs.
  const setup = "/w/0f9a1b00-0000-4000-8000-000000000001/setup";
  assert.equal(destinationAfterSignIn("guest", setup, "owner@example.com"), setup);
  assert.equal(destinationAfterSignIn("owner", `${setup}?step=rooms`, "owner@example.com"), `${setup}?step=rooms`);
  assert.equal(destinationAfterSignIn("owner", `${setup}/extra`, "owner@example.com"), homeHref("owner"));
  assert.equal(destinationAfterSignIn("owner", "/w/not-a-uuid/setup", "owner@example.com"), homeHref("owner"));
});

test("clearing without the API writes on the parent domain, Secure for a __Secure- cookie", () => {
  const writes = expiredAuthCookies(
    ["__Secure-better-auth.session_token", "better-auth.session_data", "ij_otp", "theme"],
    ".injishi.com",
  );
  assert.deepEqual(
    writes.map((c) => c.name),
    ["__Secure-better-auth.session_token", "better-auth.session_data"],
  );
  const [token, data] = writes;
  assert.equal(token.domain, ".injishi.com");
  assert.equal(token.secure, true);
  assert.equal(token.maxAge, 0);
  assert.equal(token.value, "");
  assert.equal(token.path, "/");
  assert.equal(data.secure, false);
  assert.equal(data.domain, ".injishi.com");
});

test("locally, with no cookie domain, the clearing writes are host-only", () => {
  const [token] = expiredAuthCookies(["better-auth.session_token"], undefined);
  assert.equal("domain" in token, false);
  assert.equal(token.maxAge, 0);
});

test("a session row names the device from its user agent", () => {
  assert.deepEqual(
    describeDevice(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
    ),
    { device: "Chrome on Windows", icon: "Display" },
  );
  assert.deepEqual(
    describeDevice(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    ),
    { device: "Safari on iPhone", icon: "Smartphone" },
  );
  assert.deepEqual(
    describeDevice(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0",
    ),
    { device: "Edge on Windows", icon: "Display" },
  );
  assert.deepEqual(
    describeDevice(
      "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36",
    ),
    { device: "Chrome on Android", icon: "Smartphone" },
  );
  assert.deepEqual(
    describeDevice(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.0.0 Safari/537.36",
    ),
    { device: "Chrome on Windows", icon: "Display" },
  );
  assert.deepEqual(describeDevice("node"), { device: "Unknown device", icon: "Display" });
  assert.deepEqual(describeDevice(null), { device: "Unknown device", icon: "Display" });
});

test("a session row says when it was last used, and claims no place it does not know", () => {
  const now = new Date("2026-10-22T12:00:00Z");
  assert.equal(lastActive("2026-10-22T11:59:30Z", now, true), "Active now");
  assert.equal(lastActive("2026-10-22T11:30:00Z", now, false), "30 minutes ago");
  assert.equal(lastActive("2026-10-22T09:00:00Z", now, false), "3 hours ago");
  assert.equal(lastActive("2026-10-21T09:00:00Z", now, false), "Yesterday");
  assert.equal(lastActive("2026-10-19T09:00:00Z", now, false), "3 days ago");
  const row = sessionRow(
    {
      id: "s1",
      userAgent: null,
      ipAddress: null,
      createdAt: "2026-10-22T05:58:00Z",
      updatedAt: "2026-10-22T11:00:00Z",
      current: false,
    },
    now,
  );
  assert.equal(row.place, "Unknown network");
  // Kigali is UTC+2.
  assert.equal(row.since, "22 Oct, 07:58");
  assert.equal(row.last, "1 hour ago");
});
