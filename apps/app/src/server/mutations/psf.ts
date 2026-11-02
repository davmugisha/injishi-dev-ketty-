/**
 * Writes for the PSF console, through the API (ported from the old operator console, 2026-10-26):
 * approve or decline an application, and admit or decline one branch. Every rule is the API's and
 * its refusal travels back unchanged: only the PSF District Manager of the district decides
 * (403 for a province or national manager), an officer with a stake in the business may not
 * (403), and an application or branch already decided is a 409.
 */
import type { PsfDeclineReason, PsfOfficerApplication } from "../sources/psf";
import type { SourceContext } from "../sources/types";

/** A request the screen can word for the officer, refused before it reaches the API. */
export class PsfRefusal extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PsfRefusal";
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function applicationPath(id: string): string {
  if (!UUID.test(id)) throw new PsfRefusal("This application could not be found.");
  return `/api/v1/oversight/psf-applications/${id}`;
}

const note = (text: string | undefined): string | undefined => {
  const trimmed = text?.trim();
  return trimmed ? trimmed.slice(0, 1000) : undefined;
};

/**
 * Approve: PSF's membership number for the business. A paid application is a member at once, and so is a
 * card holder (2026-11-02), with the year its card shows.
 */
export function approvePsf(
  ctx: SourceContext,
  id: string,
  membershipNumber: string,
  card?: { startsOn: string; expiresOn: string },
): Promise<PsfOfficerApplication> {
  const number = membershipNumber.trim();
  if (!number) throw new PsfRefusal("Give the PSF membership number.");
  return ctx.api.post<PsfOfficerApplication>(`${applicationPath(id)}/approve`, { membershipNumber: number.slice(0, 40), ...(card ?? {}) });
}

/** Decline, with PSF's reason; `other` needs a note the business will read. */
export function declinePsf(ctx: SourceContext, id: string, reason: PsfDeclineReason, text?: string): Promise<PsfOfficerApplication> {
  const body = { reason, ...(note(text) ? { note: note(text) } : {}) };
  if (reason === "other" && !body.note) throw new PsfRefusal("Say why, so the business knows what to fix.");
  return ctx.api.post<PsfOfficerApplication>(`${applicationPath(id)}/decline`, body);
}

/** Admit or decline one branch, as the District Manager of the branch's district. */
export function decidePsfBranch(
  ctx: SourceContext,
  id: string,
  branchId: string,
  decision: "admit" | "decline",
  text?: string,
): Promise<PsfOfficerApplication> {
  if (!UUID.test(branchId)) throw new PsfRefusal("This branch could not be found.");
  const body = { decision, ...(note(text) ? { note: note(text) } : {}) };
  if (decision === "decline" && !body.note) throw new PsfRefusal("Say why the branch is declined.");
  return ctx.api.post<PsfOfficerApplication>(`${applicationPath(id)}/branches/${branchId}/decision`, body);
}
