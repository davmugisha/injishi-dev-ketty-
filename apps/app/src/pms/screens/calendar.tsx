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
 *
 * THE SWITCHER IS THE SHARED TAB SET, and it was not. This screen wrote
 * `<div role="tablist">` around three `<Button role="tab">`, which rendered a
 * tab list containing **zero** tabs: `Button` passes its rest props to React
 * Aria's Button, which filters unrecognised DOM props, so `role` never reached
 * the element. Measured in the browser on 2026-09-17 — and `apps/web`'s
 * "Browse by city" had the identical hand-rolled strip with the identical
 * result. A listener was told "tab list" and found nothing inside it, and
 * neither strip had arrow keys, because nothing had implemented them.
 *
 * `@injishi/ui` has shipped a Radix `Tabs` with a `pill` and an `underline`
 * variant since 2026-09-12. Roving tabindex, Home/End, arrows that wrap, and
 * a panel wired to its tab are its job, not this file's. The inline
 * `fontSize: 12.5` / `borderRadius: 999` / raw `var(--accent)` that painted
 * the old strip went with it: a number in a `style` object is a hand-typed
 * size that no design rule can see, which is exactly how it survived.
 */

import { useRouter, useSearchParams } from "next/navigation";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@injishi/ui";
import { EmptyState } from "../components/ui";
import { RoomGrid } from "./room-grid";
import { useWorkspaceHref } from "../lib/workspace-href";

const VIEWS = [
  { key: "grid", label: "Grid" },
  { key: "availability", label: "Availability" },
  { key: "rates", label: "Rates" },
] as const;

type ViewKey = (typeof VIEWS)[number]["key"];

function isView(value: string): value is ViewKey {
  return VIEWS.some((v) => v.key === value);
}

export function Calendar() {
  const router = useRouter();
  const href = useWorkspaceHref();
  const params = useSearchParams();
  const raw = params.get("view") ?? "grid";
  // An unknown `?view=` is the grid rather than an empty screen: this
  // parameter is typed by hand and pasted between people.
  const view: ViewKey = isView(raw) ? raw : "grid";

  return (
    <Tabs
      value={view}
      onValueChange={(next) =>
        router.replace(next === "grid" ? href("/calendar") : href(`/calendar?view=${next}`))
      }
      className="pms-enter"
    >
      <TabsList aria-label="Calendar view" className="mb-4">
        {VIEWS.map((v) => (
          // The pill paints its active label `text-white` over `bg-ink`. In
          // this app `--color-ink` follows `--foreground`, so under the dark
          // theme the fill turns near-white and the label measured 1.02:1.
          // `background` is the role that always opposes `foreground`.
          <TabsTrigger
            key={v.key}
            value={v.key}
            className="data-[state=active]:text-background"
          >
            {v.label}
          </TabsTrigger>
        ))}
      </TabsList>

      {/*
        Two parameters reach the grid. `?booking=` opens it on that booking
        (Reservations' "Assign room" and "On the grid"); `?from=` opens it on
        that window, which is what makes "the grid for the last week of the
        month" a link somebody can send. Switching view drops both, because a
        view is neither a booking nor a window.

        `tabIndex={-1}` on the grid panel: Radix makes a panel a tab stop, and
        this one opens onto a chart whose every bar is already reachable, so
        the extra stop lands a keyboard user on a wrapper with nothing to do.
        The two placeholder panels keep their stop — there is nothing else in
        them to reach.
      */}
      <TabsContent value="grid" tabIndex={-1}>
        <RoomGrid
          focusBookingId={params.get("booking")}
          windowStart={params.get("from")}
        />
      </TabsContent>

      <TabsContent value="availability">
        <EmptyState>
          Open, closed and priced dates across rooms. It reads the same dataset
          the grid draws, shown as a month rather than as a tape.
        </EmptyState>
      </TabsContent>

      <TabsContent value="rates">
        <EmptyState>
          What each room type costs on each date, and how a rate plan follows its
          parent. The plans themselves are set up under Inventory.
        </EmptyState>
      </TabsContent>
    </Tabs>
  );
}
