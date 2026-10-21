/**
 * Local, in-memory registration walkthrough. No network proxy, database, SMS,
 * payment provider, RRA call, or file storage is involved. The process binds
 * only to loopback; restarting it clears every answer and uploaded file key.
 *
 * The fixture is the same fictional Aline Uwase / 998000001 scenario as
 * server/api/src/shared/registry/demo-registers.ts. The API responses and
 * request bodies are checked with the installed @injishi/contracts schemas.
 */
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const contracts = require("../../../packages/contracts/dist/index.js");

const PERSON_ID = "1198870034567812";
const PERSON = Object.freeze({
  fullName: "Aline Uwase",
  dateOfBirth: "1988-07-21",
  gender: "female",
  phoneE164: "+250788300412",
  documentType: "national_id",
  documentNumberMasked: "••••7812",
  issuingCountry: "RW",
  generated: true,
});
const BUSINESS = Object.freeze({
  legalName: "Uwase Hospitality Ltd",
  registeredOn: "2019-03-12",
  companyType: "private_company",
  address: { provinceId: 1, districtId: 102, sectorId: 10201, street: "KG 11 Ave" },
  directors: [{ name: "Aline Uwase" }],
  generated: true,
});
const USER_ID = "00000000-0000-4000-8000-000000000001";
const SESSION_ID = "00000000-0000-4000-8000-000000000002";
const GEOGRAPHY = Object.freeze({
  provinces: [{ id: 1, name: "Kigali City" }],
  districts: [{ id: 102, name: "Gasabo", provinceId: 1 }],
  sectors: [{ id: 10201, name: "Bumbogo", districtId: 102 }],
  cells: [{ id: 1020101, name: "Kinyaga", sectorId: 10201 }],
  villages: [{ id: 102010101, name: "Akakaza", cellId: 1020101 }],
});
const FEE_RWF = 5_000;
// A small, seed-backed catalogue keeps the optional PSF branch demonstrable.
const PSF_TIERS = Object.freeze([
  {
    code: "ordinary_100k", family: "ordinary", nameEn: "Ordinary, 100,000 a year", nameRw: null,
    priceKind: "fixed", annualFeeRwf: 100_000, annualFeeMinRwf: null, annualFeeMaxRwf: null,
    benefitsEn: ["Networking and market information", "Standard advocacy"], benefitsRw: null,
    sortOrder: 10, active: true,
  },
  {
    code: "ordinary_300k", family: "ordinary", nameEn: "Ordinary, 300,000 a year", nameRw: null,
    priceKind: "fixed", annualFeeRwf: 300_000, annualFeeMinRwf: null, annualFeeMaxRwf: null,
    benefitsEn: ["Networking and market information", "Regional trade fairs"], benefitsRw: null,
    sortOrder: 20, active: true,
  },
  {
    code: "junior_giants", family: "junior_giants", nameEn: "Junior Giants", nameRw: null,
    priceKind: "set_by_psf", annualFeeRwf: null, annualFeeMinRwf: null, annualFeeMaxRwf: null,
    benefitsEn: ["Capability building and process management"], benefitsRw: null,
    sortOrder: 30, active: true,
  },
]);

function freshState() {
  return { verified: false, challengeId: null, profile: null, draft: null, uploads: new Map(), registrations: new Map() };
}

function profileOf(state) {
  if (state.profile) return state.profile;
  return {
    fullName: null, gender: null, dateOfBirth: null, phoneE164: null,
    document: null, address: null, complete: false,
  };
}

function identityOf(state) {
  return {
    kycStatus: state.verified ? "verified" : "unverified",
    method: state.verified ? "registry" : null,
    verified: state.verified ? (({ phoneE164, ...rest }) => rest)(PERSON) : null,
    available: { nationalId: true, passport: false },
    required: true,
    modes: { registry: "mock", documents: "off" },
  };
}

function workspaceOf(summary) {
  return {
    workspaceId: summary.workspaceId, kind: "business", orgId: summary.orgId,
    orgName: summary.legalName, domain: summary.domain, orgRole: "owner",
    registrationStatus: summary.status, permissions: [], departments: [],
    propertyName: null, branches: [], branchCoverage: "all", psfMembership: { canManage: true },
  };
}

function send(res, status, payload, origin) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Injishi-Preview": "localhost-in-memory-demo",
    "Vary": "Origin",
  };
  if (origin && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Credentials"] = "true";
    headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS";
    headers["Access-Control-Allow-Headers"] = "Content-Type";
  }
  res.writeHead(status, headers);
  res.end(JSON.stringify(payload));
}

