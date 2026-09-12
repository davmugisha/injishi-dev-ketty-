"use client";

/**
 * Broker directory (F-R08) — the private landlord listing board.
 *
 * Two rules the screen exists to make felt:
 *  - A landlord's contact is hidden until a broker *spends* a reveal, and every
 *    reveal is logged. That log is what protects landlords from having their
 *    numbers harvested.
 *  - A reveal with no placement afterwards gets flagged for review, so the
 *    footer says so plainly rather than burying it in terms.
 *
 * These units are never public — the marketplace shows them to registered
 * brokers only.
 */

import { useState } from "react";
import { Button, Card } from "@injishi/ui";
import { fmt } from "../../lib/format";
import { usePms } from "../../store";
import { Badge, Chip, EmptyState } from "../../components/ui";

export function Directory() {
  const { broker, dispatch } = usePms();
  const [filter, setFilter] = useState("all");

  const types = Array.from(new Set(broker.dir.map((d) => d.type)));
  const chips = [
    { key: "all", label: "All", n: broker.dir.length },
    ...types.map((t) => ({ key: t, label: t, n: broker.dir.filter((d) => d.type === t).length })),
  ];

  const cards = broker.dir.filter((d) => filter === "all" || d.type === filter);

  return (
    <div className="pms-enter flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2.5">
        {chips.map((c) => (
          <Chip key={c.key} label={c.label} n={c.n} active={filter === c.key} onClick={() => setFilter(c.key)} />
        ))}
        <span className="flex-1" />
        <span className="text-xs text-muted-foreground">
          Private to brokers — these units are never public
        </span>
        <Badge intent="info">{broker.reveals} reveals left</Badge>
      </div>

      {cards.length === 0 ? (
        <EmptyState>No units of that type right now. Clear the filter to see the whole directory.</EmptyState>
      ) : (
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(250px,1fr))]">
          {cards.map((d) => (
            <Card key={d.id} className="gap-0 rounded border-panel-bd bg-card px-[17px] py-4 shadow-none">
              <div className="flex items-baseline gap-2">
                <span className="text-base font-bold text-ink">{d.type}</span>
                <span className="text-xs text-muted-foreground">{d.loc}</span>
              </div>
              <div className="pms-num mt-1.5 text-base font-bold tracking-[-0.2px] text-ink">
                {fmt(d.rent)}
                <span className="text-2xs font-medium text-muted-foreground"> / month</span>
              </div>
              <div className="mt-[3px] text-2xs text-muted-foreground">Deposit · {d.caution}</div>

              <div className="mt-3 border-t border-line pt-[11px]">
                {d.revealed ? (
                  <>
                    <div className="flex items-center gap-[7px]">
                      <span className="text-xs font-semibold text-ink">{d.landlord}</span>
                      <Badge intent="neutral">Reveal logged</Badge>
                    </div>
                    <div className="pms-num mt-0.5 text-sm text-ink2">{d.phone}</div>
                    <Button
                      type="button"
                      onClick={() => dispatch({ type: "startPlacement", id: d.id })}
                      className="mt-2.5 h-[38px] w-full bg-primary text-xs font-bold text-primary-foreground hover:bg-primary/90 rounded"
                    >
                      Start a placement
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="text-2xs text-faint">
                      Landlord contact stays hidden until you reveal it — every reveal is logged.
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => dispatch({ type: "revealContact", id: d.id })}
                      className="mt-2.5 h-[38px] w-full border-card-bd bg-field text-xs font-semibold text-foreground hover:bg-hover rounded"
                    >
                      Reveal contact
                    </Button>
                  </>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <p className="text-2xs text-muted-foreground">
        A reveal with no placement afterwards gets flagged for review — the log protects landlords from contact
        harvesting.
      </p>
    </div>
  );
}
