/**
 * PSF membership (ADR-056): the application a registration or a workspace
 * sends, the tier catalogue's price rule, the officer's decision inputs, and
 * where the officer role may be posted.
 *
 * The API validates against these same schemas, so each assertion is the rule
 * on both ends of the wire. Tests the built module (`dist/`), like every test
 * in this folder.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  CreateRegistrationRequest,
  CreatePsfTierRequest,
  DISTRICT_LETTERS,
  OVERSIGHT_ROLE_POSTING,
  OversightRole,
  PayPsfMembershipRequest,
  PsfApplicationInput,
  PsfApproveRequest,
  PsfBusinessesQuery,
  PsfDeclineRequest,
  businessTypeFor,
  defaultPsfMembershipDates,
  districtLetters,
  formatBusinessCode,
  isInPsfQueueState,
  isPsfApplicant,
  normalizeBusinessCode,
  oversightConsoleFor,
  psfFeeProblem,
  psfStartingFee,
  psfTierAcceptsFee,
  splitPsfName,
} = require("../dist/index.js");

const ADDRESS = { country: "RW", provinceId: 1, districtId: 102, sectorId: 10201, street: "KG 11 Ave" };

function application(overrides = {}) {
  return {
    requestedTierCode: "ordinary_300k",
    companyName: "Amahoro Hospitality Group",
    streetAddress: "KG 11 Ave",
    companyType: "private_company",
    ownership: "rwandan_100",
    businessActivity: "Accommodation: Hotel",
    tradeDirection: "none",
    contactRole: "owner",
    firstName: "Yves",
    lastName: "Habimana",
    gender: "male",
    phoneE164: "+250788123456",
    email: "yves@example.rw",
    idDocument: { documentType: "national_id", documentNumber: "1199080012345678" },
    dateOfBirth: "1985-04-12",
    consent: true,
    ...overrides,
  };
}

function hotel(business = {}) {
  return {
    role: "host",
    business: {
      domain: "hospitality",
      legalName: "Amahoro Hospitality Group",
      address: ADDRESS,
      accommodationClass: "hotel",
      tin: "123456789",
      ...business,
    },
  };
}

function paths(schema, value) {
  const result = schema.safeParse(value);
  return result.success ? [] : [...new Set(result.error.issues.map((i) => i.path.join(".")))];
}

describe("a PSF application (AC-4, AC-5)", () => {
  test("a complete one parses", () => {
    assert.deepEqual(paths(PsfApplicationInput, application()), []);
  });

  test("consent must be ticked, not merely present", () => {
    assert.deepEqual(paths(PsfApplicationInput, application({ consent: false })), ["consent"]);
  });

  test("ownership Other needs its text, and only Other may carry one", () => {
    assert.deepEqual(paths(PsfApplicationInput, application({ ownership: "other" })), ["ownershipOther"]);
    assert.deepEqual(paths(PsfApplicationInput, application({ ownershipOther: "Family trust" })), ["ownershipOther"]);
    assert.deepEqual(paths(PsfApplicationInput, application({ ownership: "other", ownershipOther: "Family trust" })), []);
  });

  test("trade details are required unless the answer is none, and forbidden with none", () => {
    assert.deepEqual(paths(PsfApplicationInput, application({ tradeDirection: "export" })).sort(), ["tradeCountries", "tradeGoods"]);
    assert.deepEqual(
      paths(PsfApplicationInput, application({ tradeDirection: "export", tradeGoods: "Coffee", tradeCountries: ["KE"] })),
      [],
    );
    assert.deepEqual(paths(PsfApplicationInput, application({ tradeGoods: "Coffee" })), ["tradeGoods"]);
  });

  test("a trade country must be one the picker offers", () => {
    assert.deepEqual(
      paths(PsfApplicationInput, application({ tradeDirection: "import", tradeGoods: "Linen", tradeCountries: ["ZZ"] })),
      ["tradeCountries.0"],
    );
  });

  test("PSF's form knows two genders", () => {
    assert.deepEqual(paths(PsfApplicationInput, application({ gender: "prefer_not_to_say" })), ["gender"]);
  });

  test("the ID number is checked by its type", () => {
    assert.deepEqual(paths(PsfApplicationInput, application({ idDocument: { documentType: "national_id", documentNumber: "123" } })), ["idDocument.documentNumber"]);
    assert.deepEqual(paths(PsfApplicationInput, application({ idDocument: { documentType: "passport", documentNumber: "pc1234567" } })), []);
  });
});

describe("PSF on a registration (AC-1, AC-6, AC-7)", () => {
  test("a No may carry an application", () => {
    assert.deepEqual(paths(CreateRegistrationRequest, hotel({ psfMember: false, psfApplication: application() })), []);
  });

  test("a Yes may carry a number, and may not carry an application", () => {
    assert.deepEqual(paths(CreateRegistrationRequest, hotel({ psfMember: true, psfMembershipNumber: "PSF-001" })), []);
    assert.deepEqual(paths(CreateRegistrationRequest, hotel({ psfMember: true, psfApplication: application() })), ["business.psfApplication"]);
  });

  test("a number without a Yes is refused", () => {
    assert.deepEqual(paths(CreateRegistrationRequest, hotel({ psfMember: false, psfMembershipNumber: "PSF-001" })), ["business.psfMembershipNumber"]);
  });

  test("a residence carrying either is refused, not stripped", () => {
    const residence = {
      role: "landlord",
      business: {
        domain: "residence",
        legalName: "Kimironko Flats",
        address: ADDRESS,
        residenceClass: "residential_landlord",
        upi: "1/03/07/02/1234",
      },
    };
    assert.deepEqual(paths(CreateRegistrationRequest, { ...residence, business: { ...residence.business, psfApplication: application() } }), ["business.psfApplication"]);
    assert.deepEqual(paths(CreateRegistrationRequest, { ...residence, business: { ...residence.business, psfMembershipNumber: "X1" } }), ["business.psfMembershipNumber"]);
  });
});

describe("the tier catalogue's price rule (AC-19)", () => {
  const tier = (price) => ({ code: "t_one", family: "ordinary", nameEn: "T", sortOrder: 1, reason: "Seeding the catalogue", ...price });

  test("each price kind carries exactly its own amounts", () => {
    assert.deepEqual(paths(CreatePsfTierRequest, tier({ priceKind: "fixed", annualFeeRwf: 100000 })), []);
    assert.deepEqual(paths(CreatePsfTierRequest, tier({ priceKind: "fixed" })), ["annualFeeRwf"]);
    assert.deepEqual(paths(CreatePsfTierRequest, tier({ priceKind: "range", annualFeeMinRwf: 500000, annualFeeMaxRwf: 3000000 })), []);
    assert.deepEqual(paths(CreatePsfTierRequest, tier({ priceKind: "range", annualFeeMinRwf: 3000000, annualFeeMaxRwf: 500000 })), ["annualFeeMinRwf"]);
    assert.deepEqual(paths(CreatePsfTierRequest, tier({ priceKind: "set_by_psf" })), []);
    assert.deepEqual(paths(CreatePsfTierRequest, tier({ priceKind: "set_by_psf", annualFeeRwf: 1 })), ["priceKind"]);
  });

  test("every write says why, for the audit row", () => {
    const { reason, ...noReason } = tier({ priceKind: "set_by_psf" });
    assert.deepEqual(paths(CreatePsfTierRequest, noReason), ["reason"]);
  });

  test("a code is a permanent machine name", () => {
    assert.deepEqual(paths(CreatePsfTierRequest, { ...tier({ priceKind: "set_by_psf" }), code: "Ordinary 300k" }), ["code"]);
  });
});

describe("the officer's decisions (AC-11, AC-12)", () => {
  test("decline Other needs a note", () => {
    assert.deepEqual(paths(PsfDeclineRequest, { reason: "other" }), ["note"]);
    assert.deepEqual(paths(PsfDeclineRequest, { reason: "details_incomplete" }), []);
  });

  test("the default term is one year less a day, leap day included", () => {
    assert.deepEqual(defaultPsfMembershipDates("2026-09-27"), { startsOn: "2026-09-27", expiresOn: "2027-09-26" });
    assert.deepEqual(defaultPsfMembershipDates("2028-02-29"), { startsOn: "2028-02-29", expiresOn: "2029-02-28" });
  });
});

describe("the membership officer's posting and console (AC-10)", () => {
  test("is PSF, for the country, a province or a district, and opens the membership console", () => {
    assert.equal(OversightRole.options.includes("psf_membership_officer"), true);
    assert.deepEqual(OVERSIGHT_ROLE_POSTING.psf_membership_officer.scopeLevels, ["country", "province", "district"]);
    assert.equal(OVERSIGHT_ROLE_POSTING.psf_membership_officer.governmentBodyCode, "PSF");
    assert.equal(oversightConsoleFor("psf_membership_officer"), "membership");
  });

  test("the registration roles keep no posting rule", () => {
    assert.equal(OVERSIGHT_ROLE_POSTING.business_field_verifier, undefined);
    assert.equal(OVERSIGHT_ROLE_POSTING.business_approver, undefined);
  });
});

describe("who may apply for a business (AC-15, AC-17, AC-22)", () => {
  const owner = { userId: "u-owner", domain: "hospitality", orgRole: "owner", obo: null };

  test("an owner of a hospitality business may", () => {
    assert.equal(isPsfApplicant(owner), true);
  });

  test("an owner of a PSF business may", () => {
    assert.equal(isPsfApplicant({ ...owner, domain: "enterprise" }), true);
  });

  test("a manager, a receptionist and a residence owner may not", () => {
    assert.equal(isPsfApplicant({ ...owner, orgRole: "manager" }), false);
    assert.equal(isPsfApplicant({ ...owner, orgRole: "receptionist" }), false);
    assert.equal(isPsfApplicant({ ...owner, orgRole: null }), false);
    assert.equal(isPsfApplicant({ ...owner, domain: "residence" }), false);
  });

  test("the on behalf agent may while the claim is open, and not once the owner claims", () => {
    const agent = { ...owner, userId: "u-agent" };
    assert.equal(isPsfApplicant({ ...agent, obo: { registrantUserId: "u-agent", claimStatus: "registrant_held" } }), true);
    assert.equal(isPsfApplicant({ ...agent, obo: { registrantUserId: "u-agent", claimStatus: "owner_claimed" } }), false);
  });

  test("the owner who claimed keeps it", () => {
    assert.equal(isPsfApplicant({ ...owner, obo: { registrantUserId: "u-agent", claimStatus: "owner_claimed" } }), true);
  });
});

describe("the queue and the name split", () => {
  test("an application is in PSF's queue only past the TIN check and in good standing (AC-8)", () => {
    for (const s of ["tin_verified", "field_verified", "approved", "active"]) assert.equal(isInPsfQueueState(s), true, s);
    for (const s of ["pending_payment", "submitted", "rejected", "suspended"]) assert.equal(isInPsfQueueState(s), false, s);
  });

  test("a full name splits at the last space, and a single name keeps it all", () => {
    assert.deepEqual(splitPsfName("  Yves  Habimana "), { firstName: "Yves", lastName: "Habimana" });
    assert.deepEqual(splitPsfName("Marie Claire Uwase"), { firstName: "Marie Claire", lastName: "Uwase" });
    assert.deepEqual(splitPsfName("Uwase"), { firstName: "Uwase", lastName: "" });
  });
});

describe("a PSF business on a registration (the PSF path)", () => {
  function enterprise(business = {}, request = {}) {
    return {
      role: "enterprise",
      business: {
        domain: "enterprise",
        legalName: "Gahaya Metal Works",
        address: ADDRESS,
        registrationKind: "tin",
        tin: "123456789",
        associationCode: "apromet",
        ...business,
      },
      ...request,
    };
  }

  test("is priced on its own fee row", () => {
    assert.equal(businessTypeFor("enterprise"), "enterprise");
  });

  test("with a TIN parses, and the owner groups default to none", () => {
    assert.deepEqual(paths(CreateRegistrationRequest, enterprise()), []);
    assert.deepEqual(CreateRegistrationRequest.parse(enterprise()).business.ownerGroups, []);
  });

  test("the TIN is optional: RCA, RGB and other carry a number, none carries nothing", () => {
    assert.deepEqual(paths(CreateRegistrationRequest, enterprise({ registrationKind: "rca", tin: undefined, registrationNumber: "RCA/0042/2024" })), []);
    assert.deepEqual(paths(CreateRegistrationRequest, enterprise({ registrationKind: "none", tin: undefined })), []);
    assert.deepEqual(paths(CreateRegistrationRequest, enterprise({ registrationKind: "rgb", tin: undefined })), ["business.registrationNumber"]);
    assert.deepEqual(paths(CreateRegistrationRequest, enterprise({ registrationKind: "none", tin: undefined, registrationNumber: "X" })), ["business.registrationNumber"]);
  });

  test("a TIN goes only with TIN, and TIN needs one", () => {
    assert.deepEqual(paths(CreateRegistrationRequest, enterprise({ tin: undefined })), ["business.tin"]);
    assert.deepEqual(paths(CreateRegistrationRequest, enterprise({ registrationKind: "none" })), ["business.tin"]);
  });

  test("needs its association, and names each owner group once", () => {
    assert.deepEqual(paths(CreateRegistrationRequest, enterprise({ associationCode: "" })), ["business.associationCode"]);
    assert.deepEqual(paths(CreateRegistrationRequest, enterprise({ ownerGroups: ["women", "youth"] })), []);
    assert.deepEqual(paths(CreateRegistrationRequest, enterprise({ ownerGroups: ["women", "women"] })), ["business.ownerGroups"]);
  });

  test("applies for membership from its portal, never inside the registration", () => {
    assert.deepEqual(paths(CreateRegistrationRequest, enterprise({ psfApplication: application() })), ["business.psfApplication"]);
  });

  test("is registered by its owner, and only an enterprise role registers one", () => {
    assert.deepEqual(paths(CreateRegistrationRequest, enterprise({}, { capacity: "on_behalf_of", intendedOwner: { name: "A B", nationalId: "1199080012345678", email: "a@b.rw" } })), ["capacity"]);
    assert.deepEqual(paths(CreateRegistrationRequest, enterprise({}, { role: "host" })), ["business.domain"]);
  });
});

describe("the price kinds, and what a business may pay (2026-10-15 tiers)", () => {
  const golden = { priceKind: "minimum", annualFeeRwf: null, annualFeeMinRwf: 5_000_000, annualFeeMaxRwf: null };
  const indashyikirwa = { priceKind: "range", annualFeeRwf: null, annualFeeMinRwf: 200_000, annualFeeMaxRwf: 4_999_999 };
  const fixed = { priceKind: "fixed", annualFeeRwf: 100_000, annualFeeMinRwf: null, annualFeeMaxRwf: null };
  const byPsf = { priceKind: "set_by_psf", annualFeeRwf: null, annualFeeMinRwf: null, annualFeeMaxRwf: null };

  test("Golden Circle is a floor with no ceiling", () => {
    const tier = { code: "golden_circle", family: "golden_circle", nameEn: "Golden Circle", sortOrder: 1, reason: "PSF price list" };
    assert.deepEqual(paths(CreatePsfTierRequest, { ...tier, priceKind: "minimum", annualFeeMinRwf: 5_000_000 }), []);
    assert.deepEqual(paths(CreatePsfTierRequest, { ...tier, priceKind: "minimum", annualFeeMinRwf: 5_000_000, annualFeeMaxRwf: 9_000_000 }), ["annualFeeMinRwf"]);
    assert.equal(psfTierAcceptsFee(golden, 5_000_000), true);
    assert.equal(psfTierAcceptsFee(golden, 12_500_000), true);
    assert.equal(psfTierAcceptsFee(golden, 4_999_999), false);
  });

  test("a band takes anything inside it, ends included", () => {
    assert.equal(psfTierAcceptsFee(indashyikirwa, 200_000), true);
    assert.equal(psfTierAcceptsFee(indashyikirwa, 4_999_999), true);
    assert.equal(psfTierAcceptsFee(indashyikirwa, 199_999), false);
    assert.equal(psfFeeProblem(indashyikirwa, 150_000), "Give an amount from RWF 200,000 to RWF 4,999,999.");
  });

  test("a fixed price takes only itself, and PSF's own price takes no amount", () => {
    assert.equal(psfTierAcceptsFee(fixed, 100_000), true);
    assert.equal(psfTierAcceptsFee(fixed, 90_000), false);
    assert.equal(psfTierAcceptsFee(byPsf, null), true);
    assert.equal(psfTierAcceptsFee(byPsf, 10_000), false);
  });

  test("a form starts from the price, or the bottom of the band", () => {
    assert.equal(psfStartingFee(golden), 5_000_000);
    assert.equal(psfStartingFee(fixed), 100_000);
    assert.equal(psfStartingFee(byPsf), null);
  });

  test("the amount a business declares must be above zero", () => {
    assert.deepEqual(paths(PsfApplicationInput, application({ declaredFeeRwf: 0 })), ["declaredFeeRwf"]);
    assert.deepEqual(paths(PsfApplicationInput, application({ declaredFeeRwf: 75_000 })), []);
  });
});

describe("approving and paying (the PSF path)", () => {
  test("an approval names the PSF number, and a fee only when PSF prices the tier", () => {
    assert.deepEqual(paths(PsfApproveRequest, { membershipNumber: "PSF/KIC/0001" }), []);
    assert.deepEqual(paths(PsfApproveRequest, { membershipNumber: " " }), ["membershipNumber"]);
    assert.deepEqual(paths(PsfApproveRequest, { membershipNumber: "PSF/1", feeRwf: 0 }), ["feeRwf"]);
  });

  test("the fee is paid from a Rwandan mobile money number", () => {
    assert.equal(PayPsfMembershipRequest.parse({ phoneE164: "+250 788 123 456" }).phoneE164, "+250788123456");
    assert.deepEqual(paths(PayPsfMembershipRequest, { phoneE164: "+254712345678" }), ["phoneE164"]);
  });

  test("the register's filters are each optional, and the district is a number", () => {
    assert.deepEqual(PsfBusinessesQuery.parse({}), {});
    assert.equal(PsfBusinessesQuery.parse({ district: "103" }).district, 103);
    assert.deepEqual(paths(PsfBusinessesQuery, { standing: "gold" }), ["standing"]);
  });
});

describe("business codes (KIC0001)", () => {
  test("every district has three letters, and no two share them", () => {
    const entries = Object.entries(DISTRICT_LETTERS);
    assert.equal(entries.length, 30);
    const letters = entries.map(([, d]) => d.letters);
    assert.equal(new Set(letters).size, 30);
    for (const l of letters) assert.match(l, /^[A-Z]{3}$/);
  });

  test("the letters are the name's first three, except where two names share them", () => {
    assert.equal(districtLetters(103, "Kicukiro"), "KIC");
    assert.equal(districtLetters(101, "Nyarugenge"), "NRG");
    assert.equal(districtLetters(506, "Ngoma"), "NGM");
    assert.equal(districtLetters(999, "Testland"), "TES");
  });

  test("a code is four digits at least, and grows past 9999", () => {
    assert.equal(formatBusinessCode("KIC", 1), "KIC0001");
    assert.equal(formatBusinessCode("KIC", 10000), "KIC10000");
    assert.equal(normalizeBusinessCode(" kic-0001 "), "KIC0001");
    assert.equal(normalizeBusinessCode("Gahaya"), null);
  });
});
