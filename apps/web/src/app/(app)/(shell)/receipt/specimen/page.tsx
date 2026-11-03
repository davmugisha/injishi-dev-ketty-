import { notFound } from "next/navigation";
import { fetchPlatform, isDemo } from "@/data/platform";
import { SpecimenGallery } from "@/components/receipt/specimen-gallery";

/**
 * `/receipt/specimen` — the specification's own worked examples, rendered by
 * the same component a guest's receipt goes through.
 *
 * A STATIC segment beside `[reference]`, which Next resolves in favour of the
 * static one. That is safe rather than lucky: a booking reference is
 * `BK-XXXX-XXXX` (`server/api`'s own generator), so no booking can ever be
 * shadowed by this page.
 *
 * Why it exists at all is in `specimen-gallery.tsx`: the API issues `NS` and
 * nothing else, so five of the six receipt types — and the whole of clause 11
 * with them — are otherwise unreachable and unreviewable.
 */
export const metadata = { title: "RRA receipt specimens" };

/**
 * The RRA spec's own example receipts (a "Trade Name", TIN 000000000), for a
 * reviewer comparing layouts. Sample data, so only on a demo stack: on a real
 * one it is not a page (2026-10-29).
 */
export default async function Page() {
  if (!isDemo(await fetchPlatform())) notFound();
  return <SpecimenGallery />;
}
