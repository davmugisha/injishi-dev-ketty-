/**
 * The place cascade: choosing a level clears the ones below, and each level asks the right endpoint.
 *
 *   pnpm --filter @injishi/ui test
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  choosePlace,
  deepestPlace,
  geographyRequest,
  isLevelOpen,
  isPlaceComplete,
  levelsTo,
  matchesPlace,
  type PlaceChain,
  parentIdFor,
  placeLine,
} from "../src/place.ts";

const kigali = { id: 1, name: "Kigali City" };
const gasabo = { id: 102, name: "Gasabo" };
const kimihurura = { id: 10207, name: "Kimihurura" };
const rugando = { id: 1020703, name: "Rugando" };
const amahoro = { id: 102070301, name: "Amahoro" };

const full: PlaceChain = { province: kigali, district: gasabo, sector: kimihurura, cell: rugando, village: amahoro };

test("choosing a level clears every level below it", () => {
  const next = choosePlace(full, "district", { id: 103, name: "Kicukiro" });
  assert.deepEqual(next, {
    province: kigali,
    district: { id: 103, name: "Kicukiro" },
    sector: null,
    cell: null,
    village: null,
  });
  assert.deepEqual(choosePlace(full, "province", null), {
    province: null,
    district: null,
    sector: null,
    cell: null,
    village: null,
  });
  assert.deepEqual(choosePlace({}, "province", kigali).province, kigali);
});

test("a level opens once the one above is chosen", () => {
  assert.equal(isLevelOpen({}, "province"), true);
  assert.equal(isLevelOpen({}, "district"), false);
  assert.equal(isLevelOpen({ province: kigali }, "district"), true);
  assert.equal(isLevelOpen({ province: kigali }, "sector"), false);
  assert.equal(parentIdFor(full, "village"), rugando.id);
  assert.equal(parentIdFor(full, "province"), null);
});

test("each level asks its geography endpoint", () => {
  assert.deepEqual(geographyRequest("province", null), { path: "/api/v1/geography/provinces", query: {} });
  assert.deepEqual(geographyRequest("district", 1), { path: "/api/v1/geography/districts", query: { provinceId: 1 } });
  assert.deepEqual(geographyRequest("village", 1020703), {
    path: "/api/v1/geography/villages",
    query: { cellId: 1020703 },
  });
});

test("complete to a depth, the deepest place, the line", () => {
  assert.equal(isPlaceComplete(full), true);
  assert.equal(isPlaceComplete({ province: kigali, district: gasabo }, "district"), true);
  assert.equal(isPlaceComplete({ province: kigali, district: gasabo }, "sector"), false);
  assert.deepEqual(levelsTo("sector"), ["province", "district", "sector"]);
  assert.deepEqual(deepestPlace({ province: kigali, district: gasabo }), { level: "district", place: gasabo });
  assert.equal(deepestPlace({}), null);
  assert.equal(placeLine(full), "Amahoro, Rugando, Kimihurura, Gasabo, Kigali City");
});

test("search ignores accents and case", () => {
  assert.equal(matchesPlace({ id: 1, name: "Rugando" }, "RUG"), true);
  assert.equal(matchesPlace({ id: 1, name: "Nyarugenge" }, "kic"), false);
  assert.equal(matchesPlace({ id: 1, name: "Nyarugenge" }, " "), true);
});
