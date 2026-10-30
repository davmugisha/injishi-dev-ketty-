import { screens } from "@injishi/data";
import type { MessageTemplate, MessageThread } from "@injishi/data/fixtures/stays";
import { MessagesView } from "@injishi/product-pms/web";
import type { Metadata } from "next";
import { NotABroker } from "@/features/broker/shared";
import {
  BrokerMessagesView,
  LandlordMessagesView,
  type OpenConversation,
} from "@/features/messages/LandlordMessagesView";
import { PmsMount } from "@/features/pms/pms-mount";
import { NoRentalsBusiness } from "@/features/rentals/shared";
import { currentAccount, currentPersona, requirePersona } from "@/lib/session";
import { brokerScope, orMissing } from "@/server/broker/client";
import { getCollection, requestContext } from "@/server/data";
import {
  brokerThread,
  brokerThreads,
  landlordPlacementThread,
  landlordPlacementThreads,
  landlordThread,
  landlordThreads,
} from "@/server/messages";
import { landlordScope, orNull } from "@/server/rentals/client";
import { deskPropertyName } from "@/server/sources/frontdesk";

export const metadata: Metadata = { title: screens.Messages.pageTitle };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Query = { lease?: string; placement?: string };

/**
 * The landlord's conversations with tenants (`?lease=` opens one) and brokers (`?placement=`), the
 * broker's with landlords (`?placement=`), the hotel desk's guest inbox otherwise.
 */
export default async function MessagesPage({ searchParams }: { searchParams: Promise<Query> }) {
  const personaId = (await currentPersona())?.id;
  if (personaId === "landlord") return LandlordMessages(await searchParams);
  if (personaId === "broker") return BrokerMessages(await searchParams);
  const persona = await requirePersona("Messages");
  const [threads, templates] = await Promise.all([
    getCollection<MessageThread>("stays.threads"),
    getCollection<MessageTemplate>("stays.messageTemplates"),
  ]);
  // The property is the desk's own read (the conversations above were read against the same board).
  const property = await deskPropertyName(await requestContext());
  return (
    <PmsMount>
      <MessagesView persona={persona} threads={threads} templates={templates} property={property} />
    </PmsMount>
  );
}

const uuid = (v: string | undefined) => (v && UUID.test(v) ? v : null);

async function LandlordMessages(query: Query) {
  await requirePersona("LandlordMessages");
  const scope = await landlordScope();
  if (!scope) return <NoRentalsBusiness title="Messages" />;
  const leaseId = uuid(query.lease);
  const placementId = leaseId ? null : uuid(query.placement);
  // Opening a placement's conversation makes it (the first "Message" on either side), so it is read
  // before the list, which then has it.
  const placement = placementId ? await orNull(landlordPlacementThread(placementId)) : null;
  const [list, brokers, lease, account] = await Promise.all([
    landlordThreads(),
    orNull(landlordPlacementThreads()),
    leaseId ? orNull(landlordThread(leaseId)) : Promise.resolve(null),
    currentAccount(),
  ]);
  const open: OpenConversation | null = lease
    ? { kind: "lease", view: lease }
    : placement
      ? { kind: "placement", view: placement }
      : null;
  return (
    <LandlordMessagesView
      key={lease?.leaseId ?? placement?.placementId ?? "none"}
      list={list}
      brokers={brokers}
      open={open}
      workspaceId={scope.workspace.workspaceId}
      selfName={account?.user.name ?? null}
    />
  );
}

async function BrokerMessages(query: Query) {
  await requirePersona("BrokerMessages");
  if (!(await brokerScope())) return <NotABroker title="Messages" />;
  const placementId = uuid(query.placement);
  const [open, account] = await Promise.all([
    placementId ? orMissing(brokerThread(placementId)) : Promise.resolve(null),
    currentAccount(),
  ]);
  // Read after the open, so a conversation it just made is in the list.
  const list = await brokerThreads();
  return (
    <BrokerMessagesView
      key={open?.placementId ?? "none"}
      list={list}
      open={open}
      selfName={account?.user.name ?? null}
    />
  );
}

export const dynamic = "force-dynamic";
