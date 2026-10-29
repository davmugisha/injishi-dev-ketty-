import { OversightAppointmentQuery, OversightRole } from "@injishi/contracts";
import { screens } from "@injishi/data";
import { EmptyBlock, PageContent, PageHeader } from "@injishi/ui";
import type { Metadata } from "next";
import type { AppointPrefill } from "@/features/admin/leaders/AppointPanel";
import { LeadersView } from "@/features/admin/leaders/LeadersView";
import { requirePersona } from "@/lib/session";
import { appointments, governmentBodies, placeChainOf, staffAccess } from "@/server/admin/leaders";
import { ApiError } from "@/server/api";

export const metadata: Metadata = { title: screens.AdminLeaders.pageTitle };

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);
const num = (v: string | undefined): number | undefined => (v && /^\d+$/.test(v) ? Number(v) : undefined);

/** Local leaders and officers (P5), read from the admin API as this staffer. */
export default async function AdminLeadersPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requirePersona("AdminLeaders");
  const sp = await searchParams;
  const parsed = OversightAppointmentQuery.safeParse({
    kind: one(sp.kind),
    role: one(sp.role),
    provinceId: one(sp.provinceId),
    districtId: one(sp.districtId),
    sectorId: one(sp.sectorId),
    cellId: one(sp.cellId),
    villageId: one(sp.villageId),
    q: one(sp.q),
  });
  const query = parsed.success ? parsed.data : {};
  try {
    const appointRole = OversightRole.safeParse(one(sp.appoint));
    const [list, bodies, access, areaChain, appointChain] = await Promise.all([
      appointments(query),
      governmentBodies().catch(() => []),
      staffAccess(),
      placeChainOf({
        province: query.provinceId,
        district: query.districtId,
        sector: query.sectorId,
        cell: query.cellId,
        village: query.villageId,
      }),
      appointRole.success
        ? placeChainOf({
            province: num(one(sp.aProvinceId)),
            district: num(one(sp.aDistrictId)),
            sector: num(one(sp.aSectorId)),
            cell: num(one(sp.aCellId)),
            village: num(one(sp.aVillageId)),
          })
        : Promise.resolve({}),
    ]);
    const initialAppoint: AppointPrefill | null = appointRole.success
      ? { role: appointRole.data, chain: appointChain }
      : null;
    return (
      <LeadersView
        list={list}
        bodies={bodies}
        canAppoint={access.permissions.includes("admin.user.role.grant")}
        areaChain={areaChain}
        initialAppoint={initialAppoint}
      />
    );
  } catch (error) {
    if (error instanceof ApiError && error.forbidden) {
      return (
        <PageContent>
          <PageHeader title="Local leaders and officers" />
          <EmptyBlock
            icon="ShieldKeyhole"
            title={
              error.code === "two_factor_required"
                ? "Enter the code we emailed you"
                : "Your staff role cannot see appointments"
            }
            description={
              error.code === "two_factor_required"
                ? "Sign in again to get a code, then come back."
                : "Ask a super admin for access to people and roles."
            }
          />
        </PageContent>
      );
    }
    throw error;
  }
}
