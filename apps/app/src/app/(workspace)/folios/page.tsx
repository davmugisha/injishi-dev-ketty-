import { screens } from "@injishi/data";
import type { Folio } from "@injishi/data/fixtures/finance";
import { getCollection } from "@injishi/db";
import type { Metadata } from "next";
import { FoliosView } from "@/features/finance/FoliosView";
import { requirePersona } from "@/lib/session";

export const metadata: Metadata = { title: screens.Folios.pageTitle };

export default async function FoliosPage() {
  await requirePersona("Folios");
  const folios = await getCollection<Folio>("finance.folios");
  return <FoliosView folios={folios} />;
}
