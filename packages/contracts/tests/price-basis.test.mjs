/**
 * How a room type's price is counted (owner decisions, 2026-10-29).
 *
 * A villa or an apartment is let whole, so its rate is per night for the whole
 * place and the party does not multiply it. A bar or coffee shop lists a menu,
 * priced each, and is never booked. Everything else stays per person.
 *
 * It tests the BUILT module (`dist/`), like every test in this folder.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  chargedGuests,
  computeBreakdown,
  isFoodVenue,
  isStayPriceBasis,
  priceBasisFor,
  setupKindLabel,
  setupStepsFor,
  setupVocabularyFor,
  stayNightlyRateRwf,
} = require("../dist/index.js");

describe("the price a stay is charged", () => {
  test("a whole unit costs its rate per night, whatever the party", () => {
    const four = computeBreakdown({ nightlyRateRwf: 200_000, nights: 3, nonRefundable: false, guests: 4, priceBasis: "per_unit" });
    assert.equal(four.guests, 1);
    assert.equal(four.grossRwf, 600_000);
    assert.equal(stayNightlyRateRwf(four), 200_000);
  });

  test("per person, and no basis at all, still multiply by the party", () => {
    for (const priceBasis of ["per_person", undefined, null]) {
      const b = computeBreakdown({ nightlyRateRwf: 50_000, nights: 2, nonRefundable: false, guests: 3, priceBasis });
      assert.equal(b.grossRwf, 300_000, String(priceBasis));
    }
  });

  test("chargedGuests and isStayPriceBasis", () => {
    assert.equal(chargedGuests("per_unit", 6), 1);
    assert.equal(chargedGuests("per_person", 6), 6);
    assert.equal(chargedGuests("per_person", 0), 1);
    assert.equal(isStayPriceBasis("per_item"), false);
    assert.equal(isStayPriceBasis("per_unit"), true);
    assert.equal(isStayPriceBasis(undefined), true);
  });
});

describe("each kind sets its prices on its own basis", () => {
  const hosp = (businessKind, accommodationClass = businessKind) => ({ domain: "hospitality", businessKind, accommodationClass });

  test("villa and apartment are per unit, per night", () => {
    for (const kind of ["villa", "apartment"]) {
      assert.equal(priceBasisFor(hosp(kind)), "per_unit", kind);
      assert.equal(setupVocabularyFor(hosp(kind)).pricePeriod, "per night, for the whole place", kind);
    }
  });

  test("rooms, tents and cottages are per person", () => {
    for (const kind of ["hotel", "motel", "guest_house", "lodge", "tented_camp", "other"]) {
      assert.equal(priceBasisFor(hosp(kind)), "per_person", kind);
    }
  });

  test("a bar or a coffee shop is a venue from its registered kind alone, priced per item", () => {
    for (const kind of ["bar_restaurant", "coffee_shop"]) {
      const business = { domain: "hospitality", businessKind: kind, accommodationClass: null };
      assert.equal(isFoodVenue(business), true, kind);
      assert.equal(priceBasisFor(business), "per_item", kind);
      assert.equal(setupStepsFor(business).find((s) => s.key === "rooms")?.required, false, kind);
    }
  });

  test("the registered kind wins over a stored class", () => {
    assert.equal(priceBasisFor({ domain: "hospitality", businessKind: "villa", accommodationClass: "hotel" }), "per_unit");
  });

  test("the kind reads as a word for the page", () => {
    assert.equal(setupKindLabel(hosp("tented_camp")), "tented camp");
    assert.equal(setupKindLabel({ domain: "hospitality", businessKind: "coffee_shop", accommodationClass: null }), "coffee shop");
    assert.equal(setupKindLabel({ domain: "residence", accommodationClass: null }), "residence");
  });

  test("a hotel must name its department heads; a villa need not", () => {
    assert.equal(setupStepsFor(hosp("hotel")).find((s) => s.key === "departments")?.required, true);
    assert.equal(setupStepsFor(hosp("villa")).find((s) => s.key === "departments")?.required, false);
  });
});
