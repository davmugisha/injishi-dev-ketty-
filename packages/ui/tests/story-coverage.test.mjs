/**
 * Every shared component has a story, or is on the list of ones that do not
 * YET (ADR-045).
 *
 * The component list is the files on disk in `src/components/`, the same
 * registry `injishi/no-duplicate-shared-component` reads, so adding a
 * component without a story fails here rather than slipping into the apps
 * undocumented.
 *
 * `PENDING` is a count, not a pardon (the idiom ADR-037 set for a `warn`). It
 * may only shrink: a pending component that gains a story fails the test until
 * its name is taken off the list, so the list can never quietly overstate what
 * is missing. When it is empty, delete it.
 *
 * Run: pnpm --filter @injishi/ui test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const componentsDir = join(root, "src", "components");
const storiesDir = join(root, "stories");

/** Waves 2 and 3 of the Storybook plan. Take a name off when its story lands. */
const PENDING = new Set([
  // wave 2: overlays
  "dialog",
  "native-dialog",
  "sheet",
  "popover",
  "dropdown-menu",
  "tooltip",
  // wave 3
  "accordion",
  "avatar",
  "breadcrumbs",
  "calendar",
  "carousel",
  "progress",
  "separator",
  "slider",
  "scroll-area",
]);

const components = readdirSync(componentsDir)
  .filter((f) => f.endsWith(".tsx"))
  .map((f) => f.slice(0, -".tsx".length))
  .sort();

const hasStory = (name) => existsSync(join(storiesDir, `${name}.stories.tsx`));

test("the component list is not empty", () => {
  assert.ok(components.length > 0, `no components found in ${componentsDir}`);
});

test("every shared component has a story or is pending", () => {
  const missing = components.filter((c) => !hasStory(c) && !PENDING.has(c));
  assert.deepEqual(
    missing,
    [],
    `write a story in stories/<name>.stories.tsx for: ${missing.join(", ")}`,
  );
});

test("no pending entry already has a story", () => {
  const stale = [...PENDING].filter(hasStory);
  assert.deepEqual(stale, [], `take these off PENDING, they have stories now: ${stale.join(", ")}`);
});

test("no pending entry names a component that does not exist", () => {
  const unknown = [...PENDING].filter((p) => !components.includes(p));
  assert.deepEqual(unknown, [], `PENDING names components that are not on disk: ${unknown.join(", ")}`);
});

test("every story file belongs to a shared component", () => {
  const orphans = readdirSync(storiesDir)
    .filter((f) => f.endsWith(".stories.tsx"))
    .map((f) => f.slice(0, -".stories.tsx".length))
    .filter((s) => !components.includes(s));
  assert.deepEqual(
    orphans,
    [],
    `Storybook is the approved system only; no story without a component in src/components: ${orphans.join(", ")}`,
  );
});
