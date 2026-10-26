/**
 * Every seeded persona must open the surface its grant holds (F-S02).
 *
 * `/start` is the one place the paths of guests, operators, officers and staff
 * part. It had a hole for a long time: it never asked `/api/v1/me/staff`, so
 * `admin@injishi.com` and `ops@demo.injishi.com` landed on `/trips`. `d4580bb`
 * closed it. Nothing pinned the rest of the roster, though, and a seed that
 * grows a persona the resolver sends somewhere wrong would pass every check
 * this app had.
 *
 * So this pins ALL of them: the table below names every account
 * `seed-users.mjs` and `seed-demo.mjs` create, and the last test fails when a
 * seed adds a persona the table does not route.
 *
 * THIS TEST RUNS THE REAL CODE, the way `safe-redirect.test.mjs` does: the
 * sources are read, their `@/` imports replaced with stubs, and the TypeScript
 * transpiled and evaluated. `apiFetch` is the only thing faked — it answers each
 * `/me/*` path from the persona under test — so `fetchAccess` does its own
 * mapping, and `safeRedirect` is the real one. `ACCESS_TS` points the loader at
 * another copy of `access.ts`, which is how a mutant without the staff branch
 * is shown to fail here.
 *
 * Each persona's answers are built by `answersFor` from the rules the API
 * applies (`me.controller.ts`): `/me/workspaces` counts business and broker
 * seats and live oversight grants toward `twoFactor.required`; `/me/staff`
 * requires it for staff alone. Whether the real server answers that way is a
 * question for a run against a live API, not for this file.
 *
 * Run: pnpm --filter @injishi/web test
 */
import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const ts = require("typescript");

const ADMIN_URL = "https://admin-demo.injishi.test";
const ADMIN = new URL("/", ADMIN_URL).toString();
// Production's shape: the operator app answers on its own host, with its screens at the root.
const WEB_URL = "https://www.injishi.test";
const APP = "https://app.injishi.test";
const OVERSIGHT = `${APP}/officer`;
const ws = (id) => `${APP}/w/${id}`;

/** `HOME` as the app defines it, read rather than restated. */
const HOME = (() => {
  const src = readFileSync(resolve(here, "../src/lib/app-nav.ts"), "utf8");
  const m = src.match(/export const HOME\s*=\s*"([^"]+)"/);
  assert.ok(m, "app-nav.ts no longer declares HOME the way this test reads it");
  return m[1];
})();

