import { STAFF_PERMISSION_LABEL } from "@injishi/contracts";
import { Lock } from "lucide-react";

import { navItemFor, staffCanSee } from "@/lib/nav";
import { readStaffAccess } from "@/lib/staff";
import type { NavKey } from "@/lib/types";

/**
 * Refuse a section the staffer's permissions do not cover (ADR-049, AC-A4).
 *
 * The sidebar already hides the section; this is what stands behind a TYPED
 * url, which the sidebar cannot. A SERVER component in each section's layout,
 * so the refusal is decided before the page renders and a staffer outside the
 * section receives none of its markup, the argument `StaffBoundary` is built
 * on. In a layout rather than in each page, because a check written into every
 * screen is a check some screen will not have; a section layout covers every
 * route under it, record pages included.
 *
 * The answer is `readStaffAccess`, the same per request read `StaffBoundary`
 * made, so asking again costs no second round trip. Only a `staff` answer is
 * judged here: every other outcome was already decided by `StaffBoundary`, which
 * never rendered this far.
 *
 * Still not the boundary. `StaffGuard` refuses every `/api/v1/admin/*` call on
 * its own, reads included, whatever this renders.
 */
export async function SectionGate({
  section,
  children,
}: {
  section: NavKey;
  children: React.ReactNode;
}) {
  const { status, access } = await readStaffAccess();
  const item = navItemFor(section);

  if (status !== "staff" || staffCanSee(access.permissions, item)) {
    return <>{children}</>;
  }

  return <SectionRefusal label={item.label} need={STAFF_PERMISSION_LABEL[item.permission]} />;
}

/**
 * The refusal, worded as StaffBoundary words its own: a fact about this
 * account and where to go about it, with no alarm. It sits inside the console,
 * under the sidebar the staffer may use, rather than replacing the whole screen.
 */
function SectionRefusal({ label, need }: { label: string; need: string }) {
  return (
    <div className="grid min-h-[60vh] place-items-center p-6">
      <div className="max-w-[42ch] animate-arrive text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-card border border-border bg-field text-muted-foreground">
          <Lock className="h-6 w-6" aria-hidden />
        </span>
        <p className="mt-4 text-base font-semibold text-foreground">
          {`${label} isn't part of your staff role`}
        </p>
        <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
          {`Opening it needs the permission to ${need}, and this account doesn't hold it. Ask a Super Admin if you need it.`}
        </p>
      </div>
    </div>
  );
}
