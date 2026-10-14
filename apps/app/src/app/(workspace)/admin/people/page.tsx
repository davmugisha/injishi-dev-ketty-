import { screens } from "@injishi/data";
import type { AccessReview, Broker, RoleFamily, StaffMember } from "@injishi/data/fixtures/platformops";
import { getCollection } from "@injishi/db";
import type { Metadata } from "next";
import { AdminPeopleView } from "@/features/platformops/AdminPeopleView";
import { requirePersona } from "@/lib/session";

export const metadata: Metadata = { title: screens.AdminPeople.pageTitle };

export default async function AdminPeoplePage() {
  await requirePersona("AdminPeople");
  const [families, staff, reviews, brokers] = await Promise.all([
    getCollection<RoleFamily>("platformops.roleFamilies"),
    getCollection<StaffMember>("platformops.staff"),
    getCollection<AccessReview>("platformops.accessReviews"),
    getCollection<Broker>("platformops.brokers"),
  ]);
  return <AdminPeopleView data={{ families, staff, reviews, brokers }} />;
}
