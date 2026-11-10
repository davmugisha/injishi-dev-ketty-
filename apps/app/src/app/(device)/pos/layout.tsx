import { ORG_ROLE_LABEL, type OrgRole } from "@injishi/contracts";
import type { ReactNode } from "react";
import { type PosMe, PosMeProvider } from "@/features/pos/pos-me";
import { currentAccount } from "@/lib/session";

/**
 * Every POS screen knows who is signed in, for the sidebar's user card (name, role, sign out). Reading the account
 * here once spares every page threading it through; a page still signs the person in or refuses them itself.
 */
export default async function PosLayout({ children }: { children: ReactNode }) {
  const account = await currentAccount();
  let me: PosMe | null = null;
  if (account) {
    const held = account.workspaces.filter((w) => w.kind === "business" && w.domain === "hospitality");
    const active = account.context?.activeWorkspaceId;
    const workspace = held.find((w) => w.workspaceId === active) ?? held[0];
    const role = workspace?.orgRole ?? null;
    me = {
      name: account.user.name || account.user.email,
      role: role && role in ORG_ROLE_LABEL ? ORG_ROLE_LABEL[role as OrgRole] : (account.persona.role ?? "Staff"),
    };
  }
  return <PosMeProvider me={me}>{children}</PosMeProvider>;
}
