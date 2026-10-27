/**
 * Save as you type, and reopen where it was left (ADR-075 S9, AC-9 and AC-10).
 *
 * THIS RUNS THE REAL MODULE (`register/register-draft.ts`): the answers into
 * and out of the server's draft, against the real `RegistrationDraft` contract
 * the API and the device copy both hold a draft to, and the header's save
 * status. The API's own proof is `server/api/scripts/verify-adr075-thread.mjs`
 * section H; the device copy is `register-device-copy.test.mjs`.
 *
 * Run: pnpm --filter @injishi/web test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

register("./ts-source-hook.mjs", import.meta.url);

const {
  toServerDraft,
  fromServerDraft,
  unnumbered,
  furthest,
  SAVE_STATE_TEXT,
  saveStateAfter,
  saveStateWhileTyping,
} = await import("@/app/(app)/(entry)/register/register-draft");
const { RegistrationDraft, holdsIdNumber } = await import("@injishi/contracts");

const EMPTY_ADDRESS = {
  country: "RW",
  provinceId: "",
  districtId: "",
  sectorId: "",
  cellId: "",
  villageId: "",
  street: "",
  addressText: "",
};
const KIGALI = { ...EMPTY_ADDRESS, provinceId: "1", districtId: "102", sectorId: "10201", street: "KN 5 Rd" };
const EMPTY_PERSONAL = {
  firstName: "",
  middleName: "",
  lastName: "",
  documentType: "national_id",
  documentNumber: "",
  issuingCountry: "RW",
  gender: "",
  dateOfBirth: "",
  phoneE164: "",
  address: { ...EMPTY_ADDRESS },
};
const EMPTY_BUSINESS = {
  legalName: "",
  accommodationClass: "",
  accommodationClassOther: "",
  residenceClass: "residential_landlord",
  tin: "",
  upi: "",
  tourismLicenseNumber: "",
  chamberOfTourismMember: null,
  psfMember: null,
  psfApply: null,
  psfMembershipNumber: "",
  eacStarGrade: "",
  address: { ...EMPTY_ADDRESS },
  franchiseRole: "",
  franchiseBrand: "",
  franchisorLegalName: "",
  franchisorCountry: "",
  franchisedLocations: "",
};
const EMPTY = { personal: EMPTY_PERSONAL, business: EMPTY_BUSINESS, address: EMPTY_ADDRESS };
let branchKey = 0;
const mintBranch = () => ({ key: `b-${(branchKey += 1)}`, name: "", address: { ...EMPTY_ADDRESS } });

/** A hotel helper's answers on Documents: an owner named, a franchise, one upload. */
const answers = (over = {}) => ({
  openStep: "documents",
  reached: "documents",
  done: ["tin", "id", "intended", "loc", "fr"],
  kind: "hotel",
  capacity: "on_behalf_of",
  typedPersonal: true,
  personal: {
    ...EMPTY_PERSONAL,
    firstName: "Aline",
    lastName: "Uwase",
    documentNumber: "1199080012345678",
    dateOfBirth: "1990-04-02",
    phoneE164: "+250788300412",
    address: { ...KIGALI },
  },
  intendedOwner: { name: "Eric Habimana", nationalId: "1198580045678923", email: "eric@example.rw" },
  business: {
    ...EMPTY_BUSINESS,
    legalName: "Kivu Lakeside Lodges Ltd",
    accommodationClass: "hotel",
    tin: "999031001",
    psfMember: false,
    address: { ...KIGALI },
    franchiseRole: "franchisee",
    franchiseBrand: "Java House",
    franchisorLegalName: "Java House Africa Ltd",
    franchisorCountry: "KE",
  },
  branches: [{ key: "b-x", name: "Gisenyi", address: { ...KIGALI } }],
  documents: [
    { kind: "rdb_certificate", kindOther: "", objectKey: "certificate/2026/10/3f2a9c1e-7d4b-4a8e-9c1f-2b6d8e0a4c11.pdf", filename: "rdb.pdf", sizeBytes: 81234 },
  ],
  ...over,
});

