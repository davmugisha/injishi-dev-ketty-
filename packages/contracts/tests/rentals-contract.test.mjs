/**
 * Rentals (blueprint WP 1.1): the lease contract, its fingerprint and the
 * typed signature.
 *
 *   pnpm --filter @injishi/contracts test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const c = require("../dist/index.js");

const INPUT = {
  landlord: {
    legalName: "Green Hills Properties Ltd",
    signatoryName: "Josephine Mukamana",
    idNumber: "1198780012345678",
    phone: "+250788123456",
    email: "josephine@example.rw",
  },
  tenant: {
    fullName: "Aimée Uwera",
    idKind: "passport",
    idNumber: "PA1234567",
    nationality: "KE",
    phone: "+250788000111",
    email: "aimee@example.rw",
  },
  premises: {
    property: "Ingoro Apartments",
    unit: "D1",
    block: "A",
    street: "KK 15 Ave",
    village: "Rebero",
    cell: "Gatare",
    sector: "Niboye",
    district: "Kicukiro",
    province: "Kigali City",
  },
  terms: {
    startDate: "2026-11-01",
    endDate: "2027-10-31",
    billingStartsOn: null,
    monthlyRentRwf: 400_000,
    depositRwf: 800_000,
    rentDueDay: 5,
    graceDays: 5,
    noticeDays: 15,
    occupants: ["Eric Mugisha"],
    otherTerms: null,
  },
};

/**
 * The fingerprint of `INPUT`'s contract under each template, pinned.
 * Signatures are stored against fingerprints, so the same terms must give the
 * same fingerprint for as long as a template exists. A change to any clause's
 * wording changes this: make it a new template version instead.
 */
const PINNED_HASH = "f4783ac9cc844587ae33d2e69d2eb50d9eb844c7b23dc8ab45a3c8b45a30d09e";
const PINNED_HASH_V3 = "2ff6c9552061a73b4369697b7de744fa367f8008a132396220f1b731ed39b1e2";

