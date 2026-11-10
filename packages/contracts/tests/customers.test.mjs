/**
 * Customer management (CRM, phase 1): the field rules every screen and the API share.
 *
 * It tests the BUILT module (`dist/`), like the other contract tests, so the build must be current:
 *
 *   pnpm --filter @injishi/contracts test
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { describe, test } from "node:test";

const require = createRequire(import.meta.url);
const {
  AttachCustomerRequest,
  CUSTOMER_PAGE_SIZE,
  CUSTOMER_SEARCH_MIN,
  CreateCustomerRequest,
  CustomerListQuery,
  CustomerPhone,
  EraseCustomerRequest,
  MergeCustomersRequest,
  UpdateCustomerRequest,
  maskCustomerEmail,
  maskCustomerPhone,
} = require("../dist/index.js");

const phone = (raw) => CustomerPhone.safeParse(raw);
const create = (over = {}) => CreateCustomerRequest.safeParse({ fullName: "Jean Bosco", phone: "0788 123 456", ...over });

describe("a customer's phone", () => {
  test("every way a Rwandan writes a mobile number becomes the one stored form", () => {
    for (const raw of [
      "0788123456",
      "788123456",
      "250788123456",
      "+250788123456",
      "0788 123 456",
      "(078) 812-3456",
      " +250 788 123 456 ",
      "0788.123.456",
    ]) {
      const r = phone(raw);
      assert.equal(r.success, true, raw);
      assert.equal(r.data, "+250788123456", raw);
    }
  });

  test("all four Rwandan mobile networks are accepted, and nothing else is", () => {
    for (const prefix of ["72", "73", "78", "79"]) assert.equal(phone(`0${prefix}1234567`).data, `+250${prefix}1234567`);
    for (const prefix of ["70", "71", "74", "75", "76", "77", "80", "90"]) {
      assert.equal(phone(`0${prefix}1234567`).success, false, `07${prefix}`);
    }
  });

  test("a visitor's number is kept with its country code", () => {
    assert.equal(phone("+44 7911 123456").data, "+447911123456");
    assert.equal(phone("0044 7911 123456").data, "+447911123456");
    assert.equal(phone("+1 (415) 555-2671").data, "+14155552671");
  });

  test("junk, short, long and wrongly built numbers are refused with a sentence", () => {
    for (const raw of ["", "   ", "abcdefgh", "0788 12", "07881234567890", "+250 788 12", "+25078812345678", "078812345a", "+0123456789", "12345678901234567"]) {
      const r = phone(raw);
      assert.equal(r.success, false, JSON.stringify(raw));
      assert.match(r.error.issues[0].message, /Rwandan mobile|phone number/i, raw);
    }
  });

  test("two spellings of one number are the same stored value (so the unique index can catch the duplicate)", () => {
    assert.equal(phone("0788123456").data, phone("+250 788-123-456").data);
  });

  test("a landline or short code is not a customer's phone", () => {
    assert.equal(phone("0252 123 456").success, false);
    assert.equal(phone("112").success, false);
  });
});

describe("registering a customer", () => {
  test("a name and a phone are enough; consent is never assumed", () => {
    const r = create();
    assert.equal(r.success, true);
    assert.equal(r.data.phone, "+250788123456");
    assert.equal(r.data.marketingConsent, false);
    assert.equal(r.data.email, undefined);
  });

  test("the name is trimmed and must be a real name", () => {
    assert.equal(create({ fullName: "  Anna  " }).data.fullName, "Anna");
    assert.equal(create({ fullName: "A" }).success, false);
    assert.equal(create({ fullName: "   " }).success, false);
    assert.equal(create({ fullName: "x".repeat(121) }).success, false);
    assert.equal(create({ fullName: undefined }).success, false);
  });

  test("the phone is required", () => {
    const r = create({ phone: undefined });
    assert.equal(r.success, false);
    assert.match(r.error.issues[0].message, /phone/i);
  });

  test("an email is optional, lower-cased, and a blank field means none", () => {
    assert.equal(create({ email: "Jean@Example.COM" }).data.email, "jean@example.com");
    assert.equal(create({ email: "" }).data.email, null);
    assert.equal(create({ email: "   " }).data.email, null);
    assert.equal(create({ email: "not-an-email" }).success, false);
    assert.equal(create({ email: `${"a".repeat(195)}@x.com` }).success, false);
  });

  test("notes are trimmed, optional and bounded", () => {
    assert.equal(create({ notes: "  allergic to nuts " }).data.notes, "allergic to nuts");
    assert.equal(create({ notes: "" }).data.notes, null);
    assert.equal(create({ notes: "x".repeat(501) }).success, false);
  });

  test("unknown fields cannot smuggle in a workspace, status or id", () => {
    const r = create({ workspaceId: "11111111-1111-4111-8111-111111111111", status: "erased", id: "x" });
    assert.equal(r.success, true);
    assert.equal("workspaceId" in r.data, false);
    assert.equal("status" in r.data, false);
    assert.equal("id" in r.data, false);
  });
});

describe("correcting a customer", () => {
  test("any one field may change, and an empty change is refused", () => {
    assert.equal(UpdateCustomerRequest.safeParse({ fullName: "Anna Uwase" }).success, true);
    assert.equal(UpdateCustomerRequest.safeParse({ phone: "0722 000 111" }).data.phone, "+250722000111");
    assert.equal(UpdateCustomerRequest.safeParse({ email: null }).success, true);
    assert.equal(UpdateCustomerRequest.safeParse({ marketingConsent: true }).success, true);
    assert.equal(UpdateCustomerRequest.safeParse({}).success, false);
  });

  test("a changed phone is validated like a new one", () => {
    assert.equal(UpdateCustomerRequest.safeParse({ phone: "12345" }).success, false);
  });
});

describe("searching", () => {
  test("a page is 25 rows unless asked otherwise, never more than 100, and the offset is not negative", () => {
    assert.equal(CUSTOMER_PAGE_SIZE, 25);
    assert.deepEqual(CustomerListQuery.parse({}), { limit: 25, offset: 0 });
    assert.equal(CustomerListQuery.parse({ limit: "50", offset: "25" }).limit, 50);
    assert.equal(CustomerListQuery.safeParse({ limit: 101 }).success, false);
    assert.equal(CustomerListQuery.safeParse({ limit: 0 }).success, false);
    assert.equal(CustomerListQuery.safeParse({ offset: -1 }).success, false);
  });

  test("a look-up needs at least three characters", () => {
    assert.equal(CUSTOMER_SEARCH_MIN, 3);
  });
});

describe("orders, merging and erasing", () => {
  const id = "11111111-1111-4111-8111-111111111111";

  test("a customer is put on an order, or taken off it with null", () => {
    assert.equal(AttachCustomerRequest.safeParse({ customerId: id }).success, true);
    assert.equal(AttachCustomerRequest.safeParse({ customerId: null }).success, true);
    assert.equal(AttachCustomerRequest.safeParse({ customerId: "nope" }).success, false);
    assert.equal(AttachCustomerRequest.safeParse({}).success, false);
  });

  test("a merge and an erase must say why", () => {
    assert.equal(MergeCustomersRequest.safeParse({ intoCustomerId: id, reason: "same person" }).success, true);
    assert.equal(MergeCustomersRequest.safeParse({ intoCustomerId: id, reason: "" }).success, false);
    assert.equal(MergeCustomersRequest.safeParse({ intoCustomerId: id }).success, false);
    assert.equal(EraseCustomerRequest.safeParse({ reason: "asked to be forgotten" }).success, true);
    assert.equal(EraseCustomerRequest.safeParse({ reason: "  " }).success, false);
  });
});

describe("masking", () => {
  test("a phone keeps its country code and last three digits", () => {
    assert.equal(maskCustomerPhone("+250788123456"), "+250******456");
    assert.equal(maskCustomerPhone("+447911123456"), "+447******456");
    assert.equal(maskCustomerPhone("+250788123456").length, "+250788123456".length);
  });

  test("a masked phone cannot be turned back into the number", () => {
    assert.equal(maskCustomerPhone("+250788123456").includes("788"), false);
  });

  test("an email keeps its first letter and its domain", () => {
    assert.equal(maskCustomerEmail("jean@example.com"), "j***@example.com");
    assert.equal(maskCustomerEmail("nonsense"), "***");
  });
});