function valid(res, schema, value, origin, status = 200) {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    console.error("Preview response contract mismatch:", parsed.error.flatten());
    send(res, 500, { message: "Local preview response does not match its contract." }, origin);
    return;
  }
  send(res, status, parsed.data, origin);
}

async function bodyOf(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 12 * 1024 * 1024) throw Object.assign(new Error("The local preview upload is too large."), { status: 413 });
    chunks.push(chunk);
  }
  const buffer = Buffer.concat(chunks);
  const contentType = req.headers["content-type"] ?? "";
  if (contentType.startsWith("multipart/form-data")) {
    const request = new Request("http://localhost/upload", {
      method: "POST", headers: { "content-type": contentType }, body: buffer,
    });
    return request.formData();
  }
  if (!buffer.length) return {};
  try { return JSON.parse(buffer.toString("utf8")); }
  catch { throw Object.assign(new Error("Expected a JSON request body."), { status: 400 }); }
}

function input(res, schema, value, origin) {
  const parsed = schema.safeParse(value);
  if (parsed.success) return parsed.data;
  send(res, 422, {
    message: parsed.error.issues[0]?.message ?? "Invalid preview input.",
    issues: parsed.error.issues.map(({ path, message }) => ({ path, message })),
  }, origin);
  return null;
}

