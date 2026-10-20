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
  /** The plan the person asked about on the pricing cards, if any. */
  plan?: string;
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
    ...(input.plan ? [`Asked about: ${input.plan}`] : []),
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

// ── Training: checking a certificate ───────────────────────────────────────────────────────────────

/**
 * What `GET /api/v1/verify/:token` answers (`TrainingVerification` in @injishi/contracts training.ts). One shape
 * for valid, revoked and unknown alike: only `status` says anything, and the fields are null when there is nothing
 * to describe. It never names an employer.
 */
export interface CertificateCheck {
  status: "valid" | "revoked" | "unknown";
  serial: string | null;
  holderName: string | null;
  courseTitle: string | null;
  courseVersion: number | null;
  sessionDate: string | null;
  venueName: string | null;
  districtName: string | null;
  leadTrainerName: string | null;
  issuedAt: string | null;
  revokedAt: string | null;
}

/**
 * "Verify" on the training page: the public check printed on every certificate (`GET /verify/:token`, no session,
 * throttled by the API). It checks by the verification code under the certificate's QR code, never by serial: a
 * lookup by serial is not a route, by design (ADR-049 AC-17).
 */
export async function checkCertificate(ctx: SourceContext, code: string): Promise<CertificateCheck> {
  const token = code.trim().toUpperCase();
  if (!token) throw new PublicInputError("Type the verification code printed under the certificate's QR code.");
  return ctx.api.get<CertificateCheck>(`/api/v1/verify/${encodeURIComponent(token)}`);
}
