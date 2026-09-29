/**
 * The stay picker's rules, run against the REAL `src/lib/stay-range.ts`.
 *
 * Follows `guest-money-reads.test.mjs`: the source is transpiled and evaluated,
 * its `@injishi/contracts` import bound to the built package (the constants the
 * API refuses on) and its `@injishi/utils` import to the real `format.ts`. The
 * matchers it returns are judged by react-day-picker's OWN `dateMatchModifiers`,
 * the function the calendar consults per cell, so a rule that reads right here
 * but that the library would not honour fails here.
 *
 * Every date is fixed. `today` is 2026-09-17 and the room's calendar sells out
 * on the night of 2026-09-24, so a stay from the 22nd can leave on the 24th
 * (it never sleeps that night) and cannot leave on the 25th.
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
const contracts = require("@injishi/contracts");
const { dateMatchModifiers } = require("react-day-picker");

globalThis.__contracts = contracts;

async function load(relative) {
  const src = readFileSync(resolve(here, "..", relative), "utf8");
  let { outputText } = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  outputText = outputText
    .replace(/import\s*\{([^}]*)\}\s*from\s*"@injishi\/contracts";/g, "const {$1} = globalThis.__contracts;")
    .replace(/import\s*\{([^}]*)\}\s*from\s*"@injishi\/utils";/g, "const {$1} = globalThis.__utils;");
  assert.doesNotMatch(outputText, /^\s*import\s/m, `${relative} imports something this harness does not bind`);
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}

globalThis.__utils = await load("../../packages/utils/src/format.ts");
const rules = await load("src/lib/stay-range.ts");

const day = (iso) => new Date(`${iso}T00:00:00`);
const iso = (date) => globalThis.__utils.toISODate(date);
const TODAY = day("2026-09-17");
const CALENDAR = { soldOut: new Set(["2026-09-24"]), minStay: 1, lastBookableNight: "2028-03-10" };
const STRICT = { ...CALENDAR, minStay: 3 };

/** What the calendar would do with this cell, by the library's own judgement. */
const isDisabled = (matchers, isoDay) => dateMatchModifiers(day(isoDay), matchers);

describe("nextRange: what one click means", () => {
  test("with nothing chosen, the click is the check-in", () => {
    assert.deepEqual(rules.nextRange(undefined, day("2026-09-20")), { from: day("2026-09-20") });
  });
  test("with a check-in, a later day closes the range", () => {
    const next = rules.nextRange({ from: day("2026-09-20") }, day("2026-09-23"));
    assert.deepEqual(next, { from: day("2026-09-20"), to: day("2026-09-23") });
  });
  test("with a check-in, an earlier day moves the check-in there", () => {
    assert.deepEqual(rules.nextRange({ from: day("2026-09-20") }, day("2026-09-18")), { from: day("2026-09-18") });
  });
  test("with a check-in, the same day keeps it as a lone check-in", () => {
    assert.deepEqual(rules.nextRange({ from: day("2026-09-20") }, day("2026-09-20")), { from: day("2026-09-20") });
  });
  test("with a finished range, the click starts over", () => {
    const next = rules.nextRange({ from: day("2026-09-20"), to: day("2026-09-23") }, day("2026-09-21"));
    assert.deepEqual(next, { from: day("2026-09-21") });
  });
});

describe("checkoutWindow", () => {
  test("a sold-out night is the last morning a guest may leave on", () => {
    const { earliest, latest } = rules.checkoutWindow(day("2026-09-22"), TODAY, CALENDAR);
    assert.equal(iso(earliest), "2026-09-23");
    assert.equal(iso(latest), "2026-09-24");
  });
  test("the minimum stay moves the earliest check-out", () => {
    const { earliest } = rules.checkoutWindow(day("2026-09-22"), TODAY, STRICT);
    assert.equal(iso(earliest), "2026-09-25");
  });
  test("without a calendar the horizon and the night cap bound it", () => {
    const { latest } = rules.checkoutWindow(day("2026-09-22"), TODAY, null);
    assert.equal(iso(latest), iso(rules.addDays(day("2026-09-22"), contracts.MAX_NIGHTS)));
    const far = rules.addDays(TODAY, contracts.MAX_HORIZON_DAYS - 10);
    assert.equal(
      iso(rules.checkoutWindow(far, TODAY, null).latest),
      iso(rules.addDays(TODAY, contracts.MAX_HORIZON_DAYS + 1)),
    );
  });
});

