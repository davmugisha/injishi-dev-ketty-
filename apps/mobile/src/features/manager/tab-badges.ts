import { isMock } from "@/lib/data-mode";
import type { TabBadges } from "@/proto/screens";
import { useApprovals, useManagerInbox } from "./data";

/**
 * The manager tab bar's badges, read by its tab layout (the prototype's `tabbar(app, active, badges)`):
 * Approvals counts the requests waiting on Aline, and Inbox wears a dot while an alert is unread.
 * Both follow the sample data as requests are decided and alerts read. Api mode has no manager data
 * on the phone yet, so it asks for none and shows no badge.
 */
export function useManagerTabBadges(): TabBadges<"manager"> {
  const approvals = useApprovals({ enabled: isMock });
  const inbox = useManagerInbox({ enabled: isMock });
  const waiting = approvals.data?.waiting.length ?? 0;
  const unread = inbox.data?.items.some((item) => item.unread && item.tags.includes("alerts")) ?? false;
  const badges: TabBadges<"manager"> = {};
  if (waiting > 0) badges.approvals = waiting;
  if (unread) badges.inbox = true;
  return badges;
}
