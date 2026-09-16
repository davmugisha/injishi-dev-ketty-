/**
 * An error the API did not write must never read as the API's answer.
 *
 * While the demo API restarts, the gateway in front of it answers a plain-text
 * `404 page not found`. `apiFetch` used to return that as `refused` 404, and the
 * booking card reads a 404 as "the API holds nothing to sell here", so a guest
 * with dates chosen was told the stay could not be booked online, and stayed
 * told until they reloaded. This pins the two halves of the fix: the gateway's
 * miss is `failed`, the API's own JSON 404 is still `refused`, and a read that
 * failed is asked again before anyone is shown a button.
 *
 * Imports the real `src/lib/api.ts` (Node strips its types) with `fetch`
 * stubbed, so it tests the code the page ships rather than a copy of it.
 *
 * Run: pnpm --filter @injishi/web test
 */
import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";

const { apiFetch, retryWhileFailed } = await import("../src/lib/api.ts");

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

function respond(status, body, contentType) {
  globalThis.fetch = async () =>
    new Response(body, { status, headers: { "content-type": contentType } });
}

describe("apiFetch", () => {
  test("a gateway's plain-text 404 is failed, not a refusal", async () => {
    respond(404, "404 page not found\n", "text/plain; charset=utf-8");
    assert.deepEqual(await apiFetch("/api/v1/properties/slug/x"), { status: "failed" });
  });

  test("a gateway's 502 is failed", async () => {
    respond(502, "Bad Gateway", "text/plain");
    assert.deepEqual(await apiFetch("/api/v1/bookable/x"), { status: "failed" });
  });

  test("the API's own JSON 404 is still refused 404", async () => {
    respond(404, JSON.stringify({ message: "Not Found", statusCode: 404 }), "application/json");
    const result = await apiFetch("/api/v1/properties/slug/x");
    assert.equal(result.status, "refused");
    assert.equal(result.httpStatus, 404);
  });

  test("a JSON answer is ok, and an empty success is ok with null", async () => {
    respond(200, JSON.stringify({ id: "a" }), "application/json");
    assert.deepEqual(await apiFetch("/x"), { status: "ok", data: { id: "a" } });
    respond(204, null, "text/plain");
    assert.deepEqual(await apiFetch("/x"), { status: "ok", data: null });
  });
});

describe("retryWhileFailed", () => {
  const noSleep = async () => {};

  test("asks again after failed, and returns the answer that arrives", async () => {
    const answers = [{ status: "failed" }, { status: "ok", data: 1 }];
    let calls = 0;
    const result = await retryWhileFailed(async () => answers[calls++], [1, 1], noSleep);
    assert.deepEqual(result, { status: "ok", data: 1 });
    assert.equal(calls, 2);
  });

  test("never repeats a refusal", async () => {
    let calls = 0;
    const refusal = { status: "refused", httpStatus: 404, message: "gone" };
    const result = await retryWhileFailed(async () => (calls++, refusal), [1, 1], noSleep);
    assert.equal(result, refusal);
    assert.equal(calls, 1);
  });

  test("gives up after the last delay and reports failed", async () => {
    let calls = 0;
    const result = await retryWhileFailed(async () => (calls++, { status: "failed" }), [1, 1], noSleep);
    assert.deepEqual(result, { status: "failed" });
    assert.equal(calls, 3);
  });
});
