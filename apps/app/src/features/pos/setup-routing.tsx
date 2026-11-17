"use client";

import { Button, Input, TextField } from "@heroui/react";
import { useMemo, useState } from "react";
import type { PosVenue } from "@/server/pos";
import { setRouteAction, setRoutesAction } from "./actions";
import { Panel } from "./back-office";
import { suggestStation } from "./outlet-type";
import { routesTo, routingSections } from "./setup-logic";
import { selectClass } from "./setup-settings";
import { StatusChip, usePosAction } from "./shared";

const NO_TICKET = "";
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * Where each menu item is prepared, grouped by menu section. A whole section can be sent to one station in ONE call
 * (all or nothing); a single item still has its own choice. Nothing is guessed from an item's name: only an outlet
 * with one station kind offers to send every unrouted item there (the place the till already sends them).
 */
export function RoutingStep({
  outletId,
  venue,
  onVenue,
}: {
  outletId: string;
  venue: PosVenue;
  onVenue: (v: PosVenue) => void;
}) {
  const [query, setQuery] = useState("");
  const [onlyUnrouted, setOnlyUnrouted] = useState(false);
  const { run, pending } = usePosAction();
  const stationName = useMemo(() => new Map(venue.stations.map((s) => [s.id, s.name])), [venue.stations]);
  const q = query.trim().toLowerCase();
  const sections = routingSections(
    venue.routing.filter(
      (r) => (!onlyUnrouted || !r.stationId) && `${r.name} ${r.categoryName ?? ""}`.toLowerCase().includes(q),
    ),
  );
  // "Whole section" always means the whole section, whatever the search shows.
  const whole = new Map(routingSections(venue.routing).map((s) => [s.name, s]));
  const unrouted = venue.routing.filter((r) => !r.stationId);
  const onlyStation = suggestStation(venue.stations);

  const sendAll = (items: typeof venue.routing, stationId: string | null, what: string) => {
    const routes = routesTo(items, stationId);
    if (!routes.length) return;
    run(
      () => setRoutesAction(outletId, routes),
      `${plural(routes.length, "item")} ${stationId ? `now go to ${stationName.get(stationId)}` : "now send no ticket"} (${what}).`,
      onVenue,
    );
  };

  if (venue.routing.length === 0) {
    return (
      <Panel title="Item routing">
        <p className="rounded-xl border border-dashed border-separator p-4 text-[13px] text-muted">
          No menu items yet. Add products on the Menu screen, then route them here.
        </p>
      </Panel>
    );
  }

  return (
    <Panel
      title="Where each item is prepared"
      note={
        !unrouted.length
          ? "Every item has its station."
          : onlyStation
            ? `${plural(unrouted.length, "item")} of ${venue.routing.length} have no station set: the till sends them to ${onlyStation.name}, this outlet's only station.`
            : `${plural(unrouted.length, "item")} of ${venue.routing.length} have no station set: they send no ticket until you choose one. Set a whole section at once below.`
      }
      action={
        onlyStation && unrouted.length ? (
          <Button
            size="sm"
            variant="secondary"
            data-ui="route-automatically"
            isDisabled={pending}
            onPress={() => sendAll(unrouted, onlyStation.id, "every item with no station")}
          >
            Send {unrouted.length} to {onlyStation.name}
          </Button>
        ) : null
      }
    >
      {venue.stations.length === 0 ? (
        <p className="rounded-xl border border-dashed border-separator p-4 text-[13px] text-muted">
          Add a kitchen or bar station first (Kitchen and bar step), then choose where each item goes.
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <TextField value={query} onChange={setQuery} aria-label="Search items" className="min-w-0 flex-1">
          <Input placeholder="Search items or sections" />
        </TextField>
        <label className="flex items-center gap-2 text-[13px]">
          <input
            type="checkbox"
            checked={onlyUnrouted}
            onChange={(e) => setOnlyUnrouted(e.target.checked)}
            data-ui="only-unrouted"
          />
          Only items with no station
        </label>
      </div>
      <div className="flex flex-col gap-3">
        {sections.map((shown) => {
          const sec = whole.get(shown.name) ?? shown;
          return (
            <section
              key={sec.name}
              aria-label={`Section ${sec.name}`}
              data-ui="routing-section"
              className="rounded-xl border border-separator"
            >
              <header className="flex flex-wrap items-center gap-2 border-b border-separator bg-surface-secondary px-3 py-2">
                <h3 className="text-[14px] font-semibold">{sec.name}</h3>
                <span className="text-[12px] text-muted">{plural(sec.items.length, "item")}</span>
                {sec.unrouted ? <StatusChip color="warning">{sec.unrouted} with no station</StatusChip> : null}
                <span className="flex-1" />
                <label className="flex items-center gap-2 text-[12px] text-muted">
                  Whole section to
                  <select
                    aria-label={`Send every item of ${sec.name} to`}
                    data-ui="section-route"
                    className={`${selectClass} h-9 w-auto min-w-[150px]`}
                    value={sec.commonStationId ?? "mixed"}
                    disabled={pending || venue.stations.length === 0}
                    onChange={(e) =>
                      e.target.value !== "mixed" && sendAll(sec.items, e.target.value || null, `section ${sec.name}`)
                    }
                  >
                    {sec.commonStationId === null && sec.items.some((i) => i.stationId) ? (
                      <option value="mixed">Mixed</option>
                    ) : null}
                    <option value={NO_TICKET}>No ticket</option>
                    {venue.stations.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
              </header>
              <ul className="divide-y divide-separator">
                {shown.items.map((r) => (
                  <li key={r.serviceItemId} className="flex flex-wrap items-center gap-3 px-3 py-2">
                    <span className="min-w-0 flex-1 truncate text-[14px]">{r.name}</span>
                    <select
                      aria-label={`Station for ${r.name}`}
                      className={`${selectClass} max-w-[220px]`}
                      value={r.stationId ?? NO_TICKET}
                      disabled={pending}
                      onChange={(e) =>
                        run(
                          () => setRouteAction(outletId, r.serviceItemId, e.target.value || null),
                          e.target.value
                            ? `${r.name} goes to ${stationName.get(e.target.value)}.`
                            : `${r.name} sends no ticket.`,
                          onVenue,
                        )
                      }
                    >
                      <option value={NO_TICKET}>No ticket</option>
                      {venue.stations.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
        {sections.length === 0 ? (
          <p className="px-1 py-2 text-[13px] text-muted">
            {onlyUnrouted && !q ? "Every item has its station." : `No item matches "${query}".`}
          </p>
        ) : null}
      </div>
    </Panel>
  );
}
