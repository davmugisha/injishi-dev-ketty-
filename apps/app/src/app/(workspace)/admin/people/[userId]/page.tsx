import { screens } from "@injishi/data";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PersonView } from "@/features/admin/people/PersonView";
import { Refused } from "@/features/admin/people/Refused";
import { currentAccount, requirePersona } from "@/lib/session";
import { governmentBodies, staffAccess } from "@/server/admin/leaders";
import { activity, person, roleCatalog, signIns } from "@/server/admin/people";
import { ApiError } from "@/server/api";

export const metadata: Metadata = { title: screens.AdminPeople.pageTitle };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A read this staffer may not make is left out of the page rather than failing it. */
async function optional<T>(allowed: boolean, read: () => Promise<T>): Promise<T | null> {
  if (!allowed) return null;
  try {
    return await read();
  } catch (error) {
    if (error instanceof ApiError && error.forbidden) return null;
    throw error;
  }
}

/** One person and every authority they hold, with the controls and tabs this staffer's role allows. */
export default async function AdminPersonPage({ params }: { params: Promise<{ userId: string }> }) {
  await requirePersona("AdminPeople");
  const { userId } = await params;
  if (!UUID.test(userId)) notFound();
  try {
    const [detail, access, account] = await Promise.all([person(userId), staffAccess(), currentAccount()]);
    const has = (p: string) => access.permissions.includes(p);
    const [catalog, history, trail, bodies] = await Promise.all([
      optional(has("admin.role.view"), roleCatalog),
      optional(has("admin.user.view"), () => signIns(userId)),
      optional(has("admin.audit.read"), () => activity(userId)),
      optional(has("admin.user.role.grant"), governmentBodies),
    ]);
    return (
      <PersonView
        person={detail}
        can={{
          grant: has("admin.user.role.grant"),
          members: has("admin.business.member.manage"),
          suspend: has("admin.user.suspend"),
          sessions: has("admin.user.session.revoke"),
        }}
        isSelf={account?.user.id === detail.id}
        customRoles={catalog?.custom ?? []}
        signIns={history}
        activity={trail}
        bodies={bodies ?? []}
      />
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    if (error instanceof ApiError && error.forbidden) return <Refused code={error.code} />;
    throw error;
  }
}
