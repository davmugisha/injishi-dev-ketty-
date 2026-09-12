import type { Metadata } from "next";
import { Suspense } from "react";

import StartResolver, { StartArrival } from "@/components/auth/start-resolver";

export const metadata: Metadata = { title: "Opening Injishi…" };

/**
 * The door after sign-in (F-S02, role routing).
 *
 * Every successful sign-in lands here, with the destination the person asked
 * for (if any) in `?redirect=`. The resolver asks the API what they hold and
 * sends them on: to enrol or present a second factor first, then to the
 * oversight console, their operator workspace, or the marketplace.
 *
 * A page, not a server action, because the answer needs the browser's session
 * cookie against the API origin, and because "we could not ask" must render a
 * retry rather than a silent guess.
 */
export default function Page() {
  return (
    // The fallback is the arrival screen itself, not `null`: `useSearchParams`
    // bails the resolver out to the client, so `null` meant a blank page was
    // the first thing a freshly signed-in person saw.
    <Suspense fallback={<StartArrival />}>
      <StartResolver />
    </Suspense>
  );
}
