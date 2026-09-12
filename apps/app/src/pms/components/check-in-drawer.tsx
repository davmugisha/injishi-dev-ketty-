"use client";

/**
 * Walk-in / check-in drawer — the "under two minutes" flow (blueprint §6.2).
 *
 * **On real data and real commands** (ADR-035). It sends
 * `POST /ops/stays/walk-in` for a guest at the counter and
 * `POST /ops/stays/:bookingId/checkin` for one who booked, and it offers the
 * rooms `GET /ops/rooms` says are free. Every part of it used to run in the
 * browser: the room list came from the demo property and submit dispatched a
 * reducer, so a receptionist could "check somebody in" and the server never
 * heard about it.
 *
 * **THE WALK IN AND THE RESERVATION ARE TWO COMMANDS, not one with a flag.**
 * Check in names a BOOKING in its path and a walk in has none — that mismatch
 * is exactly why the walk in route had to be written. Sending both through one
 * call would have meant inventing a booking for somebody who never made one.
 *
 * **THE NATIONAL ID IS NO LONGER REQUIRED, AND THAT IS A CORRECTION.** The form
 * demanded it and then threw it away: nothing on the wire carries it, and
 * `guest_stays` has no column for it. Refusing a check in over a field that is
 * discarded is worse than not asking — it stops a guest at the desk to collect
 * something nobody keeps. It stays on the form, marked optional, because the
 * desk really does look at the ID; storing it needs its own decision (identity
 * documents are their own table, and a scanned ID is personal data with its own
 * retention rules).
 *
 * **NIGHTS BECAME A DEPARTURE DATE for a walk in.** The command takes
 * `plannedExitAt`, and it is optional on purpose: a walk in often does not know
 * how long they are staying, which is half the reason they are one.
 */

import { useRouter } from "next/navigation";
import { Button, Input } from "@injishi/ui";
import { useState } from "react";
import { useWorkspaceHref } from "../lib/workspace-href";
import { usePms } from "../store";
import { usePmsUi } from "../ui-store";
import { useCapability, useWorkspaceId } from "../data/capability";
import { useCheckIn, useRooms, useWalkIn } from "../data/ops";
import { fmt, nights as nightsLabel, parseAmount } from "../lib/format";
import { fieldStyle, FieldLabel, SelectField } from "./ui";
import { Icon } from "./icon";

/** `2026-09-10T11:00:00.000Z` — `n` nights from today at the checkout hour. */
function departureFrom(nights: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + Math.max(1, nights));
  d.setUTCHours(11, 0, 0, 0);
  return d.toISOString();
}

