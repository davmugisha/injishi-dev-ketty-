/**
 * Email typos: the kit's suggestions are contracts' (`suggestEmailFix`, which the API runs), address for
 * address, and the sentence is the same.
 *
 *   pnpm --filter @injishi/ui test
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";
import { emailTypoMessage, looksLikeEmail, suggestEmailFix } from "../src/email-typo.ts";

const contracts = createRequire(import.meta.url)("../../contracts/dist/index.js") as {
  suggestEmailFix: (email: string) => string | null;
  emailTypoMessage: (suggestion: string) => string;
};

const ADDRESSES = [
  "alice@demo.injishi.con",
  "aline@gmial.com",
  "aline@gmail.co",
  "aline@gmail.cm",
  "aline@company.co",
  "aline@company.cm",
  "Aline@GMAIL.COM",
  "  aline@yaho.com ",
  "aline@hotmial.con",
  "aline@outlok.com",
  "aline@icoud.com",
  "aline@mail.gmial.com",
  "aline@gmail.co.uk",
  "aline@yahoo.co",
  "aline@yahoo.fr",
  "aline@injishi.rw",
  "aline@",
  "@gmail.com",
  "aline",
  "aline@gmail",
  "aline@gmail..com",
  "a@b.comm",
  "a@b.xom",
  "a@b.vom",
  "a@gnail.ocm",
  "",
];

test("suggestions match contracts' suggestEmailFix for every address", () => {
  for (const address of ADDRESSES) {
    assert.equal(suggestEmailFix(address), contracts.suggestEmailFix(address), address);
  }
});

test("the usual slips are caught, real addresses are left alone", () => {
  assert.equal(suggestEmailFix("alice@demo.injishi.con"), "alice@demo.injishi.com");
  assert.equal(suggestEmailFix("aline@gmial.com"), "aline@gmail.com");
  assert.equal(suggestEmailFix("aline@gmail.co"), "aline@gmail.com");
  assert.equal(suggestEmailFix("aline@company.co"), null, ".co is Colombia unless it is a .com provider");
  assert.equal(suggestEmailFix("aline@injishi.rw"), null);
});

test("the sentence is the API's", () => {
  assert.equal(emailTypoMessage("a@gmail.com"), contracts.emailTypoMessage("a@gmail.com"));
});

test("looksLikeEmail is a shape check", () => {
  assert.equal(looksLikeEmail("aline@injishi.rw"), true);
  assert.equal(looksLikeEmail(" aline@injishi.rw "), true);
  assert.equal(looksLikeEmail("aline@injishi"), false);
  assert.equal(looksLikeEmail("aline @injishi.rw"), false);
  assert.equal(looksLikeEmail("aline@@injishi.rw"), false);
  assert.equal(looksLikeEmail("aline@injishi..rw"), false);
});
