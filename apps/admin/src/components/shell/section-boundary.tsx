import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  STAFF_PERMISSION_LABEL,
  type StaffPermission,
} from "@injishi/contracts";
import { Button } from "@injishi/ui";

import {
  NAV_ITEMS,
  isNavKey,
  navItemFor,
  sectionAllows,
  sectionLabel,
  staffCanSee,
} from "@/lib/nav";
import { RETURN_HEADER } from "@/lib/return-path";
import { readStaffAccess } from "@/lib/staff";
import type { NavKey } from "@/lib/types";

/**
 * The per section route guard (ADR-049 AC-25).
 *
 * ## What was here before, and why it was not enough
 *
 * A role lens filtered the sidebar and that was the whole of it. A section a
 * lens could not see still RENDERED when its URL was typed — `lib/nav.ts`,
 * `lib/types.ts` and `role-lens-dialog.tsx` all called that a route guard in
 * prose, and none of them was one. It stayed survivable only while every staff
 * role was a platform role: an `ops` staffer typing `/finance` was somebody who
 * already held the console. ADR-049 adds `trainer`, a contractor who runs a
 * room for a day and holds no `admin.*` permission at all, and a console that
 * reads every business and every payout cannot hand that person `/finance` and
 * rely on each page's own reads failing.
 *
 * ## Why it sits here rather than in sixteen layouts
 *
 * `staff-boundary.tsx` states the rule this follows: a per screen check is a
 * check some screen will not have. One gate, wrapping every route, cannot be
 * forgotten by the seventeenth section — and an unknown first segment is a
 * `notFound()` rather than a render, so a section added WITHOUT a row in
 * `NAV` (and so no `permission`) fails closed and says so immediately,
 * instead of quietly shipping unguarded. It replaced a gate written into each
 * section's layout, which a new section could simply not have.
 *
 * A server component is not told the url it is rendering, so the path arrives
 * the way `staff-boundary.tsx` already gets it: `middleware.ts` SETS
 * `RETURN_HEADER` on every console request, overwriting anything a client sent
 * under that name.
 *
 * ## It is still not the boundary
 *
 * `StaffGuard` and `@RequireStaffPermission` on the API are, and they refuse
 * every `/api/v1/admin/*` call on their own, reads and writes alike. This reads
 * the permissions the SERVER resolved (`StaffAccess.permissions`) and never
 * expands a role itself, so the two cannot answer differently — but it is a
 * routing control, and the honest reason it exists is that a section a person
 * may not open should not paint before it refuses.
 *
 * ## Where the refusal renders
 *
 * INSIDE the chrome, unlike `staff-boundary.tsx`, and the difference is
 * deliberate. That gate refuses somebody who is not staff, for whom a sidebar
 * listing Finance and Compliance is itself a disclosure. This one refuses
 * somebody who IS staff and is already entitled to see the sidebar they are
 * looking at; taking the console away from them would leave a trainer who
 * mistyped an address with no way back to Training.
 */
export async function SectionBoundary({
  children,
}: {
  children: React.ReactNode;
}) {
  const path = (await headers()).get(RETURN_HEADER);
  const key = sectionForPath(path);

  // The console root. `app/page.tsx` redirects it to `/overview`, which is
  // guarded on arrival — refusing here would refuse the redirect itself.
  if (key === null) return <>{children}</>;
  if (key === "unknown") notFound();

  // Free: `readStaffAccess` is request memoised, so this is the answer
  // `StaffBoundary` already has rather than a second round trip.
  const { status, access } = await readStaffAccess();

  // Only a settled `staff` answer is ours to refuse on. Every other status was
  // already handled by `StaffBoundary` above us, and `unreachable` in
  // particular must never be worded as a refusal.
  if (status !== "staff" || sectionAllows(access.permissions, key)) {
    return <>{children}</>;
  }

  return <SectionRefusal section={key} permissions={access.permissions} />;
}

/**
 * `/finance/payouts?tab=held` → `finance`. The first segment and nothing else.
 *
 * `null` means the console root, `"unknown"` means an address this console has
 * no section for. They are separated because they end differently: one renders,
 * one 404s, and folding them together would either 404 the root redirect or
 * render an unregistered section unguarded.
 */
function sectionForPath(path: string | null): NavKey | "unknown" | null {
  if (!path) return null;
  const segment = path.split("?")[0].split("/").filter(Boolean)[0];
  if (!segment) return null;
  return isNavKey(segment) ? segment : "unknown";
}

/**
 * The refusal itself.
 *
 * It NAMES the missing power rather than saying "access denied", because the
 * person reading it is a colleague who needs to know what to ask a Super Admin
 * for. `STAFF_PERMISSION_LABEL` is the same wording the API's own denial uses,
 * so the sentence a staffer reads here and the sentence in the log agree.
 *
 * The way out is a section they actually hold, not `/overview` — a trainer
 * holds no `admin.overview.view`, so pointing everybody at the overview would
 * send exactly the person this guard was added for into a second refusal.
 */
function SectionRefusal({
  section,
  permissions,
}: {
  section: NavKey;
  permissions: readonly StaffPermission[];
}) {
  const label = sectionLabel(section);
  const needed = STAFF_PERMISSION_LABEL[navItemFor(section).permission];
  const wayOut = NAV_ITEMS.find((item) => staffCanSee(permissions, item));

  return (
    <div className="mx-auto max-w-page px-4 py-6 sm:px-6">
      <section className="animate-arrive rounded-card border border-border bg-field p-6 sm:p-7">
        <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <h1 className="mt-3 font-display text-2xl font-bold">
          This section isn&apos;t yours to open
        </h1>
        <p className="mt-3 max-w-read text-sm leading-6 text-muted-foreground">
          Your staff roles don&apos;t let you {needed}, so {label} stays
          closed. Nothing you did caused this, and the address is a real one —
          ask a Super Admin if this section is meant to be part of your work.
        </p>
        {wayOut ? (
          <div className="mt-4">
            <Button asChild variant="outline" size="sm">
              <Link href={`/${wayOut.key}`}>Go to {wayOut.label}</Link>
            </Button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
