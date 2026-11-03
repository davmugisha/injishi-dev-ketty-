import type { Metadata } from "next";
import { BrokerBookingsView } from "@/features/broker/broker-bookings-view";
import { NotABroker } from "@/features/broker/shared";
import { requirePersona } from "@/lib/session";
import { brokerBookings, brokerCommissions, brokerPayoutAccount, brokerScope } from "@/server/broker/client";

export const metadata: Metadata = { title: "Bookings" };

export default async function BrokerBookingsPage() {
  await requirePersona("BrokerBookings");
  if (!(await brokerScope())) return <NotABroker title="Bookings" />;
  const [data, commissions, account] = await Promise.all([
    brokerBookings(),
    brokerCommissions(),
    brokerPayoutAccount(),
  ]);
  return <BrokerBookingsView data={data} commissions={commissions} account={account} />;
}

export const dynamic = "force-dynamic";
