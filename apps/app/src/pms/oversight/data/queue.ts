/**
 * Live oversight queues and gate actions (F-S03 §6, D25).
 *
 * THE DEMO DATASET IS NO LONGER THE SOURCE. The API already serves
 * `/api/v1/oversight/verification-queue` and `/approval-queue`, and the gate
 * verbs live on `/api/v1/registrations/:id/{field-verify,field-reject,approve,reject}`.
 * This module is the one client for all four reads and writes, so the console
 * cannot drift into a second private copy of the pipeline.
 *
 * Mapping `OversightQueueItem` into the screen's `RegOrg` keeps the existing
 * queue UI. The documents, tourism licence and OBO flag used to stay empty
 * because the wire did not carry them, which flagged every hotel "No tourism
 * license"; it carries them now (registration Phase 0). Fields it still does
 * not carry stay empty rather than invented.
 */

import {
  OversightQueueItem,
  type RegistrationRejectionReason,
  type RegistrationSummary,
} from "@injishi/contracts";

import { API_BASE, ApiError, humanMessage, REQUEST_TIMEOUT_MS } from "../../data/api";
import type { BusinessType, OfficerKey, RegOrg, RegStage } from "./types";

/** Just enough of a list parser — contracts ship the row schema, not zod itself. */
function parseQueue(value: unknown): OversightQueueItem[] {
  if (!Array.isArray(value)) {
    throw new ApiError(500, "The queue answer was not a shape we recognise.");
  }
  return value.map((row) => OversightQueueItem.parse(row));
}

function ageHours(iso: string): number {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return 0;
  return Math.max(0, Math.floor((Date.now() - then) / 3_600_000));
}

/** How the queue names a certificate kind (`org_certificate_kind`). */
const CERTIFICATE_LABEL: Record<string, string> = {
  rdb_grade: "RDB grade certificate",
  tourism_license: "Tourism licence",
  tax_clearance: "Tax clearance",
  fire_safety: "Fire safety certificate",
  health_inspection: "Health inspection",
};

function domainToType(domain: string): BusinessType {
  if (domain === "residence") return "landlord";
  if (domain === "broker") return "broker";
  return "host";
}

/**
 * Lift a queue row into the shape the screens already render.
 *
 * `blockedBySeparationOfDuties` becomes a sentinel `fieldVerifiedBy` of
 * `"you"` when true so the existing same-officer check keeps working without
 * inventing a real name the API never sent.
 */
export function queueItemToRegOrg(item: OversightQueueItem): RegOrg {
  return {
    id: item.orgId,
    biz: item.legalName,
    type: domainToType(item.domain),
    registrant: "other",
    // The owner the file names (ADR-060): the intended owner on an on behalf
    // registration, otherwise the person who registered it.
    owner: (item.onBehalfOf ? item.intendedOwnerName : item.registrantName) ?? undefined,
    tin: item.tin ?? "",
    cls: item.accommodationClass ?? "",
    upi: item.upi ?? undefined,
    district: item.districtName ?? "—",
    sector: item.sectorName ?? "—",
    address: item.addressText ?? "—",
    tourismLic: item.tourismLicenseNumber ?? undefined,
    docs: item.certificates.map((c) => [
      c.kind === "other" ? (c.kindOther ?? "Other document") : (CERTIFICATE_LABEL[c.kind] ?? c.kind),
      c.certificateNumber ? `No. ${c.certificateNumber}` : "No number given",
    ]),
    branches: item.branches.map((b) => ({
      name: b.name,
      district: b.districtName,
      isHeadOffice: b.isHeadOffice,
    })),
    stage: item.status as RegStage,
    ageH: ageHours(item.waitingSince),
    submittedTs: item.waitingSince,
    obo: item.onBehalfOf,
    // The newest RRA answer on record (ADR-060). A business reaches either
    // queue only by passing the check, so a missing record still reads as passed.
    tinOk: item.tinCheck ? item.tinCheck.result === "verified" : true,
    tinMode: item.tinCheck?.adapterMode,
    fieldVerifiedBy: item.blockedBySeparationOfDuties ? "you" : null,
    approvedBy: null,
    rejectReason: null,
    rejectNote: "",
    prevStage: null,
    blockedBySeparationOfDuties: item.blockedBySeparationOfDuties,
  };
}

async function readQueue(path: string): Promise<RegOrg[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}/api/v1${path}`, {
      credentials: "include",
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new ApiError(res.status, "We couldn't load the queue.");
    }
    return parseQueue(await res.json()).map(queueItemToRegOrg);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(0, "We couldn't reach the server. Try again.");
  } finally {
    clearTimeout(timer);
  }
}

/** The queue for the open console. */
export function queuePathFor(officerKey: OfficerKey): string {
  return officerKey === "verifier"
    ? "/oversight/verification-queue"
    : "/oversight/approval-queue";
}

export function fetchQueue(officerKey: OfficerKey): Promise<RegOrg[]> {
  return readQueue(queuePathFor(officerKey));
}

async function postGate(
  path: string,
  body: unknown,
): Promise<RegistrationSummary> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}/api/v1${path}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      // The same humaniser the operator side uses: the API's own sentence when
      // it wrote one for a person, and our words for a framework default.
      let body: { message?: string | string[] } | null = null;
      try {
        body = (await res.json()) as { message?: string | string[] };
      } catch {
        // A non JSON error body is not worth failing over.
      }
      throw new ApiError(res.status, humanMessage(res.status, body));
    }
    return (await res.json()) as RegistrationSummary;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(0, humanMessage(0, null));
  } finally {
    clearTimeout(timer);
  }
}

/** Pass the gate this officer owns. */
export function passGate(
  officerKey: OfficerKey,
  orgId: string,
  notes?: string,
): Promise<RegistrationSummary> {
  const verb = officerKey === "verifier" ? "field-verify" : "approve";
  return postGate(`/registrations/${orgId}/${verb}`, {
    notes: notes || undefined,
  });
}

/** Refuse at the gate this officer owns. */
export function rejectGate(
  officerKey: OfficerKey,
  orgId: string,
  reasonCode: RegistrationRejectionReason,
  notes?: string,
): Promise<RegistrationSummary> {
  const verb = officerKey === "verifier" ? "field-reject" : "reject";
  return postGate(`/registrations/${orgId}/${verb}`, {
    reasonCode,
    notes: notes || undefined,
  });
}
