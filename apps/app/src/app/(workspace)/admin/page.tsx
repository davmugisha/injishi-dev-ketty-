import { screens } from "@injishi/data";
import type { AdminKpi, Deploy, OnCallShift, TriageItem, ViewAsSession } from "@injishi/data/fixtures/admin";
import { getCollection } from "@injishi/db";
import type { Metadata } from "next";
import { AdminHomeView } from "@/features/admin/AdminHomeView";
import { requirePersona } from "@/lib/session";

export const metadata: Metadata = { title: screens.AdminHome.pageTitle };

export default async function AdminHomePage() {
  const persona = await requirePersona("AdminHome");
  const [kpis, items, deploys, onCall, sessions] = await Promise.all([
    getCollection<AdminKpi>("admin.homeKpis"),
    getCollection<TriageItem>("admin.triageItems"),
    getCollection<Deploy>("admin.deploys"),
    getCollection<OnCallShift>("admin.onCall"),
    getCollection<ViewAsSession>("admin.viewAsSessions"),
  ]);
  return <AdminHomeView persona={persona} data={{ kpis, items, deploys, onCall, sessions }} />;
}
