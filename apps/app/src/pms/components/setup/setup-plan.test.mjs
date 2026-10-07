/**
 * The guided set-up opens on the right step, words its blockers from the
 * database's answer and nothing else, and never claims a price it does not have.
 *
 * Runs the real functions: the source is read, its type-only import is dropped,
 * and the TypeScript is transpiled and evaluated, the way
 * `data/nav-counts.test.mjs` does.
 *
 * Run: pnpm --filter @injishi/app test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const ts = require("typescript");

async function load() {
  let src = readFileSync(resolve(here, "setup-plan.ts"), "utf8");
  const imports = /^import[^;]+;\s*$/gm;
  assert.ok(src.match(imports)?.length, "setup-plan.ts has no imports to strip; update this loader");
  src = src.replace(imports, "");
  const { outputText } = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}

const plan = await load();

const WORDS = { typePlural: "Room types", unitPlural: "rooms", unitSingular: "room", pricePeriod: "per night" };

/** A guest house's ten steps, departments recommended, as the contract orders them. */
function guestHouse(done = {}) {
  const rows = [
    ["property", "Property profile", true],
    ["contact", "Contact details", true],
    ["departments", "Departments and heads", false],
    ["room_types", "Room types", true],
    ["rooms", "Your rooms", true],
    ["photos", "Photos", true],
    ["amenities", "Amenities", false],
    ["outlets", "Outlets", false],
    ["staff", "Staff members", false],
    ["listing", "Go live", false],
  ];
  return rows.map(([key, title, required]) => ({ key, title, description: "", required, done: Boolean(done[key]) }));
}

describe("firstOpenStep", () => {
  test("opens on the first unfinished REQUIRED step, past a recommended one", () => {
    const steps = guestHouse({ property: true, contact: true });
    assert.equal(steps[plan.firstOpenStep(steps)].key, "room_types");
  });

  test("with every required step done, opens on the first unfinished recommended one", () => {
    const steps = guestHouse({ property: true, contact: true, room_types: true, rooms: true, photos: true });
    assert.equal(steps[plan.firstOpenStep(steps)].key, "departments");
  });

  test("with everything done, opens on the last step", () => {
    const all = Object.fromEntries(guestHouse().map((s) => [s.key, true]));
    const steps = guestHouse(all);
    assert.equal(plan.firstOpenStep(steps), steps.length - 1);
  });
});

describe("rail and header words", () => {
  test("need follows the contract's required flag, and the last step is the publish", () => {
    const steps = guestHouse();
    assert.equal(plan.stepNeed(steps[0], false), "Required");
    assert.equal(plan.stepNeed(steps[2], false), "Recommended");
    assert.equal(plan.stepNeed(steps[9], true), "Last step");
    assert.equal(plan.railNeed({ ...steps[0], done: true }, false), "Done");
    assert.equal(plan.railNeed(steps[9], true), "");
  });

  test("only a recommended step that is not the last can be skipped", () => {
    const steps = guestHouse();
    assert.equal(plan.canSkip(steps[0], false), false);
    assert.equal(plan.canSkip(steps[2], false), true);
    assert.equal(plan.canSkip(steps[9], true), false);
  });

  test("required progress counts only required steps", () => {
    assert.deepEqual(plan.requiredProgress(guestHouse({ property: true, amenities: true })), { done: 1, total: 5, pct: 20 });
  });
});

describe("blockersFor", () => {
  test("lists every unfinished required step, in order, each with its fix", () => {
    const blockers = plan.blockersFor({
      steps: guestHouse({ property: true, room_types: true }),
      words: WORDS,
      sectorMissing: false,
      sectorText: "Choose the sector the property is in.",
    });
    assert.deepEqual(blockers.map((b) => b.step), ["contact", "rooms", "photos"]);
    assert.match(blockers[1].text, /No room can be sold yet/);
  });

  test("a recommended step left undone never blocks", () => {
    const required = { property: true, contact: true, room_types: true, rooms: true, photos: true };
    const blockers = plan.blockersFor({ steps: guestHouse(required), words: WORDS, sectorMissing: false, sectorText: "x" });
    assert.deepEqual(blockers, []);
    assert.equal(plan.publishTitle(blockers.length), "Ready to publish");
  });

  test("a missing sector blocks in the contract's own words and sends to the profile", () => {
    const all = Object.fromEntries(guestHouse().map((s) => [s.key, true]));
    const blockers = plan.blockersFor({ steps: guestHouse(all), words: WORDS, sectorMissing: true, sectorText: "Choose the sector the property is in." });
    assert.deepEqual(blockers, [{ key: "missing_sector", text: "Choose the sector the property is in.", step: "property" }]);
    assert.equal(plan.publishTitle(1), "1 thing stops it going live");
    assert.equal(plan.publishTitle(3), "3 things stop it going live");
  });

  test("the words follow the business: a tented camp sells tents", () => {
    const tents = { typePlural: "Tent types", unitPlural: "tents", unitSingular: "tent", pricePeriod: "per night" };
    assert.equal(plan.blockerText("rooms", tents, "Your tents"), "No tent can be sold yet: add your tents.");
    assert.equal(plan.blockerText("room_types", tents, "Tent types"), "Add a tent type with a price per night.");
  });
});

describe("lowestPrice", () => {
  test("is the cheapest active priced room type", () => {
    assert.equal(
      plan.lowestPrice([
        { status: "active", basePriceRwf: 90000 },
        { status: "archived", basePriceRwf: 10000 },
        { status: "active", basePriceRwf: null },
        { status: "active", basePriceRwf: 45000 },
      ]),
      45000,
    );
  });

  test("is null, never zero, when nothing has a price", () => {
    assert.equal(plan.lowestPrice([{ status: "active", basePriceRwf: null }]), null);
    assert.equal(plan.lowestPrice([]), null);
  });

  test("a price period reads as a phrase", () => {
    assert.equal(plan.perPeriod("per night"), "a night");
    assert.equal(plan.perPeriod("per month"), "a month");
  });
});

describe("parseView", () => {
  test("anything unknown is the set-up itself", () => {
    assert.equal(plan.parseView("publish"), "publish");
    assert.equal(plan.parseView("open"), "open");
    assert.equal(plan.parseView(null), "setup");
    assert.equal(plan.parseView("admin"), "setup");
  });
});