describe("disabledDays while choosing a check-in", () => {
  const matchers = rules.disabledDays(undefined, TODAY, CALENDAR);
  test("yesterday is out, today and tomorrow are in", () => {
    assert.equal(isDisabled(matchers, "2026-09-16"), true);
    assert.equal(isDisabled(matchers, "2026-09-17"), false);
    assert.equal(isDisabled(matchers, "2026-09-18"), false);
  });
  test("a sold-out night cannot be a check-in", () => {
    assert.equal(isDisabled(matchers, "2026-09-24"), true);
  });
  test("the last bookable night is in, the day after it is out", () => {
    assert.equal(isDisabled(matchers, "2028-03-10"), false);
    assert.equal(isDisabled(matchers, "2028-03-11"), true);
  });
  test("a night no stay can be completed from is not offered as a check-in", () => {
    // Three nights minimum and the 24th sold out: from the 22nd or the 23rd the
    // earliest check-out falls after the last one, so the click would leave
    // every later day greyed and the guest hunting for Clear. The 21st still
    // fits (leave on the 24th), and the 25th is past the sold-out night.
    const strict = rules.disabledDays(undefined, TODAY, STRICT);
    assert.equal(isDisabled(strict, "2026-09-21"), false);
    assert.equal(isDisabled(strict, "2026-09-22"), true);
    assert.equal(isDisabled(strict, "2026-09-23"), true);
    assert.equal(isDisabled(strict, "2026-09-25"), false);
    // The same rule at the horizon: the minimum must fit before it closes.
    assert.equal(isDisabled(strict, "2028-03-08"), false);
    assert.equal(isDisabled(strict, "2028-03-09"), true);
  });
  test("with no calendar the platform horizon applies and nothing is sold out", () => {
    const open = rules.disabledDays(undefined, TODAY, null);
    assert.equal(isDisabled(open, "2026-09-24"), false);
    assert.equal(isDisabled(open, iso(rules.addDays(TODAY, contracts.MAX_HORIZON_DAYS))), false);
    assert.equal(isDisabled(open, iso(rules.addDays(TODAY, contracts.MAX_HORIZON_DAYS + 1))), true);
  });
});

describe("disabledDays while choosing a check-out", () => {
  const from = { from: day("2026-09-22") };
  test("the sold-out morning is offered, the one after it is not", () => {
    const matchers = rules.disabledDays(from, TODAY, CALENDAR);
    assert.equal(isDisabled(matchers, "2026-09-23"), false);
    assert.equal(isDisabled(matchers, "2026-09-24"), false);
    assert.equal(isDisabled(matchers, "2026-09-25"), true);
  });
  test("days too close for the minimum stay are out, the first legal one is in", () => {
    // From the 25th, past the sold-out night: a three-night minimum makes the
    // 28th the first morning a guest may leave on.
    const matchers = rules.disabledDays({ from: day("2026-09-25") }, TODAY, STRICT);
    assert.equal(isDisabled(matchers, "2026-09-26"), true);
    assert.equal(isDisabled(matchers, "2026-09-27"), true);
    assert.equal(isDisabled(matchers, "2026-09-28"), false);
  });
  test("a minimum stay that cannot fit before a sold-out night leaves no check-out", () => {
    const matchers = rules.disabledDays(from, TODAY, STRICT);
    for (const d of ["2026-09-23", "2026-09-24", "2026-09-25", "2026-09-26"]) {
      assert.equal(isDisabled(matchers, d), true, d);
    }
  });
  test("a day before the check-in stays clickable unless it is sold out or past", () => {
    const later = { from: day("2026-09-26") };
    const matchers = rules.disabledDays(later, TODAY, CALENDAR);
    assert.equal(isDisabled(matchers, "2026-09-20"), false);
    assert.equal(isDisabled(matchers, "2026-09-24"), true);
    assert.equal(isDisabled(matchers, "2026-09-16"), true);
  });
  test("the 90-night cap holds without a calendar", () => {
    const matchers = rules.disabledDays(from, TODAY, null);
    assert.equal(isDisabled(matchers, iso(rules.addDays(from.from, contracts.MAX_NIGHTS))), false);
    assert.equal(isDisabled(matchers, iso(rules.addDays(from.from, contracts.MAX_NIGHTS + 1))), true);
  });
});

describe("previewModifiers", () => {
  test("covers exactly the nights between the check-in and the hovered day", () => {
    const mods = rules.previewModifiers({ from: day("2026-09-20") }, day("2026-09-24"));
    assert.equal(iso(mods.preview_start), "2026-09-20");
    assert.equal(iso(mods.preview_end), "2026-09-24");
    for (const d of ["2026-09-21", "2026-09-22", "2026-09-23"]) {
      assert.equal(dateMatchModifiers(day(d), mods.preview), true, d);
    }
    assert.equal(dateMatchModifiers(day("2026-09-20"), mods.preview), false);
    assert.equal(dateMatchModifiers(day("2026-09-24"), mods.preview), false);
    assert.equal(dateMatchModifiers(day("2026-09-25"), mods.preview), false);
  });
  test("previews nothing on or before the check-in, with a finished range, or with none", () => {
    assert.deepEqual(rules.previewModifiers({ from: day("2026-09-20") }, day("2026-09-20")), {});
    assert.deepEqual(rules.previewModifiers({ from: day("2026-09-20") }, day("2026-09-18")), {});
    assert.deepEqual(
      rules.previewModifiers({ from: day("2026-09-20"), to: day("2026-09-22") }, day("2026-09-25")),
      {},
    );
    assert.deepEqual(rules.previewModifiers(undefined, day("2026-09-25")), {});
  });
});
