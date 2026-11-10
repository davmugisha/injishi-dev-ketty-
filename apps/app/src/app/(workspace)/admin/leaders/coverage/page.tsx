import { screens } from "@injishi/data";
import { EmptyBlock, PageContent, PageHeader } from "@injishi/ui";
import type { Metadata } from "next";
import { CoverageView } from "@/features/admin/leaders/CoverageView";
import { requirePersona } from "@/lib/session";
import { governmentBodies, leaderCoverage, placeChainOf, staffAccess } from "@/server/admin/leaders";
import { idOf, type Search } from "@/server/admin/list";
import { ApiError } from "@/server/api";

export const metadata: Metadata = { title: screens.AdminCoverage.pageTitle };

/** Local leader coverage (P5), read from the admin API as this staffer. */
export default async function AdminCoveragePage({ searchParams }: { searchParams: Promise<Search> }) {
  await requirePersona("AdminCoverage");
  const sp = await searchParams;
  const provinceId = idOf(sp.provinceId);
  const districtId = provinceId ? idOf(sp.districtId) : undefined;
  try {
    const [coverage, access, areaChain, bodies] = await Promise.all([
      leaderCoverage(),
      staffAccess(),
      placeChainOf({ province: provinceId, district: districtId }),
      governmentBodies().catch(() => []),
    ]);
    return (
      <CoverageView
        coverage={coverage}
        canAppoint={access.permissions.includes("admin.user.role.grant")}
        areaChain={areaChain}
        bodies={bodies}
      />
    );
  } catch (error) {
    if (error instanceof ApiError && error.forbidden) {
      return (
        <PageContent>
          <PageHeader title="Coverage" />
          <EmptyBlock
            icon="ShieldKeyhole"
            title="Your staff role cannot see coverage"
            description="Ask a super admin for access to people and roles."
          />
        </PageContent>
      );
    }
    throw error;
  }
}
