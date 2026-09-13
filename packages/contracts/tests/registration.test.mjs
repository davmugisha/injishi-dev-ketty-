/**
 * An on behalf of registration names its owner well enough to be claimed.
 *
 * Owner ruling 2026-09-13 (ADR-053 J25). The intended owner's email and national
 * id used to be optional, and each one missing stranded the business: no email
 * means no claim invitation is sent, and no national id means no claimant can
 * ever match. The API validates against this schema, so these assertions are the
 * rule on both ends of the wire.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { CreateRegistrationRequest } = require("../dist/index.js");

const OWNER_NID = "1199980049049777";

function onBehalfOf(intendedOwner) {
  return {
    role: "host",
    capacity: "on_behalf_of",
    ...(intendedOwner === undefined ? {} : { intendedOwner }),
    business: {
      domain: "hospitality",
      legalName: "Umurage Guesthouse",
      address: { country: "RW", provinceId: 1, districtId: 102, sectorId: 10201 },
      accommodationClass: "guest_house",
      tin: "123456789",
      certificates: [],
    },
  };
}

/** The issue paths a request fails on, as dotted strings. */
function failingPaths(request) {
  const result = CreateRegistrationRequest.safeParse(request);
  return result.success ? [] : [...new Set(result.error.issues.map((i) => i.path.join(".")))];
}

describe("an on behalf of registration", () => {
  test("is accepted with the owner's name, national id and email", () => {
    const result = CreateRegistrationRequest.safeParse(
      onBehalfOf({ name: "Aline Uwase", nationalId: "1199 9800 4904 9777", email: " aline@example.rw " }),
    );
    assert.equal(result.success, true);
    assert.deepEqual(result.data.intendedOwner, {
      name: "Aline Uwase",
      nationalId: OWNER_NID,
      email: "aline@example.rw",
    });
  });

  test("is refused without the owner's email, naming the field", () => {
    assert.deepEqual(failingPaths(onBehalfOf({ name: "Aline Uwase", nationalId: OWNER_NID })), [
      "intendedOwner.email",
    ]);
  });

  test("is refused with a blank email, naming the field", () => {
    assert.deepEqual(
      failingPaths(onBehalfOf({ name: "Aline Uwase", nationalId: OWNER_NID, email: "   " })),
      ["intendedOwner.email"],
    );
  });

  test("is refused without the owner's national id, naming the field", () => {
    assert.deepEqual(failingPaths(onBehalfOf({ name: "Aline Uwase", email: "aline@example.rw" })), [
      "intendedOwner.nationalId",
    ]);
  });

  test("is refused with a national id that is not 16 digits", () => {
    assert.deepEqual(
      failingPaths(onBehalfOf({ name: "Aline Uwase", nationalId: "11999", email: "aline@example.rw" })),
      ["intendedOwner.nationalId"],
    );
  });

  test("is refused with no intended owner at all", () => {
    assert.deepEqual(failingPaths(onBehalfOf(undefined)), ["intendedOwner"]);
  });
});

describe("an owner's own registration", () => {
  test("needs no intended owner", () => {
    const request = onBehalfOf(undefined);
    request.capacity = "owner";
    assert.equal(CreateRegistrationRequest.safeParse(request).success, true);
  });
});
