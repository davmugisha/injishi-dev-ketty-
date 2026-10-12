import type { Metadata } from "next";

import { SavedCollection } from "@/components/collections/saved-collection";
import { databaseListings } from "@/data/discovery";

export const metadata: Metadata = {
  // Not "grouped into trips": nothing groups them, and the heading that said so
  // was the capture's own ("Kigali: March trip") on everybody's list.
  title: "Saved",
  description: "The stays you have saved.",
};

/**
 * Places kept for later (ADR-018, move 4, AC-10).
 *
 * The screen itself is not new: it rendered at `/collections`, in the PUBLIC
 * group, where anybody could open somebody's saved list and where it sat outside
 * the sign-in gate. What moved is the address and the gate.
 *
 * `saved` rather than `collections` is the rename table's word, and it is what
 * people say. The breadcrumb went with the move: inside the authenticated shell
 * the sidebar already says where you are.
 *
 * The API's published properties are read here, on the server, exactly as
 * Explore reads them, so a heart placed on one of THOSE cards finds its card on
 * this list. `databaseListings` answers with an empty array when the API is
 * unreachable, so a down API shows an empty list rather than an error.
 */
export default async function Page() {
  const listings = await databaseListings();
  return (
    <div className="page-y container">
      <SavedCollection listings={listings} />
    </div>
  );
}
