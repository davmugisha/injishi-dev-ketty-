"use server";

import { screenHref } from "@injishi/data";
import type {
  SettingsPoliciesCard,
  SettingsPoliciesOutlet,
  SettingsPoliciesVersion,
} from "@injishi/data/fixtures/owner";
import { getCollection, getDocument, updateDocument } from "@injishi/db";
import { revalidatePath } from "next/cache";
import { requirePersona } from "@/lib/session";

/**
 * Save edited policy settings. `values` maps a row id (or "c.<outletId>" for charge to room) to its new value.
 * Locked settings and values outside a row's options are ignored. Bookings keep the terms they were sold with.
 */
export async function saveSettingsPolicies(values: Record<string, string | boolean>): Promise<void> {
  await requirePersona("SettingsPolicies");
  const cards = await getCollection<SettingsPoliciesCard>("owner.settingsPoliciesCards");
  for (const card of cards) {
    let changed = false;
    const rows = card.rows.map((r) => {
      const v = values[r.id];
      if (v === undefined || v === r.value) return r;
      if (r.kind === "select" && typeof v === "string" && r.options.includes(v)) {
        changed = true;
        return { ...r, value: v };
      }
      if (r.kind === "switch" && typeof v === "boolean" && !r.locked) {
        changed = true;
        return { ...r, value: v };
      }
      return r;
    });
    if (changed) await updateDocument<SettingsPoliciesCard>("owner.settingsPoliciesCards", card.id, { rows });
  }
  const outlets = await getCollection<SettingsPoliciesOutlet>("owner.settingsPoliciesOutlets");
  for (const o of outlets) {
    const v = values[`c.${o.id}`];
    if (typeof v === "boolean" && !o.locked && v !== o.allowed)
      await updateDocument<SettingsPoliciesOutlet>("owner.settingsPoliciesOutlets", o.id, { allowed: v });
  }
  revalidatePath(screenHref("SettingsPolicies"));
}

/** Publish a draft cancellation policy version: it is scheduled from its effective date. */
export async function publishSettingsPoliciesVersion(id: string): Promise<void> {
  await requirePersona("SettingsPolicies");
  const version = await getDocument<SettingsPoliciesVersion>("owner.settingsPoliciesVersions", id);
  if (version?.state !== "draft") return;
  await updateDocument<SettingsPoliciesVersion>("owner.settingsPoliciesVersions", id, {
    state: "scheduled",
    stateLabel: "Scheduled",
    stateTone: "accent",
  });
  revalidatePath(screenHref("SettingsPolicies"));
}
