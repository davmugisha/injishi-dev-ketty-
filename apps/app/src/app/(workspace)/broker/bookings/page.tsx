import type { Metadata } from "next";
import { BrokerBookingsView } from "@/features/broker/broker-bookings-view";
import { NotABroker } from "@/features/broker/shared";
import { requirePersona } from "@/lib/session";
import { brokerBookings, brokerScope } from "@/server/broker/client";

export const metadata: Metadata = { title: "Bookings" };

export default async function BrokerBookingsPage() {
  await requirePersona("BrokerBookings");
  if (!(await brokerScope())) return <NotABroker title="Bookings" />;
  return <BrokerBookingsView data={await brokerBookings()} />;
}

export const dynamic = "force-dynamic";
