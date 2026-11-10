/**
 * A component's source with its English words put back where `t(...)` asks for them.
 *
 * Since ADR-074's catalogs (#117), the register and host screens say their
 * words through next-intl: `legend={t("legend")}`, not `legend="Part of a
 * franchise?"`. Tests that hold a screen to the words an ADR wrote read the
 * source, so they read it through this: every `t("key")` whose `t` was made by
 * `useTranslations("ns")` or `getTranslations("ns")` in the same file becomes
 * the English catalog's `ns.key`, in the shape the literal had:
 *
 *   attr={t("k")}   ->  attr="words"
 *   >{t("k")}<      ->  >words<
 *   t("k")          ->  "words"        (in an expression)
 *
 * A call with values (`t("k", { n })`) is left as it is: its words are a
 * template, and no test here asserts one. A key the catalog does not hold
 * throws, so a renamed key fails the test that reads it instead of passing on
 * the untouched call.
 */
import { readFileSync } from "node:fs";

const { catalogs } = await import("@injishi/i18n");

/** `a.b.c` in the English catalog, or a thrown error naming the key. */
function english(path) {
  let node = catalogs.en;
  for (const part of path.split(".")) {
    if (node === null || typeof node !== "object" || !(part in node)) {
      throw new Error(`The English catalog has no "${path}".`);
    }
    node = node[part];
  }
  if (typeof node !== "string") throw new Error(`"${path}" in the English catalog is not a message.`);
  return node;
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The source text with each translator call replaced by its English words. */
export function withEnglish(source) {
  const translators = new Map();
  for (const m of source.matchAll(/const\s+(\w+)\s*=\s*(?:await\s+getTranslations|useTranslations)\(\s*"([^"]+)"\s*\)/g)) {
    translators.set(m[1], m[2]);
  }
  let out = source;
  for (const [fn, ns] of translators) {
    const call = `${escapeRe(fn)}\\(\\s*"([^"]+)"\\s*\\)`;
    const words = (key) => english(`${ns}.${key}`);
    out = out
      .replace(new RegExp(`=\\{${call}\\}`, "g"), (_, key) => `="${words(key)}"`)
      .replace(new RegExp(`\\{${call}\\}`, "g"), (_, key) => words(key))
      .replace(new RegExp(`(?<![\\w.])${call}`, "g"), (_, key) => JSON.stringify(words(key)));
  }
  return out;
}

/** Read a file and put its English words back (`withEnglish`). */
export function readEnglish(path) {
  return withEnglish(readFileSync(path, "utf8"));
}
