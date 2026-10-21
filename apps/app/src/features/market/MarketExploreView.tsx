"use client";

import {
  Calendar,
  CircleInfo,
  Clock,
  Funnel,
  Heart,
  HeartFill,
  Magnifier,
  Minus,
  Plus,
  SealCheck,
  StarFill,
  Thunderbolt,
} from "@gravity-ui/icons";
import {
  Button,
  Card,
  Checkbox,
  CheckboxGroup,
  Chip,
  Description,
  Input,
  Label,
  Separator,
  Switch,
  Tag,
  TagGroup,
  TextField,
  Toast,
  toast,
} from "@heroui/react";
import { EmptyState, ItemCard, NativeSelect, Segment } from "@heroui-pro/react";
import { BarChart } from "@heroui-pro/react/bar-chart";
import { screenHref } from "@injishi/data";
import type { BookingMode, MarketListing, MarketMode, MarketSearch } from "@injishi/data/fixtures/market";
import { stock } from "@injishi/data/media";
import { Icon, LinkButton, Photo } from "@injishi/ui";
import NextLink from "next/link";
import { type FormEvent, useState, useTransition } from "react";
import { setSavedAction } from "./actions";
import { inBand, propertyHref, rwf, shortPrice } from "./format";
import { MarketFooter, MarketHeader, MarketMain, type MarketVisitor } from "./MarketChrome";

export interface MarketExploreData {
  searches: MarketSearch[];
  listings: MarketListing[];
}

type Sort = "rec" | "price" | "rating";
type BookFilter = "any" | BookingMode;

/** Static copy per search mode (artifact renderVals: heroTitle, priceLabel, rankNote, endNote…). */
const COPY: Record<
  MarketMode,
  {
    title: string;
    sub: string;
    price: string;
    unit: string;
    per: string;
    one: string;
    many: string;
    rank: string;
    end: string;
    summary: string;
  }
> = {
  stays: {
    title: "Stays across Rwanda, booked directly",
    sub: "Live rates and availability from each property’s own system. You pay the business that hosts you.",
    price: "Price per night",
    unit: "/ night",
    per: "per night",
    one: "stay",
    many: "stays",
    rank: "Recommended order: the best rated first, then the most reviewed. Nobody pays for placement.",
    end: "That is every stay listed. Clear a filter to see more.",
    summary: "Any dates · each rate is per guest per night, from the property’s own rates",
  },
  homes: {
    title: "Homes to rent in Rwanda",
    sub: "Monthly homes from verified landlords. Apply online, then sign the lease with the landlord.",
    price: "Rent per month",
    unit: "/ month",
    per: "per month",
    one: "home to rent",
    many: "homes to rent",
    rank: "Recommended order: the best rated first, then the most reviewed. Nobody pays for placement.",
    end: "That is every home listed. Clear a filter to see more.",
    summary: "Monthly rent as each landlord lists it",
  },
};

/** "Rubavu" when every place shown is in one district, else "Rwanda": read off the live results, never a sample search. */
function areaOf(listings: MarketListing[]): string {
  const districts = new Set(listings.map((l) => l.where.split(",").at(-1)?.trim() ?? "").filter(Boolean));
  return districts.size === 1 ? [...districts][0] : "Rwanda";
}

/** Bar heights (percent of the tallest) of the live prices in 14 equal steps from the lowest to the highest. */
function priceHistogram(prices: number[]): number[] {
  const steps = 14;
  if (!prices.length) return Array(steps).fill(0);
  const lo = Math.min(...prices);
  const hi = Math.max(...prices);
  const counts: number[] = Array(steps).fill(0);
  for (const p of prices) counts[hi > lo ? Math.min(steps - 1, Math.floor(((p - lo) / (hi - lo)) * steps)) : 0] += 1;
  const top = Math.max(...counts);
  return counts.map((c) => Math.round((c / top) * 100));
}

const BOOKING: { id: BookFilter; label: string }[] = [
  { id: "any", label: "Any" },
  { id: "instant", label: "Instant" },
  { id: "request", label: "Request" },
];

const SORTS: { id: Sort; label: string }[] = [
  { id: "rec", label: "Sort: Recommended" },
  { id: "price", label: "Sort: Price, lowest first" },
  { id: "rating", label: "Sort: Guest rating" },
];

