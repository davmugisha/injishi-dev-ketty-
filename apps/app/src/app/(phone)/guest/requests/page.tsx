import { screens } from "@injishi/data";
import type {
  GuestMessage,
  GuestStayRecord,
  NotifyChannel,
  RequestType,
  ServiceRequest,
  UpdateDelivery,
} from "@injishi/data/fixtures/guest";
import { GuestRequestsView } from "@injishi/product-pms/web";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PmsMount } from "@/features/pms/pms-mount";
import { requirePersona } from "@/lib/session";
import { getCollection } from "@/server/data";

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
    <PmsMount>
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
    </PmsMount>
  );
}
