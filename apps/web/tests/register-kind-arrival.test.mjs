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
 *  - the wizard opens past the kind question when the kind arrived, drops
 *    Business type from its rail, and does not save a draft merely by opening.
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
const { openingStep, resumeStep, stepOrder } = await import(
  "@/app/(app)/(entry)/register/register-steps"
);
const { safeRedirect } = await import("@/lib/redirect");


describe("a tile on /host", () => {
  test("goes straight to /register with its kind", () => {
    for (const kind of HOST_PROPERTY_KINDS) {
      // The PSF tile is the one exception: it opens the PSF page first, which
      // says what joining PSF costs, and whose button registers (next test).
      if (kind.value === "psf") continue;
      const href = hostKindHref(kind.value);
      const url = new URL(href, "http://x.invalid");
      assert.equal(url.pathname, "/register", `${kind.value} links to ${href}`);
      assert.equal(url.searchParams.get("kind"), kind.value);
    }
  });

  test("the PSF tile opens the PSF page, and the account wizard no longer registers PSF", () => {
    assert.equal(hostKindHref("psf"), "/psf");
    // Joining PSF is the public form at /psf/register (2026-10-19); the
    // wizard drops `?kind=psf`, and the page redirects it before that.
    assert.equal(findRegistrationKind("psf"), null);
    assert.match(
      src("app/(app)/(entry)/register/page.tsx"),
      /if \(kind === "psf"\) redirect\("\/psf\/register"\)/,
    );
  });

  test("carries a kind the registration form accepts, so none lands unanswered", () => {
    for (const kind of HOST_PROPERTY_KINDS) {
      if (kind.value === "psf") continue;
      const entry = findRegistrationKind(kind.value);
      assert.ok(entry, `/register would drop ?kind=${kind.value}`);
      // And a kind the server can price: every chooser tile is a business, never a broker.
      assert.notEqual(registrationForKind(kind.value).role, "broker");
    }
  });

  test("the chooser and the closing call to action no longer link through /host/start", () => {
    for (const file of ["components/host/host-chooser.tsx", "app/(marketplace)/(site)/host/host-entry-lines.tsx"]) {
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
  test("opens on You whether or not the kind arrived; the kind is asked first when it did not (ADR-075 S3)", () => {
    assert.equal(openingStep(), "you");
  });

  test("reopens a draft on the step it was left at, which never asks again a kind the draft already knows (ADR-075 S9)", () => {
    assert.equal(resumeStep("business"), "business");
    assert.equal(resumeStep(undefined), "you");
  });

  test("walks the same five steps whether or not the kind arrived: the person, then the business", () => {
    assert.deepEqual(stepOrder(), ["you", "business", "documents", "review", "pay"]);
  });

  test("saves as the answers are typed, never on opening (ADR-075 S9; R02)", () => {
    const wizard = src("app/(app)/(entry)/register/register-wizard.tsx");
    // What the wizard opened on is where saving starts: opening it writes nothing.
    assert.match(wizard, /useDraftAutosave\(\{ userId, draft: draftNow, start: saveStart \}\)/);
    assert.match(wizard, /setSaveStart\(\{ savedAt: null, push: false \}\)/);
  });

  test("the wizard reads its opening and its resume from that module", () => {
    const wizard = src("app/(app)/(entry)/register/register-wizard.tsx");
    assert.match(wizard, /setStep\(openingStep\(/);
    assert.match(wizard, /setStep\(resumeStep\(/);
    // The old confirmation face of the kind question is gone, not hidden.
    assert.doesNotMatch(src("app/(app)/(entry)/register/step-type.tsx"), /carried/);
  });
});
