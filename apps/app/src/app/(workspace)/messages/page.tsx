import { screens } from "@injishi/data";
import type { MessageTemplate, MessageThread } from "@injishi/data/fixtures/stays";
import type { Metadata } from "next";
import { LandlordMessagesView } from "@/features/messages/LandlordMessagesView";
import { NoRentalsBusiness } from "@/features/rentals/shared";
import { MessagesView } from "@/features/stays/MessagesView";
import { currentAccount, currentPersona, requirePersona } from "@/lib/session";
import { getCollection, requestContext } from "@/server/data";
import { landlordThread, landlordThreads } from "@/server/messages";
import { landlordScope, orNull } from "@/server/rentals/client";
import { deskPropertyName } from "@/server/sources/frontdesk";

export const metadata: Metadata = { title: screens.Messages.pageTitle };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The landlord's conversations with tenants (`?lease=` opens one); the hotel desk's guest inbox otherwise. */
export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ lease?: string }> }) {
  if ((await currentPersona())?.id === "landlord") return LandlordMessages(await searchParams);
  const persona = await requirePersona("Messages");
  const [threads, templates] = await Promise.all([
    getCollection<MessageThread>("stays.threads"),
    getCollection<MessageTemplate>("stays.messageTemplates"),
  ]);
  // The property is the desk's own read (the conversations above were read against the same board).
  const property = await deskPropertyName(await requestContext());
  return <MessagesView persona={persona} threads={threads} templates={templates} property={property} />;
}

async function LandlordMessages(query: { lease?: string }) {
  await requirePersona("LandlordMessages");
  const scope = await landlordScope();
  if (!scope) return <NoRentalsBusiness title="Messages" />;
  const leaseId = query.lease && UUID.test(query.lease) ? query.lease : null;
  const [list, open, account] = await Promise.all([
    landlordThreads(),
    leaseId ? orNull(landlordThread(leaseId)) : Promise.resolve(null),
    currentAccount(),
  ]);
  return (
    <LandlordMessagesView
      key={open?.leaseId ?? "none"}
      list={list}
      open={open}
      workspaceId={scope.workspace.workspaceId}
      selfName={account?.user.name ?? null}
    />
  );
}

export const dynamic = "force-dynamic";
