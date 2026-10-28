"use client";

import { Button, Card } from "@heroui/react";
import { Segment } from "@heroui-pro/react";
import type { BrokerHome, BrokerHomes, BrokerHomesSort } from "@injishi/contracts";
import {
  ActionLink,
  EmptyBlock,
  FilterMenu,
  formatNumber,
  Icon,
  PageContent,
  PageHeader,
  SearchBar,
} from "@injishi/ui";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { districtCentre } from "./districts";
import { HomeCard } from "./HomeCard";
import { HomePanel } from "./HomePanel";

const HomesMap = dynamic(() => import("./HomesMap").then((m) => m.HomesMap), {
  ssr: false,
  loading: () => <div className="size-full animate-pulse bg-default" aria-hidden />,
});

const ANY = "any";
const BEDROOMS = [
  { id: ANY, label: "Any" },
  { id: "0", label: "Studio+" },
  { id: "1", label: "1+" },
  { id: "2", label: "2+" },
  { id: "3", label: "3+" },
];
const MAX_RENT = [
  { id: ANY, label: "Any" },
  { id: "150000", label: "RWF 150K" },
  { id: "250000", label: "RWF 250K" },
  { id: "400000", label: "RWF 400K" },
  { id: "600000", label: "RWF 600K" },
  { id: "1000000", label: "RWF 1M" },
];
const MIN_RENT = [
  { id: ANY, label: "Any" },
  { id: "100000", label: "RWF 100K" },
  { id: "200000", label: "RWF 200K" },
  { id: "350000", label: "RWF 350K" },
  { id: "500000", label: "RWF 500K" },
];
const SORTS: { id: BrokerHomesSort; label: string }[] = [
  { id: "newest", label: "Newest" },
  { id: "fee_desc", label: "Highest fee" },
  { id: "price_asc", label: "Rent, low to high" },
  { id: "price_desc", label: "Rent, high to low" },
];

type StatusTab = "all" | "now" | "soon";

/**
 * Find homes — Explore-style joined filter bar, availability tabs, and a sticky
 * MapLibre map (same pattern as feat/rentals directory).
 */