export function CheckInDrawer() {
  const { toast, toastError } = usePms();
  const { checkIn, setCheckIn } = usePmsUi();
  const router = useRouter();
  // Every jump stays inside the workspace in the address bar (ADR-018).
  const href = useWorkspaceHref();
  const workspaceId = useWorkspaceId();
  const { can, reasonFor } = useCapability();
  const [showErr, setShowErr] = useState(false);

  const roomsQuery = useRooms(workspaceId);
  const walkIn = useWalkIn(workspaceId);
  const checkInGuest = useCheckIn(workspaceId);

  if (!checkIn) return null;
  const c = checkIn;

  const may = can("stay.checkin");
  const denied = may ? undefined : reasonFor("stay.checkin");
  const busy = walkIn.isPending || checkInGuest.isPending;

  /*
   * ONLY ROOMS THE SERVER CALLS AVAILABLE AND EMPTY.
   *
   * `occupiedBy` is the open stay in the room, so a room with one is occupied
   * whatever its status says. Offering it would produce a 409 the desk cannot
   * act on: the guest is standing there and the screen said the room was free.
   */
  const rooms = roomsQuery.data?.rooms ?? [];
  const freeRooms = rooms.filter(
    (rm) => rm.id === c.room || (rm.status === "available" && rm.occupiedBy === null),
  );
  const room = rooms.find((x) => x.id === c.room);
  const rateN = parseAmount(c.rate) || 0;
  // The national ID is asked for and NOT required — nothing stores it yet.
  const missing = !c.name.trim() || !c.room;

  const set = <K extends keyof typeof c>(key: K, value: (typeof c)[K]) => {
    setCheckIn({ ...c, [key]: value });
  };

  const close = () => {
    setShowErr(false);
    setCheckIn(null);
  };

  function submit() {
    if (missing) {
      setShowErr(true);
      toast("Add a name and pick a room to open the stay.", "warn");
      return;
    }
    if (denied) {
      toast(denied, "bad");
      return;
    }

    const rate = rateN > 0 ? rateN : undefined;

    if (c.walk || !c.resId) {
      walkIn.mutate(
        {
          roomId: c.room,
          guestName: c.name.trim(),
          plannedExitAt: departureFrom(c.nights),
          nightlyRateRwf: rate,
        },
        {
          onSuccess: (stay) => {
            setShowErr(false);
            setCheckIn(null);
            toast(`${c.name.trim()} is in room ${room?.label ?? ""}. Their bill is open.`.trim(), "ok");
            // The stay exists now, so the record is a real address. The demo
            // sent a walk in to the Bills list because it had no id to go to.
            router.push(href(`/stays/${stay.id}/folio`));
          },
          onError: toastError,
        },
      );
      return;
    }

    checkInGuest.mutate(
      { bookingId: c.resId, roomId: c.room, nightlyRateRwf: rate },
      {
        onSuccess: (stay) => {
          setShowErr(false);
          setCheckIn(null);
          toast(
            `${c.name.trim() || "Guest"} is in room ${room?.label ?? ""}. Their bill is open.`.replace(
              /\s+/g,
              " ",
            ),
            "ok",
          );
          router.push(href(`/stays/${stay.id}/folio`));
        },
        onError: toastError,
      },
    );
  }

  return (
    <>
      <div onClick={close} style={{ position: "fixed", inset: 0, zIndex: 60, background: "var(--scrim)" }} />
      <aside
        className="pms-drawer"
        style={{
          position: "fixed",
          right: 0,
          top: 0,
          bottom: 0,
          zIndex: 61,
          width: 456,
          maxWidth: "94vw",
          background: "var(--panel)",
          borderLeft: "1px solid var(--panel-bd)",
          boxShadow: "-30px 0 60px -30px rgba(4,35,48,.5)",
          padding: "20px 24px",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 14,
          color: "var(--foreground)",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 className="pms-display" style={{ fontSize: 21, fontWeight: 700, color: "var(--foreground)" }}>
              {c.walk ? "Walk-in check-in" : "Check in"}
            </h2>
            <div className="pms-num" style={{ marginTop: 2, fontSize: 12.5, color: "var(--muted)" }}>
              {c.resId && !c.walk ? `${c.resId} · reservation` : "No reservation — the stay opens now and the bill with it"}
            </div>
          </div>
          <Button variant="ghost"
            onClick={close}
            aria-label="Close"
            style={{ border: "none", background: "none", color: "var(--muted)", cursor: "pointer", display: "flex", padding: 3 }}
          >
            <Icon name="x" size={16} />
          </Button>
        </div>

        <div>
          <FieldLabel>Guest name</FieldLabel>
          {/* `FieldLabel` renders a bare <label> with no `htmlFor`, so it names
              nothing to a screen reader. Until it does, each input carries its
              own accessible name. */}
          <Input
            aria-label="Guest name"
            value={c.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="As on the ID"
            style={{ ...fieldStyle, marginTop: 6, minHeight: 44, fontSize: 14, borderColor: showErr && !c.name.trim() ? "var(--bad)" : "var(--line2)" }}
          />
        </div>
        <div>
          <FieldLabel>National ID or passport · optional</FieldLabel>
          <Input
            aria-label="National ID or passport"
            value={c.nid}
            onChange={(e) => set("nid", e.target.value)}
            placeholder="1 19XX X XXXXXXX X XX"
            className="pms-num"
            style={{ ...fieldStyle, marginTop: 6, minHeight: 44, fontSize: 14 }}
          />
          {/* Said out loud rather than implied. A field that looks stored and
              is not is worse than one that admits it. */}
          <div style={{ marginTop: 5, fontSize: 11.5, color: "var(--muted)" }}>
            Not kept yet. Identity documents get their own record, with their own
            retention rules.
          </div>
        </div>
        <div>
          <FieldLabel>Phone · optional</FieldLabel>
          <Input
            aria-label="Phone"
            value={c.phone}
            onChange={(e) => set("phone", e.target.value)}
            placeholder="+250 7XX XXX XXX"
            className="pms-num"
            style={{ ...fieldStyle, marginTop: 6, minHeight: 44, fontSize: 14 }}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
          <div>
            <FieldLabel>Room</FieldLabel>
            <div style={{ marginTop: 6 }}>
              <SelectField
                value={c.room}
                onChange={(next) => set("room", next)}
                label="Room"
                placeholder={
                  roomsQuery.isPending
                    ? "Loading rooms…"
                    : freeRooms.length === 0
                      ? "No free rooms"
                      : "Choose a free room"
                }
                invalid={showErr && !c.room}
                options={freeRooms.map((x) => ({
                  value: x.id,
                  label: `Room ${x.label ?? ""} · ${x.roomTypeName ?? "Room"}`.trim(),
                }))}
              />
            </div>
          </div>
          <div>
            <FieldLabel>Nights</FieldLabel>
            <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
              <Button variant="ghost"
                onClick={() => set("nights", Math.max(1, c.nights - 1))}
                aria-label="One fewer night"
                style={{ width: 44, height: 44, border: "1px solid var(--card-bd)", background: "var(--card)", color: "var(--foreground)", borderRadius: "var(--radius-surface)", fontSize: 18, fontWeight: 600, cursor: "pointer" }}
              >
                −
              </Button>
              <span className="pms-num" style={{ flex: 1, textAlign: "center", fontSize: 16, fontWeight: 700 }}>
                {c.nights}
              </span>
              <Button variant="ghost"
                onClick={() => set("nights", Math.min(30, c.nights + 1))}
                aria-label="One more night"
                style={{ width: 44, height: 44, border: "1px solid var(--card-bd)", background: "var(--card)", color: "var(--foreground)", borderRadius: "var(--radius-surface)", fontSize: 18, fontWeight: 600, cursor: "pointer" }}
              >
                +
              </Button>
            </div>
          </div>
        </div>

        <div>
          <FieldLabel>Rate per night · RWF</FieldLabel>
          <Input
            aria-label="Rate per night in RWF"
            value={c.rate}
            onChange={(e) => set("rate", e.target.value)}
            inputMode="numeric"
            placeholder="The rate agreed at the counter"
            className="pms-num"
            style={{ ...fieldStyle, marginTop: 6, minHeight: 44, fontSize: 14 }}
          />
        </div>

        <div style={{ background: "var(--field)", border: "1px solid var(--line2)", borderRadius: "var(--radius-surface)", padding: "13px 15px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
            <span style={{ color: "var(--muted)" }}>{`${nightsLabel(c.nights)} × ${fmt(rateN)}`}</span>
            <span className="pms-num" style={{ fontWeight: 700, color: "var(--foreground)" }}>
              {fmt(c.nights * rateN)}
            </span>
          </div>
          <div style={{ marginTop: 4, fontSize: 11.5, color: "var(--muted)" }}>
            The bill opens with the stay. Charges land on it as they happen.
          </div>
        </div>

        {roomsQuery.isError && (
          <div style={{ border: "1px solid var(--bad)", background: "var(--bad-bg)", color: "var(--bad)", borderRadius: "var(--radius-surface)", padding: "10px 14px", fontSize: 12.5, fontWeight: 600 }}>
            We couldn&apos;t load your rooms, so there is nothing safe to offer yet. This
            is on our side, not a full hotel — try again in a moment.
          </div>
        )}

        {showErr && missing && (
          <div style={{ border: "1px solid var(--bad)", background: "var(--bad-bg)", color: "var(--bad)", borderRadius: "var(--radius-surface)", padding: "10px 14px", fontSize: 12.5, fontWeight: 600 }}>
            A name and a room are required to open the stay.
          </div>
        )}

        <div style={{ marginTop: "auto", display: "flex", gap: 10, paddingTop: 6 }}>
          <Button variant="ghost"
            onClick={close}
            style={{ border: "1px solid var(--card-bd)", background: "var(--card)", color: "var(--ink2)", borderRadius: "var(--radius-surface)", padding: "12px 18px", fontSize: 13.5, fontWeight: 600, cursor: "pointer", minHeight: 46 }}
          >
            Cancel
          </Button>
          {/* CHECK-IN STAYS ONE PRESS. No confirm step, no second thought —
              there is a guest at the desk. `pending` keeps the button focused
              and announced while the stay opens, and refuses the second press
              that a dead-looking control invites. */}
          <Button variant="ghost"
            onClick={submit}
            disabled={Boolean(denied)}
            pending={busy}
            title={denied}
            style={{ flex: 1, border: "none", background: "var(--accent)", color: "var(--accent-ink)", borderRadius: "var(--radius-surface)", padding: 12, fontSize: 14, fontWeight: 700, cursor: denied ? "not-allowed" : "pointer", minHeight: 46, boxShadow: "var(--shadow-cta)", opacity: denied ? 0.6 : 1 }}
          >
            {busy ? "Opening the stay" : "Check in & open bill"}
          </Button>
        </div>
      </aside>
    </>
  );
}
