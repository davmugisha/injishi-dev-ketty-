/**
 * PSF membership (ADR-056): the business's own page and the PSF membership
 * officer's console read and write through here.
 *
 * NOT through `command()`: these routes are guarded by the session and the
 * applicant rule (or the officer's posting), never by `WorkspaceGuard`, so they
 * name no workspace. A business still in the registration pipeline holds no
 * permission, and its PSF page must work there.
 */
import type {
  CreatePsfApplicationRequest,
  PsfDeclineRequest,
  PsfMemberDecisionRequest,
  PsfMembershipOverview,
  PsfOfficerApplication,
  PsfQueuePage,
  PsfTier,
} from "@injishi/contracts";

import { API_BASE, ApiError, REQUEST_TIMEOUT_MS, getJson, humanMessage, readRefusal, type ReadResult } from "./api";

async function send<T>(path: string, body?: unknown): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}/api/v1${path}`, {
      method: "POST",
      credentials: "include",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) throw await readRefusal(res);
    return (await res.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    // We never heard back, which is not a refusal: the write may have landed.
    throw new ApiError(0, humanMessage(0, null));
  } finally {
    clearTimeout(timer);
  }
}

// --- The business ------------------------------------------------------------

export function fetchPsfTiers(): Promise<ReadResult<PsfTier[]>> {
  return getJson<PsfTier[]>("/psf/tiers");
}

export function fetchPsfMembership(orgId: string): Promise<ReadResult<PsfMembershipOverview>> {
  return getJson<PsfMembershipOverview>(`/orgs/${orgId}/psf-membership`);
}

export function applyForPsf(orgId: string, body: CreatePsfApplicationRequest): Promise<PsfMembershipOverview> {
  return send<PsfMembershipOverview>(`/orgs/${orgId}/psf-applications`, body);
}

export function withdrawPsfApplication(orgId: string, applicationId: string): Promise<PsfMembershipOverview> {
  return send<PsfMembershipOverview>(`/orgs/${orgId}/psf-applications/${applicationId}/withdraw`);
}

// --- The PSF membership officer ------------------------------------------------

export function fetchPsfQueue(cursor?: string | null): Promise<ReadResult<PsfQueuePage>> {
  const q = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  return getJson<PsfQueuePage>(`/oversight/psf-applications${q}`);
}

export function fetchPsfApplication(applicationId: string): Promise<ReadResult<PsfOfficerApplication>> {
  return getJson<PsfOfficerApplication>(`/oversight/psf-applications/${applicationId}`);
}

export function markPsfMember(applicationId: string, body: PsfMemberDecisionRequest): Promise<PsfOfficerApplication> {
  return send<PsfOfficerApplication>(`/oversight/psf-applications/${applicationId}/member`, body);
}

export function declinePsfApplication(applicationId: string, body: PsfDeclineRequest): Promise<PsfOfficerApplication> {
  return send<PsfOfficerApplication>(`/oversight/psf-applications/${applicationId}/decline`, body);
}
