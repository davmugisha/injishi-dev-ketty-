/**
 * Registering a business the way a person does, over the API, for the flows that need a business at a stage.
 *
 * A registrant is a brand new email signed in with the demo code; their identity is proved through the
 * product's own ID scan (ADR-075: the front of a National ID, then a selfie, read by the demo's mock verifier),
 * never by writing to the database. Every id is fresh, so a run never collides with the last.
 */
import { randomBytes, randomUUID } from "node:crypto";

import { approve, checkDocument, fieldVerify } from "../../src/server/mutations/oversight";
import type { SourceContext } from "../../src/server/sources/types";
import { check, contextForEmail, demoCode } from "./harness";

/** Gasabo District (Kigali), where the seeded field verifier and approver below are posted. */
export const GASABO = { country: "RW", provinceId: 1, districtId: 102, sectorId: 10201 };
/** Rubavu District (Western Province), outside Gasabo's officers' region. */
export const RUBAVU = { country: "RW", provinceId: 3, districtId: 303, sectorId: 30301 };

/** Seeded officers (server/api seed): a Gasabo field verifier, a Gasabo approver, and a verifier in Karongi. */
export const OFFICERS = {
  gasaboVerifier: "jeanbosco@demo.injishi.com",
  gasaboApprover: "claudine@demo.injishi.com",
  otherDistrictVerifier: "yvette@demo.injishi.com",
} as const;

let counter = 0;
/** A number that is unique within this run and across runs. */
function unique(): number {
  counter += 1;
  return Date.now() * 100 + counter;
}

/** A well formed Rwandan National ID that is nobody's yet: "1", a 1990 birth, a male marker, 7 digits, "101". */
function freshNationalId(): string {
  const sequence = String(2_000_000 + (unique() % 7_000_000)).padStart(7, "0");
  return `119908${sequence}101`;
}

export interface Registrant {
  email: string;
  ctx: SourceContext;
  /** What the scan read off their ID, which the registration form sends back as "About you". */
  person: { fullName: string; dateOfBirth: string };
}

/** Upload bytes as an `id_photo`, the way the wizard does, and answer the object key. */
async function uploadIdPhoto(ctx: SourceContext, bytes: Buffer, name: string): Promise<string> {
  const form = new FormData();
  form.append("kind", "id_photo");
  form.append("attemptToken", randomUUID());
  form.append("file", new Blob([new Uint8Array(bytes)], { type: "image/jpeg" }), name);
  const uploaded = await ctx.api.upload<{ objectKey: string }>("/api/v1/uploads", form);
  return uploaded.objectKey;
}

/**
 * A new person, signed in and identity checked by the scan, ready to register a business. The front is a demo
 * card (`INJISHI-DEMO-NID:` and a number, which the mock verifier reads as that number); the selfie is any
 * other photo.
 */
export async function newRegistrant(label: string): Promise<Registrant> {
  const email = `flow.${label}.${unique()}@example.com`;
  const ctx = await contextForEmail(email);
  await demoCode();
  const front = Buffer.concat([randomBytes(6_000), Buffer.from(`INJISHI-DEMO-NID:${freshNationalId()}`, "latin1")]);
  const [frontKey, selfieKey] = await Promise.all([
    uploadIdPhoto(ctx, front, "id-front.jpg"),
    uploadIdPhoto(ctx, randomBytes(5_000), "selfie.jpg"),
  ]);
  const scan = await ctx.api.post<{ outcome: string; fields: { fullName: string; dateOfBirth: string } | null }>(
    "/api/v1/me/identity/scan",
    { documentType: "national_id", frontKey, selfieKey },
  );
  const fields = scan.outcome === "machine_passed" ? scan.fields : null;
  check(fields, `the scan did not pass: ${JSON.stringify(scan)}`);
  return { email, ctx, person: { fullName: fields.fullName, dateOfBirth: fields.dateOfBirth } };
}

/**
 * Upload a small PDF as the registrant's RDB certificate. ADR-075 AC-11: create refuses a stay or a venue without
 * one, and only takes a certificate the registrant uploaded.
 */
async function rdbCertificate(ctx: SourceContext): Promise<{ kind: "rdb_certificate"; objectKey: string }[]> {
  const form = new FormData();
  const pdf = "%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n";
  form.append("file", new Blob([pdf], { type: "application/pdf" }), "rdb-certificate.pdf");
  const uploaded = await ctx.api.upload<{ objectKey: string }>("/api/v1/uploads/certificate", form);
  return [{ kind: "rdb_certificate", objectKey: uploaded.objectKey }];
}

