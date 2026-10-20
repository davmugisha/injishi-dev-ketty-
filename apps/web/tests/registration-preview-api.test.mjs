/**
 * The local registration preview must support the same hotel walkthrough the
 * wizard sends. These tests start only its in-memory HTTP server, never the
 * deployed API, SMS, RRA, storage, or payment services.
 */
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

import { createRegistrationPreviewServer } from "../scripts/registration-preview-api.mjs";

const require = createRequire(import.meta.url);
const contracts = require("../../../packages/contracts/dist/index.js");

const personal = {
  fullName: "Aline Uwase",
  dateOfBirth: "1988-07-21",
  gender: "female",
  phoneE164: "+250788300412",
  address: {
    country: "RW",
    provinceId: 1,
    districtId: 102,
    sectorId: 10201,
    cellId: 1020101,
    villageId: 102010101,
    street: "KG 11 Ave",
  },
};

function hotelRequest(certificateKey, tierCode) {
  return {
    role: "host",
    capacity: "owner",
    personal,
    business: {
      domain: "hospitality",
      legalName: "Uwase Hospitality Ltd",
      entityGroup: "accommodation",
      accommodationClass: "hotel",
      tin: "998000001",
      address: personal.address,
      psfMember: false,
      psfApplication: {
        requestedTierCode: tierCode,
        companyName: "Uwase Hospitality Ltd",
        streetAddress: "KG 11 Ave, Bumbogo, Gasabo",
        companyType: "private_company",
        ownership: "rwandan_100",
        businessActivity: "Hotel accommodation",
        tradeDirection: "none",
        tradeCountries: [],
        contactRole: "managing_director",
        firstName: "Aline",
        lastName: "Uwase",
        gender: "female",
        phoneE164: "+250788300412",
        email: "aline.registration@demo.injishi.com",
        useDocumentOnFile: true,
        dateOfBirth: "1988-07-21",
        consent: true,
      },
      certificates: [{ kind: "rdb_certificate", objectKey: certificateKey }],
      branches: [],
    },
  };
}