/** Build a fresh preview server. Tests may listen on port 0 and close it. */
export function createRegistrationPreviewServer() {
  let state = freshState();
  return createServer(async (req, res) => {
    const origin = req.headers.origin;
    const method = req.method ?? "GET";
    const url = new URL(req.url ?? "/", "http://localhost");
    const path = url.pathname;
    if (method === "OPTIONS") { send(res, 204, null, origin); return; }
    try {
      if (method === "GET" && path === "/api/v1/platform") {
        valid(res, contracts.PlatformInfo, { environment: "demo", sampleData: true, seededAt: null, commit: null }, origin); return;
      }
      if (method === "GET" && path === "/api/auth/get-session") {
        send(res, 200, {
          session: { id: SESSION_ID, token: "local-preview-only", userId: USER_ID, expiresAt: "2099-01-01T00:00:00.000Z" },
          user: { id: USER_ID, name: "Aline Uwase", email: "aline.registration@demo.injishi.com", emailVerified: true,
            image: null, createdAt: "2026-10-20T00:00:00.000Z", updatedAt: "2026-10-20T00:00:00.000Z" },
        }, origin); return;
      }
      if (method === "POST" && path === "/api/v1/demo/registration-preview/reset") {
        state = freshState(); send(res, 200, { reset: true, message: "Local demo answers cleared." }, origin); return;
      }
      if (method === "GET" && path === "/api/v1/me/workspaces") {
        const workspaces = [...state.registrations.values()].map(workspaceOf);
        const parsed = contracts.WorkspaceAccess.array().safeParse(workspaces);
        if (!parsed.success) throw new Error("Preview workspace contract mismatch");
        send(res, 200, { workspaces: parsed.data }, origin); return;
      }
      if (method === "GET" && path === "/api/v1/me/profile") {
        valid(res, contracts.MyProfile, profileOf(state), origin); return;
      }
      if (method === "PUT" && path === "/api/v1/me/profile") {
        const personal = input(res, contracts.PersonalDetails, await bodyOf(req), origin);
        if (!personal) return;
        state.profile = {
          fullName: personal.fullName, gender: personal.gender ?? null, dateOfBirth: personal.dateOfBirth,
          phoneE164: personal.phoneE164,
          document: personal.document ? {
            documentType: personal.document.documentType,
            documentNumberMasked: `••••${personal.document.documentNumber.slice(-4)}`,
            issuingCountry: personal.document.issuingCountry,
          } : state.verified ? {
            documentType: "national_id", documentNumberMasked: PERSON.documentNumberMasked, issuingCountry: "RW",
          } : null,
          address: personal.address, complete: true,
        };
        valid(res, contracts.MyProfile, state.profile, origin); return;
      }
      if (method === "GET" && path === "/api/v1/me/identity") {
        valid(res, contracts.IdentityStatus, identityOf(state), origin); return;
      }
      if (method === "POST" && path === "/api/v1/me/identity/national-id/lookup") {
        const value = await bodyOf(req);
        const digits = String(value.documentNumber ?? "").replace(/\s/g, "");
        if (digits !== PERSON_ID) {
          valid(res, contracts.NationalIdLookupResult, { status: "not_found", message: "The local demo knows only Aline Uwase's sample National ID." }, origin); return;
        }
        state.challengeId = randomUUID();
        valid(res, contracts.NationalIdLookupResult, {
          status: "code_sent", challengeId: state.challengeId, sentTo: "+250•••••412", expiresInSeconds: 600,
        }, origin); return;
      }
      if (method === "POST" && path === "/api/v1/me/identity/national-id/confirm") {
        const value = input(res, contracts.NationalIdConfirmRequest, await bodyOf(req), origin);
        if (!value) return;
        if (!state.challengeId || value.challengeId !== state.challengeId || value.code !== "123456") {
          send(res, 400, { message: "Use the sample code 123456 for this local demo." }, origin); return;
        }
        state.challengeId = null; state.verified = true;
        valid(res, contracts.VerifiedPerson, PERSON, origin); return;
      }
      if (method === "GET" && path === "/api/v1/me/registration-draft") {
        send(res, 200, { draft: state.draft }, origin); return;
      }
      if (method === "PUT" && path === "/api/v1/me/registration-draft") {
        const value = input(res, contracts.RegistrationDraft, await bodyOf(req), origin);
        if (!value) return;
        state.draft = value; send(res, 200, { saved: true }, origin); return;
      }
      if (method === "GET" && path === "/api/v1/registrations/fee") {
        const businessType = url.searchParams.get("businessType");
        if (businessType !== "hospitality") { send(res, 501, { message: "Only the sample hotel registration is supported in this local preview." }, origin); return; }
        valid(res, contracts.RegistrationFeeQuote, { businessType, amountRwf: FEE_RWF, currency: "RWF" }, origin); return;
      }
      if (method === "POST" && path === "/api/v1/registrations/tin-check") {
        const value = await bodyOf(req);
        const tin = String(value.tin ?? "").replace(/\s/g, "");
        valid(res, contracts.TinCheckResult, tin === "998000001"
          ? { tin, result: "verified", message: "Found in the sample RRA register (demo).", business: BUSINESS,
              registrantIsDirector: state.verified ? true : null }
          : { tin, result: "failed", message: "The local demo knows only TIN 998000001.", business: null,
              registrantIsDirector: null }, origin); return;
      }
      if (method === "GET" && path === "/api/v1/psf/tiers") {
        valid(res, contracts.PsfTier.array(), PSF_TIERS, origin); return;
      }
      const geo = path.match(/^\/api\/v1\/geography\/(provinces|districts|sectors|cells|villages)$/);
      if (method === "GET" && geo) {
        const kind = geo[1];
        const schema = { provinces: contracts.Province, districts: contracts.District,
          sectors: contracts.Sector, cells: contracts.Cell, villages: contracts.Village }[kind];
        const parentKey = { districts: "provinceId", sectors: "districtId", cells: "sectorId", villages: "cellId" }[kind];
        const selected = parentKey && url.searchParams.has(parentKey)
          ? GEOGRAPHY[kind].filter((row) => row[parentKey] === Number(url.searchParams.get(parentKey)))
          : GEOGRAPHY[kind];
        valid(res, schema.array(), selected, origin); return;
      }
      if (method === "POST" && path === "/api/v1/uploads/certificate") {
        const form = await bodyOf(req);
        const file = form instanceof FormData ? form.get("file") : null;
        if (!(file instanceof File)) { send(res, 422, { message: "Choose a sample certificate file." }, origin); return; }
        const mime = file.type || "application/octet-stream";
        if (!["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(mime)) {
          send(res, 422, { message: "A certificate must be a PDF, JPEG, PNG or WebP." }, origin); return;
        }
        const objectKey = `registration-preview/${randomUUID()}`;
        const uploaded = { objectKey, kind: "certificate", mime, sizeBytes: file.size, filename: file.name };
        state.uploads.set(objectKey, uploaded);
        valid(res, contracts.UploadedObject, uploaded, origin); return;
      }
      if (method === "DELETE" && path === "/api/v1/uploads/certificate") {
        const removed = state.uploads.delete(url.searchParams.get("objectKey"));
        send(res, removed ? 200 : 404, removed ? { removed: true } : { message: "Sample file key not found." }, origin); return;
      }
      if (method === "POST" && path === "/api/v1/registrations") {
        const request = input(res, contracts.CreateRegistrationRequest, await bodyOf(req), origin);
        if (!request) return;
        if (request.role !== "host" || request.business.tin !== "998000001") {
          send(res, 501, { message: "This local preview only submits Uwase Hospitality Ltd, TIN 998000001." }, origin); return;
        }
        if (!state.verified) { send(res, 409, { message: "Check Aline Uwase's sample National ID before submitting." }, origin); return; }
        if (request.business.legalName !== BUSINESS.legalName) {
          send(res, 422, { message: "Use the registered company name returned by the sample TIN check." }, origin); return;
        }
        if (request.business.certificates.some((certificate) => !state.uploads.has(certificate.objectKey))) {
          send(res, 422, { message: "Upload the sample certificate in this preview first." }, origin); return;
        }
        if (!request.personal && !profileOf(state).complete) {
          send(res, 422, { message: "Complete the About you details first." }, origin); return;
        }
        if (request.personal) {
          state.profile = {
            fullName: request.personal.fullName, gender: request.personal.gender ?? null,
            dateOfBirth: request.personal.dateOfBirth, phoneE164: request.personal.phoneE164,
            document: { documentType: "national_id", documentNumberMasked: PERSON.documentNumberMasked, issuingCountry: "RW" },
            address: request.personal.address, complete: true,
          };
        }
        const summary = {
          orgId: randomUUID(), workspaceId: randomUUID(), legalName: BUSINESS.legalName, domain: "hospitality",
          accommodationClass: request.business.accommodationClass, status: "pending_payment",
          amountDueRwf: FEE_RWF, invoiceId: randomUUID(), rejectionReason: null, rejectionNotes: null,
          submittedAt: null, contractVersion: null, contractAcceptedAt: null, payoutLocked: null,
        };
        const parsed = contracts.RegistrationSummary.safeParse(summary);
        if (!parsed.success) throw new Error("Preview registration summary contract mismatch");
        state.registrations.set(summary.orgId, parsed.data); state.draft = null;
        send(res, 201, parsed.data, origin); return;
      }
      const registration = path.match(/^\/api\/v1\/registrations\/([0-9a-f-]{36})(?:\/(contract|pay|resubmit))?$/i);
      if (registration) {
        const summary = state.registrations.get(registration[1]);
        if (!summary) { send(res, 404, { message: "Sample registration not found." }, origin); return; }
        const action = registration[2];
        if (method === "GET" && !action) { valid(res, contracts.RegistrationSummary, summary, origin); return; }
        if (method === "POST" && action === "contract") {
          const value = input(res, contracts.AcceptContractRequest, await bodyOf(req), origin);
          if (!value) return;
          if (value.contractVersion !== contracts.OPERATOR_CONTRACT_VERSION) {
            send(res, 409, { message: "The sample contract version has changed." }, origin); return;
          }
          summary.contractVersion ??= contracts.OPERATOR_CONTRACT_VERSION;
          summary.contractAcceptedAt ??= new Date().toISOString();
          valid(res, contracts.RegistrationSummary, summary, origin); return;
        }
        if (method === "POST" && action === "pay") {
          if (!summary.contractAcceptedAt) { send(res, 409, { message: "Accept the sample operator contract first." }, origin); return; }
          if (summary.status === "pending_payment") {
            summary.status = "submitted";
            summary.amountDueRwf = null; summary.invoiceId = null;
            summary.submittedAt = new Date().toISOString();
          }
          valid(res, contracts.RegistrationSummary, summary, origin); return;
        }
        if (method === "POST" && action === "resubmit") {
          send(res, 501, { message: "Officer rejection and resubmission are outside this local hotel walkthrough." }, origin); return;
        }
      }
      send(res, 501, { message: "This endpoint is not part of the local registration preview." }, origin);
    } catch (error) {
      const status = error?.status ?? 500;
      if (status === 500) console.error("Preview API error:", error);
      send(res, status, { message: status === 500 ? "The local preview encountered an error." : error.message }, origin);
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.REGISTRATION_PREVIEW_API_PORT ?? 8000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid REGISTRATION_PREVIEW_API_PORT");
  createRegistrationPreviewServer().listen(port, "127.0.0.1", () => {
    console.log(`In-memory registration demo API: http://127.0.0.1:${port}`);
    console.log("Sample: Aline Uwase · National ID 1198870034567812 · code 123456 · TIN 998000001");
  });
}
