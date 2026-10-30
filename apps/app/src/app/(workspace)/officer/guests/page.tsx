import { LeaderGuestQuery, LeaderGuestTab } from "@injishi/contracts";
import { screens } from "@injishi/data";
import { EmptyBlock, PageContent, PageHeader } from "@injishi/ui";
import type { Metadata } from "next";
import { LeaderGuestsView } from "@/features/oversight/guests/LeaderGuestsView";
import { requirePersona } from "@/lib/session";
import { leaderGuest, leaderGuests } from "@/server/oversight/guests";

export const metadata: Metadata = { title: screens.LeaderGuests.pageTitle };

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);

/**
 * The local leader's console (P5): the guests in their area, read from the API as this leader. A person
 * who holds no leader post is told so; the API refuses them anyway.
 */
export default async function LeaderGuestsPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requirePersona("LeaderGuests");
  const sp = await searchParams;
  const tab = LeaderGuestTab.safeParse(one(sp.tab)).success ? (one(sp.tab) as LeaderGuestTab) : "all";
  const query = LeaderGuestQuery.parse({
    tab,
    when: one(sp.when) === "later" ? "later" : "soon",
    sectorId: one(sp.sectorId),
    cellId: one(sp.cellId),
    villageId: one(sp.villageId),
    q: one(sp.q) || undefined,
    origin: ["nationals", "international"].includes(one(sp.origin) ?? "") ? one(sp.origin) : undefined,
    nationality: /^[A-Za-z]{2}$/.test(one(sp.nationality) ?? "") ? one(sp.nationality) : undefined,
    page: one(sp.page) ?? 1,
  });
  const guestId = one(sp.guest);
  const [page, openGuest] = await Promise.all([
    leaderGuests(query),
    guestId ? leaderGuest(guestId) : Promise.resolve(null),
  ]);
  if (!page) {
    return (
      <PageContent>
        <PageHeader title="Guests" />
        <EmptyBlock icon="PersonPlus" title="You do not hold a local leader post" />
      </PageContent>
    );
  }
  const exportQuery = new URLSearchParams(
    Object.entries({
      tab: query.tab,
      when: query.when,
      sectorId: query.sectorId,
      cellId: query.cellId,
      villageId: query.villageId,
      q: query.q,
      origin: query.origin,
      nationality: query.nationality,
    }).flatMap(([k, v]) => (v === undefined ? [] : [[k, String(v)]])),
  );
  return <LeaderGuestsView page={page} openGuest={openGuest} exportHref={`/api/oversight/guests.csv?${exportQuery}`} />;
}
