import assert from "node:assert/strict";
import { test } from "node:test";
import { assertFixtureWrite, FixtureWriteRefused, fixtureWritesAllowed } from "./guard.ts";

test("the demo build writes, whatever NODE_ENV says", () => {
  assert.equal(fixtureWritesAllowed({ NEXT_PUBLIC_INJISHI_ENVIRONMENT: "demo", NODE_ENV: "production" }), true);
});

test("production and staging builds refuse (both are baked NEXT_PUBLIC_INJISHI_ENVIRONMENT=production)", () => {
  assert.equal(fixtureWritesAllowed({ NEXT_PUBLIC_INJISHI_ENVIRONMENT: "production", NODE_ENV: "production" }), false);
  assert.throws(
    () => assertFixtureWrite({ NEXT_PUBLIC_INJISHI_ENVIRONMENT: "production", NODE_ENV: "production" }),
    FixtureWriteRefused,
  );
});

test("a production build with the variable unset refuses: unset never means the demo", () => {
  assert.equal(fixtureWritesAllowed({ NODE_ENV: "production" }), false);
});

test("a laptop's next dev writes, because its store is its own file", () => {
  assert.equal(fixtureWritesAllowed({ NODE_ENV: "development" }), true);
  assert.doesNotThrow(() => assertFixtureWrite({ NODE_ENV: "development" }));
});
