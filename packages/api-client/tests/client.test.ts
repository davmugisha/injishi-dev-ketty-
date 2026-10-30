/**
 * The transport against a real HTTP server on a loopback port, so the request
 * goes through Node's own `fetch` with the options this package passes it, not
 * a stand-in that would accept anything.
 *
 * Run: pnpm --filter @injishi/api-client test
 */
import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, describe, test } from "node:test";

import { createApiClient } from "../src/index.ts";

interface Seen {
  method: string;
  url: string;
  headers: IncomingMessage["headers"];
  body: string;
}

let server: Server;
let baseUrl: string;
let seen: Seen[] = [];

/** Each path answers one way; the request is recorded either way. */
const routes: Record<string, (res: import("node:http").ServerResponse) => void> = {
  "/ok": (res) => json(res, 200, { hello: "world" }),
  "/empty": (res) => res.writeHead(204).end(),
  "/signed-out": (res) => json(res, 401, { message: "Unauthorized" }),
  "/refused": (res) =>
    json(res, 409, { message: "That room was taken a moment ago.", code: "room_taken" }),
  "/already-open": (res) =>
    json(res, 409, {
      message: "Aline is already clocked in since 2026-10-29T04:55:00.000Z.",
      code: "already_open",
      record: { id: "rec-1", clockInAt: "2026-10-29T04:55:00.000Z" },
    }),
  "/framework": (res) => json(res, 403, { message: "Forbidden resource" }),
  "/invalid": (res) =>
    json(res, 400, {
      message: "Validation failed",
      issues: [{ path: ["guest", "phone"], message: "Enter a Rwandan phone number." }],
    }),
  "/gateway": (res) => res.writeHead(404, { "content-type": "text/plain" }).end("404 page not found"),
  "/slow": () => {
    // Never answers; the client's ceiling has to end it.
  },
};

function json(res: import("node:http").ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(body));
}

before(async () => {
  server = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      seen.push({ method: req.method ?? "", url: req.url ?? "", headers: req.headers, body });
      const route = routes[new URL(req.url ?? "/", "http://x").pathname];
      if (route) route(res);
      else json(res, 404, { message: "Not Found" });
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
});

after(() => {
  server.closeAllConnections();
  server.close();
});

const last = () => seen[seen.length - 1];

/**
 * The result with its `serverDate` checked and taken off: Node's server sends a
 * `date` header on every answer, and the exact instant is not what a test pins.
 */
function dated<T extends object>(result: T): Omit<T, "serverDate"> {
  const { serverDate, ...rest } = result as T & { serverDate?: string };
  assert.ok(serverDate && !Number.isNaN(Date.parse(serverDate)), "the answer's date header is carried");
  return rest;
}

