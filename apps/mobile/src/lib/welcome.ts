// The welcome screen's device flag (mobile spec 0005, D-b): unseen until Find a stay is pressed once,
// then every signed out start goes straight to Explore, until a sign out shows the welcome again. Kept
// in the device's own data file, not per account: it is about this phone, and it holds nothing personal.

import { deleteMeta, readMeta, writeMeta } from "@/data/db";

const KEY = "welcome.browse";

/** Find a stay was chosen on this phone since the last sign out. */
export function isBrowsing(): boolean {
  try {
    return readMeta(KEY) === "1";
  } catch {
    return false;
  }
}

export function startBrowsing(): void {
  try {
    writeMeta(KEY, "1");
  } catch {
    // Without it the welcome shows once more; nothing is lost.
  }
}

/** At sign out: the welcome shows again. */
export function resetWelcome(): void {
  try {
    deleteMeta(KEY);
  } catch {
    // Nothing to undo.
  }
}
