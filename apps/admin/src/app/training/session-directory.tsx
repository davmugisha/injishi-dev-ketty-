"use client";

import type { AdminTrainingSession } from "@injishi/contracts";
import { Badge, Button } from "@injishi/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { publishSession } from "@/lib/actions/training";
import { useAdminUi } from "@/lib/store";

import { OutcomeNotice, type Notice } from "./outcome-notice";

/**
 * The session list (ADR-049).
 *
 * A CLIENT COMPONENT because the status filter and the publish button are
 * stateful. The rows are read on the server and arrive already shaped.
 *
 * THE FILTER IS OVER THE LOADED PAGE, not the platform, exactly as the waitlist
 * directory's filters are, and the count line says so rather than letting an
 * empty filter read as "no session has that status". The API accepts `status`
 * and filters server side; wiring this control to the URL so it does is a small
 * change and is deliberately not smuggled in here.
 *
 * PUBLISH IS HERE rather than on the roster page because publishing is a
 * decision about a session, taken before anybody has registered. It is drawn
 * only for a holder of `training.session.publish`, which a `trainer` does not
 * hold (AC-24). This used to show the button to everybody and let the API
 * refuse a trainer, on the argument that hiding it would leave a trainer unable
 * to tell publishing exists; the console now draws each control against its
 * own permission instead, and the note under the table tells a trainer who publishes.
 *
 * MANAGE opens `/training/[sessionId]/edit` (edit, reschedule, cancel) for a
 * holder of `training.session.manage`, on a session that is still a draft or
 * published. A cancelled session is terminal and a closed roster is history,
 * so neither offers it.
 *
 * DRAFTING IS NOT ON THIS SCREEN YET. A session needs a lead trainer picked
 * from staff holding the trainer role, and no endpoint lists them; see F-S15 in
 * progress-tracker.md. The note under the table says so to anybody who could
 * otherwise draft.
 */
export function SessionDirectory({
  sessions,
  total,
  canPublish,
  canManage,
}: {
  sessions: AdminTrainingSession[];
  total: number;
  /** `training.session.publish`, from the caller's server-resolved permissions. */
  canPublish: boolean;
  /** `training.session.manage`, likewise. */
  canManage: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<"all" | AdminTrainingSession["status"]>(
    "all",
  );
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<Notice | null>(null);
  const toast = useAdminUi((state) => state.toast);

  const rows =
    status === "all"
      ? sessions
      : sessions.filter((session) => session.status === status);

  const counts = `${rows.length.toLocaleString("en-RW")} of ${sessions.length.toLocaleString(
    "en-RW",
  )} loaded${total > sessions.length ? `, ${total.toLocaleString("en-RW")} in total` : ""}`;

  function publish(session: AdminTrainingSession) {
    startTransition(async () => {
      const out = await publishSession(session.id);
      const message = `${session.course.title}: ${out.message}`;
      setNotice({ message, tone: out.tone });
      toast(message, out.tone);
      if (out.ok) router.refresh();
    });
  }

  return (
    <section className="mt-8" aria-label="Training sessions">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {(
            ["all", "draft", "published", "cancelled", "completed"] as const
          ).map((value) => (
            <Button
              key={value}
              size="sm"
              variant={status === value ? "primary" : "outline"}
              onClick={() => setStatus(value)}
            >
              {value === "all" ? "Every status" : LABEL[value]}
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{counts}</p>
      </div>

      <OutcomeNotice notice={notice} />

      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">
          Nothing on the loaded page has that status. The filter is over what is
          loaded, not over every session on the platform.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[56rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <Th>Course</Th>
                <Th>When</Th>
                <Th>Where</Th>
                <Th>Fee</Th>
                <Th>Registered</Th>
                <Th>Status</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((session) => (
                <tr key={session.id} className="border-b border-border">
                  <Td>
                    <span className="font-medium">{session.course.title}</span>
                    <span className="block text-xs text-muted-foreground">
                      v{session.course.version}
                      {session.course.isPublished
                        ? ""
                        : " · course unpublished"}
                    </span>
                  </Td>
                  <Td>{formatWhen(session.startsAt)}</Td>
                  <Td>
                    {session.venue.name}
                    <span className="block text-xs text-muted-foreground">
                      {session.venue.districtName}
                      {session.venue.retiredAt ? " · venue retired" : ""}
                    </span>
                  </Td>
                  <Td className="money">
                    {session.feeRwf.toLocaleString("en-RW")}
                  </Td>
                  <Td className="money">
                    {session.registrationCount.toLocaleString("en-RW")}
                    <span className="block text-xs text-muted-foreground">
                      of {session.seatCount.toLocaleString("en-RW")} seats
                    </span>
                  </Td>
                  <Td>
                    <Badge variant={TONE[session.status]}>
                      {LABEL[session.status]}
                    </Badge>
                    {session.rosterClosedAt ? (
                      <span className="block text-xs text-muted-foreground">
                        roster closed
                      </span>
                    ) : null}
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-2">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/training/${session.id}`}>
                          Open roster
                        </Link>
                      </Button>
                      {canManage &&
                      (session.status === "draft" ||
                        session.status === "published") ? (
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/training/${session.id}/edit`}>
                            Manage
                          </Link>
                        </Button>
                      ) : null}
                      {canPublish && session.status === "draft" ? (
                        <Button
                          size="sm"
                          onClick={() => publish(session)}
                          disabled={pending}
                        >
                          Publish
                        </Button>
                      ) : null}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canManage ? (
        <p className="mt-4 max-w-read text-xs leading-5 text-muted-foreground">
          Drafting a new session isn&apos;t in the console yet: a session needs
          a lead trainer, and the platform has no list of trainers for this
          screen to offer. Existing sessions can be edited, rescheduled and
          cancelled from Manage.
          {canPublish ? "" : " A platform admin publishes a draft."}
        </p>
      ) : null}
    </section>
  );
}

/**
 * A session's status, in the console's words.
 *
 * `completed` reads "roster closed" rather than "completed", because that is
 * what the state actually means here: the trainer said who came, and everybody
 * undecided became absent. "Completed" would suggest the training itself is
 * finished, which is true of the day and says nothing about the roster.
 */
const LABEL: Record<AdminTrainingSession["status"], string> = {
  draft: "Draft",
  published: "Published",
  cancelled: "Cancelled",
  completed: "Roster closed",
};

const TONE: Record<
  AdminTrainingSession["status"],
  "subtle" | "success" | "danger" | "light"
> = {
  draft: "subtle",
  published: "success",
  cancelled: "danger",
  completed: "light",
};

/**
 * "Mon 15 Sep 2026, 09:00" in Kigali time.
 *
 * The zone is named rather than left to the browser: a staffer opening the
 * console from outside Rwanda must see the time the session actually starts for
 * the people attending it, not the time it starts for them.
 */
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

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
      {children}
    </th>
  );
}

function Td({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={`px-3 py-3 align-top${className ? ` ${className}` : ""}`}>
      {children}
    </td>
  );
}
