import { staffAllows } from "@injishi/contracts";
import { Card, CardDescription, CardTitle } from "@injishi/ui";

import { FailureNextStep } from "@/components/failure/failure-next-step";
import { apiFailureMessage, failureHeading } from "@/lib/api/server";
import {
  listTrainingCertificates,
  listTrainingCourses,
  listTrainingSessions,
} from "@/lib/api/training";
import { STAT_NOTE, STAT_TERM, STAT_TILE, STAT_VALUE } from "@/lib/stat-tile";
import { readStaffAccess } from "@/lib/staff";

import { SessionDirectory } from "./session-directory";
import { TrainingSubnav } from "./training-subnav";

export const metadata = { title: "Training" };

/**
 * The Training section (ADR-049).
 *
 * THE FIRST SECTION OF THIS CONSOLE A NON-PLATFORM STAFF ROLE REACHES. A
 * `trainer` holds four `training.*` powers and no `admin.*` power at all, which
 * is exactly why ADR-049 also owes the console a per-section route guard: while
 * every staff role could safely see every section, hiding a sidebar item was
 * enough. It is not enough any more, and until that guard lands this page's
 * protection is `StaffGuard` plus the per-route staff permissions on the API.
 *
 * FOUR READS, and the three counting ones exist to make the tiles TRUE. A
 * filtered read with `pageSize: 1` answers "how many published sessions are
 * there" for the price of one row, where counting the loaded page would report
 * a slice as the whole list. That is the pattern the Businesses and Waitlist
 * consoles already use.
 *
 * A FAILED READ SHOWS NOTHING, NEVER A ZERO. "No sessions are published" and
 * "we could not count them" are different statements, and the second printed as
 * the first is how a console reports calm during an outage.
 *
 * THE SESSION CONTROLS FOLLOW THE CALLER'S OWN PERMISSIONS, read from the
 * `StaffAccess` the server resolved (request memoised, so this is the answer
 * the section guard already fetched). Publish needs `training.session.publish`;
 * editing, rescheduling and cancelling need `training.session.manage`. The API
 * still refuses on its own, and a trainer who holds `manage` is refused a
 * session they are not on.
 */
export default async function Page() {
  const [directory, published, drafts, certificates, courses, staff] =
    await Promise.all([
      listTrainingSessions({ pageSize: 100 }),
      listTrainingSessions({ status: "published", pageSize: 1 }),
      listTrainingSessions({ status: "draft", pageSize: 1 }),
      listTrainingCertificates({ pageSize: 1 }),
      listTrainingCourses({ pageSize: 100 }),
      readStaffAccess(),
    ]);

  const permissions = staff.access.permissions;

  return (
    <div className="mx-auto max-w-page px-4 py-6 sm:px-6">
      <div className="mb-6">
        <TrainingSubnav />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Published"
          total={published.ok ? published.data.meta.total : null}
          note="open for registration on the public page"
        />
        <Stat
          label="Drafts"
          total={drafts.ok ? drafts.data.meta.total : null}
          note="invisible to the public until an admin publishes them"
        />
        <Stat
          label="Courses"
          total={courses.ok ? courses.data.meta.total : null}
          note="a syllabus, priced per session rather than per course"
        />
        <Stat
          label="Certificates"
          total={certificates.ok ? certificates.data.meta.total : null}
          note="issued by an attendance tick, and never deleted"
        />
      </div>

      {directory.ok ? (
        <SessionDirectory
          sessions={directory.data.items}
          total={directory.data.meta.total}
          canPublish={staffAllows(permissions, "training.session.publish")}
          canManage={staffAllows(permissions, "training.session.manage")}
        />
      ) : (
        <section className="mt-8" aria-label="Training sessions">
          <div className="animate-arrive rounded-card border border-border bg-field p-5">
            <p className="text-sm font-semibold">
              {failureHeading(directory.reason, "training.view")}
            </p>
            <p className="mt-1.5 max-w-[60ch] text-sm leading-relaxed text-muted-foreground">
              {apiFailureMessage(directory.reason)}
            </p>
            <FailureNextStep reason={directory.reason} />
          </div>
        </section>
      )}
    </div>
  );
}

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
        {total === null ? "—" : total.toLocaleString("en-RW")}
      </CardDescription>
      <p className={STAT_NOTE}>{note}</p>
    </Card>
  );
}
