import { staffAllows } from "@injishi/contracts";

import { SectionFailure } from "@/components/failure/section-failure";
import { listDistricts, listProvinces } from "@/lib/api/geography";
import { listTrainingVenues } from "@/lib/api/training";
import { readStaffAccess } from "@/lib/staff";

import { TrainingSubnav } from "../training-subnav";
import { VenueDirectory } from "./venue-directory";

export const metadata = { title: "Training venues" };

/**
 * Venues (ADR-049 AC-32): the places the company lets training happen.
 *
 * READABLE BY EVERYBODY IN THE SECTION, WRITABLE BY A PLATFORM ADMIN. The API
 * serves the list on `training.view`, because a trainer's session form is
 * filled from it; every write is `training.venue.manage`, which `trainer` does
 * not hold (AC-24). So the page always renders and the create, edit and retire
 * controls are drawn only for a holder of that permission, read from the
 * permissions the SERVER resolved (`StaffAccess.permissions`, request memoised
 * in `readStaffAccess`). Hiding them is the affordance; `StaffGuard` refuses
 * the write regardless.
 *
 * THE RETIRED FILTER IS A SERVER READ, `?retired=1`, not a filter over the
 * loaded page: the API excludes retired venues unless asked, which is exactly
 * what keeps one out of a trainer's picker, so asking is the only honest way
 * to show them.
 *
 * THE DISTRICTS AND PROVINCES are the geography reference data, read here so
 * the picker offers every district rather than only those some venue already
 * uses. A failed geography read leaves the list readable and says the form
 * cannot be offered, rather than offering a picker with nothing in it.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ retired?: string }>;
}) {
  const { retired } = await searchParams;
  const includeRetired = retired === "1";

  const [venues, districts, provinces, staff] = await Promise.all([
    listTrainingVenues({ includeRetired: includeRetired || undefined, pageSize: 100 }),
    listDistricts(),
    listProvinces(),
    readStaffAccess(),
  ]);

  const canManage = staffAllows(staff.access.permissions, "training.venue.manage");

  return (
    <div className="mx-auto max-w-page px-4 py-6 sm:px-6">
      <TrainingSubnav />
      {venues.ok ? (
        <VenueDirectory
          venues={venues.data.items}
          total={venues.data.meta.total}
          includeRetired={includeRetired}
          districts={districts.ok ? districts.data : null}
          provinces={provinces.ok ? provinces.data : []}
          canManage={canManage}
        />
      ) : (
        <div className="mt-8">
          <SectionFailure eyebrow="Training" reason={venues.reason} permission="training.view" />
        </div>
      )}
    </div>
  );
}
