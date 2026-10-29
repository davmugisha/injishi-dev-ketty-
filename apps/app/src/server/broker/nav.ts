/**
 * The broker's sidebar (2026-10-26): the fixed items from `packages/data`, with the count of unread lines
 * from landlords on Messages. A count the API can't give is left out. Server side only.
 */
import { type NavGroup, navigationFor } from "@injishi/data";
import { brokerUnread, quietUnread } from "../messages";

export async function brokerNav(): Promise<NavGroup[]> {
  const unread = (await quietUnread(brokerUnread()))?.total ?? 0;
  const groups = navigationFor("broker");
  if (!unread) return groups;
  return groups.map((g) => ({
    ...g,
    items: g.items.map((i) => (i.board === "BrokerMessages" ? { ...i, chip: String(unread) } : i)),
  }));
}
