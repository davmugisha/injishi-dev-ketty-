import RegisterGate from "./register-gate";
import { findRegistrationKind } from "./registration-kinds";
import RegisterWizard from "./register-wizard";
import { Button } from "@injishi/ui";

/**
 * Register your business — the front door to F-S03 / FL01.
 *
 * This page used to be a converted prototype capture: static markup driven
 * imperatively by `public/shared/js/injishi-register.js`, which owned the
 * stepper and status panel as raw DOM and posted nowhere. Every field it
 * collected was thrown away.
 *
 * It is now a thin shell around two client components. The page itself stays a
 * Server Component because it has no state of its own — the gate resolves the
 * identity in the browser (the Better Auth cookie belongs to the API origin, so
 * the Next server never receives it) and the wizard owns everything after that.
 */
export const metadata = {
  title: "Register your business — Injishi",
  /**
   * The one route in this group a crawler MAY index (ADR-021).
   *
   * `(app)/layout.tsx` sets `noindex, nofollow` for the whole layer,
   * which is right for the other ten routes and wrong for this one:
   * registering a business is the front door of the supply side, and it
   * was crawlable before the three roots merged. Next merges segment
   * metadata deepest-last, so this key wins over the root. `/claim-org`
   * deliberately does NOT get one: it is a private invite flow.
   */
  robots: { index: true, follow: true },
};

/**
 * `?kind=` is the only search param this route reads, and it arrives from the
 * `/host` funnel's chooser (`ui-screens.md`: "host chooser → /register"). It is
 * validated HERE rather than inside the wizard, so the client component is
 * handed a kind the contract recognises or nothing at all, and a hand typed
 * value can never reach the draft it prefills.
 *
 * Checked against `findRegistrationKind` and no longer against `findHostKind`
 * (ADR-026). The two lists differ by exactly the two values `/host` refuses to
 * offer and this form must accept — `other` and `broker` — and validating a
 * registration query against the LISTING page's shorter list silently dropped
 * both, so `/register?kind=broker` landed as if nothing had been chosen.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  const { kind } = await searchParams;
  const chosen = findRegistrationKind(kind);

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-wide items-center gap-4 px-4 sm:px-6">
          <a href="/" aria-label="Injishi — home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/shared/img/injishi-extended.svg"
              alt="Injishi"
              className="h-7 w-auto dark:hidden"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/shared/img/injishi-extended-white.svg"
              alt="Injishi"
              className="hidden h-7 w-auto dark:block"
            />
          </a>
          <span className="grow" />
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
            {/* `/personal-trips` was never a route: this button 404'd, and it
                is the one a person presses to leave without losing anything.

                It then pointed at `HOME` (`/trips`), which lands somebody
                registering a BUSINESS on a guest's empty trip list. `/start`
                works out where this person belongs and takes them there, which
                is the same answer `pipeline-status.tsx` gives them on the way
                back in (ADR-044, D-a). */}
            <a href="/start">Save &amp; exit</a>
          </Button>
        </div>
      </header>

      {/* Identity first: a business belongs to whoever registers it, and every
          write below resolves that identity server-side. */}
      <RegisterGate>
        <main className="mx-auto max-w-wide px-4 py-8 sm:px-6">
          <RegisterWizard initialKind={chosen?.value ?? null} />
        </main>
      </RegisterGate>
    </>
  );
}
