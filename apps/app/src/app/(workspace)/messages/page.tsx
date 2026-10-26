import { screens } from "@injishi/data";
import type { MessageTemplate, MessageThread } from "@injishi/data/fixtures/stays";
import type { Metadata } from "next";
import { MessagesView } from "@/features/stays/MessagesView";
import { requirePersona } from "@/lib/session";
import { getCollection, requestContext } from "@/server/data";
import { deskPropertyName } from "@/server/sources/frontdesk";

export const metadata: Metadata = { title: screens.Messages.pageTitle };

export default async function MessagesPage() {
  const persona = await requirePersona("Messages");
  const [threads, templates] = await Promise.all([
    getCollection<MessageThread>("stays.threads"),
    getCollection<MessageTemplate>("stays.messageTemplates"),
  ]);
  // The property is the desk's own read (the conversations above were read against the same board).
  const property = await deskPropertyName(await requestContext());
  return <MessagesView persona={persona} threads={threads} templates={templates} property={property} />;
}
