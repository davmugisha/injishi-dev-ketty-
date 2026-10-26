"use client";

import { Button, Card } from "@heroui/react";
import type { BrokerHome, BrokerHomes, BrokerHomesSort } from "@injishi/contracts";
import {
  ActionLink,
  EmptyBlock,
  formatMoney,
  formatNumber,
  Icon,
  PageContent,
  PageHeader,
  SearchBar,
  SelectField,
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
  { id: ANY, label: "Any bedrooms" },
  { id: "0", label: "Studio+" },
  { id: "1", label: "1+" },
  { id: "2", label: "2+" },
  { id: "3", label: "3+" },
];
const MAX_RENT = [
  { id: ANY, label: "Any rent" },
  { id: "150000", label: "Up to 150K" },
  { id: "250000", label: "Up to 250K" },
  { id: "400000", label: "Up to 400K" },
  { id: "600000", label: "Up to 600K" },
  { id: "1000000", label: "Up to 1M" },
];
const MIN_RENT = [
  { id: ANY, label: "No minimum" },
  { id: "100000", label: "From 100K" },
  { id: "200000", label: "From 200K" },
  { id: "350000", label: "From 350K" },
  { id: "500000", label: "From 500K" },
];
const SORTS: { id: BrokerHomesSort; label: string }[] = [
  { id: "newest", label: "Newest" },
  { id: "fee_desc", label: "Highest fee" },
  { id: "price_asc", label: "Rent ↑" },
  { id: "price_desc", label: "Rent ↓" },
];

type StatusTab = "all" | "now" | "soon";

