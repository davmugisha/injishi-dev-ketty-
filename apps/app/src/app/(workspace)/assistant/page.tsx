import { screens } from "@injishi/data";
import type { AssistantConversation } from "@injishi/data/fixtures/platformops";
import { getCollection } from "@injishi/db";
import type { Metadata } from "next";
import { AssistantView } from "@/features/platformops/AssistantView";
import { requirePersona } from "@/lib/session";

export const metadata: Metadata = { title: screens.Assistant.pageTitle };

export default async function AssistantPage({ searchParams }: { searchParams: Promise<{ handoff?: string }> }) {
  await requirePersona("Assistant");
  const { handoff } = await searchParams;
  const conversations = await getCollection<AssistantConversation>("platformops.conversations");
  return <AssistantView data={{ conversations }} handoff={handoff === "true"} />;
}
