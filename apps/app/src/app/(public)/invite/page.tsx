import { screens } from "@injishi/data";
import type { Invitation, InvitationState, InviteStatus, RoleScope } from "@injishi/data/fixtures/shared";
import { getCollection } from "@injishi/db";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InviteAcceptView } from "@/features/shared/InviteAcceptView";
import { requireScreen } from "@/lib/session";

export const metadata: Metadata = { title: screens.InviteAccept.pageTitle };

const STATUSES: InviteStatus[] = ["valid", "expired", "revoked", "accepted"];

/** Public: someone opens the invitation link from their email (no sign-in). `?status=` shows each state. */
export default async function InviteAcceptPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireScreen("InviteAccept");
  const [invitations, states, scopes] = await Promise.all([
    getCollection<Invitation>("shared.invitations"),
    getCollection<InvitationState>("shared.invitationStates"),
    getCollection<RoleScope>("shared.roleScopes"),
  ]);
  const invitation = invitations[0];
  const { status: param } = await searchParams;
  const status = STATUSES.find((s) => s === param) ?? "valid";
  const state = states.find((s) => s.id === status);
  const scope = scopes.find((s) => s.role === invitation?.role);
  if (!invitation || !state || !scope) notFound();
  return <InviteAcceptView key={status} invitation={invitation} state={state} scope={scope} />;
}
