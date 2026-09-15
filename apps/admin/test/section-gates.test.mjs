/**
 * Every console section is gated, on every navigation (ADR-049 AC-25,
 * platform audit 2026-09-14 H5).
 *
 * The section guard used to be ONE mount in the root `app/layout.tsx`, reading
 * the path from a request header. The root layout does not render on a soft
 * navigation, so a `next/link` into a section the staffer did not hold walked
 * past it. The guard is now mounted by each section's own `layout.tsx` with its
 * key spelled in the file, and that layout renders on the server whenever a
 * navigation enters the section.
 *
 * The price of a per section mount is that a section can be added without one.
 * This file is what makes that a failure instead of a quiet unguarded screen:
 *
 *   1. every folder under `src/app` is a row in `NAV`, and every row a folder
 *   2. every section's `layout.tsx` mounts `SectionBoundary` with ITS OWN key
 *   3. the guard reads no request header and the root layout does not mount it,
 *      so there is one guard, not two that can disagree
 *   4. the decision `SectionBoundary` makes, `sectionAllows`, refuses and admits
 *      the sections each staff role should, from the permission table the API
 *      itself resolves (`staffPermissionsForRoles`), never a copy of it
 *
 *   node --test "test/*.test.mjs"
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ts = createRequire(import.meta.url)("typescript");

const admin = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const appDir = path.join(admin, "src", "app");
const read = (...parts) => readFileSync(path.join(admin, ...parts), "utf8");

/** The keys in `NAV`, read from source so this test cannot hold its own list. */
function navKeys() {
  const source = read("src", "lib", "nav.ts");
  const start = source.indexOf("export const NAV:");
  const end = source.indexOf("export const NAV_ITEMS");
  assert.ok(start >= 0 && end > start, "could not find NAV in lib/nav.ts");
  return [...source.slice(start, end).matchAll(/\bkey:\s*"([^"]+)"/g)].map((m) => m[1]).sort();
}

/**
 * The REAL `lib/nav.ts`, not a copy of its rule (the way `apps/web/tests`
 * loads TypeScript): transpiled with the app's own `typescript` and evaluated,
 * so this runs on every Node the workspace supports rather than only on one
 * that strips types. Its icon imports are stubbed, because an icon has nothing
 * to do with who may open a section; `@injishi/contracts` is the real package,
 * resolved from this app, so `staffAllows` is the one the API uses.
 */
async function loadNav() {
  let src = read("src", "lib", "nav.ts");
  const icons = /import\s*\{([^}]*)\}\s*from\s*"lucide-react";/;
  assert.match(src, icons, "nav.ts no longer imports its icons the way this test stubs them");
  src = src.replace(icons, (_, names) =>
    names
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean)
      .map((name) => `const ${name} = null;`)
      .join("\n"),
  );
  src = src.replaceAll('"@injishi/contracts"', JSON.stringify(import.meta.resolve("@injishi/contracts")));
  const { outputText } = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}

/**
 * Route folders directly under `app/`. A private folder (`_x`) is not a route.
 * A route group (`(x)`) or a dynamic first segment would need this test and
 * the gate to be rethought, so they fail loudly rather than being skipped.
 */
function sectionFolders() {
  return readdirSync(appDir)
    .filter((name) => statSync(path.join(appDir, name)).isDirectory())
    .filter((name) => !name.startsWith("_"))
    .sort();
}

test("every route folder is a NAV section, and every NAV section has a folder", () => {
  const folders = sectionFolders();
  for (const name of folders) {
    assert.ok(
      !name.startsWith("(") && !name.startsWith("["),
      `app/${name} is a route group or dynamic segment; the section gate assumes one static folder per section`,
    );
  }
  assert.deepEqual(folders, navKeys());
});

test("every section's layout mounts SectionBoundary with its own key", () => {
  for (const key of navKeys()) {
    const file = path.join(appDir, key, "layout.tsx");
    assert.ok(existsSync(file), `app/${key}/layout.tsx is missing, so /${key} is unguarded on soft navigation`);
    const source = readFileSync(file, "utf8");
    assert.match(
      source,
      /from\s+"@\/components\/shell\/section-boundary"/,
      `app/${key}/layout.tsx does not import the section guard`,
    );
    const mounts = [...source.matchAll(/<SectionBoundary\s+section="([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(mounts, [key], `app/${key}/layout.tsx must mount SectionBoundary once, with section="${key}"`);
    assert.match(source, /\{children\}\s*<\/SectionBoundary>/, `app/${key}/layout.tsx must wrap children in the guard`);
  }
});

test("there is one guard: no header read, no root mount", () => {
  const guard = read("src", "components", "shell", "section-boundary.tsx");
  assert.doesNotMatch(guard, /from\s+"next\/headers"/, "the section guard must not read the path from a request header");
  const root = read("src", "app", "layout.tsx");
  assert.doesNotMatch(root, /<SectionBoundary/, "the root layout does not render on soft navigation; do not mount the guard there");
  // No other layout, template or page mounts it with a key that is not its own section.
  for (const key of navKeys()) {
    const walk = (dir) =>
      readdirSync(dir).flatMap((name) => {
        const full = path.join(dir, name);
        return statSync(full).isDirectory() ? walk(full) : [full];
      });
    for (const file of walk(path.join(appDir, key))) {
      if (!/\.(tsx|ts)$/.test(file) || file.endsWith(`${path.sep}${key}${path.sep}layout.tsx`)) continue;
      assert.doesNotMatch(readFileSync(file, "utf8"), /<SectionBoundary/, `${path.relative(admin, file)} mounts a second section guard`);
    }
  }
});

test("sectionAllows admits and refuses by the server's permission table", async () => {
  const { sectionAllows, NAV_ITEMS } = await loadNav();
  const { staffPermissionsForRoles } = await import("@injishi/contracts");
  const holds = (role) => staffPermissionsForRoles([role]);

  // Every key the layouts use is one the rule knows. `navItemFor` throws otherwise.
  for (const key of navKeys()) assert.equal(typeof sectionAllows([], key), "boolean");

  // Nobody holding nothing opens anything.
  for (const item of NAV_ITEMS) assert.equal(sectionAllows([], item.key), false, `empty set opened ${item.key}`);

  // Super admin opens everything.
  for (const item of NAV_ITEMS) assert.equal(sectionAllows(holds("super_admin"), item.key), true, `super_admin refused ${item.key}`);

  // The person this guard was written for: a trainer opens Training and nothing else.
  const trainerOpens = NAV_ITEMS.filter((i) => sectionAllows(holds("trainer"), i.key)).map((i) => i.key);
  assert.deepEqual(trainerOpens, ["training"]);

  // The finding's own example: links on Brokers and a business record lead to
  // /audit and /users. Ops holds Brokers and Users but not Audit or Finance.
  assert.equal(sectionAllows(holds("ops"), "brokers"), true);
  assert.equal(sectionAllows(holds("ops"), "users"), true);
  assert.equal(sectionAllows(holds("ops"), "audit"), false);
  assert.equal(sectionAllows(holds("ops"), "finance"), false);
  assert.equal(sectionAllows(holds("compliance"), "audit"), true);
  assert.equal(sectionAllows(holds("finance"), "users"), false);
});
