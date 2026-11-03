import type { TabBadges } from "@/proto/screens";
import { useWaitingCount } from "./data";

/**
 * The supervisor tab bar's badges, read by its tab layout: a count, or `true` for a dot, per tab folder
 * (the prototype's `tabbar(app, active, badges)`). Inspect counts the rooms waiting for her inspection,
 * as the prototype's floor board and queue show it; nothing while that count is loading or failed.
 */
export function useSupervisorTabBadges(): TabBadges<"supervisor"> {
  const { data: waiting } = useWaitingCount();
  return waiting ? { inspect: waiting } : {};
}
