import { screens } from "@injishi/data";
import type { Metadata } from "next";
import { PeopleView } from "@/features/admin/people/PeopleView";
import { Refused } from "@/features/admin/people/Refused";
import { requirePersona } from "@/lib/session";
import { ApiError } from "@/server/api";
import { staffAccess } from "@/server/admin/leaders";
import { people } from "@/server/admin/people";

export const metadata: Metadata = { title: screens.AdminPeople.pageTitle };

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);

/**
 * People (2026-10-29), read from the admin API as this staffer: every account, searchable. It was a page of
 * sample staff and brokers whose buttons did nothing.
 */
export default async function AdminPeoplePage({ searchParams }: { searchParams: Promise<Search> }) {
  await requirePersona("AdminPeople");
  const sp = await searchParams;
  const q = one(sp.q)?.trim() ?? "";
  const page = Math.max(1, Number(one(sp.page)) || 1);
  try {
    const [list, access] = await Promise.all([people(q, page), staffAccess()]);
    return <PeopleView list={list} q={q} canCreate={access.permissions.includes("admin.user.role.grant")} />;
  } catch (error) {
    if (error instanceof ApiError && error.forbidden) return <Refused code={error.code} />;
    throw error;
  }
}
