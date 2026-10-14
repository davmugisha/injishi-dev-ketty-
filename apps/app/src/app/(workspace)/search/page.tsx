import { screens } from "@injishi/data";
import type { DeskArrival, DeskFigure, RecentSearch, SearchEntry } from "@injishi/data/fixtures/shared";
import { getCollection } from "@injishi/db";
import type { Metadata } from "next";
import { GlobalSearchView } from "@/features/shared/GlobalSearchView";
import { requirePersona } from "@/lib/session";

export const metadata: Metadata = { title: screens.GlobalSearch.pageTitle };

/** Front-desk search. The palette opens on “kimani”. */
export default async function GlobalSearchPage() {
  const persona = await requirePersona("GlobalSearch");
  const [figures, arrivals, entries, recent] = await Promise.all([
    getCollection<DeskFigure>("shared.deskFigures"),
    getCollection<DeskArrival>("shared.deskArrivals"),
    getCollection<SearchEntry>("shared.searchEntries"),
    getCollection<RecentSearch>("shared.recentSearches"),
  ]);
  return <GlobalSearchView persona={persona} data={{ figures, arrivals, entries, recent }} />;
}
