import type { TabBadges } from "@/proto/screens";

/**
 * The technician tab bar's badges, read by its tab layout: a count, or `true` for a dot, per tab folder
 * (the prototype's `tabbar(app, active, badges)`). The prototype's technician screens draw none: his
 * urgent work leads the Jobs list itself, so no tab carries a badge.
 */
export function useTechnicianTabBadges(): TabBadges<"technician"> {
  return {};
}