export function HomesView({
  data,
  openUnitId,
  desk = false,
}: {
  data: BrokerHomes;
  openUnitId: string | null;
  desk?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [search, setSearch] = useState(params.get("q") ?? "");
  const [open, setOpen] = useState<string | null>(openUnitId);
  const [showMap, setShowMap] = useState(true);
  const [mobileView, setMobileView] = useState<"list" | "map">("list");
  const [hovered, setHovered] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusTab>("all");
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

  // biome-ignore lint/correctness/useExhaustiveDependencies: debounce typed search only
  useEffect(() => {
    const current = params.get("q") ?? "";
    if (search.trim() === current) return;
    const timer = setTimeout(() => go({ q: search.trim() || null }), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const counts = useMemo(() => {
    let now = 0;
    let soon = 0;
    for (const h of data.homes) {
      if (!h.availableFrom) now += 1;
      else soon += 1;
    }
    return { all: data.homes.length, now, soon };
  }, [data.homes]);

  const shown = useMemo(() => {
    if (status === "all") return data.homes;
    if (status === "now") return data.homes.filter((h) => !h.availableFrom);
    return data.homes.filter((h) => Boolean(h.availableFrom));
  }, [data.homes, status]);

  /** MapLibre needs lat/lng — use district centres when a building has none. */
  const mapHomes = useMemo(() => homesForMap(shown), [shown]);
  const selected = shown.find((h) => h.unitId === open) ?? data.homes.find((h) => h.unitId === open) ?? null;
  const total = data.districts.reduce((s, d) => s + d.count, 0);
  const filterActive =
    Boolean(
      params.get("q") ||
        params.get("district") ||
        params.get("bedrooms") ||
        params.get("minRent") ||
        params.get("maxRent"),
    ) ||
    (params.get("sort") != null && params.get("sort") !== "newest");

  const chrome = desk ? (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
        <Icon name="MapPin" />
        <span>
          {scope.area}
          {scope.needsDistrict ? null : ` · ${formatNumber(total)} ${total === 1 ? "home" : "homes"} on offer`}
        </span>
      </p>
      {scope.upgrade ? (
        <ActionLink href="/account?plan=1" icon="ArrowUpRight" size="sm">
          See {scope.upgrade.area.replace(/^All of /, "")}
        </ActionLink>
      ) : null}
    </div>
  ) : (
    <>
      <PageHeader
        title="Homes"
        actions={
          scope.upgrade ? (
            <ActionLink href="/account?plan=1" icon="ArrowUpRight">
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
    </>
  );

  const body = (
    <>
      {chrome}

      {scope.needsDistrict ? (
        <EmptyBlock
          icon="MapPin"
          title="Choose the district you work in"
          description="The free plan shows the homes in your district."
          action={
            <ActionLink href="/account?plan=1" icon="MapPin" intent="primary">
              Choose a district
            </ActionLink>
          }
        />
      ) : (
        <div
          className={
            // One screen on a laptop: the filters and the list on the left (the list scrolls inside),
            // the map filling the right side from top to bottom. The page itself never scrolls.
            showMap
              ? "grid min-h-0 gap-x-5 gap-y-4 lg:h-[calc(100dvh-11rem)] lg:min-h-[28rem] lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]"
              : "grid min-h-0 gap-y-4 lg:h-[calc(100dvh-11rem)] lg:min-h-[28rem]"
          }
          aria-busy={pending}
        >
          <div className="flex min-h-0 min-w-0 flex-col gap-3">
            {/* The filters, as one wrapping row of dropdowns after the search. */}
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <SearchBar
                label="Search homes"
                value={search}
                onChange={setSearch}
                placeholder="Building or area"
                className="w-full sm:w-56"
              />
              <FilterMenu
                label="Availability"
                name="Show"
                icon="ListUl"
                options={[
                  { id: "all", label: "All homes", count: counts.all },
                  { id: "now", label: "Available now", count: counts.now },
                  { id: "soon", label: "On notice", count: counts.soon },
                ]}
                value={status}
                onChange={(k) => setStatus(k as StatusTab)}
              />
              <FilterMenu
                label="District"
                name="District"
                icon="MapPin"
                options={[
                  { id: ANY, label: scope.plan === "district" ? scope.area : "All districts" },
                  ...data.districts.map((d) => ({ id: String(d.id), label: d.name, count: d.count })),
                ]}
                value={data.districtId ? String(data.districtId) : ANY}
                onChange={(v) => go({ district: v })}
              />
              <FilterMenu
                label="Bedrooms"
                name="Bedrooms"
                icon="House"
                options={BEDROOMS}
                value={params.get("bedrooms") ?? ANY}
                onChange={(v) => go({ bedrooms: v })}
              />
              <FilterMenu
                label="Lowest rent"
                name="Rent from"
                icon="Wallet"
                options={MIN_RENT}
                value={params.get("minRent") ?? ANY}
                onChange={(v) => go({ minRent: v })}
              />
              <FilterMenu
                label="Highest rent"
                name="Rent up to"
                icon="Wallet"
                options={MAX_RENT}
                value={params.get("maxRent") ?? ANY}
                onChange={(v) => go({ maxRent: v })}
              />
              <FilterMenu
                label="Sort"
                name="Sort"
                icon="ArrowsRotateRight"
                options={SORTS}
                value={params.get("sort") ?? "newest"}
                onChange={(v) => go({ sort: v === "newest" ? null : v })}
              />
              {filterActive || status !== "all" ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onPress={() => {
                    setSearch("");
                    setStatus("all");
                    start(() => router.replace(pathname, { scroll: false }));
                  }}
                >
                  <Icon name="Xmark" />
                  Clear
                </Button>
              ) : null}
              <span className="ml-auto flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  className="hidden lg:inline-flex"
                  onPress={() => setShowMap((v) => !v)}
                >
                  <Icon name={showMap ? "LayoutCells" : "MapPin"} />
                  {showMap ? "Hide map" : "Show map"}
                </Button>
                <Segment
                  aria-label="Show"
                  size="sm"
                  selectedKey={mobileView}
                  onSelectionChange={(k) => setMobileView(k as "list" | "map")}
                  className="lg:hidden"
                >
                  <Segment.Item id="list">List</Segment.Item>
                  <Segment.Item id="map">Map</Segment.Item>
                </Segment>
              </span>
            </div>

            <section
              aria-label="Homes"
              className={
                mobileView === "map"
                  ? "hidden min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto pr-1 lg:flex"
                  : "flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto pr-1"
              }
            >
              {shown.length === 0 ? (
                <Card className="border-dashed p-6 shadow-none">
                  <EmptyBlock
                    icon="FolderHouse"
                    title={
                      filterActive || status !== "all" ? "No homes match these filters" : "No homes on offer here yet"
                    }
                    description={
                      filterActive || status !== "all"
                        ? "Try fewer filters, or clear them."
                        : scope.upgrade
                          ? `Landlords in ${scope.area} have not offered a home to brokers yet.`
                          : undefined
                    }
                    action={
                      filterActive || status !== "all" ? (
                        <ActionLink href={pathname} icon="ArrowRotateLeft">
                          Clear filters
                        </ActionLink>
                      ) : scope.upgrade ? (
                        <ActionLink href="/account?plan=1" icon="ArrowUpRight">
                          See {scope.upgrade.area.replace(/^All of /, "")}
                        </ActionLink>
                      ) : undefined
                    }
                  />
                </Card>
              ) : (
                <ul
                  className={
                    showMap
                      ? "grid gap-x-4 gap-y-5 pb-2 sm:grid-cols-2"
                      : "grid gap-x-5 gap-y-6 pb-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                  }
                >
                  {shown.map((h) => (
                    <li
                      key={h.unitId}
                      className="flex"
                      onMouseEnter={() => setHovered(h.unitId)}
                      onMouseLeave={() => setHovered(null)}
                    >
                      <HomeCard home={h} onOpen={() => setOpen(h.unitId)} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {showMap ? (
            <aside
              aria-label="Map"
              className={
                mobileView === "list"
                  ? "hidden h-full min-h-0 overflow-hidden rounded-xl border border-border lg:block"
                  : "h-[calc(100dvh-12rem)] min-h-80 overflow-hidden rounded-xl border border-border lg:h-full"
              }
            >
              {mapHomes.length > 0 ? (
                <HomesMap homes={mapHomes} hovered={hovered ?? open} onPick={setOpen} />
              ) : (
                <div className="flex size-full items-center justify-center bg-default p-6 text-center text-sm text-muted">
                  No homes to place on the map yet.
                </div>
              )}
            </aside>
          ) : null}
        </div>
      )}

      {selected ? <HomePanel key={selected.unitId} home={selected} onClose={() => setOpen(null)} /> : null}
      {pending ? <p className="sr-only">Updating homes…</p> : null}
    </>
  );
  return desk ? <div className="flex flex-col gap-4">{body}</div> : <PageContent>{body}</PageContent>;
}

/** Attach district-centre coordinates when a building has no pin of its own. */
function homesForMap(homes: readonly BrokerHome[]): BrokerHome[] {
  return homes
    .map((h) => {
      if (h.latitude !== null && h.longitude !== null) return h;
      const c = districtCentre(h.district);
      if (!c) return h;
      return { ...h, latitude: c.lat, longitude: c.lng };
    })
    .filter((h) => h.latitude !== null && h.longitude !== null);
}
