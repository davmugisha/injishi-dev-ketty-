import { useGuestBadges } from "./data";
import type { GuestBadges } from "./types";

const NONE: GuestBadges = {};

/**
 * The guest tab bar's badges, read by its tab layout: a count, or `true` for a dot, per tab folder
 * (the prototype's `tabbar(app, active, badges)`: Inbox 1). Through the seam, so a forced loading or
 * empty state shows none, as the prototype's state screens do.
 */
export function useGuestTabBadges(): GuestBadges {
  return useGuestBadges().data ?? NONE;
}
