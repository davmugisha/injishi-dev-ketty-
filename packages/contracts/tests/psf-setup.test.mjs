import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { CreatePsfBandRequest, PSF_FORM_FIELDS, psfBandName, psfBandOverlap, psfCardBand, psfCardHoneycomb, psfCodeFrom, psfExtraAnswerProblem, psfFeeKindsOf, psfFeeShown, psfFeeTotal, psfFormDefaults, psfLevelColours, psfLevelsOf, psfPaperPattern, PsfPublicSubmitRequest, psfSplitOf } from "../dist/index.js";

describe("the split (2026-11-06)", () => {
  it("gives the district its share rounded down, and headquarters the rest", () => {
    assert.deepEqual(psfSplitOf(90000, 70), { districtRwf: 63000, headquartersRwf: 27000 });
    assert.deepEqual(psfSplitOf(333, 60), { districtRwf: 199, headquartersRwf: 134 });
    assert.deepEqual(psfSplitOf(1000, 0), { districtRwf: 0, headquartersRwf: 1000 });
    assert.deepEqual(psfSplitOf(1000, 100), { districtRwf: 1000, headquartersRwf: 0 });
  });
});

describe("band ranges", () => {
  const bands = [
    { code: "a", minRwf: 50000, maxRwf: 99999, active: true },
    { code: "b", minRwf: 100000, maxRwf: 199999, active: true },
    { code: "top", minRwf: 5000000, maxRwf: null, active: true },
    { code: "old", minRwf: 300000, maxRwf: 400000, active: false },
    { code: "quote", minRwf: null, maxRwf: null, active: true },
  ];
  it("finds a collision, at either end and with an open ended band", () => {
    assert.equal(psfBandOverlap(bands, { minRwf: 90000, maxRwf: 120000 })?.code, "a");
    assert.equal(psfBandOverlap(bands, { minRwf: 6000000, maxRwf: null })?.code, "top");
    assert.equal(psfBandOverlap(bands, { code: "b", minRwf: 90000, maxRwf: 199999 })?.code, "a");
  });
  it("lets a band keep its own range, and ignores retired and quoted bands", () => {
    assert.equal(psfBandOverlap(bands, { code: "b", minRwf: 100000, maxRwf: 150000 }), null);
    assert.equal(psfBandOverlap(bands, { minRwf: 300000, maxRwf: 400000 }), null);
  });
  it("refuses a range whose most is not above its least", () => {
    assert.equal(CreatePsfBandRequest.safeParse({ level: "x", minRwf: 100, maxRwf: 100 }).success, false);
    assert.equal(CreatePsfBandRequest.safeParse({ level: "x", minRwf: 100, maxRwf: null }).success, true);
  });
  it("names and codes a band and level", () => {
    assert.equal(psfBandName("Indatwa", 90000, 199999), "Indatwa, 90,000 to 199,999");
    assert.equal(psfBandName("Silver", 6000000, null), "Silver, 6,000,000 and up");
    assert.equal(psfCodeFrom("Silver Circle!"), "silver_circle");
    assert.equal(psfCodeFrom("100 club"), "x_100_club");
  });
  it("lists levels in the order the API sent, with PSF's own name", () => {
    const levels = psfLevelsOf([{ family: "silver", familyName: "Silver" }, { family: "silver", familyName: "Silver" }, { family: "indatwa" }]);
    assert.deepEqual(levels.map((l) => [l.family, l.name]), [["silver", "Silver"], ["indatwa", "Indatwa"]]);
  });
});