const HOME_IMPORT = /import\s*\{\s*HOME\s*\}\s*from\s*["']@\/lib\/app-nav["'];?/;

async function evaluate(src) {
  const { outputText } = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}

// The allowlist in redirect.ts is built when the module loads.
process.env.NEXT_PUBLIC_ADMIN_URL = ADMIN_URL;

async function loadRedirect() {
  let src = readFileSync(resolve(here, "../src/lib/redirect.ts"), "utf8");
  assert.match(src, HOME_IMPORT, "redirect.ts no longer imports HOME the way this test stubs it");
  src = src.replace(HOME_IMPORT, `const HOME = ${JSON.stringify(HOME)};`);
  return evaluate(src);
}

globalThis.__roleTest = { answers: {}, safeRedirect: (await loadRedirect()).safeRedirect };

async function loadAccess() {
  let src = readFileSync(process.env.ACCESS_TS ?? resolve(here, "../src/lib/access.ts"), "utf8");
  const stubs = [
    [
      /import\s*\{\s*apiFetch\s*\}\s*from\s*["']@\/lib\/api["'];?/,
      `const apiFetch = async (path) => {
         const answer = globalThis.__roleTest.answers[path];
         if (!answer) throw new Error("unexpected read in test: " + path);
         return answer;
       };`,
    ],
    [HOME_IMPORT, `const HOME = ${JSON.stringify(HOME)};`],
    [
      /import\s*\{\s*safeRedirect\s*\}\s*from\s*["']@\/lib\/redirect["'];?/,
      `const safeRedirect = (raw) => globalThis.__roleTest.safeRedirect(raw);`,
    ],
  ];
  for (const [pattern, replacement] of stubs) {
    assert.match(src, pattern, `access.ts no longer imports ${pattern} the way this test stubs it`);
    src = src.replace(pattern, replacement);
  }
  return evaluate(src);
}

const { fetchAccess, resolveDestination } = await loadAccess();

const ok = (data) => ({ status: "ok", data });

/**
 * The three answers a person gets, from what they hold.
 *
 * `consoles` counts LIVE assignments only: `/me/oversight` drops a revoked one,
 * and so does the grant count behind `/me/workspaces`' `required`.
 */
function answersFor(p, { verified, staffRead } = {}) {
  const operator = p.operator ?? [];
  const consoles = p.consoles ?? 0;
  const staff = p.staff === true;
  const rows = [
    ...(p.personal ? [{ workspaceId: `personal-${p.email}`, kind: "personal" }] : []),
    ...operator.map((w) => ({ workspaceId: w.id, kind: w.kind })),
  ];
  const operatorRequired = operator.length > 0 || consoles > 0;
  return {
    "/api/v1/me/workspaces": ok({
      workspaces: rows,
      activeWorkspaceId: null,
      twoFactor: { required: operatorRequired, verified },
    }),
    "/api/v1/me/oversight": ok({
      consoles: Array.from({ length: consoles }, () => ({})),
      twoFactor: { required: operatorRequired, verified },
    }),
    "/api/v1/me/staff": staffRead ?? ok({ isStaff: staff, twoFactor: { required: staff, verified } }),
  };
}

/** Where `/start` sends this person, running the app's own two functions. */
async function destinationOf(p, opts, requested = null) {
  globalThis.__roleTest.answers = answersFor(p, opts);
  const access = await fetchAccess();
  assert.equal(access.status, "resolved");
  return resolveDestination(access, requested);
}

const biz = (id) => ({ id, kind: "business" });
const broker = (id) => ({ id, kind: "broker" });

/**
 * Every seeded persona and the door it must open once the step-up is done.
 * `to` is an exact destination; an operator's is their only or first seat.
 */
const PERSONAS = [
  // seed-users.mjs — one login per shape of access.
  { email: "admin@injishi.com", personal: true, staff: true, to: ADMIN },
  { email: "host@injishi.com", personal: true, operator: [biz("w-hotel")], to: ws("w-hotel") },
  { email: "landlord@injishi.com", personal: true, operator: [biz("w-residence")], to: ws("w-residence") },
  { email: "manager@injishi.com", personal: true, operator: [biz("w-hotel")], to: ws("w-hotel") },
  { email: "reception@injishi.com", personal: true, operator: [biz("w-hotel")], to: ws("w-hotel") },
  { email: "housekeeper@injishi.com", personal: true, operator: [biz("w-hotel")], to: ws("w-hotel") },
  { email: "resident-manager@injishi.com", personal: true, operator: [biz("w-residence")], to: ws("w-residence") },
  { email: "broker@injishi.com", personal: true, operator: [broker("w-broker")], to: ws("w-broker") },
  { email: "guest@injishi.com", personal: true, to: HOME },
  { email: "localgov@injishi.com", personal: true, consoles: 1, to: OVERSIGHT },
  { email: "approver@injishi.com", personal: true, consoles: 1, to: OVERSIGHT },
  // Still at `submitted`: the workspace is listed so the registrant can watch
  // the pipeline, and the operator app words the refusal inside it.
  { email: "pending@injishi.com", personal: true, operator: [biz("w-pending")], to: ws("w-pending") },
  // Both hats. The console is checked before the workspace, as it always was.
  { email: "dualhat@injishi.com", personal: true, operator: [biz("w-hotel")], consoles: 1, to: OVERSIGHT },

  // seed-demo.mjs — the public demo roster.
  { email: "yves@demo.injishi.com", operator: [biz("w-amahoro")], to: ws("w-amahoro") },
  { email: "solange@demo.injishi.com", operator: [biz("w-amahoro")], to: ws("w-amahoro") },
  { email: "denise@demo.injishi.com", operator: [biz("w-amahoro")], to: ws("w-amahoro") },
  { email: "beatha@demo.injishi.com", operator: [biz("w-amahoro")], to: ws("w-amahoro") },
  { email: "josephine@demo.injishi.com", operator: [biz("w-greenhills")], to: ws("w-greenhills") },
  // Five seats: broker, two businesses he owns, one he cleans in, personal.
  {
    email: "samuel@demo.injishi.com",
    personal: true,
    operator: [broker("w-sam-broker"), biz("w-kayitare"), biz("w-kivu"), biz("w-umurage")],
    to: ws("w-sam-broker"),
  },
  { email: "jeanbosco@demo.injishi.com", consoles: 1, to: OVERSIGHT },
  { email: "claudine@demo.injishi.com", consoles: 1, to: OVERSIGHT },
  { email: "yvette@demo.injishi.com", consoles: 1, to: OVERSIGHT },
  { email: "alice@demo.injishi.com", consoles: 1, to: OVERSIGHT },
  { email: "rayan@demo.injishi.com", personal: true, to: HOME },
  { email: "grace@demo.injishi.com", personal: true, to: HOME },
  { email: "theoneste@demo.injishi.com", personal: true, to: HOME },
  // Revoked assignment: the role is still on the account, the console is not.
  { email: "fidele@demo.injishi.com", personal: true, consoles: 0, to: HOME },
  { email: "ops@demo.injishi.com", staff: true, to: ADMIN },
  { email: "aimable@demo.injishi.com", operator: [biz("w-aimable")], to: ws("w-aimable") },
  // Limited to one branch (ADR-054 AC-D2). A branch limit narrows what she
  // sees inside the workspace, never which door she opens: same seat as Denise.
  { email: "clarisse@demo.injishi.com", operator: [biz("w-amahoro")], to: ws("w-amahoro") },
];

const holdsSomethingGuarded = (p) =>
  (p.operator?.length ?? 0) > 0 || (p.consoles ?? 0) > 0 || p.staff === true;

beforeEach(() => {
  process.env.NEXT_PUBLIC_ADMIN_URL = ADMIN_URL;
  process.env.NEXT_PUBLIC_WEB_URL = WEB_URL;
  process.env.NEXT_PUBLIC_PMS_URL = APP;
});

describe("each seeded persona opens the surface its grant holds", () => {
  for (const p of PERSONAS) {
    test(`${p.email} -> ${p.to}`, async () => {
      assert.equal(await destinationOf(p, { verified: true }), p.to);
    });
  }
});

describe("the step-up comes before any guarded surface", () => {
  for (const p of PERSONAS) {
    const guarded = holdsSomethingGuarded(p);
    test(`${p.email} ${guarded ? "is asked for the code" : "is not asked for a code"}`, async () => {
      const dest = await destinationOf(p, { verified: false });
      assert.equal(dest, guarded ? "/two-factor/verify?redirect=%2Fstart" : p.to);
    });
  }
});

describe("staff routing never costs anyone their sign-in", () => {
  const staffer = PERSONAS.find((p) => p.email === "ops@demo.injishi.com");

  test("a staffer whose staff read failed lands where a guest would, not on a retry screen", async () => {
    assert.equal(await destinationOf(staffer, { verified: true, staffRead: { status: "failed" } }), HOME);
  });

  test("a build with no console configured sends staff home, never to a default host", async () => {
    process.env.NEXT_PUBLIC_ADMIN_URL = "";
    assert.equal(await destinationOf(staffer, { verified: true }), HOME);
  });

  test("a staffer who also holds a workspace keeps opening the workspace", async () => {
    const both = { email: "x", staff: true, operator: [biz("w-own")] };
    assert.equal(await destinationOf(both, { verified: true }), ws("w-own"));
  });

  test("an explicit, allowed redirect still wins over the console", async () => {
    assert.equal(await destinationOf(staffer, { verified: true }, "/book?id=1"), "/book?id=1");
  });
});

describe("the operator app's origin decides the address, never a dead path on web", () => {
  const host = PERSONAS.find((p) => p.email === "host@injishi.com");
  const officer = PERSONAS.find((p) => p.email === "approver@injishi.com");

  test("on its own host, the officer opens /officer there, not web's /oversight", async () => {
    assert.equal(await destinationOf(officer, { verified: true }), "https://app.injishi.test/officer");
  });

  test("served as a zone on web's own origin, both stay paths on that origin", async () => {
    process.env.NEXT_PUBLIC_PMS_URL = WEB_URL;
    assert.equal(await destinationOf(host, { verified: true }), "/w/w-hotel");
    assert.equal(await destinationOf(officer, { verified: true }), "/officer");
  });
});

test("the table routes exactly the personas the seeds create", () => {
  const seeded = new Set();
  for (const file of ["seed-users.mjs", "seed-demo.mjs"]) {
    const src = readFileSync(resolve(here, "../../../server/api/scripts", file), "utf8");
    for (const m of src.matchAll(/email:\s*'([^']+@(?:demo\.)?injishi\.com)'/g)) seeded.add(m[1]);
  }
  assert.ok(seeded.size > 0, "found no seeded emails — the pattern no longer reads the seeds");
  const routed = new Set(PERSONAS.map((p) => p.email));
  assert.deepEqual([...seeded].filter((e) => !routed.has(e)).sort(), [], "seeded but not routed");
  assert.deepEqual([...routed].filter((e) => !seeded.has(e)).sort(), [], "routed but not seeded");
});
