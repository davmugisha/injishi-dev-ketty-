/**
 * One file's documents, for its Documents tab: what the person has on file
 * (`GET /ops/employees/:id/documents`), a short-lived link to read one
 * (`GET /ops/documents/:id/file`, the API logs every read), HR's decision on what
 * was handed in (`POST /ops/documents/:id/decide`) and asking for a new one
 * (`POST /ops/document-requests`).
 */

import type { EmployeeDocumentView } from "@injishi/product-hr";
import { ApiError } from "../api";
import type { SourceContext } from "../sources/types";
import { inOwningBusiness } from "./people";

export type { EmployeeDocumentView };

interface ApiDocument {
  id: string;
  title: string;
  status: "requested" | "submitted" | "approved" | "rejected";
  expired: boolean;
  expiresOn: string | null;
  dueOn: string | null;
  rejectReason: string | null;
  versions: { uploadedAt: string }[];
  updatedAt: string;
}

/** "2026-10-09" or an ISO time → "9 Oct 2026". */
function day(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso),
  );
}

function toView(d: ApiDocument): EmployeeDocumentView {
  const state = d.expired
    ? { state: "Expired", tone: "danger" as const }
    : d.status === "approved"
      ? { state: "Approved", tone: "success" as const }
      : d.status === "submitted"
        ? { state: "To review", tone: "warning" as const }
        : d.status === "rejected"
          ? { state: "Returned", tone: "danger" as const }
          : { state: "Requested", tone: "default" as const };
  const meta =
    d.status === "rejected"
      ? `Returned${d.rejectReason ? `: ${d.rejectReason}` : ""}`
      : d.expiresOn
        ? `${d.expired ? "Expired" : "Expires"} ${day(d.expiresOn)}`
        : d.versions.length
          ? `Uploaded ${day(d.updatedAt)}`
          : d.dueOn
            ? `Due ${day(d.dueOn)}`
            : "Not uploaded";
  return {
    id: d.id,
    title: d.title,
    ...state,
    meta,
    canOpen: d.versions.length > 0,
    canDecide: d.status === "submitted",
  };
}

export async function readDocuments(ctx: SourceContext, employeeId: string): Promise<EmployeeDocumentView[]> {
  const { documents } = await inOwningBusiness(ctx, (api) =>
    api.get<{ documents: ApiDocument[] }>(`/api/v1/ops/employees/${encodeURIComponent(employeeId)}/documents`),
  );
  return documents.map(toView);
}

/** Approve the newest upload, or send it back with the reason (`POST /ops/documents/:id/decide`). */
export async function decideDocument(
  ctx: SourceContext,
  documentId: string,
  decision: "approved" | "declined",
  reason?: string,
): Promise<void> {
  const note = (reason ?? "").trim();
  if (decision === "declined" && note.length < 3)
    throw new ApiError(422, "reason_required", "Say why it goes back.", null);
  await inOwningBusiness(ctx, (api) =>
    api.post(
      `/api/v1/ops/documents/${encodeURIComponent(documentId)}/decide`,
      decision === "approved" ? { decision: "approve" } : { decision: "reject", reason: note.slice(0, 500) },
    ),
  );
}

/** Ask this person for a document: it shows on Me and the phone for them to send. */
export async function requestDocument(
  ctx: SourceContext,
  employeeId: string,
  input: { title: string; note: string; dueOn: string },
): Promise<void> {
  await inOwningBusiness(ctx, (api) =>
    api.post("/api/v1/ops/document-requests", {
      title: input.title.trim(),
      description: input.note.trim() || null,
      formats: ["pdf", "jpg", "png", "heic"],
      maxMb: 10,
      dueOn: input.dueOn || null,
      employeeIds: [employeeId],
    }),
  );
}

/** A link that opens the document's latest file for a few minutes. */
export async function documentLink(ctx: SourceContext, documentId: string): Promise<string> {
  const { url } = await inOwningBusiness(ctx, (api) =>
    api.get<{ url: string }>(`/api/v1/ops/documents/${encodeURIComponent(documentId)}/file`),
  );
  return url;
}
