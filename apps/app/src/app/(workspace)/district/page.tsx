import { screens } from "@injishi/data";
import type {
  AccessReviewItem,
  DistrictOfficer,
  DistrictSector,
  GovernmentBody,
  OfficerPermission,
} from "@injishi/data/fixtures/oversight";
import type { Metadata } from "next";
import { DistrictAdminView } from "@/features/oversight/DistrictAdminView";
import { requirePersona } from "@/lib/session";
import { getCollection } from "@/server/data";

export const metadata: Metadata = { title: screens.DistrictAdmin.pageTitle };

/** Government bodies and the officers assigned to them, inside the district mandate. */
export default async function DistrictAdminPage() {
  await requirePersona("DistrictAdmin");
  const [bodies, officers, permissions, review, sectors] = await Promise.all([
    getCollection<GovernmentBody>("oversight.bodies"),
    getCollection<DistrictOfficer>("oversight.officers"),
    getCollection<OfficerPermission>("oversight.permissions"),
    getCollection<AccessReviewItem>("oversight.accessReview"),
    getCollection<DistrictSector>("oversight.districtSectors"),
  ]);
  return <DistrictAdminView data={{ bodies, officers, permissions, review, sectors }} />;
}
