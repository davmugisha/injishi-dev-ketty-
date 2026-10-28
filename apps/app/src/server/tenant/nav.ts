/**
 * The tenant's sidebar (P3.4): the fixed items from `packages/data`, with the count of unread lines from
 * their landlord on Messages. A count the API can't give is left out. Server side only.
 */
import { type NavGroup, navigationFor } from "@injishi/data";
import { quietUnread, tenantUnread } from "../messages";

export function withMessageCount(groups: NavGroup[], unread: number | null): NavGroup[] {
  if (!unread) return groups;
  return groups.map((g) => ({
    ...g,
    items: g.items.map((i) => (i.board === "TenantMessages" ? { ...i, chip: String(unread) } : i)),
  }));
}

export async function tenantNav(): Promise<NavGroup[]> {
  const unread = await quietUnread(tenantUnread());
  return withMessageCount(navigationFor("tenant"), unread?.total ?? null);
}
