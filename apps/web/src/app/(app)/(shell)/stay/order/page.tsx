import type { Metadata } from "next";

import { OrderScreen } from "./order-screen";

export const metadata: Metadata = {
  title: "Order food and drink",
  description:
    "The outlets you can order from right now, charged to your room or paid on the spot.",
};

/**
 * Ordering during a stay, on `/api/v1/me/orderable` and `POST /api/v1/me/orders`.
 *
 * A CHILD OF `/stay`: what a guest may order depends on where they are staying,
 * and the server works that out from their open stays. A person with nowhere to
 * order from is told so, never shown a menu they cannot use.
 *
 * Server shell, client screen: the session cookie belongs to the API origin, so
 * the reads run in the browser, and `metadata` cannot come out of a client
 * component. The public property menu page links here.
 */
export default function Page() {
  return <OrderScreen />;
}
