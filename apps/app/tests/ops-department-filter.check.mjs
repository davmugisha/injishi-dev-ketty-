#!/usr/bin/env node
/**
 * The operator inbox's desk filter asks the SERVER, and does not sieve a list
 * in the browser (ADR-050 D-q; gates/leaf-1.3.md G4).
 *
 * WHY THIS IS A CHECK AND NOT A CONVENTION. `GET /api/v1/ops/threads` returns
 * one flat list per workspace — on the seeded demo hotel, seventy-four
 * conversations of which two are Rooms' and one is Food and Beverage's. The
 * filter exists because that list grows with the property, so a version of it
 * that fetched everything and threw most of it away would look identical on a
 * demo and be the same problem again on a real hotel in a year. The difference
 * between the two is invisible on screen, which is exactly the kind of decision
 * that quietly reverts. So it is pinned here.
 *
 * TWO ASSERTIONS, and neither of them is a grep for a happy word:
 *
 *  1. THE REQUEST. The real `useThreads` is loaded out of `data/ops.ts` — its
 *     imports stripped and the TypeScript transpiled, the way
 *     `src/pms/lib/legacy-redirect.test.mjs` loads its subject — and its query
 *     function is RUN against a stubbed `fetch`. What is asserted is the URL
 *     that would actually go to the API, not the text of the file.
 *  2. NO SIEVE. Every file that calls `useThreads` is read, and a reduction of
 *     a thread list by department in JavaScript fails the check.
 *
 * AN ABSENCE CHECK THAT HAS NEVER FAILED IS NOT EVIDENCE, so both assertions
 * are mutation tested on every run: the checker breaks its own subject in
 * memory — a client that drops the parameter, a screen that filters by
 * `departmentName` — and fails if its rules let either through. It was also run
 * against the unchanged files at `edf31ae` before they were edited, where
 * assertion 1 failed with `no departmentId on the request` (the hook took no
 * department at all).
 *
 * Run: node apps/app/tests/ops-department-filter.check.mjs
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = dirname(fileURLToPath(import.meta.url));
const APP = resolve(here, "..");
const SRC = join(APP, "src");
const OPS = join(SRC, "pms/data/ops.ts");
const QUERIES = join(SRC, "pms/data/queries.ts");
const INBOX = join(SRC, "pms/screens/conversation.tsx");

const require = createRequire(import.meta.url);
const ts = require("typescript");

let failures = 0;
function check(ok, label, detail) {
  if (!ok) failures += 1;
  const line = `  ${ok ? "PASS" : "FAIL"}  ${label}`;
  console.log(ok || detail === undefined ? line : `${line}\n          ${detail}`);
}

// ---------------------------------------------------------------------------
// Loading a module the way the app would run it
// ---------------------------------------------------------------------------

/**
 * Evaluate a TypeScript module with its imports removed.
 *
 * Everything it imported is then a free identifier, which resolves to a global
 * at CALL time — so a stub put on `globalThis` stands in for it without the
 * module being written to accept one. Nothing in these two files touches an
 * import at module scope, which is what makes this safe.
 */
