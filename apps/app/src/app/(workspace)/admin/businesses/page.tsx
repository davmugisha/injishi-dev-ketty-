import { screens } from "@injishi/data";
import { EmptyBlock, PageContent, PageHeader } from "@injishi/ui";
import type { Metadata } from "next";
import { RegistrationsView } from "@/features/admin/registrations/RegistrationsView";
import { requirePersona } from "@/lib/session";
import { adminRegistrations } from "@/server/admin/registrations";
import { ApiError } from "@/server/api";

export const metadata: Metadata = { title: screens.AdminBusinesses.pageTitle };

/** The businesses that registered and where each stands, read from the admin API as this staffer. */
export default async function AdminBusinessesPage() {
  await requirePersona("AdminBusinesses");
  try {
    const list = await adminRegistrations();
    return <RegistrationsView orgs={list.items} />;
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