export interface Registered extends Registrant {
  orgId: string;
  legalName: string;
}

/**
 * A registration taken to `tin_verified` (the stage PSF reviews) in a place: create with the RDB certificate, then
 * pay (ADR-075: no contract before paying).
 */
export async function registerBusiness(place: typeof GASABO, label: string): Promise<Registered> {
  const registrant = await newRegistrant(label);
  const legalName = `Flow ${label} ${unique()} Lodge`;
  const created = await registrant.ctx.api.post<{ orgId: string }>("/api/v1/registrations", {
    role: "host",
    capacity: "owner",
    personal: {
      fullName: registrant.person.fullName,
      dateOfBirth: registrant.person.dateOfBirth,
      phoneE164: `+25078${String(1_000_000 + (unique() % 8_000_000))}`,
      address: place,
    },
    business: {
      domain: "hospitality",
      legalName,
      address: place,
      accommodationClass: "guest_house",
      tin: String(300_000_000 + (unique() % 600_000_000)),
      certificates: await rdbCertificate(registrant.ctx),
    },
  });
  check(created.orgId, `the registration was not created: ${JSON.stringify(created)}`);
  await payFee(registrant.ctx, created.orgId);
  const summary = await registrationOf(registrant.ctx, created.orgId);
  check(summary.status === "tin_verified", `${legalName} is at ${summary.status}, expected tin_verified`);
  return { ...registrant, orgId: created.orgId, legalName };
}

/**
 * Pay the registration fee the way a registrant does now (073-gtbank-payments
 * AC-16): press pay with a mobile money number, then poll until the prompt
 * settles. A stack where payments are off answers `settled` at once.
 */
async function payFee(ctx: SourceContext, orgId: string): Promise<void> {
  const attemptToken = randomUUID();
  const pressed = await ctx.api.post<{ kind: string; attempt?: { state: string } }>(
    `/api/v1/registrations/${orgId}/pay`,
    { attemptToken, instrument: { kind: "mobile_money", network: "mtn_momo", msisdn: "788123456" } },
  );
  if (pressed.kind === "settled") return;
  for (let i = 0; i < 60; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    const polled = await ctx.api.get<{ state: string }>(`/api/v1/registrations/${orgId}/pay/attempts/${attemptToken}`);
    if (polled.state === "confirmed") return;
    check(polled.state === "prompting", `the fee payment for ${orgId} ended ${polled.state}`);
  }
  check(false, `the fee payment for ${orgId} never settled`);
}

/** What the owner reads about their registration (RegistrationSummary), the fields the flows check. */
export interface RegistrationRead {
  orgId: string;
  status: string;
  rejectionReason: string | null;
  rejectionNotes: string | null;
  workspaceId?: string;
}

export function registrationOf(ctx: SourceContext, orgId: string): Promise<RegistrationRead> {
  return ctx.api.get<RegistrationRead>(`/api/v1/registrations/${orgId}`);
}

/**
 * Mark every document on a registration checked, as the field verifier does on the case page before verifying
 * (F-S03 §5: the gate refuses while one is unread). Every registration carries its RDB certificate (ADR-075 AC-11).
 */
export async function checkEveryDocument(officer: SourceContext, orgId: string): Promise<void> {
  const list = await officer.api.get<{ documents: { id: string }[] }>(
    `/api/v1/oversight/registrations/${orgId}/documents`,
  );
  for (const document of list.documents) await checkDocument(officer, orgId, document.id);
}

/** A business registered in Gasabo, field verified by Gasabo's verifier and approved by Gasabo's approver: `active`. */
export async function approvedBusiness(label: string): Promise<Registered> {
  const business = await registerBusiness(GASABO, label);
  const verifier = await contextForEmail(OFFICERS.gasaboVerifier);
  await checkEveryDocument(verifier, business.orgId);
  await fieldVerify(verifier, business.orgId);
  await approve(await contextForEmail(OFFICERS.gasaboApprover), business.orgId);
  const summary = await registrationOf(business.ctx, business.orgId);
  check(summary.status === "active", `${business.legalName} is at ${summary.status} after approval, expected active`);
  return business;
}