describe("local registration preview API", () => {
  let server;
  let base;

  before(async () => {
    server = createRegistrationPreviewServer();
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    base = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });

  async function call(path, { method = "GET", body, expected = 200 } = {}) {
    const response = await fetch(`${base}${path}`, {
      method,
      ...(body === undefined ? {} : body instanceof FormData
        ? { body }
        : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
    });
    const value = await response.json();
    assert.equal(response.status, expected, `${method} ${path}: ${JSON.stringify(value)}`);
    return value;
  }

  async function verifyAline() {
    const lookup = await call("/api/v1/me/identity/national-id/lookup", {
      method: "POST", body: { documentNumber: "1198870034567812" },
    });
    assert.equal(contracts.NationalIdLookupResult.parse(lookup).status, "code_sent");
    const confirmed = await call("/api/v1/me/identity/national-id/confirm", {
      method: "POST", body: { challengeId: lookup.challengeId, code: "123456" },
    });
    assert.equal(contracts.VerifiedPerson.parse(confirmed).fullName, "Aline Uwase");
  }

  test("boots with contract-valid sample identity, geography, fee, and PSF tiers", async () => {
    const platform = contracts.PlatformInfo.parse(await call("/api/v1/platform"));
    assert.deepEqual([platform.environment, platform.sampleData], ["demo", true]);

    const session = await call("/api/auth/get-session");
    assert.equal(session.user.name, "Aline Uwase");
    assert.ok(session.session.expiresAt);

    assert.equal(contracts.MyProfile.parse(await call("/api/v1/me/profile")).complete, false);
    assert.equal(contracts.IdentityStatus.parse(await call("/api/v1/me/identity")).kycStatus, "unverified");
    assert.deepEqual((await call("/api/v1/me/workspaces")).workspaces, []);

    const fee = contracts.RegistrationFeeQuote.parse(await call("/api/v1/registrations/fee?businessType=hospitality"));
    assert.deepEqual([fee.amountRwf, fee.currency], [5_000, "RWF"]);

    for (const [level, schema, parent] of [
      ["provinces", contracts.Province, ""],
      ["districts", contracts.District, "?provinceId=1"],
      ["sectors", contracts.Sector, "?districtId=102"],
      ["cells", contracts.Cell, "?sectorId=10201"],
      ["villages", contracts.Village, "?cellId=1020101"],
    ]) {
      const rows = schema.array().parse(await call(`/api/v1/geography/${level}${parent}`));
      assert.equal(rows.length, 1, level);
    }
    assert.deepEqual(await call("/api/v1/geography/districts?provinceId=999"), []);

    const tiers = contracts.PsfTier.array().parse(await call("/api/v1/psf/tiers"));
    assert.ok(tiers.length > 0, "PSF Apply now needs a selectable sample tier");
    assert.ok(tiers.some((tier) => tier.active));
  });

  test("sample registry lookups require Aline's ID and code before confirming director status", async () => {
    const beforeIdentity = contracts.TinCheckResult.parse(await call("/api/v1/registrations/tin-check", {
      method: "POST", body: { tin: "998000001" },
    }));
    assert.equal(beforeIdentity.registrantIsDirector, null);
    assert.equal(beforeIdentity.business.legalName, "Uwase Hospitality Ltd");
    assert.equal(beforeIdentity.business.generated, true);

    const unknownId = contracts.NationalIdLookupResult.parse(await call("/api/v1/me/identity/national-id/lookup", {
      method: "POST", body: { documentNumber: "0000000000000000" },
    }));
    assert.equal(unknownId.status, "not_found");

    const lookup = await call("/api/v1/me/identity/national-id/lookup", {
      method: "POST", body: { documentNumber: "1198870034567812" },
    });
    await call("/api/v1/me/identity/national-id/confirm", {
      method: "POST", body: { challengeId: lookup.challengeId, code: "000000" }, expected: 400,
    });
    const verified = contracts.VerifiedPerson.parse(await call("/api/v1/me/identity/national-id/confirm", {
      method: "POST", body: { challengeId: lookup.challengeId, code: "123456" },
    }));
    assert.equal(verified.documentNumberMasked.endsWith("7812"), true);
    assert.equal(contracts.IdentityStatus.parse(await call("/api/v1/me/identity")).kycStatus, "verified");

    const tin = contracts.TinCheckResult.parse(await call("/api/v1/registrations/tin-check", {
      method: "POST", body: { tin: "998000001" },
    }));
    assert.equal(tin.registrantIsDirector, true);
    const unknownTin = contracts.TinCheckResult.parse(await call("/api/v1/registrations/tin-check", {
      method: "POST", body: { tin: "999999999" },
    }));
    assert.equal(unknownTin.result, "failed");
  });

  test("a sample hotel can upload, apply to PSF, accept contract, pay, and enter review", async () => {
    await call("/api/v1/demo/registration-preview/reset", { method: "POST" });
    const form = new FormData();
    form.append("file", new Blob(["sample certificate"], { type: "application/pdf" }), "sample-rdb-certificate.pdf");
    const upload = contracts.UploadedObject.parse(await call("/api/v1/uploads/certificate", {
      method: "POST", body: form,
    }));
    assert.equal(upload.filename, "sample-rdb-certificate.pdf");
    assert.equal(upload.sizeBytes, 18);

    const tiers = contracts.PsfTier.array().parse(await call("/api/v1/psf/tiers"));
    const request = hotelRequest(upload.objectKey, tiers.find((tier) => tier.active).code);
    assert.equal(contracts.CreateRegistrationRequest.safeParse(request).success, true);
    await call("/api/v1/registrations", { method: "POST", body: request, expected: 409 });

    await verifyAline();
    const created = contracts.RegistrationSummary.parse(await call("/api/v1/registrations", {
      method: "POST", body: request, expected: 201,
    }));
    assert.deepEqual([created.legalName, created.status, created.amountDueRwf], ["Uwase Hospitality Ltd", "pending_payment", 5_000]);
    assert.equal((await call("/api/v1/me/workspaces")).workspaces[0].registrationStatus, "pending_payment");

    const path = `/api/v1/registrations/${created.orgId}`;
    await call(`${path}/pay`, { method: "POST", expected: 409 });
    await call(`${path}/contract`, { method: "POST", body: { contractVersion: "old" }, expected: 409 });
    const accepted = contracts.RegistrationSummary.parse(await call(`${path}/contract`, {
      method: "POST", body: { contractVersion: contracts.OPERATOR_CONTRACT_VERSION },
    }));
    assert.equal(accepted.contractVersion, contracts.OPERATOR_CONTRACT_VERSION);
    assert.ok(accepted.contractAcceptedAt);

    const paid = contracts.RegistrationSummary.parse(await call(`${path}/pay`, { method: "POST" }));
    assert.equal(paid.status, "submitted");
    assert.equal(paid.amountDueRwf, null);
    assert.ok(paid.submittedAt);
    assert.equal(contracts.RegistrationSummary.parse(await call(path)).status, "submitted");

    const workspaces = (await call("/api/v1/me/workspaces")).workspaces;
    assert.equal(contracts.WorkspaceAccess.array().parse(workspaces)[0].registrationStatus, "submitted");
    assert.deepEqual(workspaces[0].permissions, []);

    await call("/api/v1/demo/registration-preview/reset", { method: "POST" });
    assert.deepEqual((await call("/api/v1/me/workspaces")).workspaces, []);
    assert.equal(contracts.IdentityStatus.parse(await call("/api/v1/me/identity")).kycStatus, "unverified");
    await call(path, { expected: 404 });
  });
});
