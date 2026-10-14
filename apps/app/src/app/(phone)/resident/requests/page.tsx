import { screens } from "@injishi/data";
import type {
  RepairCategory,
  RepairDraft,
  RepairRequest,
  Tenancy,
  VisitorDraft,
  VisitorPass,
} from "@injishi/data/fixtures/resident";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TenantRequestsView } from "@/features/resident/TenantRequestsView";
import { requirePersona } from "@/lib/session";
import { getCollection } from "@/server/data";

export const metadata: Metadata = { title: screens.TenantRequests.pageTitle };

export default async function TenantRequestsPage() {
  const persona = await requirePersona("TenantRequests");
  const [tenancies, categories, drafts, repairs, visitorDrafts, visitors] = await Promise.all([
    getCollection<Tenancy>("resident.tenancies"),
    getCollection<RepairCategory>("resident.repairCategories"),
    getCollection<RepairDraft>("resident.repairDrafts"),
    getCollection<RepairRequest>("resident.repairs"),
    getCollection<VisitorDraft>("resident.visitorDrafts"),
    getCollection<VisitorPass>("resident.visitors"),
  ]);
  const tenancy = tenancies.find((t) => t.persona === persona.id) ?? tenancies[0];
  const draft = drafts[0];
  const visitorDraft = visitorDrafts[0];
  if (!tenancy || !draft || !visitorDraft || !categories.length) notFound();
  return (
    <TenantRequestsView
      tenancy={tenancy}
      categories={categories}
      draft={draft}
      repairs={repairs}
      visitorDraft={visitorDraft}
      visitors={visitors}
    />
  );
}
