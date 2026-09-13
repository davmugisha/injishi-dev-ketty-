import type { Metadata } from "next";
import { UnsubscribePanel } from "./unsubscribe-panel";

/**
 * `/waitlist/unsubscribe/<token>` (ADR-048 AC-12).
 *
 * The token is passed straight through to the client panel and is never
 * inspected here. It is an opaque lookup key: validating its shape, or looking
 * it up to decide what to render, would make this page answer differently for
 * an address that is on the list and one that is not.
 *
 * `noindex` because a page whose whole identity is somebody's private token has
 * no business in a search index, whatever `robots.ts` says about the rest.
 */
export const metadata: Metadata = {
  title: "Leave the Injishi waitlist",
  robots: { index: false, follow: false },
};

export default async function UnsubscribePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <section className="container max-w-read py-16 md:py-24">
      <UnsubscribePanel token={token} />
    </section>
  );
}
