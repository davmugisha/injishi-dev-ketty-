// metro/sample-data.js (the swap that keeps sample data out of api mode bundles) and the scanner
// in scripts/sample-data-check.mjs. The exported bundles themselves are checked by check:ci.

import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { describe, test } from "node:test";
import { dataModeFrom as appDataModeFrom } from "../src/lib/data-mode.ts";
import { leaks, sampleStrings } from "./sample-data-check.mjs";

const { dataModeFrom, sampleDataStub, withoutSampleData } = createRequire(import.meta.url)("../metro/sample-data.js");

const APP = "C:\\repo\\apps\\mobile";
const resolved = (filePath) => ({ type: "sourceFile", filePath });

describe("metro/sample-data.js", () => {
  test("reads the data mode by the app's own rule", () => {
    for (const value of ["mock", " mock ", "MOCK", "mocks", "api", "", undefined]) {
      assert.equal(dataModeFrom(value), appDataModeFrom(value), `EXPO_PUBLIC_DATA=${JSON.stringify(value)}`);
    }
  });

  test("swaps each feature's mock-data.ts and the prototype's photos, on Windows and POSIX paths", () => {
    assert.match(sampleDataStub(`${APP}\\src\\features\\guest-stay\\mock-data.ts`), /stubs[\\/]mock-data\.js$/);
    assert.match(sampleDataStub("/repo/apps/mobile/src/features/desk/mock-data.ts"), /stubs[\\/]mock-data\.js$/);
    assert.match(sampleDataStub(`${APP}\\src\\proto\\images.ts`), /stubs[\\/]proto-images\.js$/);
  });

  test("leaves every other file alone", () => {
    for (const file of ["features/guest/data.ts", "proto/screens.ts", "features/guest/mock-data.test.ts", "lib/mock-data.ts"]) {
      assert.equal(sampleDataStub(`/repo/apps/mobile/src/${file}`), null, file);
    }
  });

  test("in mock mode the resolver is untouched", () => {
    const upstream = () => resolved("/x");
    const config = withoutSampleData({ resolver: { resolveRequest: upstream } }, "mock");
    assert.equal(config.resolver.resolveRequest, upstream);
  });

  test("in api mode it resolves through the upstream resolver, then swaps sample data files", () => {
    const seen = [];
    const upstream = (_context, name) => {
      seen.push(name);
      return resolved(name === "./mock-data" ? "/app/src/features/guest/mock-data.ts" : "/app/src/features/guest/data.ts");
    };
    const { resolver } = withoutSampleData({ resolver: { resolveRequest: upstream } }, "api");
    assert.match(resolver.resolveRequest({}, "./mock-data", "android").filePath, /stubs[\\/]mock-data\.js$/);
    assert.equal(resolver.resolveRequest({}, "./data", "android").filePath, "/app/src/features/guest/data.ts");
    assert.deepEqual(seen, ["./mock-data", "./data"]);
  });

  test("without an upstream resolver it falls back to Metro's own", () => {
    const context = { resolveRequest: () => resolved("/app/src/proto/images.ts") };
    const { resolver } = withoutSampleData({ resolver: {} }, "api");
    assert.match(resolver.resolveRequest(context, "@/proto/images", "ios").filePath, /stubs[\\/]proto-images\.js$/);
  });

  test("the mock-data stub throws on use instead of drawing nothing", () => {
    const stub = createRequire(import.meta.url)("../metro/stubs/mock-data.js");
    assert.equal(stub.__esModule, true);
    assert.throws(() => stub.mockToday(), /Sample data "mockToday" was read outside mock mode/);
  });
});

describe("sample-data-check.mjs", () => {
  const mock = `export const stay = { name: "Isangano Lakeside Lodge", city: 'Gisenyi town centre', note: \`Balconies over the lake\` };
const short = "Two beds"; const shared = "Not connected yet, try later"; const odd = "Caf\\u00e9 au lait for two";`;

  test("looks for long ASCII sentences that only the sample data uses", () => {
    const strings = sampleStrings([mock], 'Text("Not connected yet, try later")');
    assert.deepEqual(strings, ["Balconies over the lake", "Gisenyi town centre", "Isangano Lakeside Lodge"]);
  });

  test("finds the ones a bundle holds", () => {
    const strings = sampleStrings([mock], "Not connected yet, try later");
    assert.deepEqual(leaks("...Gisenyi town centre...Not connected yet, try later", strings), ["Gisenyi town centre"]);
    assert.deepEqual(leaks("no sample data here", strings), []);
  });
});
