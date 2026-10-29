import { screens } from "@injishi/data";
import type { Metadata } from "next";
import { InvitationView } from "@/features/tenant/InvitationView";
import { currentAccount } from "@/lib/session";
import { invitationPreview } from "@/server/tenant/tenancies";

export const metadata: Metadata = { title: screens.LeaseInvite.pageTitle };

/** A lease invitation from its email link (public): the offer, then sign in, accept and sign. */
export default async function LeaseInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [preview, account] = await Promise.all([
    /^[A-Za-z0-9_-]{32,64}$/.test(token) ? invitationPreview(token) : Promise.resolve(null),
    currentAccount().catch(() => null),
  ]);
  return <InvitationView token={token} preview={preview} signedInAs={account?.user.email ?? null} />;
}

export const dynamic = "force-dynamic";
