import { screens } from "@injishi/data";
import type { DirectoryGuest, GuestProfile, ViewPurpose } from "@injishi/data/fixtures/stays";
import { GuestsView } from "@injishi/product-pms/web";
import type { Metadata } from "next";
import { PmsMount } from "@/features/pms/pms-mount";
import { requirePersona } from "@/lib/session";
import { getCollection } from "@/server/data";

export const metadata: Metadata = { title: screens.Guests.pageTitle };

export default async function GuestsPage() {
  const persona = await requirePersona("Guests");
  const [directory, profiles, purposes] = await Promise.all([
    getCollection<DirectoryGuest>("stays.directory"),
    getCollection<GuestProfile>("stays.guestProfiles"),
    getCollection<ViewPurpose>("stays.viewPurposes"),
  ]);
  return (
    <PmsMount>
      <GuestsView persona={persona} directory={directory} profiles={profiles} purposes={purposes} />
    </PmsMount>
  );
}
