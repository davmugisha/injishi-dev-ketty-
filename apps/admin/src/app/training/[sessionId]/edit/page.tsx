import { staffAllows } from "@injishi/contracts";
import { Badge, Button } from "@injishi/ui";
import Link from "next/link";

import { SectionFailure } from "@/components/failure/section-failure";
import { findTrainingSession, listTrainingVenues } from "@/lib/api/training";
import { readStaffAccess } from "@/lib/staff";

import { formatKigali } from "../../kigali-time";
import { SessionManageForm } from "./session-manage-form";

export const metadata = { title: "Manage training session" };

/**
 * Manage one session: edit, reschedule, cancel (ADR-049 AC-7, AC-21, AC-32).
 *
 * WHO: `training.session.manage`, plus being a trainer on this session or a
 * platform admin. The permission is read here from the caller's server-resolved
 * `StaffAccess`; the "is it yours" half is the API's alone (`assertMayManage`),
 * and a trainer who opens a session they are not on is told so by the write's
 * refusal, not by this page guessing.
 *
 * THE SESSION IS READ FROM THE LIST, like the roster page, because the decided
 * API surface has no `GET /admin/training/sessions/:id`. `findTrainingSession`
 * pages through it rather than trusting the first page, which is ordered by
 * start time and stops holding a given session once there are enough of them.
 *
 * THE VENUE PICKER IS THE ACTIVE LIST ONLY. `listTrainingVenues` without
 * `includeRetired` is exactly the list a trainer may pick from (AC-32). If the
 * session sits at a venue retired since it was drafted, the form says so and
 * asks for another; it does not offer the retired one back.
 *
 * A CANCELLED OR CLOSED SESSION OFFERS NOTHING. Cancelled is terminal and the
 * API answers 409; a closed roster is history. The page says which, and links
 * back, rather than drawing a form the platform will refuse.
 */
export default async function Page({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;

  const [sessions, venues, staff] = await Promise.all([
    findTrainingSession(sessionId),
    listTrainingVenues({ pageSize: 100 }),
    readStaffAccess(),
  ]);

  const canManage = staffAllows(staff.access.permissions, "training.session.manage");
  const session = sessions.ok ? sessions.data : null;

  return (
    <div className="mx-auto max-w-page px-4 py-6 sm:px-6">
      <Button asChild size="sm" variant="ghost">
        <Link href="/training">Back to training</Link>
      </Button>

      {!sessions.ok ? (
        <div className="mt-6">
          <SectionFailure eyebrow="Training" reason={sessions.reason} permission="training.view" />
        </div>
      ) : !session ? (
        <div className="mt-6">
          <SectionFailure eyebrow="Training" reason="missing" />
        </div>
      ) : (
        <>
          <header className="mt-4">
            <h1 className="text-xl font-bold">{session.course.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatKigali(session.startsAt)} · {session.venue.name},{" "}
              {session.venue.districtName}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge variant={session.status === "published" ? "success" : "subtle"}>
                {STATUS_LABEL[session.status]}
              </Badge>
              <Badge variant="light">
                Led by {session.trainers.find((t) => t.isLead)?.name ?? "nobody yet"}
              </Badge>
              {session.rescheduledFrom ? (
                <Badge variant="light">
                  Moved from {formatKigali(session.rescheduledFrom)}
                </Badge>
              ) : null}
              <Badge variant="light">
                {session.registrationCount.toLocaleString("en-RW")} registered
              </Badge>
            </div>
            <p className="mt-3 max-w-read text-sm text-muted-foreground">
              Who teaches it can&apos;t be changed here yet: the console has no
              list of trainers to offer.
            </p>
          </header>

          {!canManage ? (
            <p className="mt-6 max-w-read text-sm text-muted-foreground">
              Your staff roles don&apos;t let you manage training sessions, so
              this session is shown read-only.
            </p>
          ) : session.status === "cancelled" ? (
            <p className="mt-6 max-w-read text-sm text-muted-foreground">
              This session was cancelled
              {session.cancellationReason ? `: ${session.cancellationReason}` : "."}{" "}
              Cancelling is final, so there is nothing left to change.
            </p>
          ) : session.status === "completed" ? (
            <p className="mt-6 max-w-read text-sm text-muted-foreground">
              Its roster is closed, so the session is a record now rather than a
              plan.
            </p>
          ) : venues.ok ? (
            <SessionManageForm session={session} venues={venues.data.items} />
          ) : (
            <div className="mt-6">
              <SectionFailure eyebrow="Venues" reason={venues.reason} permission="training.view" />
            </div>
          )}
        </>
      )}
    </div>
  );
}

const STATUS_LABEL = {
  draft: "Draft",
  published: "Published",
  cancelled: "Cancelled",
  completed: "Roster closed",
} as const;
