import { screens } from "@injishi/data";
import type {
  Business,
  Entitlement,
  KybDocumentType,
  LifecycleCount,
  ViewAsSession,
} from "@injishi/data/fixtures/admin";
import { getCollection } from "@injishi/db";
import type { Metadata } from "next";
import { AdminBusinessesView } from "@/features/admin/AdminBusinessesView";
import { requirePersona } from "@/lib/session";

export const metadata: Metadata = { title: screens.AdminBusinesses.pageTitle };

export default async function AdminBusinessesPage() {
  const persona = await requirePersona("AdminBusinesses");
  const [businesses, counts, documentTypes, entitlements, sessions] = await Promise.all([
    getCollection<Business>("admin.businesses"),
    getCollection<LifecycleCount>("admin.lifecycleCounts"),
    getCollection<KybDocumentType>("admin.kybDocumentTypes"),
    getCollection<Entitlement>("admin.entitlements"),
    getCollection<ViewAsSession>("admin.viewAsSessions"),
  ]);
  return <AdminBusinessesView persona={persona} data={{ businesses, counts, documentTypes, entitlements, sessions }} />;
}
