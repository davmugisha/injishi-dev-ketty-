"use client";

/**
 * One reservation, at its own address (ADR-018, move 3, AC-8).
 *
 * The first object page in the platform, and the shell every later one copies.
 * Before it, `apps/app` had one record page across fifty routes: a duty manager
 * could not send a colleague a link to the booking they were discussing, only a
 * description of which screen to open.
 *
 * A lens is a route segment (D-c), so this component is handed the lens it is
 * rendering rather than holding it in state. That is what makes each one
 * separately linkable.
 *
 * **IT READS THE RECORD, NOT THE LIST (ADR-044, D-a, AC-6).** The list has come
 * from `GET /ops/reservations` since ADR-012 and links every row here by its
 * server id, but this page looked that id up in the demo store and 404ed every
 * live booking. It then read the live LIST and `.find()`-ed the id inside it,
 * which fixed the demo mismatch and left a worse one behind: the desk list is
 * windowed to `DESK_WINDOW_DAYS` and capped at `DESK_LIMIT`, so a booking older
 * than the window rendered "that page isn't here" to the desk that owns it.
 *
 * It reads `GET /ops/reservations/:id` now. A window is a property of a LIST and
 * must never decide whether a RECORD exists. The demo store stands in only when
 * there is no workspace to ask, exactly as the list does.
 */

import type { OperatorReservation, OperatorReservationState } from "@injishi/contracts";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Bill } from "./bill";
import { Facts, type Fact } from "../components/facts";
import { ObjectPage } from "../components/object-page";
import { EmptyState, Initials, LoadFailed, SectionHeading, Skeleton } from "../components/ui";
import { ApiError } from "../data/api";
import { useCapability, useWorkspaceId } from "../data/capability";
import { useFolios, useStays } from "../data/ops";
import { useReservation } from "../data/reservations";
import type { Reservation, ResStatus } from "../data/types";
import { buildFolio } from "../lib/folio";
import { dateRange, dateRangeIso, fmt, initials, nights } from "../lib/format";
import { folioHref, lensesFor, objectHref } from "../lib/objects";
import { useWorkspaceHref } from "../lib/workspace-href";
import { usePms } from "../store";

type Status = { label: string; intent: "ok" | "warn" | "bad" | "info" | "neutral" };

const STATUS: Record<ResStatus, Status> = {
  pending: { label: "Request pending", intent: "warn" },
  confirmed: { label: "Confirmed", intent: "info" },
  inhouse: { label: "In-house", intent: "ok" },
  out: { label: "Checked out", intent: "neutral" },
  declined: { label: "Declined", intent: "bad" },
};

const LIVE_STATUS: Record<OperatorReservationState, Status> = {
  pending: STATUS.pending,
  confirmed: STATUS.confirmed,
  inhouse: STATUS.inhouse,
  checked_out: STATUS.out,
  declined: STATUS.declined,
  cancelled: { label: "Cancelled", intent: "neutral" },
  no_show: { label: "No show", intent: "neutral" },
};

export function ReservationRecord({ id, lens }: { id: string; lens: string }) {
  const workspaceId = useWorkspaceId();
  // One branch, taken once, on the same test the list takes: a workspace in the
  // address means there is a server to ask.
  return workspaceId !== null ? (
    <LiveReservation id={id} lens={lens} workspaceId={workspaceId} />
  ) : (
    <DemoReservation id={id} lens={lens} />
  );
}

type LiveStay = NonNullable<ReturnType<typeof useStays>["data"]>["stays"][number];

