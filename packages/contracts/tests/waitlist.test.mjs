/**
 * The waitlist wire contract, pinned (ADR-048).
 *
 * This is the one definition both ends of a public, anonymous write agree on:
 * the form is typed against it and the API parses every body with it. So the
 * rules it carries (an owner row is complete or refused, a phone is stored in
 * one spelling, an unknown key is refused, a page is capped) hold for any
 * caller, not only for the form.
 *
 * It tests the BUILT module (`dist/`), like `authz.test.mjs`, because `dist/` is
 * what every consumer imports. `pnpm test` builds first.
 *
 *   pnpm --filter @injishi/contracts test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  WaitlistSignupInput,
  WaitlistSignupResult,
  WaitlistUnsubscribeResult,
  WaitlistPropertyType,
  WaitlistSizeBand,
  AdminWaitlistQuery,
  AdminWaitlistExportQuery,
  WAITLIST_PROPERTY_TYPE_LABEL,
  WAITLIST_SIZE_BAND_LABEL,
  WAITLIST_EMAIL_MAX,
  WAITLIST_NAME_MAX,
  WAITLIST_PHONE_MAX,
  WAITLIST_BUSINESS_NAME_MAX,
} = require("../dist/index.js");

const TRAVELLER = {
  audience: "traveller",
  email: "amani@example.com",
  fullName: "Amani Uwase",
};

const OWNER = {
  audience: "owner",
  email: "owner@example.com",
  fullName: "Grace Mukamana",
  phone: "0788123456",
  businessName: "Umurage Guest House",
  districtId: 103,
  propertyType: "guest_house",
  sizeBand: "6_20",
};

const parse = (body) => WaitlistSignupInput.safeParse(body);
const issuePaths = (result) => result.error.issues.map((i) => i.path.join("."));

describe("a traveller signup (covers: AC-8)", () => {
  test("needs only email and full name", () => {
    const result = parse(TRAVELLER);

    assert.equal(result.success, true);
    assert.equal(result.data.audience, "traveller");
  });

  test("defaults marketing consent to false when it is left out (covers: AC-15)", () => {
    assert.equal(parse(TRAVELLER).data.marketingOptIn, false);
  });

  test("keeps marketing consent exactly as given (covers: AC-15)", () => {
    assert.equal(parse({ ...TRAVELLER, marketingOptIn: true }).data.marketingOptIn, true);
  });

  test("accepts a phone from abroad, since the field is optional and loose", () => {
    const result = parse({ ...TRAVELLER, phone: "+1 (555) 010-0100" });

    assert.equal(result.success, true);
    assert.equal(result.data.phone, "+1 (555) 010-0100");
  });

  test("refuses a phone that is prose rather than digits", () => {
    const result = parse({ ...TRAVELLER, phone: "call me maybe" });

    assert.equal(result.success, false);
    assert.deepEqual(issuePaths(result), ["phone"]);
  });

  test("refuses an owner field on a traveller body, since unknown keys are refused", () => {
    const result = parse({ ...TRAVELLER, businessName: "Sneaky Lodge" });

    assert.equal(result.success, false);
  });

  for (const field of ["email", "fullName"]) {
    test(`refuses a body without ${field}`, () => {
      const body = { ...TRAVELLER };
      delete body[field];

      const result = parse(body);

      assert.equal(result.success, false);
      assert.ok(issuePaths(result).includes(field));
    });
  }

  test("refuses a name that is only spaces", () => {
    const result = parse({ ...TRAVELLER, fullName: "   " });

    assert.equal(result.success, false);
    assert.equal(result.error.issues[0].message, "Enter your name.");
  });
});

describe("the email address (covers: AC-10)", () => {
  test("is trimmed and lower cased, so one mailbox is one row", () => {
    assert.equal(parse({ ...TRAVELLER, email: "  Someone@Example.COM " }).data.email, "someone@example.com");
  });

  test("keeps a plus tag in the stored address", () => {
    assert.equal(parse({ ...TRAVELLER, email: "a+1@x.rw" }).data.email, "a+1@x.rw");
  });

  test("refuses something that is not an address, with the copy.md message", () => {
    const result = parse({ ...TRAVELLER, email: "not-an-address" });

    assert.equal(result.success, false);
    assert.equal(result.error.issues[0].message, "Enter an email address we can reach you on.");
  });

  test("refuses an address longer than the RFC 5321 limit", () => {
    const long = `${"a".repeat(WAITLIST_EMAIL_MAX)}@x.rw`;

    assert.equal(parse({ ...TRAVELLER, email: long }).success, false);
  });
});

describe("an owner signup (covers: AC-8, AC-14)", () => {
  test("is accepted when all seven fields are present", () => {
    assert.equal(parse(OWNER).success, true);
  });

  test("stores a local format phone in +250 form (covers: AC-8)", () => {
    assert.equal(parse(OWNER).data.phone, "+250788123456");
  });

  for (const spelling of ["0788 123 456", "+250788123456", "250788123456", "788123456"]) {
    test(`normalizes "${spelling}" to one spelling`, () => {
      assert.equal(parse({ ...OWNER, phone: spelling }).data.phone, "+250788123456");
    });
  }

  test("refuses 12345 with the Rwandan mobile message (covers: AC-8)", () => {
    const result = parse({ ...OWNER, phone: "12345" });

    assert.equal(result.success, false);
    assert.equal(result.error.issues[0].message, "Enter a Rwandan mobile number, like 0788 123 456.");
  });

  test("refuses a Rwandan number that is not a mobile", () => {
    assert.equal(parse({ ...OWNER, phone: "0252123456" }).success, false);
  });

  for (const field of ["phone", "businessName", "districtId", "propertyType", "sizeBand"]) {
    test(`refuses an owner body without ${field}, so no half filled owner row can be written (covers: AC-14)`, () => {
      const body = { ...OWNER };
      delete body[field];

      const result = parse(body);

      assert.equal(result.success, false);
      assert.ok(issuePaths(result).includes(field), `issues were ${issuePaths(result)}`);
    });
  }

  test("refuses a blank business name with the copy.md message", () => {
    const result = parse({ ...OWNER, businessName: "  " });

    assert.equal(result.success, false);
    assert.equal(result.error.issues[0].message, "This one is needed so we can get in touch properly.");
  });

  for (const districtId of [0, -4, 1.5, "103"]) {
    test(`refuses district id ${JSON.stringify(districtId)}`, () => {
      assert.equal(parse({ ...OWNER, districtId }).success, false);
    });
  }

  test("refuses a property type outside the eight", () => {
    assert.equal(parse({ ...OWNER, propertyType: "castle" }).success, false);
  });

  test("refuses a size band outside the four", () => {
    assert.equal(parse({ ...OWNER, sizeBand: "100_plus" }).success, false);
  });

  test("refuses an unknown audience", () => {
    assert.equal(parse({ ...OWNER, audience: "investor" }).success, false);
  });
});

describe("string caps on a public write", () => {
  const cases = [
    ["fullName", WAITLIST_NAME_MAX, TRAVELLER],
    ["businessName", WAITLIST_BUSINESS_NAME_MAX, OWNER],
  ];

  for (const [field, max, base] of cases) {
    test(`accepts ${field} at ${max} characters and refuses one more`, () => {
      assert.equal(parse({ ...base, [field]: "x".repeat(max) }).success, true);
      assert.equal(parse({ ...base, [field]: "x".repeat(max + 1) }).success, false);
    });
  }

  test(`refuses a traveller phone longer than ${WAITLIST_PHONE_MAX} characters`, () => {
    assert.equal(parse({ ...TRAVELLER, phone: "1".repeat(WAITLIST_PHONE_MAX + 1) }).success, false);
  });
});

describe("the closed choices the form renders", () => {
  test("offers exactly the eight property types, each with a label", () => {
    assert.deepEqual(WaitlistPropertyType.options, [
      "hotel", "guest_house", "apartment", "lodge", "villa", "hostel", "homestay", "campsite",
    ]);
    assert.deepEqual(Object.keys(WAITLIST_PROPERTY_TYPE_LABEL).sort(), [...WaitlistPropertyType.options].sort());
  });

  test("offers exactly the four size bands, each with the copy.md label", () => {
    assert.deepEqual(WaitlistSizeBand.options, ["1_5", "6_20", "21_50", "50_plus"]);
    assert.deepEqual(WAITLIST_SIZE_BAND_LABEL, {
      "1_5": "1 to 5",
      "6_20": "6 to 20",
      "21_50": "21 to 50",
      "50_plus": "More than 50",
    });
  });
});

describe("what a signup answers (covers: AC-9, AC-12)", () => {
  test("a result is a uuid and a flag", () => {
    const ok = WaitlistSignupResult.safeParse({ id: "3e99c55b-a014-47b0-8711-1619c28ae1c6", alreadyJoined: false });

    assert.equal(ok.success, true);
  });

  test("a result id must be a uuid", () => {
    assert.equal(WaitlistSignupResult.safeParse({ id: "42", alreadyJoined: true }).success, false);
  });

  test("an unsubscribe answer has no failure shape to reveal anything (covers: AC-12)", () => {
    assert.equal(WaitlistUnsubscribeResult.safeParse({ ok: true }).success, true);
    assert.equal(WaitlistUnsubscribeResult.safeParse({ ok: false }).success, false);
  });
});

describe("the staff list query (covers: AC-17)", () => {
  test("defaults to the first page of 50", () => {
    assert.deepEqual(AdminWaitlistQuery.parse({}), { limit: 50, offset: 0 });
  });

  test("reads filters and paging from query string values", () => {
    assert.deepEqual(
      AdminWaitlistQuery.parse({ audience: "owner", districtId: "103", limit: "25", offset: "50" }),
      { audience: "owner", districtId: 103, limit: 25, offset: 50 },
    );
  });

  test("caps a page at 100 rows, so one call cannot pull the whole list", () => {
    assert.equal(AdminWaitlistQuery.safeParse({ limit: "100" }).success, true);
    assert.equal(AdminWaitlistQuery.safeParse({ limit: "101" }).success, false);
  });

  for (const [key, value] of [["limit", "0"], ["offset", "-1"], ["districtId", "abc"], ["audience", "staff"]]) {
    test(`refuses ${key}=${value}`, () => {
      assert.equal(AdminWaitlistQuery.safeParse({ [key]: value }).success, false);
    });
  }

  test("the export query carries no page at all, so it can never be truncated", () => {
    const parsed = AdminWaitlistExportQuery.parse({ audience: "traveller", districtId: "507", limit: "10", offset: "5" });

    assert.deepEqual(parsed, { audience: "traveller", districtId: 507 });
  });
});
