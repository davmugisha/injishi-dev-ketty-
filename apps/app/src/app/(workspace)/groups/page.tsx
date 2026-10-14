import { screens } from "@injishi/data";
import type { GroupsBlock } from "@injishi/data/fixtures/commercial";
import { getCollection } from "@injishi/db";
import type { Metadata } from "next";
import { GroupsView } from "@/features/commercial/GroupsView";
import { requirePersona } from "@/lib/session";

export const metadata: Metadata = { title: screens.Groups.pageTitle };

export default async function GroupsPage() {
  await requirePersona("Groups");
  const blocks = await getCollection<GroupsBlock>("commercial.groupsBlocks");
  return <GroupsView blocks={blocks} />;
}