function LiveReservation({
  id,
  lens,
  workspaceId,
}: {
  id: string;
  lens: string;
  workspaceId: string;
}) {
  const query = useReservation(workspaceId, id);
  const stays = useStays(workspaceId);

  if (query.isPending) return <Skeleton height={320} />;

  if (query.isError) {
    /* A booking this workspace does not hold — or one on a branch outside the
       scope in view — is a 404, the same answer a made up id gets. Anything
       else is ours to own: an unreachable API is not a booking that never
       happened, and refusing here would tell the desk this guest does not
       exist. */
    if (query.error instanceof ApiError && query.error.status === 404) notFound();
    return (
      <LoadFailed onRetry={() => void query.refetch()} retrying={query.isFetching}>
        We couldn&apos;t load this reservation. The booking is safe — this is on our side,
        not a missing guest.
      </LoadFailed>
    );
  }

  // THE KNOWN EDGE IS CLOSED. This used to `.find()` the booking inside the
  // desk list, which reaches back `DESK_WINDOW_DAYS` (90) and stops at
  // `DESK_LIMIT` rows — so a link to a booking older than that 404'd although
  // it existed and this workspace held it. A window bounds a LIST; it never
  // decided whether this record exists, and nothing pretends it does now.
  const reservation = query.data;

  /*
   * The stay this booking became, if the guest has arrived.
   *
   * The same join the list makes: a stay carries its booking id, a booking
   * never carries a stay, because the stay does not exist until someone walks
   * in. The open one wins; a closed one is still this booking's past.
   */
  const ofThisBooking = (stays.data?.stays ?? []).filter((s) => s.bookingId === reservation.id);
  const stay = ofThisBooking.find((s) => s.lifecycle === "open") ?? ofThisBooking[0] ?? null;

  const guest = reservation.guestName ?? "Guest";

  return (
    <ObjectPage
      title={guest}
      subtitle={[
        reservation.reference,
        dateRangeIso(reservation.checkIn, reservation.checkOut),
        reservation.room ? `Room ${reservation.room}` : "Room not assigned",
      ].join(" · ")}
      status={LIVE_STATUS[reservation.state]}
      lenses={lensesFor(workspaceId, "reservations", id)}
      active={lens}
    >
      <LiveLensBody
        lens={lens}
        reservation={reservation}
        guest={guest}
        stay={stay}
        workspaceId={workspaceId}
      />
    </ObjectPage>
  );
}

function LiveLensBody({
  lens,
  reservation,
  guest,
  stay,
  workspaceId,
}: {
  lens: string;
  reservation: OperatorReservation;
  guest: string;
  stay: LiveStay | null;
  workspaceId: string;
}) {
  const href = useWorkspaceHref();
  const stayHref = stay ? objectHref(workspaceId, "stays", stay.id) : null;
  const total = reservation.totalRwf === null ? "Not priced yet" : fmt(reservation.totalRwf);

  switch (lens) {
    case "guests":
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <SectionHeading n={1}>On this booking</SectionHeading>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Initials>{initials(guest)}</Initials>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>{guest}</p>
              <p className="pms-num" style={{ fontSize: 12.5, color: "var(--muted)" }}>
                {reservation.guestCount === 1 ? "1 guest" : `${reservation.guestCount} guests`}
              </p>
            </div>
          </div>
          <EmptyState>
            One name per booking. The other guests are named on the stay, at check in.
          </EmptyState>
        </div>
      );

    case "payment":
      return (
        <LivePayment
          reservation={reservation}
          stayHref={stayHref}
          total={total}
          workspaceId={workspaceId}
        />
      );

    case "messages":
      return (
        <EmptyState>
          Messages with {guest} are in the{" "}
          <Link href={href("/inbox")} style={{ color: "var(--foreground)" }}>
            Inbox
          </Link>
          .
        </EmptyState>
      );

    case "history":
      return (
        <EmptyState>
          No history is served for a booking yet. Requested, confirmed, checked in and
          checked out land here once the API returns them.
        </EmptyState>
      );

    default:
      return (
        <Facts
          items={[
            { label: "Guest", value: guest },
            { label: "Reference", value: reservation.reference, numeric: true },
            {
              label: "Room",
              value: reservation.room ? `Room ${reservation.room}` : "Not assigned",
              numeric: Boolean(reservation.room),
            },
            {
              label: "Dates",
              value: dateRangeIso(reservation.checkIn, reservation.checkOut),
              numeric: true,
            },
            { label: "Nights", value: nights(reservation.nights), numeric: true },
            { label: "Total", value: total, numeric: reservation.totalRwf !== null },
            {
              label: "Stay",
              // A reservation becomes a stay when the guest arrives, and that is
              // where the folio is (ADR-044, the thread): Reservations, then this
              // record, then its stay, then the bill.
              value: stayHref ? (
                <Link href={stayHref} style={{ color: "var(--foreground)" }}>
                  {stay?.lifecycle === "open" ? "In-house now" : "Checked out"}
                </Link>
              ) : (
                "Not arrived yet"
              ),
            },
          ]}
        />
      );
  }
}

