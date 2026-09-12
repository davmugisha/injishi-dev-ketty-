import Link from "next/link";
import { CompassIcon, HeartIcon, LifebuoyIcon, SearchIcon } from "@/components/icons";

/** The fixed four-up tab bar pinned to the bottom of the viewport below `lg`. */
const TABS = [
  { label: "Explore", href: "/explore", Icon: CompassIcon },
  { label: "Residence", href: "/explore?kind=apartment", Icon: SearchIcon },
  { label: "Saved", href: "/saved", Icon: HeartIcon },
  { label: "Support", href: "/support", Icon: LifebuoyIcon },
];

export function MobileTabBar() {
  // The ground is `bg-black` — the brand ink, the same value the footer this bar
  // sits inside uses. It was `bg-primary`, which inverts to Mist in dark theme
  // and stood the white labels on a near-white ground.
  //
  // The bottom padding clears the home indicator rather than drawing under it.
  // A flat `py-5` put the labels of a `fixed bottom-0` bar inside the gesture
  // strip on iOS Safari and Android Chrome. `max(...)`, not `+`, so a browser
  // reporting no inset keeps the 1.25rem the design asks for — the same idiom
  // `search-sheet.tsx` uses. `SiteFooter`'s spacer is widened to match.
  return (
    <nav
      aria-label="Quick navigation"
      className="fixed bottom-0 left-0 z-10 grid w-full grid-cols-4 border-t border-border bg-black px-6 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] lg:hidden"
    >
      {TABS.map(({ label, href, Icon }) => (
        <Link
          key={label}
          href={href}
          className="flex flex-col items-center gap-1 text-center text-xs text-white"
        >
          <Icon className="size-5 text-white/80" />
          {label}
        </Link>
      ))}
    </nav>
  );
}
