import RegisterGate from "./register-gate";
import { findRegistrationKind } from "./registration-kinds";

/**
 * Register your business: the front door to F-S03 / FL01, laid out as the
 * RegisterIA board draws it.
 *
 * A thin server shell around one client component. The page has no state of
 * its own: the gate resolves the identity in the browser (the Better Auth
 * cookie belongs to the API origin, so the Next server never receives it), and
 * the wizard owns everything after that, from About you to the one In review
 * page.
 */
export const metadata = {
  title: "Register your business — Injishi",
  /**
   * The one route in this group a crawler MAY index (ADR-021).
   *
   * `(app)/layout.tsx` sets `noindex, nofollow` for the whole layer, which is
   * right for the other routes and wrong for this one: registering a business
   * is the front door of the supply side. Next merges segment metadata
   * deepest-last, so this key wins over the root.
   */
  robots: { index: true, follow: true },
};

/**
 * `?kind=` is the only search param this route reads, and it arrives from the
 * `/host` chooser: the tile press IS the answer. It is validated HERE, against
 * `findRegistrationKind` (which accepts `other` and `broker` as well as the
 * chooser's nine), so the client is handed a kind the contract recognises or
 * nothing at all.
 *
 * Nothing else is awaited here, on purpose. A tile on `/host` crosses from the
 * marketplace's root layout into this one, which Next does as a full document
 * load after the first payload arrives; a page that kept its payload open on a
 * server fetch had that stream cut mid-flight on every press. Whether this is
 * the demo is asked from the browser instead (`register-gate.tsx`).
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  const { kind } = await searchParams;
  const chosen = findRegistrationKind(kind);

  return <RegisterGate initialKind={chosen?.value ?? null} />;
}
