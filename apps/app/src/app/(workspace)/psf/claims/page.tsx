import { screens } from "@injishi/data";
import type { Metadata } from "next";
import { PsfClaimsView } from "@/features/oversight/PsfClaimsView";
import { requirePersona } from "@/lib/session";
import { requestContext } from "@/server/data";
import { readPsfClaims, readPsfScope, readPsfTiers } from "@/server/sources/psf";

export const metadata: Metadata = { title: screens.PsfClaims.pageTitle };

const STATUSES = new Set(["claimed", "confirmed", "rejected"]);

/**
 * Membership claims (0121, 2026-10-30): numbers businesses typed at registration, waiting for PSF to
 * confirm, and the ones already decided; and PSF's own member list, which confirms matching claims.
 */
export default async function PsfClaimsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requirePersona("PsfClaims");
  const { status: raw = "claimed" } = await searchParams;
  const status = (STATUSES.has(raw) ? raw : "claimed") as "claimed" | "confirmed" | "rejected";
  const ctx = await requestContext();
  const [scope, page, tiers] = await Promise.all([readPsfScope(ctx), readPsfClaims(ctx, status), readPsfTiers(ctx)]);
  return <PsfClaimsView scope={scope} page={page} status={status} tiers={tiers} />;
}
