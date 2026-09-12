/**
 * The two theme mechanisms have to agree, and this pins the one way they break.
 *
 * `apps/web` runs two of them on purpose. The four signed-in route groups use
 * `ThemeBoot`, a pre-paint inline script that reads
 * `localStorage["injishi-theme"]` and resolves an absent key to LIGHT. The
 * public layer uses next-themes, configured in
 * `components/layout/theme-provider.tsx` to write the same key with the same
 * values and to resolve an absent key the same way.
 *
 * Neither consults the OS. That is the product decision light-by-default rests
 * on, and it is only safe while BOTH halves hold it: if next-themes went back
 * to `enableSystem` while ThemeBoot stayed light, a visitor on a dark OS would
 * flip face every time they crossed between the public pages and the signed-in
 * ones. The second test below pins both halves for that reason.
 *
 * They agree on exactly two stored values: `"dark"` and `"light"`. next-themes
 * has a third, `"system"`, and writing it is silent poison: ThemeBoot reads
 * anything that is not `"dark"` as light, so a visitor who chose "follow my
 * system" would be pinned to light for good — the OS preference overridden by
 * the setting that asked to follow it.
 *
 * The toggles compute `resolvedTheme === "dark" ? "light" : "dark"` instead,
 * which can only ever produce the two shared values. This test fails the build
 * if any code path starts writing the third.
 *
 * ADR-013 AC-4. Run: pnpm --filter @injishi/web test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "..", "src");

function sourceFiles(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(path, out);
    else if (/\.(ts|tsx)$/.test(path) && statSync(path).isFile()) out.push(path);
  }
  return out;
}

/**
 * Comments are stripped before the search.
 *
 * Not a nicety: `theme-provider.tsx` explains this very invariant, and quotes
 * the forbidden call to do it. A test that reads its own documentation as a
 * violation teaches people to delete the documentation. The `[^:]` guard keeps
 * `https://` out of the line-comment rule.
 */
const stripComments = (text) =>
  text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const files = sourceFiles(SRC).map((path) => ({
  path,
  text: readFileSync(path, "utf8"),
  code: stripComments(readFileSync(path, "utf8")),
}));

describe("theme invariant", () => {
  test("nothing writes the literal \"system\" to the theme", () => {
    // Only a WRITE counts. `defaultTheme="system"` on the provider is required
    // and must not trip this: next-themes resolves that to "light" or "dark"
    // before it stores anything.
    const offenders = files
      .filter(({ code }) =>
        /setTheme\(\s*["'`]system["'`]\s*\)/.test(code) ||
        /setItem\(\s*["'`]injishi-theme["'`]\s*,\s*["'`]system["'`]/.test(code),
      )
      .map(({ path }) => path);
    assert.deepEqual(
      offenders,
      [],
      "ThemeBoot reads anything other than \"dark\" as light, so storing \"system\" " +
        "silently overrides the OS preference it was meant to follow.",
    );
  });

  test("next-themes is configured to match ThemeBoot", () => {
    const provider = files.find(({ path }) =>
      path.endsWith(join("components", "layout", "theme-provider.tsx")),
    );
    assert.ok(provider, "components/layout/theme-provider.tsx should exist");
    for (const setting of [
      'storageKey="injishi-theme"',
      'defaultTheme="light"',
      "enableSystem={false}",
    ]) {
      assert.ok(
        provider.code.includes(setting),
        `theme-provider.tsx must carry ${setting}: without it the public layer ` +
          "and the signed-in groups disagree about where the choice is stored " +
          "or what an absent key means.",
      );
    }
  });

  test("ThemeBoot resolves an absent key to light, not to the OS", () => {
    // The half that pairs with `enableSystem={false}` above. A `matchMedia`
    // call here is the exact regression that splits the two layers: the
    // signed-in groups would follow a dark OS while the public pages stayed
    // light, and crossing between them would change face mid-session.
    const boot = files.find(({ path }) =>
      path.endsWith(join("components", "app", "theme-boot.tsx")),
    );
    assert.ok(boot, "components/app/theme-boot.tsx should exist");
    assert.ok(
      !/matchMedia/.test(boot.code),
      "ThemeBoot must not consult prefers-color-scheme: light is the default " +
        "for an unset key, and theme-provider.tsx has enableSystem off to match.",
    );
    assert.ok(
      boot.code.includes("s==='dark'"),
      "ThemeBoot must resolve dark only from an explicit stored \"dark\".",
    );
  });

  test("ThemeBoot still reads the key the provider writes", () => {
    // The file is `theme-boot.tsx`, not `ThemeBoot.tsx`. Every file name in
    // this repo is kebab-case and only the exported symbol stays PascalCase;
    // this assertion kept the old spelling through that rename, so it was
    // failing on a missing file rather than checking the storage key.
    //
    // It is `components/app/theme-boot.tsx`, not `components/theme-boot.tsx`.
    // The file moved into the signed-in chrome directory and the path here did
    // not follow it, so the assertion has been red ever since and the storage
    // key it guards was never actually being checked.
    const boot = files.find(({ path }) =>
      path.endsWith(join("components", "app", "theme-boot.tsx")),
    );
    assert.ok(boot, "components/app/theme-boot.tsx should exist");
    assert.ok(
      boot.text.includes("injishi-theme"),
      "ThemeBoot must read `injishi-theme`, the key theme-provider.tsx writes.",
    );
  });
});
