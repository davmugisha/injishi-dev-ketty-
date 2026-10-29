import { screens } from "@injishi/data";
import type { Folio } from "@injishi/data/fixtures/finance";
import { FoliosView } from "@injishi/product-pms/web";
import type { Metadata } from "next";
import { PmsMount } from "@/features/pms/pms-mount";
import { requirePersona } from "@/lib/session";
import { getCollection } from "@/server/data";

export const metadata: Metadata = { title: screens.Folios.pageTitle };

export default async function FoliosPage() {
  await requirePersona("Folios");
  const folios = await getCollection<Folio>("finance.folios");
  return (
    <PmsMount>
      <FoliosView folios={folios} />
    </PmsMount>
  );
}
