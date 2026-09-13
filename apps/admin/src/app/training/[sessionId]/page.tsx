import { Badge, Button } from "@injishi/ui";
import Link from "next/link";

import { FailureNextStep } from "@/components/failure/failure-next-step";
import { apiFailureMessage, failureHeading } from "@/lib/api/server";
import { listTrainingSessions, readTrainingRoster } from "@/lib/api/training";

import { RosterTable } from "./roster-table";

export const metadata = { title: "Training roster" };

/**
 * One session's roster (ADR-049, slice 1 item 7).
 *
 * THE SCREEN WHERE A CERTIFICATE COMES INTO EXISTENCE. One tick here writes an
 * append-only decision row and issues a certificate in the same database
 * transaction, and nothing else in the product issues one. Everything on the
 * page is arranged around making that tick hard to get wrong: who is on the
 * list, what was already decided about them, and whether the roster is still
 * open.
 *
 * WHO MAY OPEN IT: `training.attendance.mark`, plus being a trainer ON this
 * session or a platform admin. The API enforces both, and a trainer who is not
 * on the session gets a 404 rather than a 403 — the same answer as a session
 * that does not exist, so the console cannot be used to enumerate other
 * people's sessions.
 *
 * THE SESSION HEADER IS READ FROM THE LIST rather than from a detail endpoint,
 * because ADR-049's API surface has no `GET /admin/training/sessions/:id`. One
 * filtered read finds it. Adding a detail route for a header would be a change
 * to the decided surface, so it is not smuggled in here.
 */
export default async function Page({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;

  const [roster, sessions] = await Promise.all([
    readTrainingRoster(sessionId, { pageSize: 100 }),
    listTrainingSessions({ pageSize: 100 }),
  ]);

  const session = sessions.ok
    ? sessions.data.items.find((item) => item.id === sessionId)
    : undefined;

  return (
    <div className="mx-auto max-w-page px-4 py-6 sm:px-6">
      <Button asChild size="sm" variant="ghost">
        <Link href="/training">Back to training</Link>
      </Button>

      {session ? (
        <header className="mt-4">
          <h1 className="text-xl font-bold">{session.course.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatWhen(session.startsAt)} · {session.venue.name},{" "}
            {session.venue.districtName}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge variant="subtle">
              Led by{" "}
              {session.trainers.find((t) => t.isLead)?.name ?? "nobody yet"}
            </Badge>
            {session.trainers
              .filter((trainer) => !trainer.isLead)
              .map((trainer) => (
                <Badge key={trainer.userId} variant="light">
                  with {trainer.name}
                </Badge>
              ))}
            {session.rosterClosedAt ? (
              <Badge variant="light">Roster closed</Badge>
            ) : null}
            {session.cancelledAt ? (
              <Badge variant="danger">Cancelled</Badge>
            ) : null}
          </div>
          {/*
            The lead trainer's name is what a certificate PRINTS, and a co
            trainer may be the one ticking. Saying both here, distinctly, is
            what stops somebody assuming the tick puts their own name on the
            paper (AC-7, AC-12).
          */}
          <p className="mt-3 max-w-[70ch] text-sm text-muted-foreground">
            Certificates issued from this roster name the lead trainer, whoever
            records the attendance.
          </p>
        </header>
      ) : null}

      {roster.ok ? (
        <RosterTable
          sessionId={sessionId}
          rows={roster.data.items}
          total={roster.data.meta.total}
          rosterClosed={session?.rosterClosedAt !== null && session !== undefined}
        />
      ) : (
        <section className="mt-8" aria-label="Roster">
          <div className="animate-arrive rounded-card border border-border bg-field p-5">
            <p className="text-sm font-semibold">
              {failureHeading(roster.reason, "training.attendance.mark")}
            </p>
            <p className="mt-1.5 max-w-[60ch] text-sm leading-relaxed text-muted-foreground">
              {apiFailureMessage(roster.reason)}
            </p>
            <FailureNextStep reason={roster.reason} />
          </div>
        </section>
      )}
    </div>
  );
}

function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat("en-RW", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Africa/Kigali",
  }).format(new Date(iso));
}
