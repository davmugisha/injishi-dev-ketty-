import { screens } from "@injishi/data";
import type { FoundItem, RegisterAccess } from "@injishi/data/fixtures/operations";
import type { Metadata } from "next";
import { LostFoundView } from "@/features/operations/LostFoundView";
import { requirePersona } from "@/lib/session";
import { getCollection, requestContext } from "@/server/data";
import { placeName } from "@/server/sources/operations";

export const metadata: Metadata = { title: screens.LostFound.pageTitle };

export default async function LostFoundPage() {
  const persona = await requirePersona("LostFound");
  const [items, access] = await Promise.all([
    getCollection<FoundItem>("operations.foundItems"),
    // Sample (deferred): shown only in the card that says so; the intake never sends anything from it.
    getCollection<RegisterAccess>("operations.lostFoundAccess"),
  ]);
  return (
    <LostFoundView persona={persona} items={items} access={access} placeName={placeName(await requestContext())} />
  );
}
