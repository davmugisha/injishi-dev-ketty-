import { screens } from "@injishi/data";
import { EmptyBlock, PageContent, PageHeader } from "@injishi/ui";
import type { Metadata } from "next";
import { CoverageView } from "@/features/admin/leaders/CoverageView";
import { requirePersona } from "@/lib/session";
import { leaderCoverage, staffAccess } from "@/server/admin/leaders";
import { ApiError } from "@/server/api";

export const metadata: Metadata = { title: screens.AdminCoverage.pageTitle };

/** Local leader coverage (P5), read from the admin API as this staffer. */
export default async function AdminCoveragePage() {
  await requirePersona("AdminCoverage");
  try {
    const [coverage, access] = await Promise.all([leaderCoverage(), staffAccess()]);
    return <CoverageView coverage={coverage} canAppoint={access.permissions.includes("admin.user.role.grant")} />;
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
