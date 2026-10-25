"use client";

import { Card } from "@heroui/react";
import { Segment } from "@heroui-pro/react";
import type { BrokerHome, BrokerHomes, BrokerHomesSort } from "@injishi/contracts";
import { screenHref } from "@injishi/data";
import {
  ActionLink,
  EmptyBlock,
  formatMoney,
  formatNumber,
  Icon,
  MapPanel,
  type MapPoint,
  PageContent,
  PageHeader,
  SearchBar,
  SelectField,
} from "@injishi/ui";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { districtCentre } from "./districts";
import { HomeCard } from "./HomeCard";
import { HomePanel } from "./HomePanel";

const ANY = "any";
const BEDROOMS = [
  { id: ANY, label: "Any bedrooms" },
  { id: "0", label: "Studio or more" },
  { id: "1", label: "1+ bedrooms" },
  { id: "2", label: "2+ bedrooms" },
  { id: "3", label: "3+ bedrooms" },
];
const MAX_RENT = [
  { id: ANY, label: "Any rent" },
  { id: "150000", label: "Up to RWF 150,000" },
  { id: "250000", label: "Up to RWF 250,000" },
  { id: "400000", label: "Up to RWF 400,000" },
  { id: "600000", label: "Up to RWF 600,000" },
  { id: "1000000", label: "Up to RWF 1,000,000" },
];
const SORTS: { id: BrokerHomesSort; label: string }[] = [
  { id: "newest", label: "Newest" },
  { id: "fee_desc", label: "Highest fee" },
  { id: "price_asc", label: "Rent, low to high" },
  { id: "price_desc", label: "Rent, high to low" },
];

/** A label the toolbar's selects carry for screen readers only: the options say what they are. */
const hidden = (words: string) => <span className="sr-only">{words}</span>;

/**
 * The homes a broker may offer (2026-10-25), like Explore: one toolbar row (search, district, bedrooms,
 * rent, sort), the homes as cards beside a map, and a home's panel with its photos, the fee and the
 * landlord's contact. Only homes the landlords switched on for brokers, inside the plan's area; the
 * filters live in the address so a reload or a shared link shows the same list.
 */
