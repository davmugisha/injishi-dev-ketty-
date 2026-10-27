/**
 * The catalogs are a scaffold, so what is pinned is their shape: one catalog
 * per locale, each a flat map of strings, and no key in Kinyarwanda that
 * English lacks (English is what a missing translation would show).
 *
 * Run: pnpm --filter @injishi/i18n test
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { catalogs, DEFAULT_LOCALE, isLocale, LOCALES } from "../src/index.ts";

describe("@injishi/i18n", () => {
  test("English and Kinyarwanda, English first", () => {
    assert.deepEqual([...LOCALES], ["en", "rw"]);
    assert.equal(DEFAULT_LOCALE, "en");
  });

  test("isLocale accepts only a locale", () => {
    assert.equal(isLocale("rw"), true);
    assert.equal(isLocale("fr"), false);
    assert.equal(isLocale("en-RW"), false);
    assert.equal(isLocale(undefined), false);
  });

  test("every locale has a catalog of strings", () => {
    for (const locale of LOCALES) {
      const catalog = catalogs[locale];
      assert.ok(catalog && typeof catalog === "object", `${locale} has a catalog`);
      for (const [key, value] of Object.entries(catalog)) {
        assert.equal(typeof value, "string", `${locale}:${key} is a string`);
      }
    }
  });

  test("Kinyarwanda names no key English lacks", () => {
    const english = new Set(Object.keys(catalogs.en));
    const extra = Object.keys(catalogs.rw).filter((key) => !english.has(key));
    assert.deepEqual(extra, []);
  });
});
