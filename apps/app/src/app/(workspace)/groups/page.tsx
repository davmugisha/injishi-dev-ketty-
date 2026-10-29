import { screens } from "@injishi/data";
import type { GroupsBlock } from "@injishi/data/fixtures/commercial";
import type { Metadata } from "next";
import { GroupsView } from "@/features/commercial/GroupsView";
import { PmsMount } from "@/features/pms/pms-mount";
import { requirePersona } from "@/lib/session";
import { getCollection } from "@/server/data";

export const metadata: Metadata = { title: screens.Groups.pageTitle };

export default async function GroupsPage() {
  await requirePersona("Groups");
  const blocks = await getCollection<GroupsBlock>("commercial.groupsBlocks");
  return (
    <PmsMount>
      <GroupsView blocks={blocks} />
    </PmsMount>
  );
}
