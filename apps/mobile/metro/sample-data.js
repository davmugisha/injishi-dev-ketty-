// Keeps the prototype's sample data out of every bundle that doesn't show it (the proto-ui seam,
// src/lib/data-mode.ts). In api mode no screen reads a feature's mock-data.ts or the prototype's
// photos, yet their static imports would still pack the words and the pictures into the build. So
// unless EXPO_PUBLIC_DATA is exactly "mock" (development only), Metro resolves those files to stubs.
// scripts/sample-data-check.mjs, a check:ci step, proves the result on the exported bundles.

const path = require("node:path");

const STUBS = path.join(__dirname, "stubs");

/** The files that hold sample data, matched on the path Metro resolved, with the stub each becomes. */
const SAMPLE_DATA = [
  { file: /[\\/]src[\\/]features[\\/][a-z-]+[\\/]mock-data\.ts$/, stub: path.join(STUBS, "mock-data.js") },
  { file: /[\\/]src[\\/]proto[\\/]images\.ts$/, stub: path.join(STUBS, "proto-images.js") },
];

/** The rule of `dataModeFrom` in src/lib/data-mode.ts, which this file can't import (a test keeps them equal). */
function dataModeFrom(value) {
  return typeof value === "string" && value.trim() === "mock" ? "mock" : "api";
}

/** The stub that replaces this resolved file, or null when the file holds no sample data. */
function sampleDataStub(filePath) {
  return SAMPLE_DATA.find((entry) => entry.file.test(filePath))?.stub ?? null;
}

/** Wraps the resolver so sample data files resolve to their stubs, unless the mode is mock. */
function withoutSampleData(config, mode = dataModeFrom(process.env.EXPO_PUBLIC_DATA)) {
  if (mode === "mock") return config;
  const upstream = config.resolver.resolveRequest;
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    const resolved = upstream
      ? upstream(context, moduleName, platform)
      : context.resolveRequest(context, moduleName, platform);
    const stub = resolved.type === "sourceFile" ? sampleDataStub(resolved.filePath) : null;
    return stub ? { type: "sourceFile", filePath: stub } : resolved;
  };
  return config;
}

module.exports = { dataModeFrom, sampleDataStub, withoutSampleData };