async function evaluate(source, label) {
  const imports = /^import[^;]+;\s*$/gm;
  if (!source.match(imports)) throw new Error(`${label}: no imports to strip; update this loader`);
  const { outputText } = ts.transpileModule(source.replace(imports, ""), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}

const API_BASE = "https://api.injishi.test";

/** Every url the module asked `fetch` for, in order. */
let requested = [];

function stubEnvironment(queryKeys) {
  Object.assign(globalThis, {
    // `data/api.ts`
    API_BASE,
    REQUEST_TIMEOUT_MS: 5_000,
    ApiError: class ApiError extends Error {
      constructor(status, message) {
        super(message);
        this.status = status;
      }
    },
    // `data/branch.ts` — the branch header is a different decision (ADR-054).
    branchHeader: () => ({}),
    // `data/capability.ts`. TRUE, deliberately: this check is about the
    // request, and a stub that refused the read would make the hook skip the
    // fetch and the assertion pass on nothing.
    useCapability: () => ({ can: () => true, reasonFor: () => undefined }),
    // `@tanstack/react-query` — hand the options straight back so the query
    // function can be called.
    useQuery: (options) => options,
    // `@injishi/contracts` — the schema is not what is under test here.
    OperatorThreadList: { parse: (value) => value },
    queryKeys,
    fetch: async (url) => {
      requested.push(String(url));
      return { ok: true, status: 200, json: async () => ({ threads: [] }) };
    },
  });
}

/** Run one `useThreads` call all the way to the url it would fetch. */
async function urlFor(ops, departmentId) {
  const before = requested.length;
  const options = ops.useThreads("de300000-0000-4000-8000-000000000201", departmentId);
  await options.queryFn();
  const asked = requested.slice(before);
  if (asked.length !== 1) throw new Error(`expected one request, saw ${asked.length}`);
  return { url: asked[0], queryKey: options.queryKey };
}

// ---------------------------------------------------------------------------
// Assertion 1: the client puts `departmentId` on the request
// ---------------------------------------------------------------------------

const DEPARTMENT = "de300000-0000-4000-8000-001701000001";

/**
 * @returns the failures found, as strings. Empty means the client asks the
 * server for one desk's threads rather than for all of them.
 */
async function requestFaults(opsSource, label) {
  const ops = await evaluate(opsSource, label);
  const faults = [];

  const every = await urlFor(ops, null);
  if (every.url !== `${API_BASE}/api/v1/ops/threads`) {
    faults.push(`unfiltered read is ${every.url}`);
  }

  const one = await urlFor(ops, DEPARTMENT);
  const query = one.url.slice(one.url.indexOf("?") + 1);
  if (!one.url.startsWith(`${API_BASE}/api/v1/ops/threads?`)) {
    faults.push(`no departmentId on the request: ${one.url}`);
  } else if (new URLSearchParams(query).get("departmentId") !== DEPARTMENT) {
    faults.push(`the request does not carry the department: ${one.url}`);
  }

  // Two answers to two different questions must not share one cache entry, or
  // the desk's list is painted under the property's heading and back again.
  if (JSON.stringify(every.queryKey) === JSON.stringify(one.queryKey)) {
    faults.push(`both reads cache under ${JSON.stringify(every.queryKey)}`);
  }
  if (!JSON.stringify(one.queryKey).includes(DEPARTMENT)) {
    faults.push(`the filtered cache key does not name the department: ${JSON.stringify(one.queryKey)}`);
  }

  // An id that is not the uuid we expect must be encoded rather than pasted
  // into the query string.
  const odd = await urlFor(ops, "a b&limit=9999");
  if (/[ ]/.test(odd.url) || (odd.url.match(/[&]/g) ?? []).length > 0) {
    faults.push(`an unexpected value is not encoded: ${odd.url}`);
  }

  return faults;
}

// ---------------------------------------------------------------------------
// Assertion 2: nothing sieves the fetched list by department
// ---------------------------------------------------------------------------

/**
 * Array methods that REDUCE a list. `map` is not one of them: rendering
 * `t.departmentName` on a row is how the operator sees which desk a
 * conversation belongs to, and that must stay legal.
 *
 * `find` and `some` are here because a selection or a test written over the
 * whole list, by department, is the same mistake wearing a different verb.
 */
const REDUCERS = ["filter", "find", "some", "every", "reduce", "flatMap", "slice", "sort"];

/** The argument list of a call starting at `open`, balanced. */
function callArguments(source, open) {
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === "(") depth += 1;
    else if (source[i] === ")") {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, i);
    }
  }
  return source.slice(open + 1);
}

