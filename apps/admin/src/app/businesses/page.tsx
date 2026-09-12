import Link from "next/link";

import { Badge, Card, CardDescription, CardTitle } from "@injishi/ui";
import { Zap } from "lucide-react";
import { listObo, listOrgReviewQueue, listOrgs } from "@/lib/api/orgs";
import type { StaffPermission } from "@injishi/contracts";
import { FailureNextStep } from "@/components/failure/failure-next-step";
import { apiFailureMessage, failureHeading, type ApiFailure } from "@/lib/api/server";
import { EMPTY, count } from "@/lib/present/format";
import { presentObo, presentOrgRow, presentReviewItem } from "@/lib/present/orgs";
import { STAT_NOTE, STAT_TERM, STAT_TILE, STAT_VALUE } from "@/lib/stat-tile";

import { OboTable } from "./obo-table";
import { OrgDirectory } from "./org-directory";
import { ReviewQueue } from "./review-queue";

export const metadata = { title: "Businesses" };

/**
 * Why this screen reads the OBO table, in the words that reach the audit trail.
 *
 * `listObo` takes the reason as a REQUIRED argument and the route writes a
 * `record_access_logs` row with it, naming this staffer and the intended owner
 * whose name and email they are about to see. It is stated here, at the one
 * call site, rather than defaulted inside the reader: a reason every row in the
 * log shares is a log that answers nothing when somebody asks why their record
 * was read.
 */
const OBO_READ_REASON =
  "Businesses console — OBO oversight: which registrations are still held by " +
  "an agent with payouts locked, and which owners have yet to claim";

/**
 * F-A03 org management & review queue.
 *
 * FIVE READS, EACH FAILING ON ITS OWN. The three panels below are gated by
 * different staff permissions — the review queue needs `admin.business.review`
 * and the directory only `admin.business.view` — so a staffer who holds one and
 * not the other must see the panel they may see rather than a whole page that
 * refuses. Panels are rendered independently for that reason, not for speed.
 *
 * The two extra reads exist to make the stat tiles TRUE. `meta.total` is the
 * count before paging, so a filtered read with `pageSize: 1` answers "how many
 * businesses are active" for the price of one row — where counting the loaded
 * page would have reported a slice as the whole platform.
 */
export default async function Page() {
  const [directory, active, suspended, review, obo] = await Promise.all([
    listOrgs(),
    listOrgs({ registrationStatus: "active", pageSize: 1 }),
    listOrgs({ registrationStatus: "suspended", pageSize: 1 }),
    listOrgReviewQueue(),
    listObo(OBO_READ_REASON),
  ]);

  return (
    <div className="mx-auto max-w-page px-4 py-6 sm:px-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Active orgs"
          total={active.ok ? active.data.meta.total : null}
          note="trading — every earlier stage holds the role and none of its powers"
        />
        <Stat
          label="In review"
          total={review.ok ? review.data.meta.total : null}
          note="waiting on a person"
        />
        <Stat
          label="OBO registrations"
          total={obo.ok ? obo.data.meta.total : null}
          note="payout locked until the owner claims"
        />
        <Stat
          label="Suspended"
          total={suspended.ok ? suspended.data.meta.total : null}
          note="reason-coded, reversible"
        />
      </div>

      {review.ok ? (
        <ReviewQueue
          rows={review.data.items.map((item) => ({
            // The org id travels beside the presented row, as in the directory
            // below: the queue's buttons now write, and a write needs an address.
            id: item.orgId,
            item: presentReviewItem(item),
          }))}
        />
      ) : (
        <Unavailable title="Review queue" reason={review.reason} permission="admin.business.review" />
      )}

      {obo.ok ? (
        <OboTable rows={obo.data.items.map(presentObo)} />
      ) : (
        <Unavailable title="OBO oversight" reason={obo.reason} permission="admin.business.view" />
      )}

      {directory.ok ? (
        <OrgDirectory
          rows={directory.data.items.map((row) => ({
            // The id travels beside the presented row rather than inside it:
            // `OrgRow` is a view type and an address is not a view decision.
            id: row.id,
            row: presentOrgRow(row),
          }))}
          total={directory.data.meta.total}
        />
      ) : (
        <Unavailable title="Org directory" reason={directory.reason} permission="admin.business.view" />
      )}

      <p className="mt-3 text-xs text-muted-foreground">
        Reading any identity, stay or contract inside an org writes a record-access log entry (
        <Link href="/audit" className="font-semibold text-accent-text hover:underline">
          F-A08
        </Link>
        ). TIN state is authoritative only when the RRA adapter is live — currently{" "}
        <Badge variant="warning">
          <Zap className="size-3" aria-hidden />
          mock
        </Badge>
        .
      </p>
    </div>
  );
}

/**
 * One stat tile, from a list route's `meta.total`.
 *
 * A read that failed shows an em dash, never a zero. "0 businesses are
 * suspended" and "we could not count them" are different statements, and the
 * second one printed as the first is how a console reports calm during an
 * outage.
 */
function Stat({
  label,
  total,
  note,
}: {
  label: string;
  total: number | null;
  note: string;
}) {
  return (
    <Card as="dl" className={STAT_TILE}>
      <CardTitle className={STAT_TERM}>{label}</CardTitle>
      <CardDescription className={`${STAT_VALUE} text-3xl`}>
        {total === null ? EMPTY : count(total)}
      </CardDescription>
      <dd className={STAT_NOTE}>
        {total === null ? "not counted — the read did not answer" : note}
      </dd>
    </Card>
  );
}

/**
 * One panel could not be read.
 *
 * Named, so a staffer can tell WHICH of the three failed and still work the
 * other two. The sentence itself comes from `apiFailureMessage`, so
 * `unreachable` keeps saying nothing about this account's access.
 */
function Unavailable({
  title,
  reason,
  permission,
}: {
  title: string;
  reason: ApiFailure;
  /** The permission this panel's route declares — the queue's differs. */
  permission: StaffPermission;
}) {
  return (
    <section className="mt-8" aria-label={title}>
      <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">{title}</h2>
      <div className="mt-3 animate-arrive rounded-card border border-border bg-field p-5">
        <p className="text-sm font-semibold">{failureHeading(reason, permission)}</p>
        <p className="mt-1.5 max-w-[60ch] text-sm leading-relaxed text-muted-foreground">
          {apiFailureMessage(reason)}
        </p>
        <FailureNextStep reason={reason} />
      </div>
    </section>
  );
}