describe("createApiClient", () => {
  test("a 200 is ok, carrying the parsed body", async () => {
    const api = createApiClient({ baseUrl });
    assert.deepEqual(dated(await api.request("/ok")), { status: "ok", data: { hello: "world" } });
    assert.equal(last().method, "GET");
  });

  test("a 204 is ok with no data", async () => {
    const api = createApiClient({ baseUrl });
    assert.deepEqual(dated(await api.request("/empty", { method: "DELETE" })), { status: "ok", data: null });
  });

  test("the workspace, the branch and the idempotency key travel as headers", async () => {
    const api = createApiClient({ baseUrl, headers: () => ({ cookie: "injishi-demo.session_token=abc" }) });
    seen = [];
    await api.request("/ok", {
      body: { amount: 5000 },
      workspaceId: "ws-1",
      branchId: "br-2",
      idempotencyKey: "press-3",
      query: { page: 2, q: "", skip: undefined },
    });
    const call = last();
    assert.equal(call.method, "POST", "a body without a method is a POST");
    assert.equal(call.url, "/ok?page=2", "empty and undefined query values are left out");
    assert.equal(call.headers["x-workspace-id"], "ws-1");
    assert.equal(call.headers["x-branch-id"], "br-2");
    assert.equal(call.headers["idempotency-key"], "press-3");
    assert.equal(call.headers.cookie, "injishi-demo.session_token=abc");
    assert.equal(call.headers["content-type"], "application/json");
    assert.equal(call.body, JSON.stringify({ amount: 5000 }));
  });

  test("no idempotency key is invented when the caller did not mint one", async () => {
    const api = createApiClient({ baseUrl });
    await api.request("/ok", { method: "POST", body: {} });
    assert.equal(last().headers["idempotency-key"], undefined);
  });

  test("a 401 is unauthenticated, never failed", async () => {
    const api = createApiClient({ baseUrl });
    assert.deepEqual(await api.request("/signed-out"), { status: "unauthenticated" });
  });

  test("a refusal keeps the API's sentence and its code", async () => {
    const api = createApiClient({ baseUrl });
    assert.deepEqual(dated(await api.request("/refused", { method: "POST", body: {} })), {
      status: "refused",
      httpStatus: 409,
      message: "That room was taken a moment ago.",
      code: "room_taken",
      body: { message: "That room was taken a moment ago.", code: "room_taken" },
    });
  });

  test("a refusal keeps its whole body, for the fields it carries beside the message", async () => {
    const api = createApiClient({ baseUrl });
    const result = await api.request("/already-open", { method: "POST", body: {} });
    assert.equal(result.status, "refused");
    assert.equal(result.status === "refused" && result.code, "already_open");
    assert.deepEqual(result.status === "refused" && (result.body as { record?: unknown }).record, {
      id: "rec-1",
      clockInAt: "2026-10-29T04:55:00.000Z",
    });
  });

  test("framework text is not passed off as a message for a person", async () => {
    const api = createApiClient({ baseUrl });
    assert.deepEqual(dated(await api.request("/framework")), {
      status: "refused",
      httpStatus: 403,
      body: { message: "Forbidden resource" },
    });
  });

  test("a validation refusal carries its field issues, and the first one is the message", async () => {
    const api = createApiClient({ baseUrl });
    const issues = [{ path: ["guest", "phone"], message: "Enter a Rwandan phone number." }];
    assert.deepEqual(dated(await api.request("/invalid", { method: "POST", body: {} })), {
      status: "refused",
      httpStatus: 400,
      message: "Enter a Rwandan phone number.",
      issues,
      body: { message: "Validation failed", issues },
    });
  });

  test("a plain text error is the gateway, so it is failed rather than refused", async () => {
    const api = createApiClient({ baseUrl });
    assert.deepEqual(await api.request("/gateway"), { status: "failed" });
  });

  test("an answer that never comes is failed at the ceiling", async () => {
    const api = createApiClient({ baseUrl, timeoutMs: 100 });
    assert.deepEqual(await api.request("/slow"), { status: "failed" });
  });

  test("the ceiling holds in a runtime without AbortSignal.timeout, as React Native is", async () => {
    const native = AbortSignal.timeout;
    Object.defineProperty(AbortSignal, "timeout", { value: undefined, configurable: true, writable: true });
    try {
      const api = createApiClient({ baseUrl, timeoutMs: 100 });
      assert.deepEqual(await api.request("/slow"), { status: "failed" });
      assert.equal(dated(await api.request("/ok")).status, "ok");
    } finally {
      Object.defineProperty(AbortSignal, "timeout", { value: native, configurable: true, writable: true });
    }
  });

  test("query values are encoded, so a date range or a search survives the trip", async () => {
    const api = createApiClient({ baseUrl });
    await api.request("/ok", { query: { from: "2026-10-29", q: "room 2&3", ok: false } });
    assert.equal(last().url, "/ok?from=2026-10-29&q=room%202%263&ok=false");
  });

  test("an unreachable API is failed", async () => {
    const api = createApiClient({ baseUrl: "http://127.0.0.1:1" });
    assert.deepEqual(await api.request("/ok"), { status: "failed" });
  });

  test("requestParsed returns the schema's data, and failed when the body does not match", async () => {
    const api = createApiClient({ baseUrl });
    const greeting = {
      safeParse: (input: unknown) =>
        input && typeof input === "object" && (input as { hello?: unknown }).hello === "world"
          ? { success: true as const, data: { hello: "world" as const } }
          : { success: false as const },
    };
    const never = { safeParse: () => ({ success: false as const }) };
    assert.deepEqual(dated(await api.requestParsed(greeting, "/ok")), { status: "ok", data: { hello: "world" } });
    assert.deepEqual(await api.requestParsed(never, "/ok"), { status: "failed" });
    assert.deepEqual(await api.requestParsed(never, "/signed-out"), { status: "unauthenticated" });
  });
});
