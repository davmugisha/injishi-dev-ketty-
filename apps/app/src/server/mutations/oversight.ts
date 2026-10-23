/**
 * Writes for the oversight area, through the API: the government officer's decisions on a registration.
 * Plain functions: the server actions in features/oversight and the verify flows both call them.
 *
 * Every rule that matters is the API's, and its refusal travels back unchanged: whether this person holds
 * the function at all (OversightGuard, 403), whether the business is inside their region, whether they
 * verified it themselves (separation of duties), whether every document has been read before a field
 * verification. The only refusals worded here are the ones a request must not even be sent with.
 */
import { forgetDesk, isRejectionCode, type RejectionCode } from "../sources/oversight";
import type { SourceContext } from "../sources/types";

/** What the API answers after a gate decision (RegistrationSummary), the fields read here. */
export interface RegistrationAfterDecision {
  orgId: string;
  legalName: string;
  status: string;
  rejectionReason: RejectionCode | null;
  rejectionNotes: string | null;
}

/** A request the screen can word for the officer, refused before it reaches the API. */
export class OversightRefusal extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OversightRefusal";
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function orgPath(orgId: string): string {
  if (!UUID.test(orgId)) throw new OversightRefusal("This case has no registration behind it.");
  return `/api/v1/registrations/${orgId}`;
}

function note(text: string | undefined): string | undefined {
  const trimmed = text?.trim();
  return trimmed ? trimmed.slice(0, 2000) : undefined;
}

/**
 * Record that this field verifier has read one document (`POST /oversight/registrations/:orgId/documents/
 * :documentId/check`). Idempotent on the API: a second press is not a second check.
 */
export async function checkDocument(ctx: SourceContext, orgId: string, documentId: string): Promise<void> {
  orgPath(orgId);
  if (!UUID.test(documentId)) throw new OversightRefusal("That document is not on this registration.");
  await ctx.api.post(`/api/v1/oversight/registrations/${orgId}/documents/${documentId}/check`, {});
  forgetDesk(ctx);
}

/** The field verifier's pass (`POST /registrations/:id/field-verify`) → `field_verified`. */
export async function fieldVerify(
  ctx: SourceContext,
  orgId: string,
  notes?: string,
): Promise<RegistrationAfterDecision> {
  const done = await ctx.api.post<RegistrationAfterDecision>(`${orgPath(orgId)}/field-verify`, { notes: note(notes) });
  forgetDesk(ctx);
  return done;
}

/** The second officer's pass (`POST /registrations/:id/approve`) → `approved`, and `active` unless unclaimed. */
export async function approve(ctx: SourceContext, orgId: string, notes?: string): Promise<RegistrationAfterDecision> {
  const done = await ctx.api.post<RegistrationAfterDecision>(`${orgPath(orgId)}/approve`, { notes: note(notes) });
  forgetDesk(ctx);
  return done;
}

/**
 * Refuse at the gate this officer decides: `field-reject` for the field verifier, `reject` for the approver.
 * Two routes on the API because each guard names one function; the caller says which gate it is at.
 * A reason code is required (it is what the owner is told to fix), and so is a note the owner can act on.
 */
export async function reject(
  ctx: SourceContext,
  orgId: string,
  gate: "field" | "approval",
  reasonCode: string,
  notes: string,
): Promise<RegistrationAfterDecision> {
  if (!isRejectionCode(reasonCode)) throw new OversightRefusal("Choose the reason the business is told.");
  const explanation = note(notes);
  if (!explanation) throw new OversightRefusal("Write the explanation the business reads.");
  const route = gate === "field" ? "field-reject" : "reject";
  const done = await ctx.api.post<RegistrationAfterDecision>(`${orgPath(orgId)}/${route}`, {
    reasonCode,
    notes: explanation,
  });
  forgetDesk(ctx);
  return done;
}