/** A thread list reduced by department, somewhere in this file. */
function sieveFaults(source, label) {
  const faults = [];

  for (const method of REDUCERS) {
    const call = new RegExp(`\\.${method}\\s*\\(`, "g");
    let match;
    while ((match = call.exec(source)) !== null) {
      const receiver = source.slice(Math.max(0, match.index - 90), match.index);
      if (!/threads/i.test(receiver)) continue;
      const args = callArguments(source, match.index + match[0].length - 1);
      if (/department/i.test(args)) {
        faults.push(`${label}: threads.${method}(...) reduces by department — ${args.trim().slice(0, 70)}`);
      }
    }
  }

  // The same thing said without an array method: a thread's department
  // compared against the chosen one, anywhere in the file.
  //
  // A comparison against `null` or `undefined` is not that. It is the question
  // "is a desk chosen at all", which the screen has to ask to know whether it
  // is filtered — and a nullish test can no more sieve by desk than `map` can.
  // The array rule above still catches it if one is ever written over threads.
  const NULLISH = "(?!\\s*(?:null|undefined)\\b)";
  const compared = new RegExp(
    `department(?:Name|Id)\\s*(?:===|!==|==(?!=)|!=(?!=))${NULLISH}|(?:===|!==|==(?!=)|!=(?!=))\\s*[\\w.?]*department(?:Name|Id)`,
    "g",
  );
  for (const hit of source.match(compared) ?? []) {
    faults.push(`${label}: a thread's department is compared in the browser — ${hit.trim()}`);
  }

  return faults;
}

/** Every file under `src` that reads the operator thread list. */
function threadReaders() {
  const found = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry) && full !== OPS) {
        if (readFileSync(full, "utf8").includes("useThreads(")) found.push(full);
      }
    }
  };
  walk(SRC);
  return found;
}

// ---------------------------------------------------------------------------

async function main() {
  console.log("ops department filter — the narrowing is a request, not a reduction\n");

  // 1. The request.
  const opsSource = readFileSync(OPS, "utf8");
  const queriesSource = readFileSync(QUERIES, "utf8");
  stubEnvironment((await evaluate(queriesSource, "queries.ts")).queryKeys);

  const faults = await requestFaults(opsSource, "ops.ts");
  check(faults.length === 0, "the threads client asks the API for one department", faults.join("; "));

  // 1b. …and the rule that found nothing can find something. A client that
  // drops the parameter is what this assertion exists to catch.
  const dropped = opsSource.replace(/read\(\s*opsThreadsPath\([^)]*\)/, 'read("/ops/threads"');
  const caught =
    dropped === opsSource ? [] : await requestFaults(dropped, "ops.ts (mutated)").catch(() => ["threw"]);
  check(
    dropped !== opsSource && caught.length > 0,
    "a client that dropped the parameter would be caught",
    dropped === opsSource ? "the mutation did not apply; update this check" : "it passed unnoticed",
  );

  // 2. No sieve, in any file that reads the list.
  const readers = threadReaders();
  check(readers.includes(INBOX), "the inbox screen is among the files checked", readers.join(", "));

  const sieves = readers.flatMap((file) => sieveFaults(readFileSync(file, "utf8"), relative(APP, file)));
  check(sieves.length === 0, "no screen reduces the thread list by department", sieves.join("\n          "));

  // 2b. The same rule, against a screen that does sieve. Both spellings: the
  // array method, and the bare comparison.
  const inbox = readFileSync(INBOX, "utf8");
  const mutations = [
    ["an array method", "const shown = threads.filter((t) => t.departmentName === deskLabel);"],
    ["a bare comparison", "const mine = t.departmentName === deskLabel;"],
  ];
  for (const [name, line] of mutations) {
    const mutated = inbox.replace("const threads = threadsQuery.data?.threads ?? [];", `$&\n  ${line}`);
    const found = mutated === inbox ? [] : sieveFaults(mutated, "conversation.tsx (mutated)");
    check(
      mutated !== inbox && found.length > 0,
      `a screen that sieved by department (${name}) would be caught`,
      mutated === inbox ? "the mutation did not apply; update this check" : "it passed unnoticed",
    );
  }

  // 3. The screen actually hands the chosen desk to the client. Without this,
  // both rules above can hold on a filter that does nothing at all.
  check(
    /useThreads\([^)]*,\s*[\w.?\s]*[Dd]epartment[\w]*\s*\)/.test(inbox),
    "the inbox passes the chosen department to the threads client",
  );

  if (failures > 0) {
    console.log(`\n${failures} check${failures === 1 ? "" : "s"} failed.`);
    process.exitCode = 1;
    return;
  }
  console.log("\nOPS DEPARTMENT FILTER IS SERVER SIDE");
}

await main();
