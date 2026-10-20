import { screens } from "@injishi/data";
import type { MessageTemplate, MessageThread } from "@injishi/data/fixtures/stays";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MessagesView } from "@/features/stays/MessagesView";
import { requirePersona } from "@/lib/session";
import { getCollection } from "@/server/data";

export const metadata: Metadata = { title: screens.Messages.pageTitle };

export default async function MessagesPage() {
  const persona = await requirePersona("Messages");
  const [threads, templates] = await Promise.all([
    getCollection<MessageThread>("stays.threads"),
    getCollection<MessageTemplate>("stays.messageTemplates"),
  ]);
  if (!threads.length) notFound();
  return <MessagesView persona={persona} threads={threads} templates={templates} />;
}