const ZOOMS = [1, 1.25, 1.5, 1.75, 2];

const toggleIn = (list: string[], value: string) =>
  list.includes(value) ? list.filter((x) => x !== value) : [...list, value];

/** Marketplace explore (artifact: MarketExplore.dc.html) — one search across stays and homes to rent. */
export function MarketExploreView({
  visitor,
  data,
  initialMode,
}: {
  visitor: MarketVisitor | null;
  data: MarketExploreData;
  initialMode: MarketMode;
}) {
  const searchOf = (m: MarketMode) => data.searches.find((s) => s.id === m) ?? data.searches[0];
  const [mode, setMode] = useState<MarketMode>(initialMode);
  const [types, setTypes] = useState<string[]>([]);
  const [book, setBook] = useState<BookFilter>("any");
  const [band, setBand] = useState("any");
  const [amen, setAmen] = useState<string[]>([]);
  const [sort, setSort] = useState<Sort>("rec");
  const [saved, setSaved] = useState<string[]>(() => data.listings.filter((l) => l.saved).map((l) => l.id));
  /** The map opens on the mode's first result in the recommended order. */
  const firstOf = (m: MarketMode) =>
    data.listings.filter((l) => l.mode === m).sort((a, b) => a.rank - b.rank)[0]?.id ?? "";
  const [sel, setSel] = useState(() => firstOf(initialMode));
  const [saving, startSaving] = useTransition();
  /** The heart saves to (or removes from) the signed-in person's lists; a refusal is shown. */
  const toggleSaved = (id: string) =>
    startSaving(async () => {
      const result = await setSavedAction(id, !saved.includes(id));
      if (result.ok) setSaved((s) => toggleIn(s, id));
      else toast.danger(result.error);
    });
  const [zoom, setZoom] = useState(0);

  const search = searchOf(mode);
  const copy = COPY[mode];
  const homes = mode === "homes";
  const pool = data.listings.filter((l) => l.mode === mode);
  const priceBand = search.bands.find((b) => b.id === band);
  const amenSel = amen.filter((a) => search.amenities.some((x) => x.id === a));

  let results = pool.filter(
    (d) =>
      (types.length === 0 || types.includes(d.type)) &&
      inBand(priceBand, d.price) &&
      amenSel.every((a) => d.amenities.includes(a)) &&
      (homes || book === "any" || d.booking === book),
  );
  if (sort === "price") results = [...results].sort((a, b) => a.price - b.price);
  else if (sort === "rating") results = [...results].sort((a, b) => b.rating - a.rating);
  else results = [...results].sort((a, b) => a.rank - b.rank);

  const selItem = results.find((d) => d.id === sel) ?? null;
  const n = results.length;
  const scale = ZOOMS[zoom];
  // What the live catalogue says about itself: where its places are and how their prices spread. The sample
  // search's area, dates and price curve are not this catalogue's, so none of them is shown.
  const area = areaOf(results.length ? results : pool);
  const histogram = priceHistogram(pool.map((d) => d.price));
  const prices = pool.map((d) => d.price);
  const histogramLabel = prices.length
    ? `Distribution of ${homes ? "monthly rents" : "nightly prices"} across ${pool.length} listed, from ${rwf(Math.min(...prices))} to ${rwf(Math.max(...prices))}`
    : `No ${homes ? "rents" : "prices"} listed yet`;

  const switchMode = (m: MarketMode) => {
    setMode(m);
    setTypes([]);
    setBand("any");
    setSel(firstOf(m));
  };
  const clearAll = () => {
    setTypes([]);
    setBand("any");
    setAmen([]);
    setBook("any");
  };
  // Searching by place and dates is not on the API's catalogue read yet: the filters beside the results work.
  const submit = (e: FormEvent) => {
    e.preventDefault();
    toast.warning("Searching by place and dates is not available yet. Use the filters beside the results.");
  };

  return (
    <>
      <MarketHeader
        width="wide"
        visitor={visitor}
        returnTo={screenHref("MarketExplore")}
        current={mode}
        onMode={switchMode}
        actions={
          <>
            <LinkButton href={screenHref("GuestAccount")} variant="ghost" size="sm">
              <Heart className="size-4" />
              Saved · {saved.length}
            </LinkButton>
            <LinkButton href={screenHref("PublicHost")} variant="ghost" size="sm" className="hidden sm:inline-flex">
              List your property
            </LinkButton>
          </>
        }
      />

      <MarketMain width="wide" className="gap-5 pt-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-[28px] leading-9 font-semibold tracking-[-0.02em]">{copy.title}</h1>
          <p className="text-sm text-muted">{copy.sub}</p>
        </div>

        <Card render={(p) => <section {...p} />} aria-label="Search" className="gap-3.5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Segment
              aria-label="What are you looking for"
              selectedKey={mode}
              onSelectionChange={(k) => switchMode(String(k) as MarketMode)}
            >
              {data.searches.map((s) => (
                <Segment.Item key={s.id} id={s.id} className="gap-1.5">
                  <Icon name={s.icon} className="size-3.5" />
                  {s.label}
                  <span className="ml-1 text-muted tabular">{data.listings.filter((l) => l.mode === s.id).length}</span>
                </Segment.Item>
              ))}
            </Segment>
            <span className="inline-flex items-center gap-1.5 text-xs text-muted">
              <Magnifier className="size-3.5" aria-hidden="true" />
              One search across hotels, lodges, camps, guest houses and homes to rent
            </span>
          </div>
          <form
            key={mode}
            onSubmit={submit}
            className="grid items-end gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(160px,100%),1fr))]"
          >
            {search.fields.map((f) => (
              <TextField key={f.id} fullWidth className={`gap-1 ${f.wide ? "sm:col-span-2" : ""}`}>
                <Label>{f.label}</Label>
                {/* The sample search's values are a hint, never a query this person made. */}
                <Input variant="secondary" placeholder={f.value} />
              </TextField>
            ))}
            <Button type="submit">
              <Magnifier className="size-4" />
              {search.submit}
            </Button>
          </form>
        </Card>

        <div className="flex flex-wrap items-start gap-6">
          <Card
            variant="secondary"
            render={(p) => <aside {...p} />}
            aria-label="Filters"
            className="min-w-[min(220px,100%)] flex-[0_1_252px] gap-[18px] p-[18px]"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[15px] leading-[22px] font-semibold">Filters</h2>
              <Button variant="ghost" size="sm" onPress={clearAll}>
                Clear all
              </Button>
            </div>

            <CheckboxGroup value={types} onChange={setTypes} className="flex flex-col gap-1.5">
              <Label className="mb-1.5">Property type</Label>
              {search.types.map((t) => (
                <Checkbox key={t.id} value={t.id} className="mt-0 w-full">
                  <Checkbox.Content className="flex w-full items-center justify-between gap-2.5 py-[3px]">
                    <span className="flex items-center gap-2.5">
                      <Checkbox.Control>
                        <Checkbox.Indicator />
                      </Checkbox.Control>
                      {t.label}
                    </span>
                    <span className="text-xs text-muted tabular">{pool.filter((d) => d.type === t.id).length}</span>
                  </Checkbox.Content>
                </Checkbox>
              ))}
            </CheckboxGroup>

            <Separator />

            <div className="flex flex-col gap-2.5">
              <span className="text-sm font-medium">{copy.price}</span>
              <div role="img" aria-label={histogramLabel} className="h-11">
                <BarChart
                  data={histogram.map((v, i) => ({ step: `${i}`, v }))}
                  height={44}
                  margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
                >
                  <BarChart.YAxis hide domain={[0, 100]} />
                  <BarChart.Bar dataKey="v" fill="var(--chart-5)" radius={[3, 3, 1, 1]} isAnimationActive={false} />
                </BarChart>
              </div>
              <TagGroup
                aria-label={copy.price}
                size="sm"
                variant="surface"
                selectionMode="single"
                disallowEmptySelection
                selectedKeys={new Set([band])}
                onSelectionChange={(keys) => {
                  const [k] = [...keys];
                  if (k) setBand(String(k));
                }}
              >
                <TagGroup.List className="flex flex-wrap gap-1.5">
                  {search.bands.map((b) => (
                    <Tag key={b.id} id={b.id}>
                      {b.label}
                    </Tag>
                  ))}
                </TagGroup.List>
              </TagGroup>
            </div>

            <Separator />

            {homes ? (
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">How homes are let</span>
                <span className="text-xs leading-[17px] text-muted">
                  By application. The landlord or their manager approves each tenant, and rent and deposit are agreed in
                  a signed lease.
                </span>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <span id="book-l" className="text-sm font-medium">
                  Booking
                </span>
                <Segment
                  aria-labelledby="book-l"
                  selectedKey={book}
                  onSelectionChange={(k) => setBook(String(k) as BookFilter)}
                  className="w-full"
                >
                  {BOOKING.map((o) => (
                    <Segment.Item key={o.id} id={o.id} className="flex-1">
                      {o.label}
                    </Segment.Item>
                  ))}
                </Segment>
                <Description className="text-xs text-muted">
                  Instant: confirmed as soon as payment is verified. Request: the host accepts or declines by a stated
                  deadline.
                </Description>
              </div>
            )}

            <Separator />

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Amenities</span>
              <TagGroup
                aria-label="Amenities"
                size="sm"
                variant="surface"
                selectionMode="multiple"
                selectedKeys={new Set(amen)}
                onSelectionChange={(keys) => setAmen([...keys].map(String))}
              >
                <TagGroup.List className="flex flex-wrap gap-1.5">
                  {search.amenities.map((a) => (
                    <Tag key={a.id} id={a.id}>
                      {a.label}
                    </Tag>
                  ))}
                </TagGroup.List>
              </TagGroup>
            </div>

            <ItemCard className="flex-col items-start gap-3">
              <ItemCard.Icon>
                <SealCheck />
              </ItemCard.Icon>
              <ItemCard.Content>
                <ItemCard.Title className="whitespace-normal">Verified businesses only</ItemCard.Title>
                <ItemCard.Description className="whitespace-normal">
                  Every listing belongs to a legal business that passed Injishi verification. Unverified listings are
                  never published.
                </ItemCard.Description>
              </ItemCard.Content>
            </ItemCard>
          </Card>

          <section className="flex min-w-0 flex-[1_1_520px] flex-col gap-3.5" aria-labelledby="res-h">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-[1_1_260px] flex-col gap-0.5">
                <h2 id="res-h" className="text-[17px] leading-6 font-semibold">
                  {n} {n === 1 ? copy.one : copy.many} in {area}
                </h2>
                <span className="text-xs text-muted">{copy.summary}</span>
              </div>
              <NativeSelect className="min-w-[min(210px,100%)]">
                <Label htmlFor="sort" className="sr-only">
                  Sort results
                </Label>
                <NativeSelect.Trigger
                  id="sort"
                  aria-label="Sort results"
                  value={sort}
                  onChange={(e) => setSort(e.target.value as Sort)}
                >
                  {SORTS.map((s) => (
                    <NativeSelect.Option key={s.id} value={s.id}>
                      {s.label}
                    </NativeSelect.Option>
                  ))}
                  <NativeSelect.Indicator />
                </NativeSelect.Trigger>
              </NativeSelect>
            </div>
            <p className="flex items-center gap-1.5 text-xs leading-4 text-muted">
              <CircleInfo className="size-3.5 shrink-0" aria-hidden="true" />
              {copy.rank}
            </p>

            {n > 0 ? (
              <>
                <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(300px,100%),1fr))]">
                  {results.map((l) => {
                    const isSaved = saved.includes(l.id);
                    const isSel = selItem?.id === l.id;
                    return (
                      <Card
                        key={l.id}
                        render={(p) => <article {...p} />}
                        className={`gap-0 overflow-hidden p-0 ${isSel ? "outline-2 outline-accent" : ""}`}
                      >
                        <div className="relative h-[160px] bg-surface-secondary">
                          <Photo image={stock[l.photo]} fill sizes="(min-width: 1280px) 330px, 100vw" />
                          <span className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/55 to-transparent px-3 pt-6 pb-2.5 text-xs text-white">
                            {l.caption}
                          </span>
                          <ModeChip listing={l} />
                          <Button
                            variant="secondary"
                            size="sm"
                            isIconOnly
                            aria-label={isSaved ? `Remove ${l.name} from saved` : `Save ${l.name}`}
                            aria-pressed={isSaved}
                            isDisabled={saving}
                            onPress={() => toggleSaved(l.id)}
                            className="absolute top-2 right-2"
                          >
                            {isSaved ? <HeartFill className="size-4 text-danger" /> : <Heart className="size-4" />}
                          </Button>
                        </div>
                        <div className="flex flex-col gap-1.5 px-4 pt-3.5 pb-4">
                          <div className="flex items-start justify-between gap-2">
                            {l.page && !homes ? (
                              <NextLink
                                href={propertyHref(l.page)}
                                className="text-[15px] leading-5 font-semibold text-inherit no-underline hover:underline"
                              >
                                {l.name}
                              </NextLink>
                            ) : (
                              <span className="text-[15px] leading-5 font-semibold">{l.name}</span>
                            )}
                            <span className="inline-flex items-center gap-1 text-[13px] whitespace-nowrap">
                              <StarFill className="size-3.5 text-warning" aria-hidden="true" />
                              <span className="font-semibold tabular">{l.rating.toFixed(1)}</span>
                              <span className="text-muted tabular">({l.reviews})</span>
                            </span>
                          </div>
                          <span className="text-[13px] text-muted">
                            {search.types.find((t) => t.id === l.type)?.label} · {l.where}
                          </span>
                          {/* The business that runs it. A search card carries no verification record, so it claims
                              none; the property page shows "Verified business" only when the API records one. */}
                          <span className="inline-flex items-center gap-1.5 text-xs text-muted">Run by {l.entity}</span>
                          <div className="mt-1 flex items-baseline justify-between gap-2">
                            <span>
                              <span className="text-base font-semibold tabular">{rwf(l.price)}</span>
                              <span className="text-[13px] text-muted">{` ${copy.unit}`}</span>
                            </span>
                            <span className="text-xs text-muted tabular">
                              {homes ? l.size : "per guest · dates on its page"}
                            </span>
                          </div>
                          {homes ? (
                            <div className="mt-1 flex items-center gap-2">
                              <Button
                                variant="secondary"
                                size="sm"
                                onPress={() =>
                                  toast.warning(
                                    `Requesting a viewing is not available yet. Nothing was sent to the landlord of ${l.name}.`,
                                  )
                                }
                              >
                                <Calendar className="size-4" />
                                Request a viewing
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      </Card>
                    );
                  })}
                </div>
                <p className="text-center text-xs text-muted">{copy.end}</p>
              </>
            ) : (
              <Card variant="secondary">
                <EmptyState size="md">
                  <EmptyState.Header>
                    <EmptyState.Media variant="icon">
                      <Funnel />
                    </EmptyState.Media>
                    <EmptyState.Title>Nothing matches every filter</EmptyState.Title>
                    <EmptyState.Description>
                      Try removing an amenity or widening the price range.
                    </EmptyState.Description>
                  </EmptyState.Header>
                  <EmptyState.Content>
                    <Button variant="secondary" size="sm" onPress={clearAll}>
                      Clear filters
                    </Button>
                  </EmptyState.Content>
                </EmptyState>
              </Card>
            )}
          </section>

          <Card
            variant="secondary"
            render={(p) => <aside {...p} />}
            aria-label="Map"
            className="min-w-[min(300px,100%)] flex-[0_1_360px] gap-0 overflow-hidden p-0"
          >
            <div className="flex items-center justify-between gap-2 px-3.5 py-3">
              <Switch isSelected={false} isDisabled size="sm" aria-describedby="map-note">
                <Switch.Content className="gap-2 text-[13px] font-normal">
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                  Search as I move the map
                </Switch.Content>
              </Switch>
              <div className="flex gap-1">
                <Button
                  variant="tertiary"
                  size="sm"
                  isIconOnly
                  aria-label="Zoom in"
                  isDisabled={zoom >= ZOOMS.length - 1}
                  onPress={() => setZoom((z) => Math.min(ZOOMS.length - 1, z + 1))}
                >
                  <Plus className="size-4" />
                </Button>
                <Button
                  variant="tertiary"
                  size="sm"
                  isIconOnly
                  aria-label="Zoom out"
                  isDisabled={zoom <= 0}
                  onPress={() => setZoom((z) => Math.max(0, z - 1))}
                >
                  <Minus className="size-4" />
                </Button>
              </div>
            </div>
            <div className="relative h-[640px] overflow-hidden bg-surface-tertiary">
              <div
                className="absolute inset-0 origin-center transition-transform duration-200"
                style={{ transform: `scale(${scale})` }}
              >
                <svg
                  viewBox="0 0 360 640"
                  width="100%"
                  height="100%"
                  preserveAspectRatio="none"
                  role="img"
                  aria-label={`Map placeholder with ${n} results pinned around ${area}`}
                  className="block"
                >
                  <path d={search.waterPath} fill="var(--accent-soft)" />
                  <path
                    d="M0 520 C 90 470, 160 430, 220 380 S 330 250, 360 210"
                    fill="none"
                    stroke="var(--separator)"
                    strokeWidth="6"
                  />
                  <path
                    d="M120 0 C 140 120, 170 220, 200 330 S 250 520, 300 640"
                    fill="none"
                    stroke="var(--separator)"
                    strokeWidth="4"
                  />
                </svg>
                {results.map((p) => {
                  const isSel = selItem?.id === p.id;
                  return (
                    <Button
                      key={p.id}
                      size="sm"
                      variant={isSel ? "primary" : "tertiary"}
                      aria-label={`${p.name}, ${rwf(p.price)} ${copy.per}`}
                      aria-pressed={isSel}
                      onPress={() => setSel(p.id)}
                      className={`absolute h-6 min-w-0 -translate-x-1/2 -translate-y-1/2 rounded-full px-2 text-xs tabular shadow-sm ${isSel ? "z-10" : "bg-surface"}`}
                      style={{
                        left: `${p.pin.x}%`,
                        top: `${p.pin.y}%`,
                        ...(scale === 1 ? {} : { scale: `${1 / scale}` }),
                      }}
                    >
                      {shortPrice(p.price)}
                    </Button>
                  );
                })}
              </div>
              <span className="absolute top-3 left-3.5 text-xs text-muted">{area}</span>
              {selItem ? (
                <Card className="absolute right-3 bottom-3 left-3 flex-row items-center gap-2 p-3">
                  <div className="relative h-14 w-16 shrink-0 overflow-hidden rounded-xl bg-surface-secondary">
                    <Photo image={stock[selItem.photo]} alt="" fill sizes="64px" />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate font-semibold">{selItem.name}</span>
                    <span className="text-xs text-muted tabular">
                      {rwf(selItem.price)} {copy.unit} · {selItem.where}
                    </span>
                  </div>
                  {!homes && selItem.page ? (
                    <LinkButton href={propertyHref(selItem.page)} size="sm">
                      View
                    </LinkButton>
                  ) : null}
                </Card>
              ) : null}
            </div>
            <p id="map-note" className="px-3.5 pt-2 pb-3 text-[11px] leading-4 text-muted">
              Pins show the approximate area. The exact address is shared after booking. Searching as the map moves is
              not available yet.
            </p>
          </Card>
        </div>
      </MarketMain>

      <MarketFooter width="wide" links={5} />
      <Toast.Provider placement="bottom" />
    </>
  );
}

/** Booking mode chip over a listing photo: instant, request (with reply time) or the home's availability. */
function ModeChip({ listing }: { listing: MarketListing }) {
  const cls = "absolute top-2.5 left-2.5 shadow-sm";
  if (listing.mode === "homes") {
    return (
      <Chip size="sm" className={cls}>
        <Calendar className="size-3" />
        <Chip.Label>{listing.available}</Chip.Label>
      </Chip>
    );
  }
  if (listing.booking === "instant") {
    return (
      <Chip size="sm" color="accent" className={cls}>
        <Thunderbolt className="size-3" />
        <Chip.Label>Instant booking</Chip.Label>
      </Chip>
    );
  }
  return (
    <Chip size="sm" className={cls}>
      <Clock className="size-3" />
      <Chip.Label>Request · replies in {listing.replies}</Chip.Label>
    </Chip>
  );
}
