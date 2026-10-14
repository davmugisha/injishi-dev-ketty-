import { screens } from "@injishi/data";
import type { GuestStayRecord, KeyAccessPoint, KeyEvent, KeyHelpNote } from "@injishi/data/fixtures/guest";
import { getCollection } from "@injishi/db";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GuestKeyView, type KeyMode } from "@/features/guest/GuestKeyView";
import { requirePersona } from "@/lib/session";

export const metadata: Metadata = { title: screens.GuestKey.pageTitle };

const MODES: KeyMode[] = ["active", "provisioning", "revoked", "unavailable"];

export default async function GuestKeyPage({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  await requirePersona("GuestKey");
  const [stays, events, access, help] = await Promise.all([
    getCollection<GuestStayRecord>("guest.stays"),
    getCollection<KeyEvent>("guest.keyEvents"),
    getCollection<KeyAccessPoint>("guest.keyAccess"),
    getCollection<KeyHelpNote>("guest.keyHelp"),
  ]);
  const stay = stays[0];
  if (!stay || !events.length) notFound();
  const { state } = await searchParams;
  return (
    <GuestKeyView
      data={{ stay, events, access, help }}
      state={MODES.includes(state as KeyMode) ? (state as KeyMode) : "active"}
    />
  );
}
