/**
 * The branches a hospitality registration declares (ADR-054 AC-R3).
 *
 * The API validates the create call against this schema, so these assertions
 * are the rule on both ends of the wire: the wizard refuses what the server
 * would refuse, and names the same field.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { CreateRegistrationRequest, MAX_REGISTRATION_BRANCHES } = require("../dist/index.js");

const ADDRESS = { country: "RW", provinceId: 1, districtId: 102, sectorId: 10201, street: "KG 11 Ave" };

function branch(name) {
  return { name, address: ADDRESS };
}

function hotel(branches) {
  return {
    role: "host",
    business: {
      domain: "hospitality",
      legalName: "Amahoro Hospitality Group",
      address: ADDRESS,
      accommodationClass: "hotel",
      tin: "123456789",
      ...(branches === undefined ? {} : { branches }),
    },
  };
}

function residence(branches) {
  return {
    role: "landlord",
    business: {
      domain: "residence",
      legalName: "Kimironko Flats",
      address: ADDRESS,
      residenceClass: "residential_landlord",
      upi: "1/03/07/02/1234",
      branches,
    },
  };
}

/** The issue paths a request fails on, as dotted strings. */
function failingPaths(request) {
  const result = CreateRegistrationRequest.safeParse(request);
  return result.success ? [] : [...new Set(result.error.issues.map((i) => i.path.join(".")))];
}

describe("a hospitality registration's branches", () => {
  test("defaults to none, which is a single site business", () => {
    const result = CreateRegistrationRequest.safeParse(hotel());
    assert.equal(result.success, true);
    assert.deepEqual(result.data.business.branches, []);
  });

  test("accepts up to the cap", () => {
    const branches = Array.from({ length: MAX_REGISTRATION_BRANCHES }, (_, i) => branch(`Branch ${i + 1}`));
    assert.deepEqual(failingPaths(hotel(branches)), []);
  });

  test("refuses one more than the cap, naming the list", () => {
    const branches = Array.from({ length: MAX_REGISTRATION_BRANCHES + 1 }, (_, i) => branch(`Branch ${i + 1}`));
    assert.deepEqual(failingPaths(hotel(branches)), ["business.branches"]);
  });

  test("refuses two names equal after trimming and ignoring case, naming the second", () => {
    assert.deepEqual(failingPaths(hotel([branch("Musanze"), branch("  musanze ")])), ["business.branches.1.name"]);
  });

  test("refuses a branch named like the head office, which carries the legal name", () => {
    assert.deepEqual(failingPaths(hotel([branch("AMAHORO hospitality group")])), ["business.branches.0.name"]);
  });

  test("refuses a branch with no sector, naming the field", () => {
    const { sectorId, ...noSector } = ADDRESS;
    assert.deepEqual(failingPaths(hotel([{ name: "Rubavu", address: noSector }])), ["business.branches.0.address.sectorId"]);
  });
});

describe("a residence registration", () => {
  test("is accepted with no branches", () => {
    assert.deepEqual(failingPaths(residence(undefined)), []);
  });

  test("is refused when it carries a branch, rather than dropping it silently", () => {
    assert.deepEqual(failingPaths(residence([branch("Second building")])), ["business.branches"]);
  });
});
