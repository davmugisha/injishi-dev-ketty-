"use client";

/**
 * Calendar: three screens over one dataset (ADR-018, AC-12).
 *
 * `grid`, `availability` and the rate calendar inside `rooms-rates` were three
 * nav entries answering one question: what is sellable, when, at what price. A
 * receptionist under time pressure could not predict which one held the answer.
 *
 * VIEWS, NOT LENSES, and the difference is why this one takes `?view=` while
 * Finance takes segments. A lens is a facet of a RECORD and people send each
 * other links to facets, so it needs an address (D-c). A view is a display mode
 * of one dataset: nobody sends "the availability view of the calendar" as a
 * thing in itself, they send a date range. If that ever feels strained, the
 * tiebreak is D-c.
 */

import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@injishi/ui";
import { EmptyState } from "../components/ui";
import { RoomGrid } from "./room-grid";
import { useWorkspaceHref } from "../lib/workspace-href";

const VIEWS = [
  { key: "grid", label: "Grid" },
  { key: "availability", label: "Availability" },
  { key: "rates", label: "Rates" },
] as const;

export function Calendar() {
  const router = useRouter();
  const href = useWorkspaceHref();
  const params = useSearchParams();
  const view = params.get("view") ?? "grid";

  return (
    <div className="pms-enter">
      <div
        role="tablist"
        aria-label="Calendar view"
        style={{ display: "flex", gap: 6, marginBottom: 16 }}
      >
        {VIEWS.map((v) => {
          const on = v.key === view;
          return (
            <Button variant="ghost"
              key={v.key}
              role="tab"
              aria-selected={on}
              onClick={() =>
                router.replace(
                  v.key === "grid"
                    ? href("/calendar")
                    : href(`/calendar?view=${v.key}`),
                )
              }
              style={{
                border: `1px solid ${on ? "var(--accent)" : "var(--card-bd)"}`,
                background: on ? "var(--accent-soft)" : "var(--card)",
                color: on ? "var(--accent-text)" : "var(--ink2)",
                borderRadius: 999,
                padding: "7px 14px",
                fontSize: 12.5,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {v.label}
            </Button>
          );
        })}
      </div>

      {view === "availability" ? (
        <EmptyState>
          Open, closed and priced dates across rooms. It reads the same dataset
          the grid draws, shown as a month rather than as a tape.
        </EmptyState>
      ) : view === "rates" ? (
        <EmptyState>
          What each room type costs on each date, and how a rate plan follows its
          parent. The plans themselves are set up under Inventory.
        </EmptyState>
      ) : (
        /* `?booking=` is the one other parameter this route reads: the grid
           opens on that booking (Reservations' "Assign room" and "On the
           grid"). Switching view drops it, because a view is not a booking. */
        <RoomGrid focusBookingId={params.get("booking")} />
      )}
    </div>
  );
}
