import type { StaffPermission } from "@injishi/contracts";

import { FailureNextStep } from "@/components/failure/failure-next-step";
import {
  apiFailureMessage,
  failureHeading,
  type ApiFailure,
} from "@/lib/api/server";

/**
 * A whole section that could not be read.
 *
 * ONE copy of a block that eight pages each held their own version of — and
 * eight versions is how eight of them came to print the raw permission key at
 * a staffer. The words come from `lib/api/server.ts` so they cannot drift, and
 * the next step is offered where the failure is, rather than leaving the
 * person on a page with nothing to press.
 *
 * Its heading is deliberately lighter than a real page title: this is an
 * absence, and dressing it with the weight of the screen it replaces makes the
 * console look like it is reporting a finding.
 */
export function SectionFailure({
  eyebrow = "Platform",
  reason,
  permission,
}: {
  /** The breadcrumb line the section normally carries. */
  eyebrow?: string;
  reason: ApiFailure;
  /** The permission the section's route declares, named if it is refused. */
  permission?: StaffPermission;
}) {
  return (
    <section className="animate-arrive rounded-card border border-dashed border-border bg-field p-6 sm:p-7">
      <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
        {eyebrow}
      </p>
      <h1 className="mt-3 font-display text-2xl font-bold">
        {failureHeading(reason, permission)}
      </h1>
      <p className="mt-3 max-w-read text-sm leading-6 text-muted-foreground">
        {apiFailureMessage(reason)}
      </p>
      <FailureNextStep reason={reason} />
    </section>
  );
}
