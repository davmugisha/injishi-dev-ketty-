/**
 * "Part of a franchise?" (ADR-075 O-7, AC-8): No, a franchisee or a franchisor,
 * asked on Business after Location, and sent as the `franchise` block the API
 * validates with the same contract.
 *
 * THIS RUNS THE REAL HELPERS (`register/franchise-draft.ts`) against the real
 * contract (`FranchiseDeclaration` in `@injishi/contracts`), so what the wizard
 * builds is what the API accepts. The API's own proof is
 * `server/api/scripts/verify-adr075-thread.mjs` section G.
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
const REGISTER = resolve(here, "../src/app/(app)/(entry)/register");
const { franchiseCandidate, franchiseLine } = await import("@/app/(app)/(entry)/register/franchise-draft");
const { sectionOrder, documentRows } = await import("@/app/(app)/(entry)/register/register-steps");
const { FranchiseDeclaration, BusinessDetails } = await import("@injishi/contracts");

/** The franchise fields of a business draft, empty as `EMPTY_BUSINESS` holds them. */
const draft = (over) => ({
  franchiseRole: "",
  franchiseBrand: "",
  franchisorLegalName: "",
  franchisorCountry: "",
  franchisedLocations: "",
  ...over,
});

describe("the question", () => {
  test("follows Location for a business with a TIN, and a residence is not asked", () => {
    assert.deepEqual(sectionOrder("owner", "business").slice(-2), ["loc", "fr"]);
    assert.deepEqual(sectionOrder("helper", "business").slice(-2), ["loc", "fr"]);
    assert.ok(!sectionOrder("landlord", "business").includes("fr"));
  });

  test("the section offers the three answers the ADR words", () => {
    const section = readFileSync(resolve(REGISTER, "section-franchise.tsx"), "utf8");
    assert.match(section, /legend="Part of a franchise\?"/);
    assert.match(section, /title="No"/);
    assert.match(section, /title="We run another company's brand"/);
    assert.match(section, /title="We own the brand and license it"/);
  });
});

describe("what the wizard sends", () => {
  test("No sends no block, and neither does no answer yet", () => {
    assert.equal(franchiseCandidate(draft({ franchiseRole: "none" })), undefined);
    assert.equal(franchiseCandidate(draft({ franchiseRole: "" })), undefined);
  });

  test("a franchisee's block is one the contract accepts", () => {
    const block = franchiseCandidate(
      draft({ franchiseRole: "franchisee", franchiseBrand: "Java House", franchisorLegalName: "Java House Africa Ltd", franchisorCountry: "KE" }),
    );
    assert.deepEqual(FranchiseDeclaration.parse(block), {
      role: "franchisee",
      brandName: "Java House",
      franchisorLegalName: "Java House Africa Ltd",
      franchisorCountry: "KE",
    });
  });

  test("a franchisor's count is a number, and typing that is not one is refused in words", () => {
    const block = franchiseCandidate(draft({ franchiseRole: "franchisor", franchiseBrand: "Kivu Rooms", franchisedLocations: " 12 " }));
    assert.deepEqual(FranchiseDeclaration.parse(block), { role: "franchisor", brandName: "Kivu Rooms", franchisedLocations: 12 });
    for (const typed of ["", "twelve", "1.5"]) {
      const bad = FranchiseDeclaration.safeParse(franchiseCandidate(draft({ franchiseRole: "franchisor", franchiseBrand: "Kivu Rooms", franchisedLocations: typed })));
      assert.equal(bad.success, false, typed);
      assert.match(bad.error.issues[0].message, /locations/, typed);
    }
  });

  test("a franchisee who names no country is told to pick one", () => {
    const bad = FranchiseDeclaration.safeParse(franchiseCandidate(draft({ franchiseRole: "franchisee", franchiseBrand: "B", franchisorLegalName: "Brand Co" })));
    assert.equal(bad.success, false);
    assert.equal(bad.error.issues[0].message, "Pick the franchisor's country.");
  });
});

describe("the agreement", () => {
  test("is a Documents row for a franchisee only, and optional", () => {
    const rows = documentRows("hotel", { franchisee: true });
    assert.deepEqual(rows.find((r) => r.kind === "franchise_agreement"), { kind: "franchise_agreement", required: false, label: "Franchise agreement" });
    assert.equal(documentRows("hotel").some((r) => r.kind === "franchise_agreement"), false);
  });

  test("the contract refuses it on a business that does not run another company's brand", () => {
    const business = {
      domain: "hospitality",
      legalName: "Spec Hotel",
      address: { country: "RW", provinceId: 1, districtId: 102, sectorId: 10201 },
      businessKind: "hotel",
      accommodationClass: "hotel",
      tin: "999031001",
      certificates: [
        { kind: "rdb_certificate", objectKey: "rdb" },
        { kind: "franchise_agreement", objectKey: "agreement" },
      ],
    };
    const refused = BusinessDetails.safeParse({ ...business, franchise: { role: "franchisor", brandName: "B", franchisedLocations: 2 } });
    assert.equal(refused.success, false);
    assert.deepEqual(refused.error.issues[0].path, ["certificates", 1, "kind"]);
    const kept = BusinessDetails.safeParse({
      ...business,
      franchise: { role: "franchisee", brandName: "B", franchisorLegalName: "Brand Co", franchisorCountry: "RW" },
    });
    assert.equal(kept.success, true);
  });

  test("the wizard drops it when the answer stops being a franchisee", () => {
    const wizard = readFileSync(resolve(REGISTER, "register-wizard.tsx"), "utf8");
    assert.match(wizard, /if \(business\.franchiseRole !== "franchisee"\) setDocs\(\(d\) => d\.filter\(\(doc\) => doc\.kind !== "franchise_agreement"\)\)/);
  });
});

describe("the line Review shows", () => {
  test("words each answer", () => {
    assert.equal(franchiseLine(draft({ franchiseRole: "none" })), "Not part of a franchise");
    assert.equal(
      franchiseLine(draft({ franchiseRole: "franchisee", franchiseBrand: "Java House", franchisorLegalName: "Java House Africa Ltd", franchisorCountry: "KE" })),
      "Runs Java House under licence from Java House Africa Ltd, Kenya",
    );
    assert.equal(franchiseLine(draft({ franchiseRole: "franchisor", franchiseBrand: "Kivu Rooms", franchisedLocations: "1" })), "Owns the Kivu Rooms brand · 1 franchised location");
  });
});