describe("SHA-256", () => {
  const nodeHash = (s) => createHash("sha256").update(s, "utf8").digest("hex");

  test("matches node:crypto, including the padding edges and non-ASCII text", () => {
    const samples = [
      "",
      "abc",
      "The quick brown fox jumps over the lazy dog",
      "Aimée Uwera, Kicukiro, RWF 400,000",
      "emoji 🏠 and a lone \ud800 surrogate",
      ...[55, 56, 57, 63, 64, 65, 119, 120, 1000].map((n) => "x".repeat(n)),
    ];
    for (const s of samples) assert.equal(c.sha256Hex(s), nodeHash(s), JSON.stringify(s.slice(0, 20)));
  });

  test("the known vector for abc", () => {
    assert.equal(c.sha256Hex("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});

describe("canonical JSON", () => {
  test("key order does not matter, and undefined fields are left out", () => {
    const a = c.canonicalJson({ b: 1, a: { d: 2, c: [1, { y: 1, x: 2 }] }, u: undefined });
    const b = c.canonicalJson({ a: { c: [1, { x: 2, y: 1 }], d: 2 }, b: 1 });
    assert.equal(a, b);
    assert.equal(a, '{"a":{"c":[1,{"x":2,"y":1}],"d":2},"b":1}');
  });

  test("null stays null; arrays keep their order", () => {
    assert.equal(c.canonicalJson({ a: null, b: [3, 1, 2] }), '{"a":null,"b":[3,1,2]}');
    assert.throws(() => c.canonicalJson({ a: Number.POSITIVE_INFINITY }), RangeError);
  });
});

describe("the contract", () => {
  const contract = c.buildLeaseContract(INPUT, "2026-10-24T08:00:00.000Z");

  test("it is a version 4 agreement the schema accepts, and a stored version 3 still parses", () => {
    assert.equal(contract.version, 4);
    assert.equal(c.LeaseContract.safeParse(contract).success, true);
    const older = c.buildLeaseContract(INPUT, "2026-10-24T08:00:00.000Z", 3);
    assert.equal(c.LeaseContract.safeParse(JSON.parse(JSON.stringify(older))).success, true);
    assert.equal(c.isKnownContractTemplate(3), true);
    assert.equal(c.isKnownContractTemplate(0), false);
  });

  test("signers confirm with an emailed code, or a tenant's password", () => {
    const signing = contract.clauses.find((k) => k.heading === "Signatures");
    assert.match(signing.body, /confirms it is them with an emailed code, or a tenant's password\./);
    const older = c.buildLeaseContract(INPUT, "2026-10-24T08:00:00.000Z", 3).clauses.find((k) => k.heading === "Signatures");
    assert.match(older.body, /with a code sent to their email or with their password\./);
    assert.equal(contract.title, "Residential lease agreement");
  });

  test("the home is named down to its village", () => {
    assert.equal(
      contract.premisesLine,
      "Unit D1, Block A, Ingoro Apartments, KK 15 Ave, Rebero village, Gatare cell, Niboye sector, Kicukiro district, Kigali City",
    );
    const sectorInStreet = c.premisesLine({ ...INPUT.premises, street: "KK 15 Ave, Niboye", unit: null, block: null });
    assert.equal(sectorInStreet, "Ingoro Apartments, KK 15 Ave, Niboye, Rebero village, Gatare cell, Kicukiro district, Kigali City");
  });

  test("every term has its clause, in plain words", () => {
    const byHeading = Object.fromEntries(contract.clauses.map((cl) => [cl.heading, cl.body]));
    assert.deepEqual(Object.keys(byHeading), [
      "The parties",
      "The home",
      "Who lives there",
      "How long",
      "Rent",
      "Caution deposit",
      "Repairs",
      "Using the home",
      "Guests",
      "Notice",
      "Ending and renewal",
      "Disputes",
      "Filing with the tax administration",
      "Signatures",
    ]);
    assert.match(byHeading["The parties"], /Green Hills Properties Ltd, represented by Josephine Mukamana \(ID or TIN 1198780012345678/);
    assert.match(byHeading["The parties"], /Aimée Uwera \(passport PA1234567/);
    assert.match(byHeading["Who lives there"], /with Eric Mugisha\./);
    assert.equal(byHeading["How long"], "The lease runs from 1 November 2026 to 31 October 2027.");
    assert.match(byHeading.Rent, /RWF 400,000 per month, due on the 5th of each month/);
    assert.match(byHeading.Rent, /charged by calendar month/);
    assert.match(byHeading.Rent, /pays through Injishi/);
    assert.match(byHeading.Rent, /within 5 days of its due date is late/);
    assert.match(byHeading["Caution deposit"], /RWF 800,000/);
    assert.equal(byHeading.Guests, "The tenant registers overnight guests on Injishi.");
    assert.match(byHeading.Notice, /at least 15 days' notice/);
    assert.match(byHeading["Filing with the tax administration"], /Rwanda Revenue Authority within 15 days of signing, as Law No. 048\/2023 requires/);
    assert.match(byHeading.Signatures, /Law No. 18\/2010/);
    assert.match(byHeading.Signatures, /SHA-256/);
  });

  test("no em dash anywhere in what a person reads", () => {
    for (const cl of contract.clauses) assert.equal(/[–—]/.test(cl.heading + cl.body), false, cl.heading);
  });

  test("other terms, a brought-in tenancy, no deposit and no grace read as they should", () => {
    const other = c.buildLeaseContract(
      {
        ...INPUT,
        terms: { ...INPUT.terms, otherTerms: "No pets.", billingStartsOn: "2026-12-01", depositRwf: 0, graceDays: 0, occupants: [] },
      },
      "2026-10-24T08:00:00.000Z",
    );
    const byHeading = Object.fromEntries(other.clauses.map((cl) => [cl.heading, cl.body]));
    assert.equal(byHeading["Other terms"], "No pets.");
    assert.match(byHeading.Rent, /Rent is charged on Injishi from 1 December 2026/);
    assert.match(byHeading.Rent, /Rent not paid by its due date is late\./);
    assert.equal(byHeading["Caution deposit"], "No caution deposit is taken on this lease.");
    assert.match(byHeading["Who lives there"], /^The tenant will live in the home\./);
  });
});

describe("the fingerprint", () => {
  const at = (issuedAt, input = INPUT) => c.contractHash(c.buildLeaseContract(input, issuedAt));

  test("it covers the terms, not the moment the text was rendered", () => {
    assert.equal(at("2026-10-01T00:00:00.000Z"), at(new Date("2026-10-22T09:30:00Z")));
    assert.match(at("2026-10-01T00:00:00.000Z"), /^[a-f0-9]{64}$/);
  });

  test("it changes when any term changes", () => {
    const base = at("2026-10-01T00:00:00.000Z");
    assert.notEqual(at("2026-10-01T00:00:00.000Z", { ...INPUT, terms: { ...INPUT.terms, monthlyRentRwf: 410_000 } }), base);
    assert.notEqual(at("2026-10-01T00:00:00.000Z", { ...INPUT, terms: { ...INPUT.terms, occupants: [] } }), base);
    assert.notEqual(at("2026-10-01T00:00:00.000Z", { ...INPUT, tenant: { ...INPUT.tenant, phone: "+250788000112" } }), base);
  });

  test("the order fields were written in does not matter", () => {
    const reordered = {
      terms: Object.fromEntries(Object.entries(INPUT.terms).reverse()),
      premises: Object.fromEntries(Object.entries(INPUT.premises).reverse()),
      tenant: Object.fromEntries(Object.entries(INPUT.tenant).reverse()),
      landlord: Object.fromEntries(Object.entries(INPUT.landlord).reverse()),
    };
    assert.equal(at("2026-10-01T00:00:00.000Z", reordered), at("2026-10-01T00:00:00.000Z"));
  });

  test("a stored contract read back from JSON gives the same fingerprint", () => {
    const contract = c.buildLeaseContract(INPUT, "2026-10-24T08:00:00.000Z");
    assert.equal(c.contractHash(JSON.parse(JSON.stringify(contract))), c.contractHash(contract));
  });

  test("it is pinned: the same terms give the same fingerprint for as long as each template exists", () => {
    assert.equal(at("2026-10-24T08:00:00.000Z"), PINNED_HASH);
    assert.equal(c.contractHash(c.buildLeaseContract(INPUT, "2026-10-24T08:00:00.000Z", 3)), PINNED_HASH_V3);
  });

  test("a signature names the fingerprint it was given against", () => {
    assert.equal(c.ContractHash.safeParse(at("2026-10-01T00:00:00.000Z")).success, true);
    assert.equal(c.ContractHash.safeParse("ABC").success, false);
  });
});

describe("the typed signature", () => {
  test("case, spacing and accents may differ; nothing else may", () => {
    assert.equal(c.sameName("  aline   UWERA ", "Aline Uwera"), true);
    assert.equal(c.sameName("Aimee Uwera", "Aimée Uwera"), true);
    assert.equal(c.sameName("AIMÉE UWERA", "Aimee Uwera"), true);
    assert.equal(c.sameName("Aline U.", "Aline Uwera"), false);
    assert.equal(c.sameName("Uwera Aline", "Aline Uwera"), false);
    assert.equal(c.sameName("", ""), false);
    assert.equal(c.sameName("   ", "   "), false);
  });

  test("each side types the name the contract states for it", () => {
    const contract = c.buildLeaseContract(INPUT, "2026-10-24T08:00:00.000Z");
    assert.equal(c.expectedSignerName(contract, "landlord"), "Josephine Mukamana");
    assert.equal(c.typedNameProblem("josephine  mukamana", contract, "landlord"), null);
    assert.equal(c.typedNameProblem("aimee uwera", contract, "tenant"), null);
    assert.equal(c.typedNameProblem("Aimée", contract, "tenant"), "Type your full name as the contract states it: Aimée Uwera.");
    assert.equal(c.typedNameProblem("  ", contract, "tenant"), "Type your full name.");
  });

  test("a signature carries the name, the fingerprint and exactly one proof", () => {
    const hash = "a".repeat(64);
    assert.equal(c.SignLeaseRequest.safeParse({ typedName: "Aimée Uwera", documentHash: hash, code: "123456" }).success, true);
    assert.equal(c.SignLeaseRequest.safeParse({ typedName: "Aimée Uwera", documentHash: hash, password: "secret" }).success, true);
    assert.equal(c.SignLeaseRequest.safeParse({ typedName: "Aimée Uwera", documentHash: hash }).success, false);
    assert.equal(c.SignLeaseRequest.safeParse({ typedName: "Aimée Uwera", documentHash: hash, code: "12345" }).success, false);
    assert.equal(c.SignLeaseRequest.safeParse({ typedName: "Aimée Uwera", documentHash: "nope", code: "123456" }).success, false);
  });
});

describe("a province as a contract names it", () => {
  test("the reference table's capitals become the words people use", () => {
    assert.equal(c.provinceWords("KIGALI"), "Kigali City");
    assert.equal(c.provinceWords(" east "), "Eastern Province");
    assert.equal(c.provinceWords("Somewhere"), "Somewhere");
  });
});
