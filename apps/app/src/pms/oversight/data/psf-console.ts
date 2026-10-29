/**
 * The PSF officer console's reads (2026-10-19): what the officer covers, the
 * report over a period, the decision log, and the queue, each narrowed by the
 * console's place switcher (`PsfArea`) inside the officer's own region.
 *
 * The API holds the boundary: a district outside the region narrows to
 * nothing, so nothing here needs to check it.
 */
import type {
  CreatePsfSubsectorRequest,
  PsfSubsectorsView,
  UpdatePsfSubsectorRequest,
  PsfBusinessDetail,
  PsfBusinessHistory,
  PsfDecisionsPage,
  PsfOfficerFeesView,
  SetPsfTierFeeRequest,
  PsfMembershipFamily,
  PsfOwnerGroup,
  PsfOfficerScope,
  PsfQueuePage,
  PsfRegisterSummary,
  PsfReport,
} from "@injishi/contracts";

import { API_BASE, ApiError, REQUEST_TIMEOUT_MS, getJson, humanMessage, readRefusal, type ReadResult } from "../../data/api";

/** One district, one province, or the officer's whole region. */
export interface PsfArea {
  district?: number;
  province?: number;
}

function qs(params: Record<string, string | number | undefined | null>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
}

export function fetchPsfScope(): Promise<ReadResult<PsfOfficerScope>> {
  return getJson<PsfOfficerScope>("/oversight/psf/scope");
}

export function fetchPsfReport(from: string, to: string, area: PsfArea): Promise<ReadResult<PsfReport>> {
  return getJson<PsfReport>(`/oversight/psf/report${qs({ from, to, ...area })}`);
}

/** What the decision log is narrowed to, past the place. */
export interface PsfDecisionFilter {
  outcome?: "approved" | "declined";
  q?: string;
  cluster?: string;
}

export function fetchPsfDecisions(area: PsfArea, filter: PsfDecisionFilter, cursor: string | null): Promise<ReadResult<PsfDecisionsPage>> {
  return getJson<PsfDecisionsPage>(`/oversight/psf/decisions${qs({ ...area, ...filter, cursor })}`);
}

/** What the queue is narrowed to, past the place, and its order. */
export interface PsfQueueFilter {
  q?: string;
  cluster?: string;
  family?: PsfMembershipFamily;
  group?: PsfOwnerGroup;
  sort: "newest" | "oldest" | "amount";
}

export function fetchPsfQueueIn(area: PsfArea, filter: PsfQueueFilter, cursor: string | null): Promise<ReadResult<PsfQueuePage>> {
  return getJson<PsfQueuePage>(`/oversight/psf-applications${qs({ ...area, ...filter, cursor })}`);
}

/** The business behind an application: its payments, applications and memberships. */
export function fetchPsfBusinessHistory(applicationId: string): Promise<ReadResult<PsfBusinessHistory>> {
  return getJson<PsfBusinessHistory>(`/oversight/psf-applications/${applicationId}/history`);
}

export function fetchPsfSummaryIn(area: PsfArea): Promise<ReadResult<PsfRegisterSummary>> {
  return getJson<PsfRegisterSummary>(`/oversight/psf/summary${qs({ ...area })}`);
}

export function fetchPsfSubsectors(area: PsfArea): Promise<ReadResult<PsfSubsectorsView>> {
  return getJson<PsfSubsectorsView>(`/oversight/psf/subsectors${qs({ ...area })}`);
}

async function write<T>(method: "POST" | "PATCH" | "PUT", path: string, body: unknown): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}/api/v1${path}`, {
      method,
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) throw await readRefusal(res);
    return (await res.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(0, humanMessage(0, null));
  } finally {
    clearTimeout(timer);
  }
}

export function createPsfSubsector(body: CreatePsfSubsectorRequest): Promise<PsfSubsectorsView> {
  return write("POST", "/oversight/psf/subsectors", body);
}

export function updatePsfSubsector(id: string, body: UpdatePsfSubsectorRequest): Promise<PsfSubsectorsView> {
  return write("PATCH", `/oversight/psf/subsectors/${id}`, body);
}

/** What each band costs in the district shown (or nationally), and who may set it. */
export function fetchPsfFees(area: PsfArea): Promise<ReadResult<PsfOfficerFeesView>> {
  return getJson<PsfOfficerFeesView>(`/oversight/psf/fees${qs({ ...area })}`);
}

/** Set a band's price for a place, or clear it with `amountRwf: null`. */
export function setPsfFee(body: SetPsfTierFeeRequest): Promise<PsfOfficerFeesView> {
  return write("PUT", "/oversight/psf/fees", body);
}

/** A member's certificate as a PDF: a plain link, so the browser downloads it with the session. */
export function psfCertificateHref(applicationId: string): string {
  return `${API_BASE}/api/v1/oversight/psf-applications/${applicationId}/certificate`;
}

/** Mail the certificate to the email the business gave with its application. */
export function emailPsfCertificate(applicationId: string): Promise<{ sentTo: string }> {
  return write("POST", `/oversight/psf-applications/${applicationId}/certificate/email`, {});
}

/** One business: its row, its contact, and every payment, application and membership. */
export function fetchPsfBusiness(orgId: string): Promise<ReadResult<PsfBusinessDetail>> {
  return getJson<PsfBusinessDetail>(`/oversight/psf/businesses/${orgId}`);
}
