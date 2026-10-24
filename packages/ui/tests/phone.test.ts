/**
 * Phone numbers: the kit's Rwandan rule agrees with contracts' `normalizeRwPhone` (the API's), and other
 * countries are taken only with their + code.
 *
 *   pnpm --filter @injishi/ui test
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";
import {
  formatPhone,
  INTL_PHONE_MESSAGE,
  isRwMobile,
  normalisePhone,
  normaliseRwPhone,
  phoneFieldText,
  phoneProblem,
  RW_PHONE_MESSAGE,
} from "../src/phone.ts";

const contracts = createRequire(import.meta.url)("../../contracts/dist/index.js") as {
  normalizeRwPhone: (raw: string) => string | null;
};

const SPELLINGS = [
  "0788123456",
  "788123456",
  "250788123456",
  "+250788123456",
  "+250 788 123 456",
  "0788-123-456",
  "(078) 812.3456",
  "0722123456",
  "0732123456",
  "0792123456",
  "0782123456",
  "0752123456",
  "0252123456",
  "078812345",
  "07881234567",
  "+256772123456",
  "+2507881234567",
  "phone 0788123456",
  "",
  "   ",
  "+",
  "2500788123456",
  "00250788123456",
];

test("the Rwandan rule matches contracts' normalizeRwPhone on every spelling", () => {
  for (const raw of SPELLINGS) {
    assert.equal(normaliseRwPhone(raw), contracts.normalizeRwPhone(raw), raw);
  }
});

test("Rwandan numbers become E.164 however they are written", () => {
  assert.equal(normaliseRwPhone("0788 123 456"), "+250788123456");
  assert.equal(normaliseRwPhone("+250 72 212 3456"), "+250722123456");
  assert.equal(isRwMobile("0752123456"), false, "75 is not a mobile prefix");
  assert.equal(isRwMobile("078812345"), false, "too short");
});

test("other countries need their + code and only when allowed", () => {
  assert.equal(normalisePhone("+256 772 123 456"), null);
  assert.equal(normalisePhone("+256 772 123 456", { allowInternational: true }), "+256772123456");
  assert.equal(normalisePhone("00256772123456", { allowInternational: true }), "+256772123456");
  assert.equal(normalisePhone("+250788123456", { allowInternational: true }), "+250788123456");
  assert.equal(normalisePhone("+250752123456", { allowInternational: true }), null, "+250 keeps the Rwandan rule");
  assert.equal(normalisePhone("0788123456", { allowInternational: true }), "+250788123456");
  assert.equal(normalisePhone("+12", { allowInternational: true }), null);
});

test("problems are worded, empty is left to the form", () => {
  assert.equal(phoneProblem(""), null);
  assert.equal(phoneProblem("0788123456"), null);
  assert.equal(phoneProblem("0752123456"), RW_PHONE_MESSAGE);
  assert.equal(phoneProblem("+256 7", { allowInternational: true }), INTL_PHONE_MESSAGE);
  assert.equal(phoneProblem("+250 75", { allowInternational: true }), RW_PHONE_MESSAGE);
});

test("display forms", () => {
  assert.equal(formatPhone("+250788123456"), "+250 788 123 456");
  assert.equal(formatPhone("+256772123456"), "+256772123456");
  assert.equal(phoneFieldText("+250788123456"), "788 123 456");
});
