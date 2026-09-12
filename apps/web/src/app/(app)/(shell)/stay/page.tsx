import type { Metadata } from "next";

import { StayScreen } from "./stay-screen";

export const metadata: Metadata = {
  title: "My stay",
  description:
    "The hotel you are checked into: your room, your dates, room service and the desks you can message.",
};

/**
 * The in-house guest's hub.
 *
 * It sits in the authenticated shell beside Trips and Saved, and the split
 * between the three is worth stating because it is not obvious from the names.
 * `/trips` is every stay a person has ever booked, past and future. `/stay` is
 * the ONE they are standing in right now, and it exists as its own address
 * because what a guest wants at 21:40 on the second night — the room number,
 * the menu, the front desk — has almost nothing in common with what they want
 * when planning a trip.
 *
 * A SERVER COMPONENT WITH A CLIENT CHILD, and that shape is forced. The stay
 * and the orders both live in `localStorage`, so the screen itself has to be a
 * client component; `metadata` cannot be exported from one. The two files are
 * the smallest way to have both, and the same split is used at `/stay/order`.
 */
export default function Page() {
  return <StayScreen />;
}
