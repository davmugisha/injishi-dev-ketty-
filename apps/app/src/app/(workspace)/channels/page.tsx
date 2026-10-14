import { screens } from "@injishi/data";
import type { Channel, ChannelSource, ChannelSyncEntry, DistributionSettings } from "@injishi/data/fixtures/operations";
import { getCollection, getDocument } from "@injishi/db";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChannelsView } from "@/features/operations/ChannelsView";
import { requirePersona } from "@/lib/session";

export const metadata: Metadata = { title: screens.Channels.pageTitle };

export default async function ChannelsPage() {
  const persona = await requirePersona("Channels");
  const [channels, syncLog, sources, settings] = await Promise.all([
    getCollection<Channel>("operations.channels"),
    getCollection<ChannelSyncEntry>("operations.channelSyncLog"),
    getCollection<ChannelSource>("operations.channelSources"),
    getDocument<DistributionSettings>("operations.distributionSettings", "isangano"),
  ]);
  if (!settings) notFound();
  return <ChannelsView persona={persona} data={{ channels, syncLog, sources, settings }} />;
}
