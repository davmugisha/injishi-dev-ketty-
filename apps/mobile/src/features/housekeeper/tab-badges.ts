import type { TabBadges } from "@/proto/screens";
import { useTabBadgeSource } from "./data";

/**
 * The housekeeper tab bar's badges, read by its tab layout: a count, or `true` for a dot, per tab folder
 * (the prototype's `tabbar(app, active, badges)`). A dot on Schedule while a swap waits that she has not
 * looked at yet; none in api mode, where the schedule has no read yet.
 */
export function useHousekeeperTabBadges(): TabBadges<"housekeeper"> {
  const { data } = useTabBadgeSource();
  return data?.schedule ? { schedule: true } : {};
}
