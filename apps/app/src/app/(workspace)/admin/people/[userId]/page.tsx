import { screens } from "@injishi/data";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PersonView } from "@/features/admin/people/PersonView";
import { currentAccount, requirePersona } from "@/lib/session";
import { ApiError } from "@/server/api";
import { staffAccess } from "@/server/admin/leaders";
import { person } from "@/server/admin/people";
import { Refused } from "@/features/admin/people/Refused";

export const metadata: Metadata = { title: screens.AdminPeople.pageTitle };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One person and every authority they hold (2026-10-29), with the controls this staffer's role allows. */
export default async function AdminPersonPage({ params }: { params: Promise<{ userId: string }> }) {
  await requirePersona("AdminPeople");
  const { userId } = await params;
  if (!UUID.test(userId)) notFound();
  try {
    const [detail, access, account] = await Promise.all([person(userId), staffAccess(), currentAccount()]);
    const can = {
      staff: access.permissions.includes("admin.user.role.grant"),
      members: access.permissions.includes("admin.business.member.manage"),
      seats: access.permissions.includes("admin.user.role.grant"),
    };
    return <PersonView person={detail} can={can} isSelf={account?.user.id === detail.id} />;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    if (error instanceof ApiError && error.forbidden) return <Refused code={error.code} />;
    throw error;
  }
}
