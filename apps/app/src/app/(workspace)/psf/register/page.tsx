import { PSF_OWNER_GROUP_SHORT, type PsfOwnerGroup } from "@injishi/contracts";
import { screens } from "@injishi/data";
import type { Metadata } from "next";
import { PsfRegisterView, type RegisterFilters } from "@/features/oversight/PsfRegisterView";
import { requirePersona } from "@/lib/session";
import { requestContext } from "@/server/data";
import { readPsfBusinesses, readPsfRegisterSummary, readPsfScope, readPsfTiers, type PsfStanding } from "@/server/sources/psf";

export const metadata: Metadata = { title: screens.PsfRegister.pageTitle };

const STANDINGS = new Set<PsfStanding>(["not_applied", "claimed", "applied", "sent_back", "awaiting_payment", "member", "lapsed", "declined"]);

/** Businesses: every business in the manager's region on PSF's register, each opening its profile. */
export default async function PsfRegisterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requirePersona("PsfRegister");
  const p = await searchParams;
  // "Renewal due" and "Awaiting payment" are views of their own, so each stands in for a standing.
  const view: RegisterFilters["view"] =
    p.renewal === "due"
      ? "renewal_due"
      : p.payment === "due"
        ? "payment_due"
        : STANDINGS.has(p.standing as PsfStanding)
          ? (p.standing as PsfStanding)
          : "";
  const filters: RegisterFilters = {
    q: p.q ?? "",
    view,
    cluster: p.cluster ?? "",
    tier: p.tier ?? "",
    district: Number(p.district) > 0 ? String(Number(p.district)) : "",
    group: p.group && p.group in PSF_OWNER_GROUP_SHORT ? p.group : "",
    tin: p.tin === "with" || p.tin === "without" ? p.tin : "",
    rdb: p.rdb === "with" || p.rdb === "without" ? p.rdb : "",
  };
  const ctx = await requestContext();
  const [scope, summary, page, tiers] = await Promise.all([
    readPsfScope(ctx),
    readPsfRegisterSummary(ctx),
    readPsfBusinesses(ctx, apiFilter(filters)),
    readPsfTiers(ctx),
  ]);
  return <PsfRegisterView scope={scope} summary={summary} page={page} filters={filters} tiers={tiers} />;
}

/** The screen's filters as the API reads them. */
function apiFilter(f: RegisterFilters) {
  return {
    q: f.q,
    standing: f.view && f.view !== "renewal_due" && f.view !== "payment_due" ? f.view : undefined,
    renewal: f.view === "renewal_due" ? ("due" as const) : undefined,
    payment: f.view === "payment_due" ? ("due" as const) : undefined,
    cluster: f.cluster || undefined,
    tier: f.tier || undefined,
    district: f.district ? Number(f.district) : undefined,
    group: (f.group || undefined) as PsfOwnerGroup | undefined,
    tin: (f.tin || undefined) as "with" | "without" | undefined,
    rdb: (f.rdb || undefined) as "with" | "without" | undefined,
  };
}
