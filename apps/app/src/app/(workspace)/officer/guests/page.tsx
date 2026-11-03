import { screens } from "@injishi/data";
import { EmptyBlock, kigaliDay, PageContent, PageHeader } from "@injishi/ui";
import type { Metadata } from "next";
import { LeaderGuestsView } from "@/features/oversight/guests/LeaderGuestsView";
import { downloadQuery, guestListQuery } from "@/features/oversight/guests/query";
import { requirePersona } from "@/lib/session";
import { leaderGuest, leaderGuests } from "@/server/oversight/guests";

export const metadata: Metadata = { title: screens.LeaderGuests.pageTitle };

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v) || undefined;

/**
 * The local leader's console (P5): the guests in their area, read from the API as this leader. A person
 * who holds no leader post is told so; the API refuses them anyway.
 */
export default async function LeaderGuestsPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requirePersona("LeaderGuests");
  const sp = await searchParams;
  const query = guestListQuery(sp);
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
  const files = downloadQuery(query);
  return (
    <LeaderGuestsView
      page={page}
      openGuest={openGuest}
      today={kigaliDay()}
      downloads={{
        xlsx: `/api/oversight/guests.xlsx?${files}`,
        pdf: `/api/oversight/guests.pdf?${files}`,
        csv: `/api/oversight/guests.csv?${files}`,
      }}
    />
  );
}
