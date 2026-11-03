// The seam's decisions (proto-ui, PLAN.md "Data seam"), under `node --test`: the mode switch, the
// forced prototype states, the not wired answer, and the keys an action refreshes.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { dataModeFrom } from "../lib/data-mode.ts";
import {
  actionDefaults,
  actionPlan,
  forcedState,
  invalidationKeys,
  queryDefaults,
  readPlan,
  type SourceImpl,
  sourceKey,
} from "./source-rules.ts";

const impl: SourceImpl<string[]> = {
  mock: () => ["204", "205"],
  empty: () => [],
  api: async () => ["real"],
};

describe("the mode", () => {
  test("only the exact word mock turns the sample data on", () => {
    assert.equal(dataModeFrom("mock"), "mock");
    assert.equal(dataModeFrom(" mock\n"), "mock");
    assert.equal(dataModeFrom(undefined), "api");
    assert.equal(dataModeFrom(""), "api");
    assert.equal(dataModeFrom("api"), "api");
    assert.equal(dataModeFrom("Mock"), "api");
    assert.equal(dataModeFrom("mocks"), "api");
  });
});

describe("forced states", () => {
  test("mock mode reads loading, empty and error from the URL", () => {
    assert.equal(forcedState("mock", "loading"), "loading");
    assert.equal(forcedState("mock", "empty"), "empty");
    assert.equal(forcedState("mock", "error"), "error");
    assert.equal(forcedState("mock", ["error", "loading"]), "error");
  });

  test("anything else is no forced state", () => {
    assert.equal(forcedState("mock", undefined), null);
    assert.equal(forcedState("mock", ""), null);
    assert.equal(forcedState("mock", "offline"), null);
    assert.equal(forcedState("mock", 1), null);
  });

  test("api mode never forces a state", () => {
    assert.equal(forcedState("api", "loading"), null);
    assert.equal(forcedState("api", "error"), null);
  });
});

describe("reads", () => {
  test("mock mode answers at once from the sample data", () => {
    const plan = readPlan("mock", null, impl);
    assert.equal(plan.kind, "now");
    assert.deepEqual(plan.kind === "now" && plan.read(), ["204", "205"]);
  });

  test("forced empty uses the empty answer, else the sample data", () => {
    const plan = readPlan("mock", "empty", impl);
    assert.deepEqual(plan.kind === "now" && plan.read(), []);
    const noEmpty = readPlan("mock", "empty", { mock: () => ["only"] });
    assert.deepEqual(noEmpty.kind === "now" && noEmpty.read(), ["only"]);
  });

  test("forced loading never answers and forced error fails", () => {
    assert.equal(readPlan("mock", "loading", impl).kind, "never");
    assert.equal(readPlan("mock", "error", impl).kind, "fail");
  });

  test("mock mode never calls the API, even where a real call exists", () => {
    const calls: string[] = [];
    const plan = readPlan("mock", null, {
      mock: () => 1,
      api: async () => {
        calls.push("api");
        return 2;
      },
    });
    assert.equal(plan.kind, "now");
    assert.deepEqual(calls, []);
  });

  test("api mode calls the real read", async () => {
    const plan = readPlan("api", null, impl);
    assert.equal(plan.kind, "api");
    assert.deepEqual(plan.kind === "api" && (await plan.read()), ["real"]);
  });

  test("api mode with no real read is not wired, whatever the URL says", () => {
    assert.equal(readPlan("api", null, { mock: () => 1 }).kind, "not-wired");
    assert.equal(readPlan("api", forcedState("api", "loading"), { mock: () => 1 }).kind, "not-wired");
  });
});

describe("writes", () => {
  test("mock mode runs the sample data's own change", () => {
    const plan = actionPlan("mock", { mock: (room: string) => `done ${room}`, api: async () => "real" });
    assert.equal(plan.kind, "mock");
    assert.equal(plan.kind === "mock" && plan.run("204"), "done 204");
  });

  test("api mode runs the real write, or is not wired", async () => {
    const wired = actionPlan("api", { mock: () => "mock", api: async () => "real" });
    assert.equal(wired.kind === "api" && (await wired.run(undefined)), "real");
    assert.equal(actionPlan("api", { mock: () => "mock" }).kind, "not-wired");
  });
});

describe("keys", () => {
  test("the cache key wraps the screen's key with the mode and the forced state", () => {
    assert.deepEqual(sourceKey(["housekeeper", "today"], "mock", null), [
      "source",
      "housekeeper",
      "today",
      "mock",
      null,
    ]);
    assert.deepEqual(sourceKey(["guest", "trips"], "mock", "empty"), ["source", "guest", "trips", "mock", "empty"]);
  });

  test("an action's prefixes invalidate under the seam's root, so they match every mode and state", () => {
    const [prefix] = invalidationKeys([["housekeeper"]]);
    const key = sourceKey(["housekeeper", "today"], "mock", "error");
    assert.deepEqual(key.slice(0, prefix.length), prefix);
    assert.deepEqual(invalidationKeys(undefined), []);
  });
});

describe("query options", () => {
  test("sample data never goes stale, is not retried and never waits for signal", () => {
    assert.deepEqual(queryDefaults("mock"), {
      staleTime: Number.POSITIVE_INFINITY,
      retry: false,
      networkMode: "always",
    });
    assert.deepEqual(actionDefaults("mock"), { networkMode: "always" });
  });

  test("api mode keeps the query client's own defaults", () => {
    assert.deepEqual(queryDefaults("api"), {});
    assert.deepEqual(actionDefaults("api"), {});
  });
});