describe("the form", () => {
  it("keeps what the system needs locked", () => {
    for (const key of ["nationalId", "phone", "district", "tin", "legalName", "clusterCode", "gender"]) {
      assert.equal(PSF_FORM_FIELDS.find((f) => f.key === key)?.locked, true, key);
    }
  });
  it("has one row per field, in order", () => {
    const d = psfFormDefaults();
    assert.equal(new Set(d.map((f) => f.key)).size, d.length);
    assert.deepEqual([...d].sort((a, b) => a.sortOrder - b.sortOrder).map((f) => f.key), d.map((f) => f.key));
  });
  it("checks an answer by the question's kind", () => {
    const q = (fieldType, required = true, options = []) => ({ label: "Q", fieldType, required, options });
    assert.match(psfExtraAnswerProblem(q("text"), undefined), /Answer/);
    assert.equal(psfExtraAnswerProblem(q("text", false), undefined), null);
    assert.match(psfExtraAnswerProblem(q("number"), "12"), /number/);
    assert.equal(psfExtraAnswerProblem(q("number"), 0), null);
    assert.match(psfExtraAnswerProblem(q("select", true, ["A", "B"]), "C"), /Pick/);
    assert.equal(psfExtraAnswerProblem(q("select", true, ["A", "B"]), "B"), null);
    assert.match(psfExtraAnswerProblem(q("boolean"), false), /Answer/);
  });
  it("leaves a hidden photo and activity to PSF's settings, not the contract", () => {
    const parsed = PsfPublicSubmitRequest.safeParse({
      checkToken: "x".repeat(20),
      business: { legalName: "Spec", registrationKind: "none", subsectorOther: "Coffee", associationCode: "a", address: { provinceId: 1, districtId: 1, sectorId: 1, street: "" }, companyType: "sole_trader", ownership: "rwandan_100", tradeDirection: "none" },
      membership: { tierCode: "t", declaredFeeRwf: 10 },
      contact: { role: "owner", gender: "female", phoneE164: "+250788000000" },
      payerPhoneE164: "+250788000000",
      consent: true,
    });
    assert.equal(parsed.success, true, JSON.stringify(parsed.error?.issues));
  });
});

describe("a member's papers (2026-11-06)", () => {
  it("draws the same pattern for the same number, and another for another", () => {
    assert.deepEqual(psfPaperPattern("PSF-2026-000123", 226, 595), psfPaperPattern("PSF-2026-000123", 226, 595));
    assert.notDeepEqual(psfPaperPattern("PSF-2026-000123", 226, 595).paths, psfPaperPattern("PSF-2026-000124", 226, 595).paths);
  });

  it("gives each member their own band and honeycomb on the card, always the same ones", () => {
    assert.deepEqual(psfCardBand("PSF/GAS/2026/0004", 227), psfCardBand("PSF/GAS/2026/0004", 227));
    assert.notDeepEqual(psfCardBand("PSF/GAS/2026/0004", 227).paths, psfCardBand("PSF/GAS/2026/0005", 227).paths);
    assert.notDeepEqual(psfCardHoneycomb("PSF/GAS/2026/0004", 360, 227).filled, psfCardHoneycomb("PSF/GAS/2026/0005", 360, 227).filled);
  });

  it("gives each level its colours, and an added level always the same spare ones", () => {
    assert.equal(psfLevelColours("golden_circle").accent, "#d9be6d");
    assert.notEqual(psfLevelColours("indatwa").ground, psfLevelColours("indashyikirwa").ground);
    assert.deepEqual(psfLevelColours("a_new_level"), psfLevelColours("a_new_level"));
  });
});

describe("fees by kind, and whose view (2026-11-06)", () => {
  const line = (totalRwf, districtRwf, headquartersRwf, kind) => ({ kind, totalRwf, districtRwf, headquartersRwf });
  const kinds = psfFeeKindsOf([line(100000, 60000, 40000, "application"), line(50000, 30000, 20000, "application"), line(200000, 120000, 80000, "renewal"), line(90000, 63000, 27000, "upgrade")]);

  it("adds each kind, and the three make the total", () => {
    assert.equal(kinds.application.totalRwf, 150000);
    assert.equal(kinds.renewal.totalRwf, 200000);
    assert.equal(kinds.upgrade.headquartersRwf, 27000);
    assert.deepEqual(psfFeeTotal(kinds), { totalRwf: 440000, districtRwf: 273000, headquartersRwf: 167000 });
  });

  it("shows the whole fee, or the viewer's own share", () => {
    const total = psfFeeTotal(kinds);
    assert.equal(psfFeeShown(total, "all", "headquarters"), 440000);
    assert.equal(psfFeeShown(total, "ours", "headquarters"), 167000);
    assert.equal(psfFeeShown(total, "ours", "district"), 273000);
  });
});
