import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BrokerBookingView } from "@/features/broker/broker-bookings-view";
import { NotABroker } from "@/features/broker/shared";
import { requirePersona } from "@/lib/session";
import { brokerBooking, brokerScope, orMissing } from "@/server/broker/client";

export const metadata: Metadata = { title: "Booking" };

export default async function BrokerBookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePersona("BrokerBookings");
  if (!(await brokerScope())) return <NotABroker title="Booking" />;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const group = await orMissing(brokerBooking(id));
  if (!group) notFound();
  return <BrokerBookingView group={group} />;
}

export const dynamic = "force-dynamic";
