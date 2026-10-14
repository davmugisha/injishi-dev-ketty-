import { screens } from "@injishi/data";
import type { FoundItem, RegisterAccess } from "@injishi/data/fixtures/operations";
import { getCollection } from "@injishi/db";
import type { Metadata } from "next";
import { LostFoundView } from "@/features/operations/LostFoundView";
import { requirePersona } from "@/lib/session";

export const metadata: Metadata = { title: screens.LostFound.pageTitle };

export default async function LostFoundPage() {
  const persona = await requirePersona("LostFound");
  const [items, access] = await Promise.all([
    getCollection<FoundItem>("operations.foundItems"),
    getCollection<RegisterAccess>("operations.lostFoundAccess"),
  ]);
  return <LostFoundView persona={persona} items={items} access={access} />;
}
