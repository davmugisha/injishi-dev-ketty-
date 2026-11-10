import { screens } from "@injishi/data";
import type { HelpdeskTicket, StaffAsset } from "@injishi/data/fixtures/payroll";
import type { Employee } from "@injishi/data/fixtures/people";
import { StaffServicesView } from "@injishi/product-hr/web";
import type { Metadata } from "next";
import { HrMount } from "@/features/hr/hr-mount";
import { requirePersona } from "@/lib/session";
import { readAnnouncementBoard } from "@/server/announcements";
import { getCollection, requestContext } from "@/server/data";
import { hrFeaturesOff } from "@/server/hr-features";

export const metadata: Metadata = { title: screens.StaffServices.pageTitle };

export default async function StaffServicesPage() {
  await requirePersona("StaffServices");
  const [tickets, assets, employees, ctx] = await Promise.all([
    getCollection<HelpdeskTicket>("payroll.helpdeskTickets"),
    getCollection<StaffAsset>("payroll.staffAssets"),
    getCollection<Employee>("people.employees"),
    requestContext(),
  ]);
  // Who can be lent something: the people still working here.
  const people = employees
    .filter((e) => e.status !== "leaving")
    .map((e) => ({ id: e.id, name: e.name, title: e.position }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const { announcements, audience } = await readAnnouncementBoard(ctx, people);
  return (
    <HrMount off={await hrFeaturesOff()}>
      <StaffServicesView data={{ tickets, assets, announcements, audience }} people={people} today={ctx.today.iso} />
    </HrMount>
  );
}
