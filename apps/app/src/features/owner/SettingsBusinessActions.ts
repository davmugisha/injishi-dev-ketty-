"use server";

import { screenHref } from "@injishi/data";
import type { SettingsBusinessProfile } from "@injishi/data/fixtures/owner";
import { getDocument, updateDocument } from "@injishi/db";
import { revalidatePath } from "next/cache";
import { requirePersona } from "@/lib/session";

export type SettingsBusinessProfilePatch = Pick<
  SettingsBusinessProfile,
  "name" | "type" | "location" | "phone" | "email"
>;

/**
 * Save a property profile. The legal entity is not editable here (moving a property to another entity changes who
 * issues receipts and receives money). Type and location must come from their lists; the display name is required.
 */
export async function saveSettingsBusinessProfile(id: string, patch: SettingsBusinessProfilePatch): Promise<void> {
  await requirePersona("SettingsBusiness");
  const profile = await getDocument<SettingsBusinessProfile>("owner.settingsBusinessProfiles", id);
  if (!profile) return;
  const name = patch.name.trim();
  if (!name || !profile.typeOptions.includes(patch.type) || !profile.locationOptions.includes(patch.location)) return;
  await updateDocument<SettingsBusinessProfile>("owner.settingsBusinessProfiles", id, {
    name,
    type: patch.type,
    location: patch.location,
    phone: patch.phone.trim(),
    email: patch.email.trim(),
  });
  revalidatePath(screenHref("SettingsBusiness"));
}
