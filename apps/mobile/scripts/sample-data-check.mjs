#!/usr/bin/env node
/**
 * Proves an exported build carries none of the prototype's sample data (metro/sample-data.js).
 *
 *   node scripts/sample-data-check.mjs dist     # check:ci's step after its export step
 *   node scripts/sample-data-check.mjs <export folder>
 *
 * It fails on any sample sentence from a feature's mock-data.ts found in a bundle, and on any photo
 * from assets/proto/ found among the exported assets (Expo names each asset file by its md5).
 * A sentence counts as sample data only when no other source file uses it too. Sentences the
 * prototype shares with the older @injishi/data fixtures are left out: those fixtures still reach
 * every build through src/lib/store.ts, a separate backlog that the no-demo-data lint rule counts.
 */

import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const APP_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

/** The string literals worth looking for: plain ASCII sentences, long enough not to match by chance. */
export function sampleStrings(mockSources, otherSource) {
  const found = new Set();
  for (const source of mockSources) {
    for (const match of source.matchAll(/"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'|`([^`$\\]*)`/g)) {
      const text = match[1] ?? match[2] ?? match[3];
      if (text.length < 12 || !text.includes(" ") || !/^[\x20-\x7e]+$/.test(text) || text.includes("\\")) continue;
      if (!/[A-Za-z]{3}/.test(text) || otherSource.includes(text)) continue;
      found.add(text);
    }
  }
  return [...found].sort();
}

/** The sample strings a bundle holds. */
export function leaks(bundle, strings) {
  return strings.filter((text) => bundle.includes(text));
}

function files(dir, keep = () => true) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? files(full, keep) : keep(full) ? [full] : [];
  });
}

function main(distDir) {
  const src = path.join(APP_DIR, "src");
  const isMockData = (file) => /[\\/]mock-data\.ts$/.test(file);
  const sources = files(src, (file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file));
  const mock = sources.filter(isMockData).map((file) => readFileSync(file, "utf8"));
  const fixtures = files(path.join(APP_DIR, "..", "..", "packages", "data", "src"), (file) => /\.tsx?$/.test(file));
  const other = [...sources.filter((file) => !isMockData(file)), ...fixtures]
    .map((file) => readFileSync(file, "utf8"))
    .join("\n");
  const strings = sampleStrings(mock, other);
  const photos = files(path.join(APP_DIR, "assets", "proto")).map((file) => ({
    name: path.basename(file),
    md5: createHash("md5").update(readFileSync(file)).digest("hex"),
  }));

  const bundles = files(path.join(distDir, "_expo", "static", "js"), (file) => /\.(hbc|js)$/.test(file));
  if (bundles.length === 0) {
    console.error(`sample-data-check found no bundles under ${distDir}/_expo/static/js. Export first.`);
    process.exit(1);
  }
  if (mock.length === 0 || strings.length === 0) {
    console.error("sample-data-check found no sample strings in src/features/*/mock-data.ts to look for.");
    process.exit(1);
  }

  const problems = [];
  for (const bundle of bundles) {
    const text = readFileSync(bundle).toString("latin1");
    const hits = leaks(text, strings);
    if (hits.length > 0) {
      const shown = hits.slice(0, 5).map((hit) => `"${hit}"`).join(", ");
      problems.push(`${path.relative(distDir, bundle)} holds ${hits.length} sample strings, e.g. ${shown}`);
    }
  }
  const exported = new Set(files(path.join(distDir, "assets")).map((file) => path.basename(file)));
  const shipped = photos.filter((photo) => exported.has(photo.md5));
  if (shipped.length > 0) {
    const shown = shipped.slice(0, 5).map((photo) => photo.name).join(", ");
    problems.push(`${shipped.length} prototype photos are exported assets, e.g. ${shown}`);
  }

  if (problems.length > 0) {
    console.error(`The build carries sample data:\n- ${problems.join("\n- ")}`);
    console.error("A sample data file is reached outside metro/sample-data.js's swap, or the swap is off.");
    process.exit(1);
  }
  console.log(
    `no sample data in ${bundles.length} bundles: ${strings.length} sample strings and ${photos.length} prototype photos looked for.`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(path.resolve(APP_DIR, process.argv[2] ?? "dist"));
}
