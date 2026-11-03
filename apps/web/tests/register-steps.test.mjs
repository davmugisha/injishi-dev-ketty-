/**
 * The registration walks ADR-075's five steps, You · Business · Documents ·
 * Review · Pay, for every kind (O-3, AC-3): the person first, then the business.
 *
 * THIS RUNS THE REAL MODULE (`register/register-steps.ts`), the one the wizard
 * reads its progress, its sections, its saving and its documents from. The last
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
  sectionOrder,
  sectionStates,
  openableThrough,
  openingStep,
  resumeStep,
  clampToOpenable,
  documentRows,
  missingRequired,
} = steps;

describe("the steps", () => {
  test("every path walks the same five: the business, then the person", () => {
    assert.deepEqual(stepOrder().map((id) => STEP_TITLE[id]), ["Business", "You", "Documents", "Review", "Pay"]);
  });

  test("the role and capacity choose the path", () => {
    assert.equal(pathFor("host", "owner"), "owner");
    assert.equal(pathFor("host", "on_behalf_of"), "helper");
    assert.equal(pathFor("landlord", "owner"), "landlord");
    assert.equal(pathFor(null, "owner"), "owner");
  });
});

describe("the sections of Business and You show in order", () => {
  test("which sections each step has, per path", () => {
    // No franchise question for now (2026-11-03).
    assert.deepEqual(sectionOrder("owner", "business"), ["tin", "cls", "loc"]);
    // You is the person alone, on every path; the owner a helper names is the business's.
    assert.deepEqual(sectionOrder("owner", "you"), ["id"]);
    assert.deepEqual(sectionOrder("helper", "business"), ["tin", "intended", "cls", "loc"]);
    assert.deepEqual(sectionOrder("helper", "you"), ["id"]);
    assert.deepEqual(sectionOrder("landlord", "business"), ["upi", "loc"]);
    assert.deepEqual(sectionOrder("landlord", "you"), ["id"]);
    for (const step of ["documents", "review", "pay"]) assert.deepEqual(sectionOrder("owner", step), []);
  });

  test("nothing satisfied: the first is open, the rest wait (and are not drawn)", () => {
    const { states, open, allDone } = sectionStates(["tin", "cls", "loc"], () => false);
    assert.deepEqual(states, { tin: "open", cls: "locked", loc: "locked" });
    assert.equal(open, "tin");
    assert.equal(allDone, false);
  });

  test("the first unsatisfied section is open even when a later one is satisfied", () => {
    const { states } = sectionStates(["tin", "cls", "loc"], (id) => id === "loc");
    assert.deepEqual(states, { tin: "open", cls: "locked", loc: "locked" });
  });

  test("all satisfied: all done, and the step can be left", () => {
    const { states, open, allDone } = sectionStates(["tin", "cls", "loc"], () => true);
    assert.deepEqual(states, { tin: "done", cls: "done", loc: "done" });
    assert.equal(open, null);
    assert.equal(allDone, true);
  });
});

describe("the progress opens only what has been reached", () => {
  const order = stepOrder();
  test("up to and including the first step not complete", () => {
    assert.equal(openableThrough(order, (id) => id === "business"), 1);
    assert.equal(openableThrough(order, () => false), 0);
  });

  test("a step that stops being complete closes what follows it again", () => {
    const done = new Set(["business", "you", "documents"]);
    done.delete("you");
    assert.equal(openableThrough(order, (id) => done.has(id)), 1);
  });

  test("everything complete: the last step", () => {
    assert.equal(openableThrough(order, () => true), order.length - 1);
  });
});

describe("drafts (ADR-075 S9, AC-9)", () => {
  test("the wizard opens on Business", () => {
    assert.equal(openingStep(), "business");
  });

  test("a draft reopens on the step that was open, and one saved before ADR-075 on Business", () => {
    assert.equal(resumeStep("documents"), "documents");
    assert.equal(resumeStep("pay"), "pay");
    assert.equal(resumeStep(undefined), "business");
  });

  test("every step a draft can name is one of the five", async () => {
    const { REGISTRATION_DRAFT_STEPS } = await import("@injishi/contracts");
    assert.deepEqual([...REGISTRATION_DRAFT_STEPS].sort(), [...stepOrder()].sort());
  });

  test("it opens no step past the first one still owing an answer", () => {
    const order = stepOrder();
    // Business and You complete: Documents is as far as it can open.
    assert.equal(clampToOpenable(order, "documents", 2), "documents");
    assert.equal(clampToOpenable(order, "review", 2), "documents");
    // The owner's National ID is never kept, so a helper's Business (where the owner is named) is owed again.
    assert.equal(clampToOpenable(order, "documents", 0), "business");
    assert.equal(clampToOpenable(order, "business", 4), "business");
  });
});

describe("documents, by business kind (ADR-075 S5, AC-11)", () => {
  test("a stay: the RDB certificate, and nothing else", () => {
    assert.deepEqual(
      documentRows("hotel").map((r) => [r.label, r.required]),
      [["RDB certificate", true]],
    );
  });

  test("Other is a stay that fits no named class, and takes the stay rows", () => {
    assert.deepEqual(documentRows("other"), documentRows("guest_house"));
  });

  test("a venue: the RDB certificate, and nothing else", () => {
    for (const kind of ["coffee_shop", "bar_restaurant"]) {
      assert.deepEqual(documentRows(kind).map((r) => [r.kind, r.required]), [["rdb_certificate", true]]);
    }
  });

  test("a residence: the land title, and nothing else", () => {
    assert.deepEqual(documentRows("residence").map((r) => [r.kind, r.required]), [["land_title", true]]);
  });

  test("a franchisee's agreement joins its kind's rows, optional", () => {
    const rows = documentRows("coffee_shop", { franchisee: true });
    assert.deepEqual(rows.at(-1), { kind: "franchise_agreement", required: false, label: "Franchise agreement" });
    assert.equal(rows.length, documentRows("coffee_shop").length + 1);
  });

  test("no rows before the kind is known, and none for a broker", () => {
    assert.deepEqual(documentRows(null), []);
    assert.deepEqual(documentRows("broker"), []);
  });

  test("every row's kind is one the contract accepts", async () => {
    const { OrgCertificateKind } = await import("@injishi/contracts");
    for (const kind of ["hotel", "coffee_shop", "residence"]) {
      for (const row of documentRows(kind, { franchisee: true })) {
        assert.ok(OrgCertificateKind.safeParse(row.kind).success, row.kind);
      }
    }
  });

  test("the rows are the API's own table: the same kinds, the same required one", async () => {
    const { registrationDocumentRows, missingRegistrationDocument } = await import("@injishi/contracts");
    for (const kind of ["hotel", "other", "coffee_shop", "bar_restaurant", "residence"]) {
      assert.deepEqual(
        documentRows(kind).map(({ kind: k, required }) => ({ kind: k, required })),
        registrationDocumentRows(kind).map(({ kind: k, required }) => ({ kind: k, required })),
      );
    }
    assert.equal(missingRegistrationDocument("hotel", []), "rdb_certificate");
    assert.equal(missingRegistrationDocument("residence", [{ kind: "rdb_certificate" }]), "land_title");
    assert.equal(missingRegistrationDocument("coffee_shop", [{ kind: "rdb_certificate" }]), null);
  });

  test("what is still needed", () => {
    assert.deepEqual(missingRequired("hotel", new Set()).map((r) => r.kind), ["rdb_certificate"]);
    assert.deepEqual(missingRequired("hotel", new Set(["rdb_certificate"])), []);
    assert.deepEqual(missingRequired("residence", new Set(["rdb_certificate"])).map((r) => r.kind), ["land_title"]);
  });
});

describe("the wizard reads all of this from the module", () => {
  const wizard = readFileSync(resolve(REGISTER, "register-wizard.tsx"), "utf8");
  test("its order, its sections, its rail and its saving", () => {
    for (const name of ["stepOrder(", "sectionOrder(", "sectionStates(", "openableThrough(", "resumeStep(", "clampToOpenable("]) {
      assert.ok(wizard.includes(name), `register-wizard.tsx does not call ${name}`);
    }
  });
  test("and keeps no second copy of the order", () => {
    assert.doesNotMatch(wizard, /\[\s*"business",\s*"you"/);
  });
  test("and asks for no agreement or signature before paying (AC-12)", () => {
    assert.doesNotMatch(wizard, /SignaturePad|acceptRegistrationContract|OPERATOR_CONTRACT_VERSION/);
  });
  test("and mints the Pay press's Idempotency-Key at the press, once (AC-14)", () => {
    assert.match(wizard, /createFromAnswers\(crypto\.randomUUID\(\)\)/);
  });
});
