import { screens } from "@injishi/data";
import type {
  GuestMessage,
  GuestStayRecord,
  NotifyChannel,
  RequestType,
  ServiceRequest,
  UpdateDelivery,
} from "@injishi/data/fixtures/guest";
import { getCollection } from "@injishi/db";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GuestRequestsView } from "@/features/guest/GuestRequestsView";
import { requirePersona } from "@/lib/session";

export const metadata: Metadata = { title: screens.GuestRequests.pageTitle };

export default async function GuestRequestsPage() {
  await requirePersona("GuestRequests");
  const [stays, types, requests, messages, channels, deliveries] = await Promise.all([
    getCollection<GuestStayRecord>("guest.stays"),
    getCollection<RequestType>("guest.requestTypes"),
    getCollection<ServiceRequest>("guest.serviceRequests"),
    getCollection<GuestMessage>("guest.messages"),
    getCollection<NotifyChannel>("guest.notifyChannels"),
    getCollection<UpdateDelivery>("guest.updateDeliveries"),
  ]);
  const stay = stays[0];
  if (!stay || !types.length) notFound();
  return (
    <GuestRequestsView
      data={{
        stay,
        types,
        requests,
        messages: messages.filter((m) => m.thread === "stay"),
        channels,
        deliveries,
      }}
    />
  );
}