const hidden = (words: string) => <span className="sr-only">{words}</span>;

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
    Boolean(params.get("q") || params.get("district") || params.get("bedrooms") || params.get("minRent") || params.get("maxRent")) ||
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
            showMap
              ? "grid items-start gap-x-6 gap-y-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.62fr)]"
              : "grid items-start gap-x-6 gap-y-4"
          }
          aria-busy={pending}
        >
          {/* Joined pill filter bar (feat/rentals directory) */}
          <div className="-mx-1 flex items-center gap-3 overflow-x-auto px-1 pb-1 lg:overflow-visible lg:pb-0">
            <div className="inline-flex h-11 shrink-0 items-stretch divide-x divide-border overflow-hidden rounded-full border border-border bg-surface shadow-sm">
              <div className="flex min-w-[10rem] items-center px-1 sm:min-w-[14rem]">
                <SearchBar
                  label="Search homes"
                  value={search}
                  onChange={setSearch}
                  placeholder="Building, area…"
                  className="border-0 bg-transparent shadow-none"
                />
              </div>
              <SelectField
                label={hidden("District")}
                options={[
                  { id: ANY, label: scope.plan === "district" ? scope.area : "All districts" },
                  ...data.districts.map((d) => ({
                    id: String(d.id),
                    label: `${d.name} (${formatNumber(d.count)})`,
                  })),
                ]}
                value={data.districtId ? String(data.districtId) : ANY}
                onChange={(v) => go({ district: v })}
                isDisabled={scope.plan === "district"}
                className="w-40 border-0 bg-transparent shadow-none sm:w-48"
              />
              <SelectField
                label={hidden("Bedrooms")}
                options={BEDROOMS}
                value={params.get("bedrooms") ?? ANY}
                onChange={(v) => go({ bedrooms: v })}
                className="w-28 border-0 bg-transparent shadow-none sm:w-32"
              />
              <SelectField
                label={hidden("Min rent")}
                options={MIN_RENT}
                value={params.get("minRent") ?? ANY}
                onChange={(v) => go({ minRent: v })}
                className="hidden w-32 border-0 bg-transparent shadow-none sm:block"
              />
              <SelectField
                label={hidden("Max rent")}
                options={MAX_RENT}
                value={params.get("maxRent") ?? ANY}
                onChange={(v) => go({ maxRent: v })}
                className="w-32 border-0 bg-transparent shadow-none sm:w-36"
              />
            </div>
            {filterActive ? (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  start(() => router.replace(pathname, { scroll: false }));
                }}
                className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1.5 text-sm font-medium text-muted hover:bg-default hover:text-foreground"
              >
                <Icon name="CircleXmark" />
                Clear
              </button>
            ) : null}
          </div>

          {/* Status + sort + map toggle — sits over the map column on desktop */}
          <div
            className={
              showMap
                ? "flex flex-wrap items-center justify-between gap-2"
                : "flex flex-wrap items-center justify-between gap-2 lg:justify-end"
            }
          >
            <div
              role="radiogroup"
              aria-label="Availability"
              className="inline-flex h-11 shrink-0 items-center rounded-full bg-default p-1"
            >
              {(
                [
                  ["all", "All", counts.all],
                  ["now", "Available", counts.now],
                  ["soon", "On notice", counts.soon],
                ] as const
              ).map(([key, label, n]) => (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={status === key}
                  onClick={() => setStatus(key)}
                  className={
                    status === key
                      ? "inline-flex h-9 items-center gap-1.5 rounded-full bg-surface px-3.5 text-sm font-medium text-foreground shadow-sm"
                      : "inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium text-muted hover:text-foreground"
                  }
                >
                  {label}
                  <span className="text-xs tabular text-muted">{formatNumber(n)}</span>
                </button>
              ))}
            </div>
            <span className="flex items-center gap-2">
              <SelectField
                label={hidden("Sort")}
                options={SORTS}
                value={params.get("sort") ?? "newest"}
                onChange={(v) => go({ sort: v === "newest" ? null : v })}
                className="w-36"
              />
              <Button
                isIconOnly
                variant="outline"
                className="hidden size-11 rounded-full lg:inline-flex"
                aria-label={showMap ? "Hide the map" : "Show the map"}
                onPress={() => setShowMap((v) => !v)}
              >
                <Icon name={showMap ? "LayoutCells" : "MapPin"} />
              </Button>
              <div
                role="radiogroup"
                aria-label="Show"
                className="inline-flex h-11 items-center rounded-full bg-default p-1 lg:hidden"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={mobileView === "list"}
                  className={
                    mobileView === "list"
                      ? "inline-flex h-9 items-center gap-1 rounded-full bg-surface px-3 text-sm font-medium shadow-sm"
                      : "inline-flex h-9 items-center gap-1 rounded-full px-3 text-sm text-muted"
                  }
                  onClick={() => setMobileView("list")}
                >
                  <Icon name="LayoutCells" />
                  List
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={mobileView === "map"}
                  className={
                    mobileView === "map"
                      ? "inline-flex h-9 items-center gap-1 rounded-full bg-surface px-3 text-sm font-medium shadow-sm"
                      : "inline-flex h-9 items-center gap-1 rounded-full px-3 text-sm text-muted"
                  }
                  onClick={() => setMobileView("map")}
                >
                  <Icon name="MapPin" />
                  Map
                </button>
              </div>
            </span>
          </div>

          <section
            aria-label="Homes"
            className={
              mobileView === "map"
                ? "hidden min-w-0 flex-col gap-4 lg:flex"
                : showMap
                  ? "flex min-w-0 flex-col gap-4"
                  : "flex min-w-0 flex-col gap-4 lg:col-span-2"
            }
          >
            {shown.length === 0 ? (
              <Card className="border-dashed p-6 shadow-none">
                <EmptyBlock
                  icon="FolderHouse"
                  title={filterActive || status !== "all" ? "No homes match these filters" : "No homes on offer here yet"}
                  description={
                    filterActive || status !== "all"
                      ? "Try fewer filters, or clear them."
                      : scope.upgrade
                        ? `Landlords in ${scope.area} have not offered a home to brokers yet.`
                        : undefined
                  }
                  action={
                    filterActive || status !== "all" ? (
                      <ActionLink
                        href={pathname}
                        icon="ArrowRotateLeft"
                      >
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
                    ? "grid gap-x-5 gap-y-6 sm:grid-cols-2 2xl:grid-cols-3"
                    : "grid gap-x-5 gap-y-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
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

          {showMap ? (
            <aside
              aria-label="Map"
              className={
                mobileView === "list"
                  ? "sticky top-20 hidden h-[calc(100dvh-6.5rem)] min-h-96 overflow-hidden rounded-2xl border border-border lg:block"
                  : "h-[min(70dvh,32rem)] overflow-hidden rounded-2xl border border-border lg:sticky lg:top-20 lg:h-[calc(100dvh-6.5rem)] lg:min-h-96"
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
  return homes.map((h) => {
    if (h.latitude !== null && h.longitude !== null) return h;
    const c = districtCentre(h.district);
    if (!c) return h;
    return { ...h, latitude: c.lat, longitude: c.lng };
  }).filter((h) => h.latitude !== null && h.longitude !== null);
}