export function HomesView({ data, openUnitId }: { data: BrokerHomes; openUnitId: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [search, setSearch] = useState(params.get("q") ?? "");
  const [open, setOpen] = useState<string | null>(openUnitId);
  const [view, setView] = useState<"list" | "map">("list");
  const { scope } = data;

  const go = (next: Record<string, string | null>) => {
    const q = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v === null || v === "" || v === ANY) q.delete(k);
      else q.set(k, v);
    }
    q.delete("home");
    start(() => router.replace(`${pathname}${q.size > 0 ? `?${q.toString()}` : ""}`, { scroll: false }));
  };

  // The search waits for typing to pause.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only the typed words trigger it
  useEffect(() => {
    const current = params.get("q") ?? "";
    if (search.trim() === current) return;
    const timer = setTimeout(() => go({ q: search.trim() || null }), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const points = useMemo(() => mapPoints(data.homes), [data.homes]);
  const selected = data.homes.find((h) => h.unitId === open) ?? null;
  const total = data.districts.reduce((s, d) => s + d.count, 0);

  const toolbar = (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
      <SearchBar
        label="Search homes"
        value={search}
        onChange={setSearch}
        placeholder="Building, unit, area or landlord"
        className="lg:w-72"
      />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:flex lg:flex-1 lg:justify-end">
        <SelectField
          label={hidden("District")}
          options={[
            { id: ANY, label: scope.plan === "district" ? scope.area : "All districts" },
            ...data.districts.map((d) => ({ id: String(d.id), label: `${d.name} (${formatNumber(d.count)})` })),
          ]}
          value={data.districtId ? String(data.districtId) : ANY}
          onChange={(v) => go({ district: v })}
          isDisabled={scope.plan === "district"}
          className="lg:w-48"
        />
        <SelectField
          label={hidden("Bedrooms")}
          options={BEDROOMS}
          value={params.get("bedrooms") ?? ANY}
          onChange={(v) => go({ bedrooms: v })}
          className="lg:w-40"
        />
        <SelectField
          label={hidden("Highest rent")}
          options={MAX_RENT}
          value={params.get("maxRent") ?? ANY}
          onChange={(v) => go({ maxRent: v })}
          className="lg:w-48"
        />
        <SelectField
          label={hidden("Sort")}
          options={SORTS}
          value={params.get("sort") ?? "newest"}
          onChange={(v) => go({ sort: v === "newest" ? null : v })}
          className="lg:w-44"
        />
      </div>
    </div>
  );

  return (
    <PageContent>
      <PageHeader
        title="Homes"
        actions={
          scope.upgrade ? (
            <ActionLink href={screenHref("BrokerPlan")} icon="ArrowUpRight">
              See {scope.upgrade.area.replace(/^All of /, "")}
            </ActionLink>
          ) : null
        }
      />
      <p className="-mt-3 flex flex-wrap items-center gap-2 text-sm text-muted">
        <Icon name="MapPin" />
        <span>
          {scope.area}
          {scope.needsDistrict ? null : ` · ${formatNumber(total)} ${total === 1 ? "home" : "homes"} on offer`}
        </span>
      </p>

      {scope.needsDistrict ? (
        <EmptyBlock
          icon="MapPin"
          title="Choose the district you work in"
          description="The free plan shows the homes in your district."
          action={
            <ActionLink href={screenHref("BrokerPlan")} icon="MapPin" intent="primary">
              Choose a district
            </ActionLink>
          }
        />
      ) : (
        <>
          {toolbar}
          <Segment
            aria-label="Show"
            selectedKey={view}
            onSelectionChange={(k) => setView(k === "map" ? "map" : "list")}
            className="w-fit lg:hidden"
          >
            <Segment.Item id="list">
              <Icon name="LayoutCells" />
              List
            </Segment.Item>
            <Segment.Item id="map">
              <Icon name="MapPin" />
              Map
            </Segment.Item>
          </Segment>
          <div
            className={
              pending ? "grid gap-4 opacity-60 transition-opacity lg:grid-cols-5" : "grid gap-4 lg:grid-cols-5"
            }
            aria-busy={pending}
          >
            <section aria-label="Homes" className={view === "map" ? "hidden lg:block lg:col-span-3" : "lg:col-span-3"}>
              {data.homes.length === 0 ? (
                <Card className="p-6">
                  <EmptyBlock
                    icon="FolderHouse"
                    title={params.size > 0 ? "No homes match these filters" : "No homes on offer here yet"}
                    description={
                      params.size > 0
                        ? "Try fewer filters."
                        : scope.upgrade
                          ? `Landlords in ${scope.area} have not offered a home to brokers yet.`
                          : undefined
                    }
                    action={
                      params.size > 0 ? (
                        <ActionLink href={pathname} icon="ArrowRotateLeft">
                          Clear filters
                        </ActionLink>
                      ) : scope.upgrade ? (
                        <ActionLink href={screenHref("BrokerPlan")} icon="ArrowUpRight">
                          See {scope.upgrade.area.replace(/^All of /, "")}
                        </ActionLink>
                      ) : undefined
                    }
                  />
                </Card>
              ) : (
                <ul className="grid gap-4 sm:grid-cols-2">
                  {data.homes.map((h) => (
                    <li key={h.unitId} className="flex">
                      <HomeCard home={h} onOpen={() => setOpen(h.unitId)} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <aside aria-label="Map" className={view === "list" ? "hidden lg:col-span-2 lg:block" : "lg:col-span-2"}>
              <div className="lg:sticky lg:top-4">
                <MapPanel
                  label="Homes on the map"
                  points={points}
                  selectedId={selected ? pointIdOf(selected) : null}
                  height="32rem"
                  onSelect={(id) => {
                    if (id.startsWith("district:")) go({ district: id.slice("district:".length) });
                    else setOpen(id);
                  }}
                />
                <p className="mt-2 text-xs text-muted">A ring marks a district, not an address.</p>
              </div>
            </aside>
          </div>
        </>
      )}

      {selected ? <HomePanel key={selected.unitId} home={selected} onClose={() => setOpen(null)} /> : null}
    </PageContent>
  );
}

/** A home's own map point when its building has one, else its district's (grouped). */
function pointIdOf(home: BrokerHome): string {
  return home.latitude !== null && home.longitude !== null ? home.unitId : `district:${home.districtId ?? "none"}`;
}

function mapPoints(homes: readonly BrokerHome[]): MapPoint[] {
  const exact: MapPoint[] = [];
  const byDistrict = new Map<string, { lat: number; lng: number; name: string; count: number; id: number }>();
  for (const h of homes) {
    if (h.latitude !== null && h.longitude !== null) {
      exact.push({
        id: h.unitId,
        lat: h.latitude,
        lng: h.longitude,
        label: `${h.unitLabel}, ${h.propertyName}: ${formatMoney(h.rentRwf)}`,
      });
      continue;
    }
    const centre = districtCentre(h.district);
    if (!centre || h.districtId === null) continue;
    const key = String(h.districtId);
    const g = byDistrict.get(key) ?? { ...centre, name: h.district ?? "", count: 0, id: h.districtId };
    g.count += 1;
    byDistrict.set(key, g);
  }
  return [
    ...exact,
    ...[...byDistrict.values()].map((g) => ({
      id: `district:${g.id}`,
      lat: g.lat,
      lng: g.lng,
      label: `${g.name}: ${g.count} ${g.count === 1 ? "home" : "homes"}`,
      count: g.count,
      approximate: true,
    })),
  ];
}
