/**
 * Explore's type chips (mobile spec 0005, D-i): every accommodation class a business may hold,
 * current or retired, has a chip, and a class nobody mapped falls back to a plain "Stay".
 *
 * It tests the BUILT module (`dist/`), like `authz.test.mjs`.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  EXPLORE_TYPES,
  EXPLORE_TYPE_LABEL,
  ExplorePlaceRef,
  ExploreSearchQuery,
  STORED_ACCOMMODATION_CLASSES,
  StoredAccommodationClass,
  exploreTypeOf,
} = require("../dist/index.js");

describe("explore type chips", () => {
  test("every stored class has a chip with a label", () => {
    for (const cls of STORED_ACCOMMODATION_CLASSES) {
      assert.ok(StoredAccommodationClass.safeParse(cls).success, cls);
      const type = EXPLORE_TYPES[cls];
      assert.ok(type, `${cls} has no chip`);
      assert.ok(EXPLORE_TYPE_LABEL[type], `${type} has no label`);
    }
  });

  test("the stored vocabulary is the whole union", () => {
    const union = StoredAccommodationClass.options.flatMap((o) => o.options);
    assert.deepEqual([...union].sort(), [...STORED_ACCOMMODATION_CLASSES].sort());
  });

  test("retired classes keep a chip", () => {
    assert.equal(exploreTypeOf("stays", "town_hotel"), "hotel");
    assert.equal(exploreTypeOf("stays", "cottage"), "lodge");
    assert.equal(exploreTypeOf("stays", "serviced_apartment"), "apartment");
  });

  test("a null or unknown class is a Stay, and every home is a Home", () => {
    assert.equal(exploreTypeOf("stays", null), "stay");
    assert.equal(exploreTypeOf("stays", "castle"), "stay");
    assert.equal(exploreTypeOf("stays", "toString"), "stay");
    assert.equal(exploreTypeOf("homes", "hotel"), "home");
  });
});

describe("explore query", () => {
  test("defaults: stays, top rated, pages of 20", () => {
    const q = ExploreSearchQuery.parse({});
    assert.equal(q.mode, "stays");
    assert.equal(q.sort, "top_rated");
    assert.equal(q.limit, 20);
  });

  test("a page is at most 50", () => {
    assert.equal(ExploreSearchQuery.safeParse({ limit: "51" }).success, false);
    assert.equal(ExploreSearchQuery.parse({ limit: "50" }).limit, 50);
  });

  test("a place is a district, a sector or a property slug, nothing else", () => {
    for (const ok of ["district:12", "sector:345", "property:isangano-lakeside"]) {
      assert.ok(ExplorePlaceRef.safeParse(ok).success, ok);
    }
    for (const bad of ["district:", "city:1", "sector:x", "property:a b", "district:1;drop"]) {
      assert.equal(ExplorePlaceRef.safeParse(bad).success, false, bad);
    }
  });
});
