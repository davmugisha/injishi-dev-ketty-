/**
 * Search — the Explore sheet. Where, when, who.
 *
 * Registered in `app/_layout.tsx` as a `formSheet` with the [0.55, 0.95]
 * detents and the platform grabber (decision D8), so the presentation is the
 * system's; `ExploreSearchSheet` draws only what goes inside it.
 */
import { ExploreSearchSheet } from '@/screens/guest/explore-search-sheet';

export default function SearchScreen() {
  return <ExploreSearchSheet />;
}
