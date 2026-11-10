import { AdminOrgStage, Domain } from "@injishi/contracts";
import { screens } from "@injishi/data";
import { EmptyBlock, PageContent, PageHeader } from "@injishi/ui";
import type { Metadata } from "next";
import { RegistrationsView } from "@/features/admin/registrations/RegistrationsView";
import { requirePersona } from "@/lib/session";
import { placeChainOf } from "@/server/admin/leaders";
import { idOf, one, pageOf, type Search, sinceDay, wordOf } from "@/server/admin/list";
import { adminRegistrations } from "@/server/admin/registrations";
import { ApiError } from "@/server/api";

export const metadata: Metadata = { title: screens.AdminBusinesses.pageTitle };

/**
 * The businesses that registered and where each stands, read from the admin API as this staffer, one page
 * at a time and filtered by what the URL carries (`q`, `stage`, `domain`, `provinceId`, `districtId`,
 * `since`, `page`), so the server filters every business and a filtered list can be shared.
 */
export default async function AdminBusinessesPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requirePersona("AdminBusinesses");
  const sp = await searchParams;
  const provinceId = idOf(sp.provinceId);
  const districtId = provinceId ? idOf(sp.districtId) : undefined;
  try {
    const [list, areaChain] = await Promise.all([
      adminRegistrations({
        q: one(sp.q)?.trim() || undefined,
        stage: wordOf(sp.stage, AdminOrgStage.options),
        domain: wordOf(sp.domain, Domain.options),
        provinceId,
        districtId,
        createdFrom: sinceDay(sp.since),
        page: pageOf(sp.page),
      }),
      placeChainOf({ province: provinceId, district: districtId }),
    ]);
    return <RegistrationsView list={list} areaChain={areaChain} />;
  } catch (error) {
    if (error instanceof ApiError && error.forbidden) {
      return (
        <PageContent>
          <PageHeader title="Businesses" />
          <EmptyBlock icon="ShieldKeyhole" title="Your staff role cannot see businesses" />
        </PageContent>
      );
    }
    throw error;
  }
}

export const dynamic = "force-dynamic";
