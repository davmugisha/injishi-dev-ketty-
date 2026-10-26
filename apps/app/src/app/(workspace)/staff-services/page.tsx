import { screens } from "@injishi/data";
import type { HelpdeskTicket, HrAutomation, HrReport, StaffAsset } from "@injishi/data/fixtures/payroll";
import type { Metadata } from "next";
import { StaffServicesView } from "@/features/payroll/StaffServicesView";
import { requirePersona } from "@/lib/session";
import { getCollection } from "@/server/data";

export const metadata: Metadata = { title: screens.StaffServices.pageTitle };

export default async function StaffServicesPage() {
  const persona = await requirePersona("StaffServices");
  const [tickets, assets, reports, automations] = await Promise.all([
    getCollection<HelpdeskTicket>("payroll.helpdeskTickets"),
    getCollection<StaffAsset>("payroll.staffAssets"),
    getCollection<HrReport>("payroll.hrReports"),
    getCollection<HrAutomation>("payroll.hrAutomations"),
  ]);
  return <StaffServicesView persona={persona} data={{ tickets, assets, reports, automations }} />;
}
