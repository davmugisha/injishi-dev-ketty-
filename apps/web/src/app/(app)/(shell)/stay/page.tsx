import type { Metadata } from "next";

import { StayScreen } from "./stay-screen";

export const metadata: Metadata = {
  title: "My stay",
  description:
    "The stay you are in today, the outlets you can order from, and the orders you have placed.",
};

/**
 * The in-house guest's hub.
 *
 * It sits in the authenticated shell beside Trips and Saved. `/trips` is every
 * stay a person has ever booked, past and future. `/stay` is the one under way
 * today, and what the guest can order during it.
 *
 * A SERVER COMPONENT WITH A CLIENT CHILD. Everything on the screen comes from
 * `/api/v1/me/*`, guarded by the session cookie on the API origin, so the
 * screen reads in the browser; `metadata` cannot be exported from a client
 * component. `?placed=<order id>` is how the order screen hands over the order
 * it just placed, so the hub can mark it in the list.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ placed?: string | string[] }>;
}) {
  const { placed } = await searchParams;
  return <StayScreen placedOrderId={typeof placed === "string" ? placed : null} />;
}
