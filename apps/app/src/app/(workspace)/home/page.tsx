import { screens } from "@injishi/data";
import type { Metadata } from "next";
import { type HomeInvitation, type HomeTenancy, TenantHomeView } from "@/features/rentals/TenantHomeView";
import { currentAccount, currentApi, requirePersona } from "@/lib/session";
import { ApiError } from "@/server/api";

export const metadata: Metadata = { title: screens.TenantHome.pageTitle };

/** What `GET /me/tenancies` answers, as far as this page reads it. */
interface Tenancies {
  tenancies: HomeTenancy[];
  invitations: HomeInvitation[];
}

/** My home: the person's tenancies (`/me/tenancies`, else the summary `/me/context` carries). */
export default async function TenantHomePage() {
  await requirePersona("TenantHome");
  const [account, api] = await Promise.all([currentAccount(), currentApi()]);
  // An API without the tenant's routes yet (404) falls back to the summary `/me/context` carries.
  const list = await api.get<Tenancies>("/api/v1/me/tenancies").catch((error: unknown) => {
    if (error instanceof ApiError && error.notFound) return null;
    throw error;
  });
  const tenancies: HomeTenancy[] =
    list?.tenancies ?? (account?.context?.tenancies ?? []).map((t) => ({ ...t, id: t.leaseId }));
  return (
    <TenantHomeView
      firstName={account?.user.name?.trim().split(/\s+/)[0] ?? ""}
      tenancies={tenancies}
      invitations={list?.invitations ?? []}
    />
  );
}

export const dynamic = "force-dynamic";
