/** Writes for the public area, through the API. Plain functions: server actions and verify flows both call them. */
import { ApiError } from "../api";
import type { SourceContext } from "../sources/types";

/** The support intake's closed topics (`SupportTopic` in @injishi/contracts support.ts). */
export type SupportTopic = "booking" | "payment" | "listing" | "other";

export interface SupportTicketInput {
  topic: SupportTopic;
  message: string;
  email: string;
  name?: string;
  phone?: string;
}

/**
 * Open a support ticket. Public on purpose: a signed-out visitor needs help too. When someone is signed
 * in, the API attributes the ticket to them from the session; the body can never name a requester.
 */
export async function openSupportTicket(ctx: SourceContext, input: SupportTicketInput): Promise<{ id: string }> {
  return ctx.api.post<{ id: string }>("/api/v1/support/tickets", input);
}

/** A plain-words refusal raised before the API is asked (a district it does not know). */
export class PublicInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublicInputError";
  }
}

/** A district as the hosts page names it ("Rubavu") → its id on the API (`GET /geography/districts`). */
async function districtId(ctx: SourceContext, name: string): Promise<number> {
  const wanted = name.trim().toLowerCase();
  const districts = await ctx.api.get<{ id: number; name: string }[]>("/api/v1/geography/districts");
  const found = districts.find((d) => d.name.toLowerCase() === wanted);
  if (!found) throw new PublicInputError("Choose your district from the list.");
  return found.id;
}

// ── For hosts: the waitlist ────────────────────────────────────────────────────────────────────────

/** `WaitlistPropertyType` in @injishi/contracts waitlist.ts. */
export type WaitlistPropertyType =
  | "hotel"
  | "guest_house"
  | "apartment"
  | "lodge"
  | "villa"
  | "hostel"
  | "homestay"
  | "campsite";
/** `WaitlistSizeBand`: rooms or units. */
export type WaitlistSizeBand = "1_5" | "6_20" | "21_50" | "50_plus";

export interface OwnerWaitlistInput {
  fullName: string;
  email: string;
  /** A Rwandan number as typed ("078 300 1122"); the API normalises it to +250…. */
  phone: string;
  businessName: string;
  /** The district's name, as the form lists it. */
  district: string;
  propertyType: WaitlistPropertyType;
  sizeBand: WaitlistSizeBand;
  marketingOptIn: boolean;
}

/**
 * "Join the waitlist" on the hosts page (ADR-048): a business owner's signup, `POST /waitlist/signups` with
 * audience `owner`. Anonymous on purpose (the product is not launched for them yet) and throttled by the API.
 * `alreadyJoined` is true when the address was already on the list; nothing is written twice.
 */
export async function joinOwnerWaitlist(
  ctx: SourceContext,
  input: OwnerWaitlistInput,
): Promise<{ id: string; alreadyJoined: boolean }> {
  return ctx.api.post<{ id: string; alreadyJoined: boolean }>("/api/v1/waitlist/signups", {
    audience: "owner",
    email: input.email.trim(),
    fullName: input.fullName.trim(),
    phone: input.phone.trim(),
    businessName: input.businessName.trim(),
    districtId: await districtId(ctx, input.district),
    propertyType: input.propertyType,
    sizeBand: input.sizeBand,
    marketingOptIn: input.marketingOptIn,
  });
}

// ── For hosts: a demo ─────────────────────────────────────────────────────────────────────────────────

export interface DemoRequestInput {
  name: string;
  email: string;
  phone: string;
  business: string;
  businessType: string;
  district: string;
  heardFrom: string;
  /** "Online" or "At my property" (a field agent visit). */
  format: string;
}

/**
 * "Request demo" on the hosts page. There is no demo-booking service, so the request goes where a person reads
 * it: Injishi support's intake (`POST /support/tickets`, topic `other`), with everything the form asked written
 * into the ticket. Answers the ticket id; nobody is promised a call by this.
 */
export async function requestDemo(ctx: SourceContext, input: DemoRequestInput): Promise<{ id: string }> {
  const name = input.name.trim();
  const business = input.business.trim();
  if (!name) throw new PublicInputError("Enter your name.");
  if (!business) throw new PublicInputError("Enter the business name.");
  const message = [
    `Demo request: ${business}`,
    `Business type: ${input.businessType}`,
    `District: ${input.district}`,
    `Demo: ${input.format}`,
    `Phone: ${input.phone.trim()}`,
    `Heard about Injishi from: ${input.heardFrom}`,
  ].join("\n");
  return openSupportTicket(ctx, {
    topic: "other",
    message,
    email: input.email.trim(),
    name: name.slice(0, 120),
    ...(input.phone.trim() ? { phone: input.phone.trim() } : {}),
  });
}

/** True when this error is a refusal the person can read (the API's, or one raised here). */
export function readableRefusal(error: unknown): string | null {
  if (error instanceof ApiError || error instanceof PublicInputError) return error.message;
  return null;
}
