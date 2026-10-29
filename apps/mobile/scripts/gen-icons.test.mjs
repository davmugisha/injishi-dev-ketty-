// icons:gen and icons:check (mobile spec 0002, D-n, AC-10). Run with `pnpm --filter @injishi/mobile test`.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { generate, namesInUse, parseSvg, pascalName, readNames } from "./gen-icons.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(HERE, "gen-icons.mjs");
const GLYPHS = path.join(HERE, "..", "src", "components", "ui", "icon-glyphs.ts");

test("AC-10: a name is the PascalCase of its file name, digits included", () => {
  assert.equal(pascalName("arrow-rotate-right.svg"), "ArrowRotateRight");
  assert.equal(pascalName("boxes-3.svg"), "Boxes3");
  assert.equal(pascalName("abbr-api.svg"), "AbbrApi");
});

test("AC-10: the generator gives the same bytes twice, and the committed file is those bytes", () => {
  const once = generate();
  assert.equal(generate(), once);
  assert.equal(readFileSync(GLYPHS, "utf8").replace(/\r\n/g, "\n"), once);
});

test("AC-10: a name with no SVG fails", () => {
  assert.throws(() => generate(["House", "Hous"]), /no SVG .* for: Hous/);
});

test("AC-10: icons:check passes on the app", () => {
  const { status, stderr } = spawnSync(process.execPath, [SCRIPT, "--check"], { encoding: "utf8" });
  assert.equal(status, 0, stderr);
});

test("AC-10: every icon name written in src is in icons.json", () => {
  const listed = new Set(readNames());
  const unlisted = [...namesInUse()].filter(([name]) => !listed.has(name));
  assert.deepEqual(unlisted, []);
});

test("AC-10: the scan finds names on Icon, RowIcon and IconTile, and nothing else", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "icons-"));
  try {
    const file = path.join(dir, "screen.tsx");
    writeFileSync(
      file,
      [
        '<Icon name="House" size={20} />',
        '<RowIcon tone="info" name="Bell" />',
        '<IconTile name="Key" />',
        '<Avatar name="NotAnIcon" />',
      ].join("\n"),
    );
    assert.deepEqual([...namesInUse([file]).keys()].sort(), ["Bell", "House", "Key"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("AC-10: a group's fill rule reaches its paths, the full box clip is dropped, a fixed colour is not kept", () => {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 16 16">' +
    '<g clip-path="url(#a)"><g fill-rule="evenodd" clip-rule="evenodd">' +
    '<path fill="currentColor" d="M1 1h2v2H1z"/><path fill="#f33" d="M5 5h1v1H5z"/></g>' +
    '<path fill="currentColor" d="M9 9h1v1H9z"/></g>' +
    '<defs><clipPath id="a"><path fill="currentColor" d="M0 0h16v16H0z"/></clipPath></defs></svg>';
  assert.deepEqual(parseSvg(svg), {
    size: 16,
    paths: [
      { d: "M1 1h2v2H1z", evenodd: true },
      { d: "M5 5h1v1H5z", evenodd: true },
      { d: "M9 9h1v1H9z", evenodd: false },
    ],
  });
});

test("AC-10: an element the generator does not draw fails loudly", () => {
  assert.throws(
    () => parseSvg('<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="4"/></svg>', "dot.svg"),
    /dot.svg: unexpected <circle>/,
  );
});
