/**
 * The officer's own decision log: `GET /api/v1/oversight/decisions` (ADR-049,
 * AC-G6).
 *
 * The one client for it, beside `queue.ts`, so the console holds no second copy
 * of what was decided. Every row is the server's: the body and the title are the
 * review row's own copies from the day of the decision, never the officer's
 * current posting, so a posting that was revoked or moved does not rewrite a
 * decision already taken.
 */

import {
  OversightDecisionPage,
  REJECTION_REASON_LABEL,
  type OversightDecision,
} from "@injishi/contracts";
import { formatMarketDateTime } from "@injishi/utils";

import { API_BASE, ApiError, REQUEST_TIMEOUT_MS } from "../../data/api";
import type { Decision } from "./types";

/** One page, newest first. No cursor is the newest page. */
export async function fetchDecisionPage(
  cursor: string | null,
): Promise<OversightDecisionPage> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  try {
    const res = await fetch(`${API_BASE}/api/v1/oversight/decisions${query}`, {
      credentials: "include",
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new ApiError(res.status, "We couldn't load your decisions.");
    }
    const parsed = OversightDecisionPage.safeParse(await res.json());
    if (!parsed.success) {
      throw new ApiError(500, "The decision log answer was not a shape we recognise.");
    }
    return parsed.data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(0, "We couldn't reach the server. Try again.");
  } finally {
    clearTimeout(timer);
  }
}

/** The words an officer reads for what they did at which gate. */
function actionOf(d: OversightDecision): string {
  if (d.decision === "rejected") return "Rejected";
  return d.stage === "tin_verified" ? "Field-verified" : "Approved";
}

/** A server decision as the log screen renders it. */
export function decisionFromWire(d: OversightDecision): Decision {
  return {
    id: d.reviewId,
    orgId: d.orgId,
    biz: d.legalName,
    action: actionOf(d),
    reason: d.reasonCode ? REJECTION_REASON_LABEL[d.reasonCode] : undefined,
    note: d.notes ?? undefined,
    title: d.governmentTitle,
    body: d.governmentBodyCode,
    ts: formatMarketDateTime(new Date(d.decidedAt)),
  };
}
