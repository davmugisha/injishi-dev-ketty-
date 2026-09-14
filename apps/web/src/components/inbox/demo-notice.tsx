import type { ReactNode } from "react";

import { Icon } from "@/components/app/icon";

/**
 * The line that stops this screen from being a lie.
 *
 * Contract row C31. `data/dining.ts` attaches an INVENTED menu, invented prices
 * and invented staff to named catalogue hotels — the Lanternhouse, the
 * Amberhill, fictional since 2026-09-14 — because the rule the product owes ("a listing under a hotel is
 * available to that hotel's guests and to nobody else") cannot be demonstrated
 * against a made-up property. The safeguard for that trade is not in the fixture,
 * it is here: every screen that renders the fabrication says so where the reader
 * is looking.
 *
 * QUIET, AND ALWAYS PRESENT. It is a bar in the reading column rather than a
 * dismissible banner, because a notice a presenter can close is a notice the
 * audience never sees. It uses the secondary surface pair rather than a warning
 * colour on purpose: nothing is wrong, and an amber strip across a chat screen
 * reads as an error and gets ignored by the third slide.
 *
 * The wording is the caller's. `/inbox` and one conversation are honest about
 * slightly different things — invented staff on the list, a simulated order on
 * the thread — and a single sentence covering both would be vaguer than either.
 */
export function DemoNotice({ children }: { children: ReactNode }) {
  return (
    <p
      role="note"
      className="flex shrink-0 items-start gap-2 border-b border-border bg-secondary px-4 py-2 text-xs leading-relaxed text-secondary-foreground sm:px-6"
    >
      <Icon name="info" className="mt-1 h-4 w-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
