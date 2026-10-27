// Holds the verdict check:ci ends with (mobile spec 0001, D-w, AC-12): it always exits 0, whatever it
// can or cannot work out. Which paths count as native needs @expo/fingerprint on a real app, so that
// part is proven by /check verify. Run with `pnpm --filter @injishi/mobile test`.

import assert from "node:assert/strict";
import { after, describe, test } from "node:test";

import { fromApp, makeSandbox, removeSandboxes } from "./test-support/sandbox.mjs";

const sandbox = () =>
  makeSandbox({ "apps/mobile/scripts/fingerprint-verdict.mjs": fromApp("scripts/fingerprint-verdict.mjs") });

describe("fingerprint verdict", { concurrency: true }, () => {
  after(removeSandboxes);

  test("AC-12: gives no verdict and exits 0 when origin/main is not there, as in a shallow clone", () => {
    const { status, output } = sandbox().run("fingerprint-verdict.mjs");
    assert.equal(status, 0);
    assert.match(output, /fingerprint verdict: no verdict: origin\/main is not here to compare with/);
  });

  test("AC-12: says nothing changed when HEAD is origin/main and the tree is clean", () => {
    const box = sandbox();
    box.git("update-ref", "refs/remotes/origin/main", "HEAD");
    const { status, output } = box.run("fingerprint-verdict.mjs");
    assert.equal(status, 0);
    assert.match(output, /fingerprint verdict: nothing changed since origin\/main\./);
  });

  test("AC-12: still exits 0 when the fingerprint itself cannot be worked out", () => {
    const box = sandbox();
    box.git("update-ref", "refs/remotes/origin/main", "HEAD");
    box.write("apps/mobile/src/app/index.tsx", "export default null;\n");
    const { status, output } = box.run("fingerprint-verdict.mjs");
    assert.equal(status, 0);
    assert.match(output, /fingerprint verdict: none, it could not be worked out/);
  });
});
