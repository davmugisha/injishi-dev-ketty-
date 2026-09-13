import { WaitlistFooter } from "@/components/waitlist/waitlist-footer";
import { WaitlistHeader } from "@/components/waitlist/waitlist-header";

/**
 * The chrome while the gate is up (ADR-048 AC-19).
 *
 * A FOURTH GROUP UNDER `(marketplace)`, beside `(site)`, `(results)` and
 * `(checkout)`, and it is here rather than inside `(site)` for the reason
 * `(marketplace)/layout.tsx` writes down: each group is named for the CHROME it
 * puts on, never for the route inside it. `(site)` means the canonical header
 * and footer, and AC-19 requires the opposite of that here, with every gated
 * link removed. Putting the waitlist inside `(site)` would have meant threading
 * a "hide almost everything" flag through `SiteHeader`, `MobileNav`,
 * `AccountMenu`, `HostCta`, `SearchOverlay` and `SiteFooter` — six components
 * that a launch-day deletion would then have to unpick one by one.
 *
 * Route groups do not appear in the URL, so the path is still `/waitlist`,
 * which is what `middleware.ts` and every link on the page name.
 *
 * `min-h-screen` with the footer pushed down by `mt-auto` so a short page (the
 * unsubscribe confirmation is two lines) does not leave the footer floating in
 * the middle of the viewport.
 */
export default function GateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <WaitlistHeader />
      <main className="flex-1">{children}</main>
      <WaitlistFooter />
    </div>
  );
}
