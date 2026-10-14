/**
 * `redactText` (ADR-063, "The patterns"): the one definition of what personal
 * data looks like inside an error string, shared by the phone's crash reporter
 * and the API's `beforeSend`.
 *
 * Every row of the spec's pattern table has an exact placeholder pinned here,
 * because both sides read this helper and a changed placeholder changes what
 * Sentry groups and what a person searching an issue sees. The fixture list in
 * "Critical test scenarios" is run as one string at the end, and the two things
 * that must SURVIVE (prose punctuation and a constraint name) are pinned too:
 * a scrubber that eats everything is as useless as one that eats nothing.
 *
 * It tests the BUILT module (`dist/`), like every other test in this folder.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { redactText, REDACT_MAX_INPUT } = require("../dist/index.js");

describe("redactText, row by row", () => {
  test("1. drops the query and fragment of a URL or a path token", () => {
    assert.equal(
      redactText("GET https://api-demo.injishi.com/api/v1/search?q=Jane#top failed"),
      "GET https://api-demo.injishi.com/api/v1/search failed",
    );
    assert.equal(redactText("GET /api/v1/search?q=Jane failed"), "GET /api/v1/search failed");
    assert.equal(redactText('fetch("/api/x?q=Jane")'), 'fetch("/api/x');
  });

  test("1. leaves a ? or # in prose alone", () => {
    assert.equal(redactText("Why did it fail? See #4"), "Why did it fail? See #4");
    assert.equal(redactText("and/or? either"), "and/or? either");
  });

  test("2. names a file on the phone without its path", () => {
    assert.equal(
      redactText("could not read file:///data/user/0/rw.injishi.mobile/cache/x.jpg now"),
      "could not read [local file] now",
    );
    assert.equal(redactText("content://media/external/images/12"), "[local file]");
    assert.equal(redactText("ph://ABCD-1234/L0/001"), "[local file]");
    assert.equal(
      redactText("ENOENT /data/user/0/rw.injishi.mobile/cache/ImagePicker/x.jpg"),
      "ENOENT [local file]",
    );
    assert.equal(redactText("at /storage/emulated/0/DCIM/a.jpg"), "at [local file]");
    assert.equal(redactText("at /sdcard/a.jpg"), "at [local file]");
    assert.equal(redactText("at /var/mobile/Containers/Data/x.jpg"), "at [local file]");
    assert.equal(redactText("at /private/var/mobile/x.jpg"), "at [local file]");
  });

  test("3. cuts a Drizzle parameter list to the end, across lines", () => {
    assert.equal(
      redactText('Failed query: select * from users where email = $1\nparams: jane@x.rw,\n"Jane Mukamana"'),
      "Failed query: select * from users where email = $1\nparams: [redacted]",
    );
  });

  test("4. replaces the value a Postgres message quotes", () => {
    assert.equal(
      redactText('invalid input syntax for type uuid: "Jane Mukamana"'),
      'invalid input syntax for type uuid: "[value]"',
    );
    assert.equal(
      redactText('invalid input value for enum booking_status: "Jane"'),
      'invalid input value for enum booking_status: "[value]"',
    );
    assert.equal(
      redactText('date/time field value out of range: "Jane"'),
      'date/time field value out of range: "[value]"',
    );
  });

  test("5. hides a bearer credential", () => {
    assert.equal(redactText("Authorization: Bearer abc.def-ghi"), "Authorization: Bearer [redacted]");
  });

  test("6. hides a JWT", () => {
    assert.equal(
      redactText("token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.c2lnbmF0dXJl was bad"),
      "token [token] was bad",
    );
  });

  test("7. hides a signed session token, %2B in its signature included", () => {
    const token = "Ab3dEf5hIj7lMn9pQr1tUv3xYz5bCd7f.Xy%2BzW1v%2Fu2t3s4r5q6p%3D";
    assert.equal(redactText(`cookie ${token}; Path=/`), "cookie [token]; Path=/");
  });

  test("8. turns a UUID into :id, inside a URL path too", () => {
    assert.equal(
      redactText("https://api.injishi.com/api/v1/leases/3f0c2a9e-1b2c-4d5e-8f90-a1b2c3d4e5f6/sign"),
      "https://api.injishi.com/api/v1/leases/:id/sign",
    );
  });

  test("9. hides an email, %40 included", () => {
    assert.equal(redactText("no account for jane@x.rw"), "no account for [email]");
    assert.equal(redactText("no account for jane%40x.rw"), "no account for [email]");
    assert.equal(redactText("to: J.Mukamana+work@mail.example.com."), "to: [email].");
  });

  test("10. hides a Rwandan mobile number in every spelling", () => {
    for (const spelling of [
      "+250 788 123 456",
      "0781234567",
      "073 123 4567",
      "(+250) 788-123-456",
      "250791234567",
      "788123456",
      "%2B250788123456",
      "+250.722.123.456",
    ]) {
      assert.equal(redactText(`call ${spelling} now`), "call [phone] now", spelling);
    }
  });

  test("10. hides any + number of 9 to 15 digits", () => {
    assert.equal(redactText("call +1 555 123 4567"), "call [phone]");
    assert.equal(redactText("call +44 20 7946 0958"), "call [phone]");
  });

  test("10. does not read a number inside a longer digit run as a phone", () => {
    // Eleven digits: not a phone, and too short and too long for the digit rows.
    assert.equal(redactText("ref 07812345678"), "ref 07812345678");
  });

  test("11. hides 13 to 19 digits, single spaces allowed", () => {
    assert.equal(redactText("ID 1199080012345678 refused"), "ID [number] refused");
    assert.equal(redactText("ID 1 1990 8 0012345 6 78 refused"), "ID [number] refused");
    assert.equal(redactText("card 4111111111111"), "card [number]");
  });

  test("12. hides a nine digit TIN", () => {
    assert.equal(redactText("TIN 999031001 unknown"), "TIN [number] unknown");
  });

  test("13. hides six digits whatever touches them", () => {
    assert.equal(redactText("otp123456"), "otp[code]");
    assert.equal(redactText("code=123456&x"), "code=[code]&x");
    assert.equal(redactText("123456"), "[code]");
  });

  test("13. leaves shorter and longer digit runs alone", () => {
    assert.equal(redactText("status 500, 12345, 1234567"), "status 500, 12345, 1234567");
  });

  test("14. hides a long random run, keeps a SQL identifier", () => {
    const random = "aB3dE5fG7hI9jK1lM3nO5pQ7rS9tU1vW3xY5zA7bC9dE1fG3hI5jK7lM9nO1pQ3r";
    assert.equal(redactText(`key ${random} expired`), "key [token] expired");
    assert.equal(
      redactText('duplicate key value violates unique constraint "stay_refund_requests_one_open_per_stay_uk"'),
      'duplicate key value violates unique constraint "stay_refund_requests_one_open_per_stay_uk"',
    );
  });
});

describe("redactText, as a whole", () => {
  test("cuts input to the maximum before anything else", () => {
    assert.equal(REDACT_MAX_INPUT, 2000);
    const long = "a ".repeat(1500);
    assert.equal(redactText(long).length, 2000);
  });

  test("returns an empty string for anything that is not a string", () => {
    assert.equal(redactText(undefined), "");
    assert.equal(redactText(null), "");
    assert.equal(redactText(42), "");
  });

  test("is stable when run twice", () => {
    const once = redactText("jane@x.rw +250 788 123 456 otp123456");
    assert.equal(redactText(once), once);
  });

  test("the critical scenario fixtures leave nothing personal", () => {
    const fixtures = [
      "jane@x.rw",
      "jane%40x.rw",
      "+250 788 123 456",
      "0781234567",
      "073 123 4567",
      "(+250) 788-123-456",
      "250791234567",
      "788123456",
      "999031001",
      "1 1990 8 0012345 6 78",
      "1199080012345678",
      "otp123456",
      "code=123456",
      "Bearer s3cr3t-value",
      "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.c2lnbmF0dXJl",
      "Ab3dEf5hIj7lMn9pQr1tUv3xYz5bCd7f.Xy%2BzW1v%2Fu2t3s4r5q6p%3D",
      "aB3dE5fG7hI9jK1lM3nO5pQ7rS9tU1vW3xY5zA7bC9dE1fG3hI5jK7lM9nO1pQ3r",
      "https://api.injishi.com/api/v1/leases/3f0c2a9e-1b2c-4d5e-8f90-a1b2c3d4e5f6/sign",
      "https://api.injishi.com/api/v1/search?q=Jane",
      "file:///data/user/0/rw.injishi.mobile/cache/x.jpg",
      "/data/user/0/rw.injishi.mobile/cache/ImagePicker/x.jpg",
    ];
    const out = redactText(fixtures.join(" | "));
    for (const leak of [
      "jane",
      "788",
      "781234567",
      "123 4567",
      "791234567",
      "999031001",
      "1990",
      "1199080012345678",
      "123456",
      "s3cr3t",
      "eyJ",
      "Ab3dEf5h",
      "aB3dE5fG",
      "3f0c2a9e",
      "Jane",
      "rw.injishi.mobile",
      "ImagePicker",
    ]) {
      assert.ok(!out.includes(leak), `"${leak}" survived: ${out}`);
    }
  });
});
