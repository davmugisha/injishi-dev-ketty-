"use client";

import { Magnifier } from "@gravity-ui/icons";
import { Card, Chip, SearchField, ToggleButton } from "@heroui/react";
import { useMemo, useState } from "react";
import type { PosMenu, PosOutlet, PosStationRow } from "@/server/pos";
import { OutletSwitch } from "./back-office";
import { rwf } from "./format";
import { PosNav } from "./pos-nav";
import { PosHeader } from "./shared";

/** The groups the menu is shown in, in the order a guest reads it (POS spec section 7). */
const GROUPS = ["Beer", "Wine", "Spirits", "Soft drinks", "Water", "Food", "Cocktails", "Other services"] as const;
type Group = (typeof GROUPS)[number];

/** Which group a menu category belongs to; anything that is not a drink or a service is food. */
export function groupOf(category: string): Group {
  const c = category.toLowerCase();
  if (c.includes("beer")) return "Beer";
  if (c.includes("wine")) return "Wine";
  if (c.includes("spirit")) return "Spirits";
  if (c.includes("cocktail")) return "Cocktails";
  if (c.includes("water")) return "Water";
  if (c.includes("soft") || c.includes("juice")) return "Soft drinks";
  if (c.includes("service")) return "Other services";
  return "Food";
}

/**
 * The menu of an outlet as the till sells it (POS spec section 7): every product with its price, tax, the
 * station that prepares it, its add-on choices and whether it can be sold now. Prices and availability are
 * changed by the manager through the catalogue (`menu.manage`); this screen is the read of what the till uses.
 */
export function PosMenuView({
  outlets,
  outlet,
  menu,
  stations,
  can,
}: {
  outlets: PosOutlet[];
  outlet: PosOutlet;
  menu: PosMenu;
  stations: PosStationRow[];
  can: string[];
}) {
  const [group, setGroup] = useState<Group | "All">("All");
  const [query, setQuery] = useState("");
  const categoryName = useMemo(() => new Map(menu.categories.map((c) => [c.id, c.name])), [menu.categories]);
  const stationName = useMemo(() => new Map(stations.map((s) => [s.id, s.name])), [stations]);
  const counts = useMemo(() => {
    const m = new Map<Group, number>();
    for (const i of menu.items) {
      const g = groupOf(categoryName.get(i.categoryId) ?? "");
      m.set(g, (m.get(g) ?? 0) + 1);
    }
    return m;
  }, [menu.items, categoryName]);

  const shown = menu.items.filter((i) => {
    const cat = categoryName.get(i.categoryId) ?? "";
    if (group !== "All" && groupOf(cat) !== group) return false;
    const q = query.trim().toLowerCase();
    return !q || i.name.toLowerCase().includes(q) || cat.toLowerCase().includes(q);
  });
  const unavailable = menu.items.filter((i) => !i.available).length;

  return (
    <div className="relative flex h-full flex-col bg-background">
      <PosHeader title="Menu and products" outlet={outlet}>
        <OutletSwitch outlets={outlets} current={outlet.id} href="/pos/menu" />
        <PosNav current="PosMenu" outletId={outlet.id} can={can} />
      </PosHeader>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1" role="group" aria-label="Menu group">
            <ToggleButton size="sm" isSelected={group === "All"} onChange={() => setGroup("All")}>
              All ({menu.items.length})
            </ToggleButton>
            {GROUPS.filter((g) => counts.get(g)).map((g) => (
              <ToggleButton key={g} size="sm" isSelected={group === g} onChange={() => setGroup(g)}>
                {g} ({counts.get(g)})
              </ToggleButton>
            ))}
          </div>
          <span className="flex-1" />
          <SearchField value={query} onChange={setQuery} aria-label="Search the menu" className="w-[220px]">
            <SearchField.Group>
              <SearchField.SearchIcon>
                <Magnifier />
              </SearchField.SearchIcon>
              <SearchField.Input placeholder="Search the menu" />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
        </div>
        <p className="text-[12px] text-muted">
          {outlet.settings.taxMode === "inclusive" ? "Prices include tax." : "Tax is added to these prices."}{" "}
          {unavailable > 0 ? `${unavailable} item${unavailable === 1 ? " is" : "s are"} not on sale right now.` : "Everything is on sale."}
        </p>

        {shown.length === 0 ? (
          <p className="py-6 text-center text-[14px] text-muted">No product matches.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {shown.map((i) => {
              const station = i.stationId ? stationName.get(i.stationId) : null;
              return (
                <li key={i.id}>
                  <Card className="h-full gap-2 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="min-w-0 text-[15px] leading-5 font-semibold">{i.name}</h3>
                      <span className="shrink-0 text-[15px] font-semibold tabular">{rwf(i.priceRwf)}</span>
                    </div>
                    <p className="text-[12px] text-muted">{categoryName.get(i.categoryId)}</p>
                    {i.description ? <p className="text-[13px]">{i.description}</p> : null}
                    <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
                      <Chip size="sm" variant="soft" color={i.available ? "success" : "danger"}>
                        <Chip.Label>{i.available ? "Available" : (i.unavailableReason ?? "Not on sale")}</Chip.Label>
                      </Chip>
                      <Chip size="sm" variant="soft">
                        <Chip.Label>{station ?? "No ticket"}</Chip.Label>
                      </Chip>
                      <Chip size="sm" variant="soft">
                        <Chip.Label>{i.taxRateBps === 0 ? "Tax exempt" : `Tax ${i.taxRateBps / 100}%`}</Chip.Label>
                      </Chip>
                      {i.options.length > 0 ? (
                        <Chip size="sm" variant="soft">
                          <Chip.Label>{i.options.length} choice{i.options.length === 1 ? "" : "s"}</Chip.Label>
                        </Chip>
                      ) : null}
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
