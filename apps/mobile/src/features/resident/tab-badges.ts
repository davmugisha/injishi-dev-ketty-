import type { TabBadges } from "@/proto/screens";
import { useTabCounts } from "./data";

/**
 * The resident tab bar's badges, read by its tab layout (the prototype's `badges = { requests: 1,
 * building: true }`): Requests counts unread messages on open repairs, Building shows a dot while a
 * notice from management is new. Nothing while the counts load or fail.
 */
export function useResidentTabBadges(): TabBadges<"resident"> {
  const { data } = useTabCounts();
  if (!data) return {};
  const badges: TabBadges<"resident"> = {};
  if (data.requests > 0) badges.requests = data.requests;
  if (data.building) badges.building = true;
  return badges;
}
