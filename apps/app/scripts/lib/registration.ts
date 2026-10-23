/**
 * Registering a business the way a person does, over the API, for the flows that need a business at a stage.
 *
 * A registrant is a brand new email signed in with the demo code; their identity is proved through the
 * product's own National ID routes (the register sends a code to the phone it holds, and the demo's code is
 * the fixed one), never by writing to the database. Every id is fresh, so a run never collides with the last.
 */
import { approve, fieldVerify } from "../../src/server/mutations/oversight";
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

/** The contract version the API accepts (OPERATOR_CONTRACT_VERSION in @injishi/contracts). */
const CONTRACT_VERSION = "2026-09-12";

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
  /** What the register confirmed about them, which the registration form sends back as "About you". */
  person: { fullName: string; dateOfBirth: string };
}

/** A new person, signed in and identity verified through the register, ready to register a business. */
export async function newRegistrant(label: string): Promise<Registrant> {
  const email = `flow.${label}.${unique()}@example.com`;
  const ctx = await contextForEmail(email);
  const lookup = await ctx.api.post<{ status: string; challengeId?: string }>(
    "/api/v1/me/identity/national-id/lookup",
    { documentNumber: freshNationalId() },
  );
  check(
    lookup.status === "code_sent" && lookup.challengeId,
    `the register did not send a code: ${JSON.stringify(lookup)}`,
  );
  const person = await ctx.api.post<{ fullName: string; dateOfBirth: string }>(
    "/api/v1/me/identity/national-id/confirm",
    { challengeId: lookup.challengeId, code: await demoCode() },
  );
  return { email, ctx, person };
}

export interface Registered extends Registrant {
  orgId: string;
  legalName: string;
}

/** A registration taken to `tin_verified` (the stage the field verifier works) in a place: create, accept, pay. */
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
      certificates: [],
    },
  });
  check(created.orgId, `the registration was not created: ${JSON.stringify(created)}`);
  await registrant.ctx.api.post(`/api/v1/registrations/${created.orgId}/contract`, {
    contractVersion: CONTRACT_VERSION,
  });
  await registrant.ctx.api.post(`/api/v1/registrations/${created.orgId}/pay`);
  const summary = await registrationOf(registrant.ctx, created.orgId);
  check(summary.status === "tin_verified", `${legalName} is at ${summary.status}, expected tin_verified`);
  return { ...registrant, orgId: created.orgId, legalName };
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

/** A business registered in Gasabo, field verified by Gasabo's verifier and approved by Gasabo's approver: `active`. */
export async function approvedBusiness(label: string): Promise<Registered> {
  const business = await registerBusiness(GASABO, label);
  await fieldVerify(await contextForEmail(OFFICERS.gasaboVerifier), business.orgId);
  await approve(await contextForEmail(OFFICERS.gasaboApprover), business.orgId);
  const summary = await registrationOf(business.ctx, business.orgId);
  check(summary.status === "active", `${business.legalName} is at ${summary.status} after approval, expected active`);
  return business;
}