describe("the answers, to the server's draft and back (AC-9)", () => {
  test("go without either ID number, and the contract the API holds them to accepts them", () => {
    const draft = toServerDraft(answers());
    assert.equal(RegistrationDraft.safeParse(draft).success, true);
    assert.equal(holdsIdNumber(draft), false, JSON.stringify(draft));
    assert.equal("documentNumber" in draft.personal, false);
    assert.equal("nationalId" in draft.intendedOwner, false);
  });

  test("come back as they were, with both ID numbers asked again", () => {
    const back = fromServerDraft(toServerDraft(answers()), EMPTY, mintBranch);
    const want = answers();
    assert.equal(back.personal.documentNumber, "");
    assert.equal(back.intendedOwner.nationalId, "");
    assert.deepEqual({ ...back.personal, documentNumber: "x" }, { ...want.personal, documentNumber: "x" });
    assert.deepEqual(back.business, want.business);
    assert.equal(back.intendedOwner.name, "Eric Habimana");
    assert.deepEqual(back.branches.map((b) => b.name), ["Gisenyi"]);
    assert.equal(back.kind, "hotel");
    assert.equal(back.capacity, "on_behalf_of");
  });

  test("keep the step that was open, how far the walk reached, and what was marked done", () => {
    const back = fromServerDraft(
      toServerDraft(answers({ openStep: "you", reached: "review", done: ["review", "tin", "tin", "loc"] })),
      EMPTY,
      mintBranch,
    );
    assert.equal(back.openStep, "you");
    assert.equal(back.reached, "review");
    // In the contract's order, once each.
    assert.deepEqual(back.done, ["tin", "loc", "review"]);
  });

  test("carry the franchise answer in its own block, not in the business record (S9)", () => {
    const draft = toServerDraft(answers());
    assert.deepEqual(draft.franchise, {
      role: "franchisee",
      brandName: "Java House",
      franchisorLegalName: "Java House Africa Ltd",
      franchisorCountry: "KE",
      franchisedLocations: "",
    });
    for (const key of ["franchiseRole", "franchiseBrand", "franchisorLegalName", "franchisorCountry", "franchisedLocations"]) {
      assert.equal(key in draft.business, false, key);
    }
  });

  test("keep each uploaded document by the key of its stored object, never the file", () => {
    const draft = toServerDraft(answers());
    assert.deepEqual(draft.documents, [
      { kind: "rdb_certificate", objectKey: "certificate/2026/10/3f2a9c1e-7d4b-4a8e-9c1f-2b6d8e0a4c11.pdf", filename: "rdb.pdf", sizeBytes: 81234 },
    ]);
    const back = fromServerDraft(draft, EMPTY, mintBranch);
    assert.deepEqual(back.documents, answers().documents);
  });

  test("cut a sixteen digit run in a file name to its last four, so a scan named by its ID still saves", () => {
    assert.equal(unnumbered("id-1199080012345678.pdf"), "id-…5678.pdf");
    assert.equal(unnumbered("rdb-2026.pdf"), "rdb-2026.pdf");
    const draft = toServerDraft(
      answers({
        documents: [{ kind: "tax_clearance", kindOther: "", objectKey: "certificate/2026/10/a.pdf", filename: "1199080012345678.pdf", sizeBytes: 10 }],
      }),
    );
    assert.equal(RegistrationDraft.safeParse(draft).success, true);
    assert.equal(draft.documents[0].filename, "…5678.pdf");
  });

  test("a draft saved before ADR-075 still reads, and reopens on Business with nothing marked done", () => {
    const old = {
      v: 1,
      phase: "documents",
      kind: "hotel",
      capacity: "owner",
      typedPersonal: false,
      personal: { ...EMPTY_PERSONAL, documentNumber: undefined },
      intendedOwner: { name: "", email: "" },
      business: { legalName: "Old Hotel", tin: "999031001", address: { ...KIGALI } },
      branches: [],
    };
    delete old.personal.documentNumber;
    const parsed = RegistrationDraft.safeParse(old);
    assert.equal(parsed.success, true, JSON.stringify(parsed.error?.issues));
    const back = fromServerDraft(parsed.data, EMPTY, mintBranch);
    assert.equal(back.openStep, "business");
    assert.equal(back.reached, "business");
    assert.deepEqual(back.done, []);
    assert.deepEqual(back.documents, []);
    assert.equal(back.business.legalName, "Old Hotel");
    assert.equal(back.business.franchiseRole, "");
  });

  test("the contract refuses a draft holding an ID number anywhere, or a document number field", () => {
    const draft = toServerDraft(answers());
    assert.equal(RegistrationDraft.safeParse({ ...draft, business: { ...draft.business, note: "1199080012345678" } }).success, false);
    assert.equal(
      RegistrationDraft.safeParse({ ...draft, personal: { ...draft.personal, documentNumber: "12345" } }).success,
      false,
    );
    assert.equal(holdsIdNumber({ a: "id 1199080012345678" }), true);
    assert.equal(holdsIdNumber({ a: "+250788300412", b: "certificate/2026/10/3f2a9c1e-7d4b.pdf" }), false);
  });

  test("the furthest of two steps is the later one", () => {
    assert.equal(furthest("you", "review"), "review");
    assert.equal(furthest("pay", "business"), "pay");
  });
});

describe("the header's save status, always true (AC-10)", () => {
  test("says the four things ADR-075 gives it, word for word", () => {
    assert.deepEqual(SAVE_STATE_TEXT, {
      saving: "Saving…",
      saved: "✓ Saved",
      offline: "Offline, saved on this phone",
      // Followed by its Retry button.
      failed: "Not saved,",
    });
  });

  test("while typing: on its way when online, on this phone when not, and not saved when the phone kept nothing", () => {
    assert.equal(saveStateWhileTyping(true, true), "saving");
    assert.equal(saveStateWhileTyping(false, true), "offline");
    assert.equal(saveStateWhileTyping(false, false), "failed");
  });

  test("after a save: saved, offline only when this phone holds the answers, refused is not saved", () => {
    assert.equal(saveStateAfter("ok", false), "saved");
    assert.equal(saveStateAfter("unreachable", true), "offline");
    assert.equal(saveStateAfter("unreachable", false), "failed");
    assert.equal(saveStateAfter("refused", true), "failed");
  });
});
