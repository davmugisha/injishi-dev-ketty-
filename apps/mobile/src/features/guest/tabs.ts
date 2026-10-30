// The guest shell's five tabs (mobile spec 0005, D-c, D-am): defined in the app, never read from the
// demo data package, so no guest file imports demo data (AC-2).

import type { TabItem } from "@/components/phone";

export const GUEST_TABS: readonly TabItem[] = [
  { key: "home", label: "Home", icon: "House", href: "/guest" },
  { key: "explore", label: "Explore", icon: "Magnifier", href: "/guest/explore" },
  { key: "trips", label: "Trips", icon: "Suitcase", href: "/guest/trips" },
  { key: "inbox", label: "Inbox", icon: "Comments", href: "/guest/inbox" },
  { key: "me", label: "Me", icon: "Person", href: "/guest/me" },
];

/** The tab a guest path belongs to: `/guest` is Home, `/guest/trips/BK-1` is Trips. */
export function guestTabOf(pathname: string): string | undefined {
  if (pathname === "/guest" || pathname === "/guest/") return "home";
  const segment = pathname.split("/")[2];
  return GUEST_TABS.some((t) => t.key === segment) ? segment : undefined;
}
