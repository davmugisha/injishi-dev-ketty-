import { screens } from "@injishi/data";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { tenantHomeHref } from "@/features/leases/shared";
import { TenantChooserView } from "@/features/tenant/TenantChooserView";
import { currentAccount, requirePersona } from "@/lib/session";
import { tenancyList } from "@/server/tenant/tenancies";

export const metadata: Metadata = { title: screens.TenantHome.pageTitle };

/** My home: one home and nothing waiting opens it; else the homes and the leases waiting to be accepted. */
export default async function TenantHomePage() {
  await requirePersona("TenantHome");
  const [account, list] = await Promise.all([currentAccount(), tenancyList()]);
  // The newest live tenancy first; a cancelled or ended one stays reachable from the list.
  if (list.invitations.length === 0 && list.tenancies.length === 1) redirect(tenantHomeHref(list.tenancies[0].id));
  return (
    <TenantChooserView
      firstName={account?.user.name?.trim().split(/\s+/)[0] ?? ""}
      tenancies={list.tenancies}
      invitations={list.invitations}
    />
  );
}

export const dynamic = "force-dynamic";
