import { AdminAccountKind, AdminAccountStatus, type AdminCustomRole } from "@injishi/contracts";
import { screens } from "@injishi/data";
import type { Metadata } from "next";
import { PeopleView } from "@/features/admin/people/PeopleView";
import { Refused } from "@/features/admin/people/Refused";
import { requirePersona } from "@/lib/session";
import { staffAccess } from "@/server/admin/leaders";
import { people, roleCatalog } from "@/server/admin/people";
import { ApiError } from "@/server/api";

export const metadata: Metadata = { title: screens.AdminPeople.pageTitle };

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);
const SORTS = new Set(["name", "email", "createdAt", "lastSignInAt"]);

/**
 * People, read from the admin API as this staffer: every account, one page at a time, filtered by what the
 * URL carries (`q`, `kind`, `status`, `role`, `sort`, `dir`, `page`) so a filtered page can be shared.
 */
export default async function AdminPeoplePage({ searchParams }: { searchParams: Promise<Search> }) {
  await requirePersona("AdminPeople");
  const sp = await searchParams;
  const kind = AdminAccountKind.safeParse(one(sp.kind));
  const status = AdminAccountStatus.safeParse(one(sp.status));
  const sort = one(sp.sort);
  const filters = {
    q: one(sp.q)?.trim() ?? "",
    kind: kind.success ? kind.data : "",
    status: status.success ? status.data : "",
    role: one(sp.role)?.trim().slice(0, 64) ?? "",
    sort: sort && SORTS.has(sort) ? sort : "",
    dir: one(sp.dir) === "asc" ? "asc" : one(sp.dir) === "desc" ? "desc" : "",
    page: Math.max(1, Number(one(sp.page)) || 1),
  };
  try {
    const access = await staffAccess();
    const [list, catalog] = await Promise.all([
      people({
        q: filters.q,
        kind: kind.success ? kind.data : undefined,
        status: status.success ? status.data : undefined,
        role: filters.role || undefined,
        sort: (filters.sort || undefined) as "name" | undefined,
        dir: (filters.dir || undefined) as "asc" | undefined,
        page: filters.page,
      }),
      access.permissions.includes("admin.role.view") ? roleCatalog() : Promise.resolve(null),
    ]);
    const customRoles: AdminCustomRole[] = catalog?.custom ?? [];
    return (
      <PeopleView
        list={list}
        filters={filters}
        customRoles={customRoles}
        canCreate={access.permissions.includes("admin.user.role.grant")}
      />
    );
  } catch (error) {
    if (error instanceof ApiError && error.forbidden) return <Refused code={error.code} />;
    throw error;
  }
}
