import { screens } from "@injishi/data";
import type {
  RepairCategory,
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
  // The forms start empty; the visitor draft is read only for the house rule on overnight stays (its
  // maxNights is the API's MAX_OVERNIGHT_NIGHTS), never as a visitor to register.
  const [tenancies, categories, repairs, visitorDrafts, visitors] = await Promise.all([
    getCollection<Tenancy>("resident.tenancies"),
    getCollection<RepairCategory>("resident.repairCategories"),
    getCollection<RepairRequest>("resident.repairs"),
    getCollection<VisitorDraft>("resident.visitorDrafts"),
    getCollection<VisitorPass>("resident.visitors"),
  ]);
  const tenancy = tenancies.find((t) => t.persona === persona.id) ?? tenancies[0];
  const visitorDraft = visitorDrafts[0];
  if (!tenancy || !visitorDraft || !categories.length) notFound();
  return (
    <TenantRequestsView
      tenancy={tenancy}
      categories={categories}
      repairs={repairs}
      visitorDraft={visitorDraft}
      visitors={visitors}
    />
  );
}
