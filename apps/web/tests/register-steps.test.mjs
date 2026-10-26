/**
 * The registration walks the artboard's steps, in the artboard's order
 * (Register.dc.html, "Business registration · six steps", 2026-10-19).
 *
 * THIS RUNS THE REAL MODULE (`register/register-steps.ts`), the one the wizard
 * reads its rail, its sections, its saving and its documents from. The last
 * describe reads the wizard's source to prove it does read them from here, so
 * a second, drifting copy of the order cannot creep into the component.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { register } from "node:module";

register("./ts-source-hook.mjs", import.meta.url);

const here = dirname(fileURLToPath(import.meta.url));
const REGISTER = resolve(here, "../src/app/(app)/(entry)/register");
const steps = await import("@/app/(app)/(entry)/register/register-steps");
const {
  STEP_TITLE,
  pathFor,
  stepOrder,
  proofStep,
  sectionOrder,
  sectionStates,
  openableThrough,
  draftPhaseFor,
  openingStep,
  resumeStep,
  savesOnLeave,
  documentRows,
  missingRequired,
  countWord,
} = steps;

describe("the steps, per path", () => {
  test("a business owner walks the artboard's six", () => {
    assert.deepEqual(stepOrder("owner", false), ["type", "tin", "branches", "documents", "overview", "pay"]);
    assert.deepEqual(
      stepOrder("owner", false).map((s) => STEP_TITLE[s]),
      ["Business type", "TIN and licences", "Branches and PSF", "Documents", "Overview", "Pay"],
    );
    assert.equal(countWord(stepOrder("owner", false).length), "Six");
  });

  test("a helper walks the same six: the API has the registrant sign and pay, the owner claims after approval", () => {
    assert.deepEqual(stepOrder("helper", false), stepOrder("owner", false));
  });

  test("a residence walks five, with Property and owner, and no branches or PSF", () => {
    assert.deepEqual(stepOrder("landlord", false), ["type", "property", "documents", "overview", "pay"]);
    assert.equal(STEP_TITLE.property, "Property and owner");
  });

  test("a kind carried in from /host drops Business type, and only that", () => {
    for (const path of ["owner", "helper", "landlord"]) {
      const full = stepOrder(path, false);
      assert.deepEqual(stepOrder(path, true), full.slice(1), path);
    }
  });

  test("the role and capacity choose the path", () => {
    assert.equal(pathFor("host", "owner"), "owner");
    assert.equal(pathFor("host", "on_behalf_of"), "helper");
    assert.equal(pathFor("landlord", "owner"), "landlord");
    assert.equal(pathFor("landlord", "on_behalf_of"), "landlord");
    assert.equal(proofStep("owner"), "tin");
    assert.equal(proofStep("landlord"), "property");
  });
});

describe("step two's sections unlock in order", () => {
  test("which sections each path has", () => {
    assert.deepEqual(sectionOrder("owner"), ["tin", "owner", "cls", "loc"]);
    assert.deepEqual(sectionOrder("helper"), ["tin", "id", "intended", "cls", "loc"]);
    assert.deepEqual(sectionOrder("landlord"), ["upi", "id", "loc"]);
  });

  test("the artboard's code-to-the-company section is absent: no endpoint sends that code", () => {
    for (const path of ["owner", "helper", "landlord"]) assert.ok(!sectionOrder(path).includes("code"), path);
  });

  test("nothing satisfied: the first is open, the rest locked", () => {
    const { states, open, allDone } = sectionStates(sectionOrder("owner"), () => false);
    assert.deepEqual(states, { tin: "open", owner: "locked", cls: "locked", loc: "locked" });
    assert.equal(open, "tin");
    assert.equal(allDone, false);
  });

  test("the first unsatisfied section is open even when a later one is satisfied", () => {
    const done = new Set(["tin", "cls"]);
    const { states, open } = sectionStates(sectionOrder("owner"), (id) => done.has(id));
    assert.deepEqual(states, { tin: "done", owner: "open", cls: "locked", loc: "locked" });
    assert.equal(open, "owner");
  });

  test("all satisfied: all done, and the step can be left", () => {
    const { states, allDone, open } = sectionStates(sectionOrder("landlord"), () => true);
    assert.deepEqual(states, { upi: "done", id: "done", loc: "done" });
    assert.equal(allDone, true);
    assert.equal(open, null);
  });
});

describe("the rail opens only what has been reached", () => {
  test("up to and including the first step not complete", () => {
    const order = stepOrder("owner", false);
    const complete = new Set(["type", "tin"]);
    assert.equal(order[openableThrough(order, (s) => complete.has(s))], "branches");
  });

  test("a step that stops being complete locks what follows it again", () => {
    const order = stepOrder("owner", false);
    const complete = new Set(["type", "branches", "documents"]); // the TIN changed
    assert.equal(order[openableThrough(order, (s) => complete.has(s))], "tin");
  });

  test("everything complete: the last step", () => {
    const order = stepOrder("landlord", true);
    assert.equal(openableThrough(order, () => true), order.length - 1);
  });
});

describe("drafts", () => {
  test("each step saves as a phase the server's draft accepts, and the signing steps never save", async () => {
    const { REGISTRATION_DRAFT_PHASES } = await import("@injishi/contracts");
    for (const step of Object.keys(STEP_TITLE)) {
      const phase = draftPhaseFor(step);
      if (step === "overview" || step === "pay") assert.equal(phase, null, step);
      else assert.ok(REGISTRATION_DRAFT_PHASES.includes(phase), `${step} → ${phase}`);
    }
  });

  test("a draft is saved when a step is left, never when the wizard opens", () => {
    assert.equal(savesOnLeave(null, "tin"), false);
    assert.equal(savesOnLeave("tin", "tin"), false);
    assert.equal(savesOnLeave("type", "tin"), true);
    assert.equal(savesOnLeave("tin", "branches"), true);
    assert.equal(savesOnLeave("overview", "pay"), false);
  });

  test("an answered kind opens on step two; an unanswered one on Business type", () => {
    assert.equal(openingStep("owner", true), "tin");
    assert.equal(openingStep("landlord", true), "property");
    assert.equal(openingStep("owner", false), "type");
  });

  test("a draft resumes on step two, where the checks it cannot keep are asked again", () => {
    assert.equal(resumeStep("owner", true), "tin");
    assert.equal(resumeStep("landlord", true), "property");
    assert.equal(resumeStep("owner", false), "type");
  });
});

describe("documents", () => {
  test("a business: the artboard's eight rows, the RDB certificate required", () => {
    const rows = documentRows("owner");
    assert.deepEqual(
      rows.map((r) => r.label),
      [
        "RDB certificate",
        "Tourism licence",
        "Grading certificate (RDB, EAC criteria)",
        "Tax clearance",
        "Fire safety",
        "Health inspection",
        "PSF certificate",
        "Other",
      ],
    );
    assert.deepEqual(rows.filter((r) => r.required).map((r) => r.kind), ["rdb_certificate"]);
  });

  test("a residence: the land title required, and Other", () => {
    assert.deepEqual(documentRows("landlord").map((r) => [r.kind, r.required]), [
      ["land_title", true],
      ["other", false],
    ]);
  });

  test("every row's kind is one the contract accepts", async () => {
    const { OrgCertificateKind } = await import("@injishi/contracts");
    for (const path of ["owner", "landlord"]) {
      for (const row of documentRows(path)) assert.ok(OrgCertificateKind.safeParse(row.kind).success, row.kind);
    }
  });

  test("what is still needed", () => {
    assert.deepEqual(missingRequired("owner", new Set()).map((r) => r.kind), ["rdb_certificate"]);
    assert.deepEqual(missingRequired("owner", new Set(["rdb_certificate"])), []);
    assert.deepEqual(missingRequired("landlord", new Set(["other"])).map((r) => r.kind), ["land_title"]);
  });
});

describe("the wizard reads all of this from the module", () => {
  const wizard = readFileSync(resolve(REGISTER, "register-wizard.tsx"), "utf8");
  test("its order, its sections, its rail and its saving", () => {
    for (const name of ["stepOrder(", "sectionOrder(", "sectionStates(", "openableThrough(", "savesOnLeave(", "draftPhaseFor("]) {
      assert.ok(wizard.includes(name), `register-wizard.tsx does not call ${name}`);
    }
  });
  test("and keeps no second copy of the order", () => {
    assert.doesNotMatch(wizard, /\["type",\s*"tin"/);
  });
});
