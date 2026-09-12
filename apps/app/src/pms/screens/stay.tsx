"use client";

/**
 * One stay, at its own address (ADR-018, move 3, AC-8).
 *
 * **On real data** (ADR-035, wave 2 follow-up). Reads `GET /api/v1/ops/stays`,
 * a route that did not exist until this wave: the stays controller could check
 * a guest in and out and never read one back, which is why this record showed a
 * fixture. The demo store is gone from this screen (D-i).
 *
 * **THE FOLIO IS THE REASON THIS RECORD MATTERS, AND IT IS JOINED UP NOW.** A
 * guest disputes a spa charge from three nights ago; before the stays read
 * existed there was no stay to open, and once `Bill` moved to real data the
 * lens could not even address it — `Bill` takes a FOLIO id and this page only
 * had a fixture's reservation id. The folio is found by matching
 * `OperatorFolio.guestStayId` against this stay, which is the join the database
 * already carries.
 *
 * **A STAY IS NOT A BOOKING.** It does not exist until someone arrives, which is
 * why `POST /ops/stays/:id/checkin` takes the BOOKING id and why a reservation
 * links here rather than the other way round. This page is addressed by the
 * STAY's own id now, as it always should have been.
 *
 * A CLOSED stay is still openable, deliberately. A guest who checked out this
 * morning is exactly the one who rings about a charge this afternoon.
 */

import { notFound } from "next/navigation";
import Link from "next/link";

import { Bill } from "./bill";
import { Facts } from "../components/facts";
import { ObjectPage } from "../components/object-page";
import { EmptyState, Initials, LoadFailed, SectionHeading, Skeleton } from "../components/ui";
import { useCapability, useWorkspaceId } from "../data/capability";
import { useFolios, useStays } from "../data/ops";
import { dshortIso, initials } from "../lib/format";
import { folioHref, lensesFor, objectHref } from "../lib/objects";
import { useWorkspaceHref } from "../lib/workspace-href";

export function StayRecord({ id, lens }: { id: string; lens: string }) {
  const workspaceId = useWorkspaceId();
  const href = useWorkspaceHref();
  const stays = useStays(workspaceId);

  if (stays.isPending) return <Skeleton height={320} />;

  if (stays.isError) {
    /* An unreachable API is not a stay that never happened. A 404 here would
       tell the desk this guest does not exist. */
    return (
      <LoadFailed onRetry={() => void stays.refetch()} retrying={stays.isFetching}>
        We couldn&apos;t load this stay. The guest and their bill are safe — this is on our
        side, not a missing guest.
      </LoadFailed>
    );
  }

  const stay = (stays.data?.stays ?? []).find((s) => s.id === id);
  // Only once the list has really answered. A 404 while the read is in flight
  // would refuse a stay that is about to arrive.
  if (!stay) notFound();

  const open = stay.lifecycle === "open";

  return (
    <ObjectPage
      title={stay.guestName ?? "Unnamed guest"}
      subtitle={[
        stay.roomLabel ? `Room ${stay.roomLabel}` : "No room",
        `arrived ${dshortIso(stay.entryAt)}`,
      ].join(" · ")}
      status={
        open
          ? { label: "In-house", intent: "ok" }
          : { label: "Checked out", intent: "neutral" }
      }
      lenses={lensesFor(workspaceId, "stays", id)}
      active={lens}
    >
      <LensBody lens={lens} stay={stay} href={href} />
    </ObjectPage>
  );
}

type Stay = NonNullable<ReturnType<typeof useStays>["data"]>["stays"][number];

