/**
 * A module resolve hook, so a test can import the app's real `.ts` modules.
 *
 * Node strips the types by itself; what it cannot do is resolve the two things
 * every module in this app is written with:
 *
 *  - the `@/` alias, which only `tsconfig.json` and the bundler understand;
 *  - extensionless relative specifiers (`./cn`), which are legal TypeScript
 *    and not legal ESM.
 *
 * `guest-money-reads.test.mjs` solves the same problem by transpiling one file
 * and textually rebinding its imports, which is right for a module with two
 * seams to stub. This is the other case: a module with a dependency TREE that
 * has to run for real — `lib/stay-search.ts` reads `lib/search-params.ts`,
 * which reads the contracts and `@injishi/utils`, and the words this test is
 * about come out of `pluralize` at the bottom of it. Stubbing any of that
 * would leave the test checking its own fixtures.
 *
 * Register it before the first dynamic import:
 *
 *     import { register } from "node:module";
 *     register("./ts-source-hook.mjs", import.meta.url);
 *
 * Resolution only, deliberately. It adds no transform and never names a
 * format, so what runs is the source on disk, stripped by Node, and nothing
 * else changed.
 */
import { existsSync, statSync } from "node:fs";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const APP_SRC = resolvePath(dirname(fileURLToPath(import.meta.url)), "..", "src");

/** `x` to `x.ts`, `x.tsx` or `x/index.ts` — whichever is on disk. */
const SUFFIXES = ["", ".ts", ".tsx", ".mjs", ".js"];

function firstOnDisk(basePath) {
  for (const suffix of SUFFIXES) {
    const candidate = basePath + suffix;
    if (!existsSync(candidate) || statSync(candidate).isDirectory()) continue;
    return pathToFileURL(candidate).href;
  }
  for (const suffix of [".ts", ".tsx"]) {
    const candidate = resolvePath(basePath, `index${suffix}`);
    if (existsSync(candidate)) return pathToFileURL(candidate).href;
  }
  return null;
}

/** The `@/` alias, as a file URL, or null when nothing is there. */
export function aliasToFileUrl(specifier) {
  return firstOnDisk(resolvePath(APP_SRC, specifier.slice(2)));
}

export async function resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) {
    const url = aliasToFileUrl(specifier);
    if (url) return { url, shortCircuit: true };
  }

  if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
    const parent = dirname(fileURLToPath(context.parentURL));
    const url = firstOnDisk(resolvePath(parent, specifier));
    if (url) return { url, shortCircuit: true };
  }

  return next(specifier, context);
}
