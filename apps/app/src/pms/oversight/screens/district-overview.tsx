"use client";

/**
 * District overview — every registered business in the officer's jurisdiction,
 * open or closed, with how it is actually performing.
 *
 * Performance settles from platform activity: bookings for hospitality, let
 * units for residence. A closed business stays *registered* — its license state
 * does not change because it stopped trading, and the note says why it closed.
 */

import { useState } from "react";
import { Button, Progress } from "@injishi/ui";
import { useConsole } from "../store";
import { Badge, EmptyState, StatCard, surfaceClass } from "../components/ui";
import { cn } from "@/lib/utils";

const COLS = "minmax(180px,1.6fr) minmax(90px,.8fr) minmax(160px,1.3fr) minmax(110px,1fr) minmax(120px,1fr) minmax(70px,.6fr)";

export function DistrictOverview() {
  const { oversight, officer } = useConsole();
  const [filter, setFilter] = useState<"all" | "open" | "closed">("all");

  if (!officer) return null;

  const all = oversight.perf;
  const rows = all.filter((p) => filter === "all" || (filter === "open" ? p.open : !p.open));
  // The queue the API scoped for this officer. It used to be filtered again by
  // `officer.scope`, a district typed into a fixture, so a file in the real
  // jurisdiction was counted only if its district happened to match the word.
  const inPipeline = oversight.orgs.filter((o) => o.stage === officer.actsOn).length;

  /*
   * NOTHING IS CONNECTED BEHIND THIS SCREEN YET, and it now says so once
   * instead of implying it four times.
   *
   * `oversight.perf` is `[]` in the store and nothing fills it. That left four
   * stat cards reading zero — "Registered 0", "Open now 0", "Closed 0", each a
   * statement about a district rather than about a missing feed — a filter rail
   * over an empty table, a count of "registered businesses · July 2026" with a
   * month typed into the source, and an empty state inviting the officer to
   * "clear the filter" when no filter was set.
   */
  if (all.length === 0) {
    return (
      <div className="pms-enter flex max-w-wide flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <StatCard n={String(inPipeline)} label="In your queue now" />
        </div>
        <EmptyState className="flex flex-col items-center gap-2 p-9 text-center">
          <span className="text-base font-semibold text-ink">
            District performance isn&apos;t connected yet
          </span>
          <span className="max-w-form text-sm text-muted-foreground">
            When it is, every registered business in your district appears here — open or
            closed, and how it is trading. Your queue is live in the meantime.
          </span>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="pms-enter flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard n={String(all.length)} label="Registered businesses" />
        <StatCard n={String(all.filter((p) => p.open).length)} label="Open now" />
        <StatCard n={String(all.filter((p) => !p.open).length)} label="Closed" />
        <StatCard n={String(inPipeline)} label="In your queue now" />
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        {([["all", "All"], ["open", "Open now"], ["closed", "Closed"]] as const).map(([key, label]) => (
          <Button
            key={key}
            type="button"
            variant="outline"
            onClick={() => setFilter(key)}
            className={cn(
              "h-9 rounded-full border-[1.5px] px-4 text-sm font-semibold",
              filter === key
                ? "border-accent-text bg-accent-soft text-accent-text hover:bg-accent-soft"
                : "border-card-bd bg-card text-muted-foreground hover:bg-hover",
            )}
          >
            {label}
          </Button>
        ))}
        <span className="flex-1" />
        <span className="pms-num text-xs text-muted-foreground">
          {rows.length} registered businesses
        </span>
      </div>

      {rows.length === 0 ? (
        <EmptyState>
          {filter === "all"
            ? "No registered businesses in your district yet."
            : `No ${filter === "open" ? "open" : "closed"} businesses in this view. Choose All to see the whole district.`}
        </EmptyState>
      ) : (
        <div className={cn(surfaceClass, "scrollbar overflow-x-auto")}>
          <div className="min-w-[900px]">
            <div
              className="grid gap-2.5 border-b border-line px-[18px] py-[11px] text-2xs font-bold tracking-[0.05em] uppercase text-[var(--muted2)]"
              style={{ gridTemplateColumns: COLS }}
            >
              <span>Business</span>
              <span>Type</span>
              <span>Status</span>
              <span>This month</span>
              <span>Occupancy</span>
              <span>MoM</span>
            </div>
            {rows.map((p, i) => (
              <div
                key={p.biz}
                className={cn(
                  "grid items-center gap-2.5 px-[18px] py-3",
                  i === 0 ? "border-t border-transparent" : "border-t border-line",
                )}
                style={{ gridTemplateColumns: COLS }}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-ink">{p.biz}</span>
                  <span className="block text-2xs text-muted-foreground">
                    {p.sector}
                  </span>
                </span>
                <span>
                  <Badge intent={p.type === "host" ? "accent" : "info"}>
                    {p.type === "host" ? "Host" : "Landlord"}
                  </Badge>
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-sm font-medium text-ink">
                    <span className={cn("size-2 rounded-full", p.open ? "bg-ok" : "bg-warn")} />
                    {p.open ? "Open now" : "Closed"}
                  </span>
                  {p.note && <span className="block truncate text-2xs text-muted-foreground">{p.note}</span>}
                </span>
                <span className="pms-num text-sm text-ink2">{p.metric}</span>
                <span className="flex items-center gap-2">
                  {/* A magnitude, so one hue over a track of the same hue. The
                      bar used to turn amber under 75%, which read 57% occupancy
                      as a warning: a verdict nobody made, on a figure that is
                      not a status. The percentage beside it carries the value. */}
                  <Progress
                    value={p.occ}
                    aria-label={`${p.biz} occupancy`}
                    className="h-1.5 flex-1 bg-chart-track"
                    indicatorClassName="bg-chart-1"
                  />
                  <span className="pms-num w-9 text-right text-xs text-muted-foreground">{p.occ}%</span>
                </span>
                <span>
                  <Badge intent={p.mom[1]}>{p.mom[0]}</Badge>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-2xs text-muted-foreground">
        Performance settles from platform activity — bookings for hospitality, let units for residence. Closed
        businesses stay registered; their license state does not change.
      </p>
    </div>
  );
}