function LensBody({
  lens,
  stay,
  href,
}: {
  lens: string;
  stay: Stay;
  href: (path: string) => string;
}) {
  const workspaceId = useWorkspaceId();
  const { can } = useCapability();
  /*
   * The stay's own bill: the folio whose one address is this lens (ADR-044,
   * D-c). The same function Bills links with decides it, so the two can never
   * disagree about where a bill lives.
   *
   * Only asked for when a lens needs it, and only when the caller may read a
   * folio at all — the list is gated on `folio.charge`, so a receptionist gets
   * it and a housekeeper does not.
   */
  const needsFolio = lens === "folio" || lens === "";
  const folios = useFolios(can("folio.charge") && needsFolio ? workspaceId : null);
  const here = `${objectHref(workspaceId, "stays", stay.id)}/folio`;
  const folio = (folios.data?.folios ?? []).find((f) => folioHref(workspaceId, f) === here);

  switch (lens) {
    case "folio": {
      if (!can("folio.charge")) {
        return (
          <EmptyState style={{ padding: 26, fontSize: 13.5 }}>
            Your role cannot open a bill.
          </EmptyState>
        );
      }
      if (folios.isPending) return <Skeleton height={260} />;
      if (folios.isError) {
        return (
          <LoadFailed onRetry={() => void folios.refetch()} retrying={folios.isFetching}>
            We couldn&apos;t load this stay&apos;s bill. Every charge on it is still there —
            this is on our side, not a settled account.
          </LoadFailed>
        );
      }
      if (!folio) {
        /* A stay with no folio is a real state, not an error: the bill opens
           when the first charge posts, and a walk in may not have one yet. */
        return (
          <EmptyState style={{ padding: 26, fontSize: 13.5 }}>
            No bill on this stay yet. One opens with the first charge.
          </EmptyState>
        );
      }
      // The Bill screen IS the folio, and it already handles posting a charge,
      // taking a payment and reversing a line. Rebuilding it beside itself
      // would be two statements of the same money.
      return <Bill id={folio.id} />;
    }

    case "guests":
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <SectionHeading n={1}>In the room</SectionHeading>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Initials>{initials(stay.guestName ?? "?")}</Initials>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>
                {stay.guestName ?? "Unnamed guest"}
              </p>
              <p style={{ fontSize: 12.5, color: "var(--muted)" }}>
                {/* A stay with no booking behind it walked in. The database says
                    so by leaving `bookingId` null; the demo used a flag. */}
                {stay.bookingId ? "Registered guest" : "Registered guest · walked in"}
              </p>
            </div>
          </div>
        </div>
      );

    case "documents":
      return (
        /* No ticket numbers in front of a person. "(F-S09)" told an operator
           nothing except that somebody else has a spreadsheet. */
        <EmptyState>
          No documents on this stay yet. The guest&apos;s ID from check-in and their tax
          invoice from checkout will be kept here once document storage is switched on.
        </EmptyState>
      );

    case "notes":
      return (
        <EmptyState>
          No notes yet. This is where the desk leaves what the next shift needs to know
          about {stay.guestName ?? "this guest"}.
        </EmptyState>
      );

    default:
      return (
        <Facts
          items={[
            { label: "Guest", value: stay.guestName ?? "Unnamed guest" },
            { label: "Stay", value: stay.id, numeric: true },
            {
              label: "Room",
              value: stay.roomLabel ? `Room ${stay.roomLabel}` : "Not assigned",
              numeric: Boolean(stay.roomLabel),
            },
            { label: "Arrived", value: dshortIso(stay.entryAt), numeric: true },
            {
              label: "Due out",
              value: stay.plannedExitAt ? dshortIso(stay.plannedExitAt) : "Open ended",
              numeric: Boolean(stay.plannedExitAt),
            },
            {
              label: "Left",
              value: stay.actualExitAt ? dshortIso(stay.actualExitAt) : "Still here",
              numeric: Boolean(stay.actualExitAt),
            },
            {
              label: "Balance",
              // The one number on this page that is money, and it comes from
              // the folio rather than being recomputed here.
              value: folio ? String(folio.balanceRwf) : "—",
              numeric: Boolean(folio),
            },
          ]}
        />
      );
  }
}
