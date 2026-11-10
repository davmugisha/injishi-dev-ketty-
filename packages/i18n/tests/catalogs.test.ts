/**
 * The catalogs' contract, pinned.
 *
 * English is the source: every other locale must carry exactly its keys, so a
 * key added in one place and forgotten in another fails here rather than on a
 * screen. Placeholders are checked too — a French sentence that drops `{count}`
 * is a runtime blank, and ICU would happily format it.
 *
 * Run: pnpm --filter @injishi/i18n test
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  catalogKeys,
  catalogs,
  DEFAULT_LOCALE,
  formatLocale,
  isLocale,
  LOCALES,
} from "../src/index.ts";

/** The `{name}` placeholders in a message, sorted, ignoring ICU plural syntax. */
function placeholders(message: string): string[] {
  return [...message.matchAll(/\{([a-zA-Z_][a-zA-Z0-9_]*)/g)]
    .map((match) => match[1]!)
    .sort();
}

describe("@injishi/i18n", () => {
  test("English, French and Kinyarwanda, English first", () => {
    assert.deepEqual([...LOCALES], ["en", "fr", "rw"]);
    assert.equal(DEFAULT_LOCALE, "en");
  });

  test("isLocale accepts only a locale", () => {
    assert.equal(isLocale("rw"), true);
    assert.equal(isLocale("fr"), true);
    assert.equal(isLocale("en-RW"), false);
    assert.equal(isLocale(undefined), false);
  });

  test("every locale maps to a Rwandan formatting tag", () => {
    assert.equal(formatLocale("en"), "en-RW");
    assert.equal(formatLocale("fr"), "fr-RW");
    assert.equal(formatLocale("rw"), "rw-RW");
  });

  test("every locale has the same keys as English", () => {
    const english = catalogKeys(catalogs.en);
    assert.ok(english.length > 0, "the English catalog has keys");
    for (const locale of LOCALES) {
      assert.deepEqual(catalogKeys(catalogs[locale]), english, `${locale} matches English's keys`);
    }
  });

  test("no message is empty", () => {
    for (const locale of LOCALES) {
      const stack = [catalogs[locale]] as object[];
      while (stack.length > 0) {
        const node = stack.pop()!;
        for (const [key, value] of Object.entries(node)) {
          if (typeof value === "string") {
            assert.notEqual(value.trim(), "", `${locale}:${key} is not empty`);
          } else {
            stack.push(value);
          }
        }
      }
    }
  });

  test("a locale keeps English's placeholders", () => {
    const english = new Map(
      catalogKeys(catalogs.en).map((key) => [key, englishValue(catalogs.en, key)]),
    );
    for (const locale of LOCALES) {
      if (locale === "en") continue;
      for (const [key, message] of english) {
        const translated = englishValue(catalogs[locale], key);
        assert.deepEqual(
          placeholders(translated),
          placeholders(message),
          `${locale}:${key} keeps the same placeholders`,
        );
      }
    }
  });
});

function englishValue(catalog: object, path: string): string {
  const value = path.split(".").reduce<unknown>((node, part) => {
    return typeof node === "object" && node !== null ? (node as Record<string, unknown>)[part] : undefined;
  }, catalog);
  assert.equal(typeof value, "string", `${path} is a message`);
  return value as string;
}
