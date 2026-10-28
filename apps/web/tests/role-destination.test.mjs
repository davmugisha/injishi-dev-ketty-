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
 * Since 2026-10-24 everyone who holds something in the operator app (a
 * business or broker seat, an oversight console, a staff role) goes to the
 * app's own `/auth/continue`, which picks their home there. Web used to build
 * `/w/<id>`, `/oversight` or an admin console url itself, and every one of
 * those 404ed once the app's screens moved to its root.
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
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const ts = require("typescript");

const APP_URL = "https://app-demo.injishi.test";
/** The app's resolver: it opens each persona's home. */
const APP = new URL("/auth/continue", APP_URL).toString();

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

// The allowlist and the app's url in redirect.ts are read when the module loads.
process.env.NEXT_PUBLIC_PMS_URL = APP_URL;

async function loadRedirect() {
  let src = readFileSync(resolve(here, "../src/lib/redirect.ts"), "utf8");
  assert.match(src, HOME_IMPORT, "redirect.ts no longer imports HOME the way this test stubs it");
  src = src.replace(HOME_IMPORT, `const HOME = ${JSON.stringify(HOME)};`);
  return evaluate(src);
}

const redirectModule = await loadRedirect();
globalThis.__roleTest = { answers: {}, safeRedirect: redirectModule.safeRedirect, appHome: redirectModule.appHome };

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
      /import\s*\{\s*appHome,\s*safeRedirect\s*\}\s*from\s*["']@\/lib\/redirect["'];?/,
      `const safeRedirect = (raw) => globalThis.__roleTest.safeRedirect(raw);
       const appHome = () => globalThis.__roleTest.appHome();`,
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
  { email: "admin@injishi.com", personal: true, staff: true, to: APP },
  { email: "host@injishi.com", personal: true, operator: [biz("w-hotel")], to: APP },
  { email: "landlord@injishi.com", personal: true, operator: [biz("w-residence")], to: APP },
  { email: "manager@injishi.com", personal: true, operator: [biz("w-hotel")], to: APP },
  { email: "reception@injishi.com", personal: true, operator: [biz("w-hotel")], to: APP },
  { email: "housekeeper@injishi.com", personal: true, operator: [biz("w-hotel")], to: APP },
  { email: "resident-manager@injishi.com", personal: true, operator: [biz("w-residence")], to: APP },
  { email: "broker@injishi.com", personal: true, operator: [broker("w-broker")], to: APP },
  { email: "guest@injishi.com", personal: true, to: HOME },
  { email: "localgov@injishi.com", personal: true, consoles: 1, to: APP },
  { email: "approver@injishi.com", personal: true, consoles: 1, to: APP },
  { email: "finance@injishi.com", personal: true, operator: [biz("w-hotel")], to: APP },
  { email: "hr@injishi.com", personal: true, operator: [biz("w-hotel")], to: APP },
  { email: "admin-ops@injishi.com", personal: true, staff: true, to: APP },
  { email: "admin-compliance@injishi.com", personal: true, staff: true, to: APP },
  { email: "admin-finance@injishi.com", personal: true, staff: true, to: APP },
  { email: "admin-trainer@injishi.com", personal: true, staff: true, to: APP },
  { email: "taxofficer@injishi.com", personal: true, consoles: 1, to: APP },
  { email: "psf@injishi.com", personal: true, consoles: 1, to: APP },
  // Still at `submitted`: the workspace is listed so the registrant can watch
  // the pipeline, and the operator app words the refusal inside it.
  { email: "pending@injishi.com", personal: true, operator: [biz("w-pending")], to: APP },
  // Both hats. The app decides which home opens first.
  { email: "dualhat@injishi.com", personal: true, operator: [biz("w-hotel")], consoles: 1, to: APP },

  // seed-demo.mjs — the public demo roster.
  { email: "yves@demo.injishi.com", operator: [biz("w-amahoro")], to: APP },
  { email: "solange@demo.injishi.com", operator: [biz("w-amahoro")], to: APP },
  { email: "denise@demo.injishi.com", operator: [biz("w-amahoro")], to: APP },
  { email: "beatha@demo.injishi.com", operator: [biz("w-amahoro")], to: APP },
  { email: "josephine@demo.injishi.com", operator: [biz("w-greenhills")], to: APP },
  // Five seats: broker, two businesses he owns, one he cleans in, personal.
  {
    email: "samuel@demo.injishi.com",
    personal: true,
    operator: [broker("w-sam-broker"), biz("w-kayitare"), biz("w-kivu"), biz("w-umurage")],
    to: APP,
  },
  { email: "jeanbosco@demo.injishi.com", consoles: 1, to: APP },
  { email: "claudine@demo.injishi.com", consoles: 1, to: APP },
  { email: "yvette@demo.injishi.com", consoles: 1, to: APP },
  { email: "alice@demo.injishi.com", consoles: 1, to: APP },
  { email: "rayan@demo.injishi.com", personal: true, to: HOME },
  { email: "grace@demo.injishi.com", personal: true, to: HOME },
  { email: "theoneste@demo.injishi.com", personal: true, to: HOME },
  // Revoked assignment: the role is still on the account, the console is not.
  { email: "fidele@demo.injishi.com", personal: true, consoles: 0, to: HOME },
  { email: "ops@demo.injishi.com", staff: true, to: APP },
  { email: "aimable@demo.injishi.com", operator: [biz("w-aimable")], to: APP },
  // Limited to one branch (ADR-054 AC-D2). A branch limit narrows what she
  // sees inside the workspace, never which door she opens: same seat as Denise.
  { email: "clarisse@demo.injishi.com", operator: [biz("w-amahoro")], to: APP },
];

const holdsSomethingGuarded = (p) =>
  (p.operator?.length ?? 0) > 0 || (p.consoles ?? 0) > 0 || p.staff === true;

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

  test("a staffer who also holds a workspace opens the app, which picks the home", async () => {
    const both = { email: "x", staff: true, operator: [biz("w-own")] };
    assert.equal(await destinationOf(both, { verified: true }), APP);
  });

  test("an explicit, allowed redirect still wins over the app", async () => {
    assert.equal(await destinationOf(staffer, { verified: true }, "/book?id=1"), "/book?id=1");
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
