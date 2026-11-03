import { PSF_STANDING_LABEL, type PsfStanding } from "@injishi/contracts";
import { screens } from "@injishi/data";
import { EmptyBlock, PageContent, PageHeader } from "@injishi/ui";
import type { Metadata } from "next";
import { AdminPsfView, type AdminPsfFilter } from "@/features/admin/psf/AdminPsfView";
import { requirePersona } from "@/lib/session";
import { psfBusinesses, psfSummary } from "@/server/admin/psf";
import { ApiError } from "@/server/api";

export const metadata: Metadata = { title: screens.AdminPsf.pageTitle };

/** PSF memberships across Rwanda, with what is due for renewal, read from the admin API as this staffer. */
export default async function AdminPsfPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; standing?: string; renewal?: string; cursor?: string }>;
}) {
  await requirePersona("AdminPsf");
  const { q = "", standing: rawStanding = "", renewal = "", cursor } = await searchParams;
  const filter: AdminPsfFilter =
    renewal === "due" ? "renewal_due" : rawStanding in PSF_STANDING_LABEL ? (rawStanding as PsfStanding) : "";
  try {
    const [summary, page] = await Promise.all([
      psfSummary(),
      psfBusinesses({
        q,
        cursor,
        renewal: filter === "renewal_due" ? "due" : undefined,
        standing: filter && filter !== "renewal_due" ? filter : undefined,
      }),
    ]);
    return <AdminPsfView summary={summary} page={page} q={q} filter={filter} />;
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