/**
 * The Payment lens, and the address of a guest's bill before they arrive
 * (ADR-044, D-c, AC-4).
 *
 * Approving a booking opens its folio on the booking, and check in binds that
 * folio to the stay. So between the two the bill belongs to this reservation,
 * and this lens renders it. From check in on, the bill's one address is the
 * stay's Folio lens, and this lens links there instead of showing it twice.
 * `folioHref` makes the call for both, the same function Bills links with.
 */
function LivePayment({
  reservation,
  stayHref,
  total,
  workspaceId,
}: {
  reservation: OperatorReservation;
  stayHref: string | null;
  total: string;
  workspaceId: string;
}) {
  const { can } = useCapability();
  const mayRead = can("folio.charge");
  // Gated on `folio.charge` server side, so a caller without it never asks.
  const folios = useFolios(mayRead ? workspaceId : null);

  const here = `${objectHref(workspaceId, "reservations", reservation.id)}/payment`;
  const addresses = (folios.data?.folios ?? [])
    .filter((f) => f.bookingId === reservation.id)
    .map((f) => ({ folio: f, href: folioHref(workspaceId, f) }));
  const bill = addresses.find((a) => a.href === here)?.folio ?? null;
  // The bill moved to the stay at check in. The stay link stands in when this
  // caller cannot read folios, because the stay is still this booking's.
  const elsewhere =
    addresses.find((a) => a.href !== null && a.href !== here)?.href ??
    (stayHref ? `${stayHref}/folio` : null);

  const facts: Fact[] = [
    { label: "Room total", value: total, numeric: reservation.totalRwf !== null },
    { label: "Nights", value: nights(reservation.nights), numeric: true },
  ];
  // With the bill on this page its own header carries the balance. Stating it
  // twice is two statements of the same money.
  if (!bill) {
    facts.push({
      label: "Balance",
      value: elsewhere ? (
        <Link href={elsewhere} style={{ color: "var(--foreground)" }}>
          On the stay&apos;s folio
        </Link>
      ) : !mayRead ? (
        "Your role cannot open a bill"
      ) : folios.isPending ? (
        "Loading the bill"
      ) : folios.isError ? (
        "Couldn't load the bill. Try again shortly"
      ) : reservation.state === "pending" ? (
        "No bill until the booking is approved"
      ) : (
        "No bill on this booking"
      ),
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <Facts items={facts} />
      {mayRead && folios.isPending ? <Skeleton height={260} /> : null}
      {bill ? <Bill id={bill.id} /> : null}
    </div>
  );
}

function DemoReservation({ id, lens }: { id: string; lens: string }) {
  const { host } = usePms();
  const workspaceId = useWorkspaceId();

  // A reservation belongs to a hospitality property. Reached from a workspace
  // that has none, there is nothing to find, and that is a 404 rather than an
  // error: the address names a record this workspace does not have.
  const reservation = host?.res.find((r) => r.id === id);
  if (!reservation) notFound();

  return (
    <ObjectPage
      title={reservation.guest}
      subtitle={`${reservation.id} · ${dateRange(reservation.start, reservation.nights)} · ${
        reservation.room ? `Room ${reservation.room}` : "Room not assigned"
      }`}
      status={STATUS[reservation.status]}
      lenses={lensesFor(workspaceId, "reservations", id)}
      active={lens}
    >
      <DemoLensBody lens={lens} reservation={reservation} />
    </ObjectPage>
  );
}

function DemoLensBody({ lens, reservation }: { lens: string; reservation: Reservation }) {
  const { host, state } = usePms();
  const property = host;

  switch (lens) {
    case "guests":
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <SectionHeading n={1}>On this booking</SectionHeading>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Initials>{initials(reservation.guest)}</Initials>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>
                {reservation.guest}
              </p>
              <p style={{ fontSize: 12.5, color: "var(--muted)" }}>
                {reservation.rep ?? "No reputation history on this guest yet."}
              </p>
            </div>
          </div>
          <EmptyState>
            One name per booking today. Additional guests arrive with the API,
            which carries them on the stay rather than the reservation.
          </EmptyState>
        </div>
      );

    case "payment": {
      const rate = reservation.rateOv ?? Number(
        property?.rooms.find((r) => r.id === reservation.room)?.rate ?? 0,
      );
      const folio = property ? buildFolio(reservation, property) : null;
      return (
        <Facts
          items={[
            { label: "Nightly rate", value: fmt(rate), numeric: true },
            { label: "Nights", value: nights(reservation.nights), numeric: true },
            {
              label: "Room total",
              value: fmt(rate * reservation.nights),
              numeric: true,
            },
            {
              label: "Balance",
              // The fixture keeps no bill before arrival. The live lens does,
              // from approval on (ADR-044, D-c), so this says only what it knows.
              value: folio ? fmt(folio.bal) : "No bill yet",
              numeric: !!folio,
            },
            {
              label: "Tax invoice",
              value: reservation.invoice ?? "Issued at checkout",
              numeric: !!reservation.invoice,
            },
          ]}
        />
      );
    }

    case "messages": {
      // Threads hang off the record they are about, so the reservation id is
      // what links them. A guest with no thread is normal, not missing data.
      const threads = (property?.threads ?? []).filter(
        (t) => t.ref === reservation.id || t.with === reservation.guest,
      );
      if (threads.length === 0) {
        return (
          <EmptyState>
            Nothing from {reservation.guest} yet. Messages about this booking
            appear here and in the Inbox.
          </EmptyState>
        );
      }
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {threads.flatMap((thread) =>
            thread.msgs.map((message, i) => (
              <div key={`${thread.id}-${i}`} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--muted2)" }}>
                  {message.from === "host" ? "You" : thread.with} · {message.ts}
                </span>
                <p style={{ fontSize: 13.5, color: "var(--foreground)" }}>{message.text}</p>
              </div>
            )),
          )}
        </div>
      );
    }

    case "history":
      // The demo store keeps no event log, so this lens says what it knows
      // rather than inventing a timeline. The API's booking lifecycle is what
      // fills it.
      return (
        <EmptyState>
          No event log in the demo store. Once this reads the API,
          the booking lifecycle events land here: requested, confirmed, checked
          in, checked out.
        </EmptyState>
      );

    default: {
      const rate = reservation.rateOv ?? Number(
        property?.rooms.find((r) => r.id === reservation.room)?.rate ?? 0,
      );
      return (
        <Facts
          items={[
            { label: "Guest", value: reservation.guest },
            { label: "Reference", value: reservation.id, numeric: true },
            {
              label: "Room",
              value: reservation.room ? `Room ${reservation.room}` : "Not assigned",
              numeric: !!reservation.room,
            },
            {
              label: "Stay",
              value: dateRange(reservation.start, reservation.nights),
              numeric: true,
            },
            { label: "Nights", value: nights(reservation.nights), numeric: true },
            { label: "Rate", value: fmt(rate), numeric: true },
            {
              label: "Arrival",
              value: reservation.time ?? "No time given",
              numeric: !!reservation.time,
            },
            {
              label: "Source",
              value: reservation.walkin ? "Walk in" : "Booked ahead",
            },
          ]}
        />
      );
    }
  }
}
