import { PSF_STANDING_LABEL, PsfBusinessKind, type PsfStanding } from "@injishi/contracts";
import { screens } from "@injishi/data";
import { EmptyBlock, PageContent, PageHeader } from "@injishi/ui";
import type { Metadata } from "next";
import { type AdminPsfFilter, AdminPsfView } from "@/features/admin/psf/AdminPsfView";
import { requirePersona } from "@/lib/session";
import { placeChainOf } from "@/server/admin/leaders";
import { idOf, one, type Search, wordOf } from "@/server/admin/list";
import { psfBusinesses, psfSummary } from "@/server/admin/psf";
import { ApiError } from "@/server/api";

export const metadata: Metadata = { title: screens.AdminPsf.pageTitle };

/**
 * PSF memberships across Rwanda, with what is due for renewal, read from the admin API as this staffer and
 * filtered by what the URL carries (status, area, cluster, kind, TIN, RDB certificate, unpaid, search).
 */
export default async function AdminPsfPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requirePersona("AdminPsf");
  const sp = await searchParams;
  const rawStatus = one(sp.status) ?? "";
  const filter: AdminPsfFilter =
    rawStatus === "renewal_due" || rawStatus === "payment_due"
      ? rawStatus
      : rawStatus in PSF_STANDING_LABEL
        ? (rawStatus as PsfStanding)
        : "";
  const provinceId = idOf(sp.provinceId);
  const districtId = provinceId ? idOf(sp.districtId) : undefined;
  try {
    const [summary, page, areaChain] = await Promise.all([
      psfSummary(),
      psfBusinesses({
        q: one(sp.q)?.trim() || undefined,
        cursor: one(sp.cursor) || undefined,
        renewal: filter === "renewal_due" ? "due" : undefined,
        payment: filter === "payment_due" ? "due" : undefined,
        standing: filter && filter !== "renewal_due" && filter !== "payment_due" ? filter : undefined,
        province: provinceId,
        district: districtId,
        cluster: one(sp.cluster)?.slice(0, 60) || undefined,
        kind: wordOf(sp.kind, PsfBusinessKind.options),
        tin: wordOf(sp.tin, ["with", "without"] as const),
        rdb: wordOf(sp.rdb, ["with", "without"] as const),
      }),
      placeChainOf({ province: provinceId, district: districtId }),
    ]);
    return <AdminPsfView summary={summary} page={page} areaChain={areaChain} />;
  } catch (error) {
    if (error instanceof ApiError && error.forbidden) {
      return (
        <PageContent>
          <PageHeader title="PSF memberships" />
          <EmptyBlock
            icon="ShieldKeyhole"
            title="Your staff role cannot see businesses"
            description="Ask a super admin for access to businesses."
          />
        </PageContent>
      );
    }
    throw error;
  }
}
