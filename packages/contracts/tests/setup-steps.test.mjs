/**
 * What an approved business sets up, pinned for every kind of business.
 *
 * The user's ask (2026-09-13) was "all accommodation types, and rentals", so the
 * test walks the ENUM rather than a hand picked list: a class added to
 * `AccommodationClass` next month is covered here the day it lands, or this
 * file fails.
 *
 * It tests the built module (`dist/`), like every test in this folder.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  AccommodationClass,
  RetiredAccommodationClass,
  SETUP_STEP_KEYS,
  currentAccommodationClass,
  isFoodVenue,
  isSetupStepDone,
  setupCompletion,
  setupStepsFor,
  setupVocabularyFor,
} = require("../dist/index.js");

const EMPTY = {
  properties: 0,
  contactDetails: 0,
  departments: 0,
  departmentHeads: 0,
  roomTypes: 0,
  pricedRoomTypes: 0,
  rooms: 0,
  photos: 0,
  amenities: 0,
  outlets: 0,
  staff: 0,
  published: 0,
};

const ALL_HOSPITALITY = [...AccommodationClass.options, ...RetiredAccommodationClass.options];

describe("every hospitality class has a checklist", () => {
  for (const cls of ALL_HOSPITALITY) {
    test(`${cls}`, () => {
      const steps = setupStepsFor({ domain: "hospitality", accommodationClass: cls });
      const keys = steps.map((s) => s.key);
      // The whole spine a guest can book against.
      for (const key of ["property", "contact", "departments", "room_types", "rooms", "photos", "amenities", "outlets", "staff", "listing"]) {
        assert.ok(keys.includes(key), `${cls} is missing ${key}`);
      }
      // Order follows the canonical list, so every screen shows the same sequence.
      const order = keys.map((k) => SETUP_STEP_KEYS.indexOf(k));
      assert.deepEqual(order, [...order].sort((a, b) => a - b));
      for (const step of steps) {
        assert.ok(step.title.length > 0 && step.description.length > 0, `${cls}:${step.key} has no words`);
      }
      for (const key of ["property", "contact", "room_types", "rooms", "photos"]) {
        assert.equal(steps.find((s) => s.key === key).required, true, `${cls}:${key} should be required`);
      }
    });
  }
});

test("departments are required where a business runs them, recommended elsewhere", () => {
  const required = (cls) =>
    setupStepsFor({ domain: "hospitality", accommodationClass: cls }).find((s) => s.key === "departments").required;
  for (const cls of ["hotel", "motel", "lodge", "tented_camp", "town_hotel", "vacation_hotel_resort", "cottage"]) {
    assert.equal(required(cls), true, cls);
  }
  for (const cls of ["guest_house", "apartment", "villa", "other", "serviced_apartment"]) {
    assert.equal(required(cls), false, cls);
  }
});

test("a residence lets units by the month and has no departments or outlets", () => {
  const steps = setupStepsFor({ domain: "residence", accommodationClass: null });
  const keys = steps.map((s) => s.key);
  assert.ok(!keys.includes("departments"));
  assert.ok(!keys.includes("outlets"));
  assert.deepEqual(keys, ["property", "contact", "room_types", "rooms", "photos", "amenities", "staff", "listing"]);
  const words = setupVocabularyFor({ domain: "residence", accommodationClass: null });
  assert.equal(words.typePlural, "Unit types");
  assert.equal(words.pricePeriod, "per month");
});

test("each class speaks its own words", () => {
  assert.equal(setupVocabularyFor({ domain: "hospitality", accommodationClass: "tented_camp" }).unitPlural, "tents");
  assert.equal(setupVocabularyFor({ domain: "hospitality", accommodationClass: "villa" }).typePlural, "Villa types");
  assert.equal(setupVocabularyFor({ domain: "hospitality", accommodationClass: "apartment" }).unitSingular, "apartment");
  assert.equal(setupVocabularyFor({ domain: "hospitality", accommodationClass: "hotel" }).pricePeriod, "per person, per night");
});

test("a coffee shop or bar is a food venue, not a hotel", () => {
  assert.equal(
    isFoodVenue({ entityGroup: "restaurant_bar_nightclub", accommodationClass: "other" }),
    true,
  );
  assert.equal(
    isFoodVenue({
      accommodationClass: "other",
      accommodationClassOther: "Coffee shop",
    }),
    true,
  );
  assert.equal(isFoodVenue({ accommodationClass: "hotel" }), false);

  const coffee = {
    domain: "hospitality",
    accommodationClass: "other",
    entityGroup: "restaurant_bar_nightclub",
    accommodationClassOther: "Coffee shop",
  };
  const words = setupVocabularyFor(coffee);
  assert.equal(words.typePlural, "What you sell");
  assert.equal(words.pricePeriod, "each");

  const steps = setupStepsFor(coffee);
  assert.equal(steps.find((s) => s.key === "property").title, "Venue profile");
  assert.equal(steps.find((s) => s.key === "rooms").required, false);
  assert.equal(steps.find((s) => s.key === "room_types").required, true);
  assert.equal(steps.find((s) => s.key === "departments").required, false);
  // "other" without a venue group still asks for rooms (unusual lodging).
  assert.equal(
    setupStepsFor({ domain: "hospitality", accommodationClass: "other" }).find((s) => s.key === "rooms")
      .required,
    true,
  );
});

test("a retired or missing class resolves rather than throws", () => {
  assert.equal(currentAccommodationClass("town_hotel"), "hotel");
  assert.equal(currentAccommodationClass("serviced_apartment"), "apartment");
  assert.equal(currentAccommodationClass(null), "other");
  assert.equal(currentAccommodationClass("not_a_class"), "other");
});

test("done is judged from the counts, and a new business has done nothing", () => {
  const steps = setupStepsFor({ domain: "hospitality", accommodationClass: "hotel" });
  const empty = setupCompletion(steps, EMPTY);
  assert.equal(empty.done, 0);
  assert.equal(empty.total, steps.length);
  assert.ok(empty.requiredTotal >= 6);

  // Seeded departments with nobody named at their head are not "done".
  assert.equal(isSetupStepDone("departments", { ...EMPTY, departments: 11 }), false);
  assert.equal(isSetupStepDone("departments", { ...EMPTY, departments: 11, departmentHeads: 1 }), true);
  // A room type with no price cannot be sold, so it does not finish the step.
  assert.equal(isSetupStepDone("room_types", { ...EMPTY, roomTypes: 2 }), false);
  assert.equal(isSetupStepDone("room_types", { ...EMPTY, roomTypes: 2, pricedRoomTypes: 1 }), true);

  const full = Object.fromEntries(Object.keys(EMPTY).map((k) => [k, 1]));
  const all = setupCompletion(steps, full);
  assert.equal(all.done, all.total);
  assert.equal(all.requiredDone, all.requiredTotal);
});
