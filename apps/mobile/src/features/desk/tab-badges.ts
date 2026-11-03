import type { TabBadges } from "@/proto/screens";

/**
 * The desk tab bar's badges, read by its tab layout: a count, or `true` for a dot, per tab folder
 * (the prototype's `tabbar(app, active, badges)`). The prototype draws the desk's tab bar with no
 * badge on any screen: what needs the desk is already on Today (the bell's dot, the balances due),
 * so the tabs stay quiet.
 */
export function useDeskTabBadges(): TabBadges<"desk"> {
  return {};
}
