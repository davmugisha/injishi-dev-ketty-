/**
 * A kind chosen on `/host` lands on the registration form already answered,
 * with no page in between, and survives a sign in on the way.
 *
 * WHY THIS FILE EXISTS. The funnel used to be `/host` (pick a kind) →
 * `/host/start` (the kind said back, one button) → `/register` (the kind said
 * back AGAIN, one button) → About you. Two screens repeated an answer given one
 * click earlier. This pins the shorter path:
 *
 *  - every chooser tile links to `/register?kind=…` and nothing links through
 *    `/host/start`, which only redirects now;
 *  - every value the chooser can send is one the registration form accepts, so
 *    no tile lands as if nothing was chosen;
 *  - the sign in round trip hands the query back intact;
 *  - the wizard opens past the kind question when the kind arrived, drops Place
 *    from its rail, and does not save a draft merely by opening.
 *
 * What it does not do is render the wizard: the wizard is one client component
 * with a live API behind every step. The browser run is in the leaf's evidence.
 *
 * Run: pnpm --filter @injishi/web test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { register } from "node:module";

register("./ts-source-hook.mjs", import.meta.url);

const here = dirname(fileURLToPath(import.meta.url));
const src = (p) => readFileSync(resolve(here, "../src", p), "utf8");

const { HOST_PROPERTY_KINDS, hostKindHref, findHostKind } = await import("@/data/host");
const { findRegistrationKind, registrationForKind } = await import(
  "@/app/(app)/(entry)/register/registration-kinds"
);
const { openingPhase, resumePhase, savesOnEntry, showsRail, stepsToShow } = await import(
  "@/app/(app)/(entry)/register/wizard-path"
);
const { safeRedirect } = await import("@/lib/redirect");

/** The five rail ids, in the wizard's order; the rail module itself is TSX. */
const FULL = ["place", "about", "business", "documents", "pay"].map((id) => ({ id }));
const BROKER = ["place", "about"].map((id) => ({ id }));

describe("a tile on /host", () => {
  test("goes straight to /register with its kind", () => {
    for (const kind of HOST_PROPERTY_KINDS) {
      const href = hostKindHref(kind.value);
      const url = new URL(href, "http://x.invalid");
      assert.equal(url.pathname, "/register", `${kind.value} links to ${href}`);
      assert.equal(url.searchParams.get("kind"), kind.value);
    }
  });

  test("carries a kind the registration form accepts, so none lands unanswered", () => {
    for (const kind of HOST_PROPERTY_KINDS) {
      const entry = findRegistrationKind(kind.value);
      assert.ok(entry, `/register would drop ?kind=${kind.value}`);
      // And a kind the server can price: every chooser tile is a business, never a broker.
      assert.notEqual(registrationForKind(kind.value).role, "broker");
    }
  });

  test("the chooser and the closing call to action no longer link through /host/start", () => {
    for (const file of ["components/host/host-chooser.tsx", "components/host/host-cta.tsx"]) {
      const code = src(file)
        .split(/\r?\n/)
        .filter((line) => !/^\s*(\*|\/\/|\{\/\*)/.test(line))
        .join("\n");
      assert.doesNotMatch(code, /["'`]\/host\/start/, `${file} still links to /host/start`);
    }
    assert.match(src("components/host/host-chooser.tsx"), /href=\{hostKindHref\(kind\.value\)\}/);
  });
});

describe("/host/start", () => {
  const page = src("app/(marketplace)/(site)/host/start/page.tsx");

  test("is a redirect into registration, not a page", () => {
    assert.match(page, /import \{ redirect \} from "next\/navigation"/);
    assert.match(page, /redirect\(chosen \? hostKindHref\(chosen\.value\) : "\/register"\)/);
    assert.doesNotMatch(page, /<Button|Register your business<\//, "the interstitial's button is back");
  });

  test("keeps a known kind and drops an unknown one, as the page always did", () => {
    assert.equal(findHostKind("guest_house")?.value, "guest_house");
    assert.equal(findHostKind("castle"), null);
    assert.equal(findHostKind(undefined), null);
  });
});

describe("the sign in round trip", () => {
  test("hands /register back with its kind", () => {
    for (const kind of HOST_PROPERTY_KINDS) {
      const back = hostKindHref(kind.value);
      // RegisterGate sends `/sign-in?redirect=<encoded path and query>`, and
      // the sign in screens resolve it through `safeRedirect`.
      const bounced = new URL(`/sign-in?redirect=${encodeURIComponent(back)}`, "http://x.invalid");
      assert.equal(safeRedirect(bounced.searchParams.get("redirect")), back);
    }
  });

  test("the gate builds the bounce from the whole path and query", () => {
    const gate = src("app/(app)/(entry)/register/register-gate.tsx");
    assert.match(gate, /`\$\{window\.location\.pathname\}\$\{window\.location\.search\}`/);
    assert.match(gate, /\/sign-in\?redirect=\$\{encodeURIComponent\(back\)\}/);
  });
});

describe("the wizard, given a kind", () => {
  test("opens on About you when the kind arrived, on the kind question when it did not", () => {
    assert.equal(openingPhase("guest_house"), "about");
    assert.equal(openingPhase(null), "place");
  });

  test("never resumes a draft on the question the URL just answered", () => {
    assert.equal(resumePhase("place", true), "about");
    assert.equal(resumePhase("place", false), "place");
    assert.equal(resumePhase("business", true), "business");
  });

  test("shows the steps that remain: Place drops out while the kind is the one that arrived", () => {
    assert.deepEqual(
      stepsToShow(FULL, true).map((s) => s.id),
      ["about", "business", "documents", "pay"],
    );
    assert.deepEqual(stepsToShow(FULL, false).map((s) => s.id), FULL.map((s) => s.id));
  });

  test("a broker arriving answered has one step, and one step is no rail", () => {
    const steps = stepsToShow(BROKER, true);
    assert.deepEqual(steps.map((s) => s.id), ["about"]);
    assert.equal(showsRail(steps.length), false);
    assert.equal(showsRail(stepsToShow(FULL, true).length), true);
  });

  test("saves a draft when a step is left, not when the wizard opens (R02)", () => {
    assert.equal(savesOnEntry("resume", "about"), false, "opening on About you overwrote a draft");
    assert.equal(savesOnEntry("about", "business"), true);
    assert.equal(savesOnEntry("place", "about"), true);
    assert.equal(savesOnEntry("about", "place"), false, "Place was never a saved phase");
  });

  test("the wizard reads its opening, its rail and its saving from that module", () => {
    const wizard = src("app/(app)/(entry)/register/register-wizard.tsx");
    assert.match(wizard, /setPhase\(openingPhase\(arrivalKind\)\)/);
    assert.match(wizard, /setPhase\(resumePhase\(resume\.phase, carriedNow\)\)/);
    assert.match(wizard, /stepsToShow\(/);
    assert.match(wizard, /savesOnEntry\(previous, phase\)/);
    // The confirmation face of Place is gone, not hidden.
    assert.doesNotMatch(src("app/(app)/(entry)/register/step-place.tsx"), /carried/);
  });
});
