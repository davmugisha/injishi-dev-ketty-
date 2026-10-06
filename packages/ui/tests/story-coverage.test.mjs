/**
 * Every shared component has a story (ADR-045).
 *
 * The component list is the files on disk in `src/components/`, the same
 * registry `injishi/no-duplicate-shared-component` reads, so adding a
 * component without a story fails here rather than slipping into the apps
 * undocumented.
 *
 * There used to be a `PENDING` set here: the components still waiting for a
 * story, a count that could only shrink (the idiom ADR-037 set for a `warn`).
 * It reached zero when the last fifteen landed together, and was deleted as
 * this file said it would be. There is no list to add a name to now; a new
 * component brings its story in the same change.
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

const components = readdirSync(componentsDir)
  .filter((f) => f.endsWith(".tsx"))
  .map((f) => f.slice(0, -".tsx".length))
  .sort();

const hasStory = (name) => existsSync(join(storiesDir, `${name}.stories.tsx`));

test("the component list is not empty", () => {
  assert.ok(components.length > 0, `no components found in ${componentsDir}`);
});

test("every shared component has a story", () => {
  const missing = components.filter((c) => !hasStory(c));
  assert.deepEqual(
    missing,
    [],
    `write a story in stories/<name>.stories.tsx for: ${missing.join(", ")}`,
  );
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
