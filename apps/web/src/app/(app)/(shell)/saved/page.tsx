import type { Metadata } from "next";

import { SavedCollection } from "@/components/collections/saved-collection";

export const metadata: Metadata = {
  title: "Saved",
  description: "The stays you have saved, grouped into trips.",
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
 */
export default function Page() {
  return (
    <div className="page-y container">
      <SavedCollection />
    </div>
  );
}
