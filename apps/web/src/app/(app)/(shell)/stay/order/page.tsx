import type { Metadata } from "next";

import { OrderScreen } from "./order-screen";

export const metadata: Metadata = {
  title: "Room service",
  description:
    "The bar and restaurant card for the hotel you are checked into, ordered to your room.",
};

/**
 * Room service, for the hotel the guest is actually in.
 *
 * IT IS A CHILD OF `/stay` RATHER THAN A SIBLING, and the nesting is the
 * argument: there is no such thing as room service without a room. The screen
 * reads the same stay record its parent does, and a person who arrives here
 * with no stay is offered the same check-in panel rather than an empty menu.
 *
 * Server shell, client screen, for the reason given on `/stay/page.tsx`: the
 * cart and the stay both live in the browser, and `metadata` cannot come out of
 * a client component.
 */
export default function Page() {
  return <OrderScreen />;
}
