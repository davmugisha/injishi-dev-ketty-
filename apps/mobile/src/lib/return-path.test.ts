// The sign in return's allowlist (mobile spec 0005, the guest shell child's tests), under `node --test`.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { isReturnPath, landingAfterSignIn } from "./return-path.ts";

describe("isReturnPath", () => {
  test("accepts the guest's own screens", () => {
    for (const ok of [
      "/guest/property/x",
      "/guest/explore?q=kivu&sort=price_asc",
      "/guest/trips",
      "/guest/property/a?save=1",
    ]) {
      assert.equal(isReturnPath(ok), true, ok);
    }
  });

  test("refuses anything that leaves the guest shell or the app", () => {
    const bad = [
      "https://evil.example/guest/x",
      "//evil.example/guest/x",
      "/staff",
      "/staff/task",
      "/guest",
      "/guest/../staff",
      "/guest/\\evil",
      "/guest/a b",
      "/guest/a\nb",
      "guest/property/x",
      "",
      null,
      undefined,
      42,
      `/guest/${"a".repeat(600)}`,
    ];
    for (const path of bad) assert.equal(isReturnPath(path), false, String(path));
  });
});

describe("landingAfterSignIn", () => {
  test("a guest goes back to the kept path", () => {
    assert.equal(
      landingAfterSignIn({ pending: "/guest/property/x", isGuest: true, home: "/guest" }),
      "/guest/property/x",
    );
  });

  test("a staff persona goes to its own home, whatever was kept", () => {
    assert.equal(landingAfterSignIn({ pending: "/guest/property/x", isGuest: false, home: "/staff" }), "/staff");
  });

  test("nothing kept, or a refused path, is the home", () => {
    assert.equal(landingAfterSignIn({ pending: null, isGuest: true, home: "/guest" }), "/guest");
    assert.equal(landingAfterSignIn({ pending: "//evil", isGuest: true, home: "/guest" }), "/guest");
  });
});
