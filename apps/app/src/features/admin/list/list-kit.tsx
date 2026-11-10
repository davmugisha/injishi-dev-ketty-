"use client";

import {
  ActionButton,
  FilterMenu,
  FormDialog,
  IconAction,
  type KpiItem,
  ListToolbar,
  type PlaceChain,
  type PlaceLevel,
  PlacePicker,
  SearchBar,
} from "@injishi/ui";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createContext, type ReactNode, useContext, useEffect, useRef, useState, useTransition } from "react";
import { loadGuestPlaces } from "../../guests/places";
import { StatCards } from "./stat-cards";

/**
 * The admin list kit (2026-11-09): one way to filter every admin list. Every filter lives in the URL, so a
 * filtered list can be shared and the server answers it; changing any filter goes back to page 1, and the
 * list dims while the next answer loads. Search filters as you type, every other filter is a menu with its
 * counts, the area is picked down the place cascade, and "Clear all" appears once anything is set.
 */

/** The menu value meaning "no filter": the first option of every `ListFilter`. */
export const ALL = "all";

const AREA_KEYS = ["provinceId", "districtId", "sectorId", "cellId", "villageId"] as const;

interface ListUrl {
  get: (key: string) => string;
  set: (changes: Record<string, string | null>) => void;
  hrefWith: (changes: Record<string, string | null>) => string;
  pending: boolean;
}

const Ctx = createContext<ListUrl | null>(null);

/** Wraps one list page, so its toolbar, strip and grid share the URL and the loading state. */
export function ListUrlProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();

  const next = (changes: Record<string, string | null>): string => {
    const out = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v === null || v === "" || v === ALL) out.delete(k);
      else out.set(k, v);
    }
    // Any other filter starts the list again from its first page (or first cursor).
    if (!("page" in changes)) out.delete("page");
    if (!("cursor" in changes)) {
      out.delete("cursor");
      out.delete("back");
    }
    const qs = out.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  const value: ListUrl = {
    get: (key) => params.get(key) ?? "",
    set: (changes) => start(() => router.replace(next(changes), { scroll: false })),
    hrefWith: next,
    pending,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useListUrl(): ListUrl {
  const v = useContext(Ctx);
  if (!v) throw new Error("useListUrl needs a ListUrlProvider around the list.");
  return v;
}

/** Search as you type, sent a moment after the last key so each letter is not a request. */
export function ListSearch({ placeholder, param = "q" }: { placeholder: string; param?: string }) {
  const url = useListUrl();
  const [text, setText] = useState(url.get(param));
  const first = useRef(true);
  // biome-ignore lint/correctness/useExhaustiveDependencies: only the typed text starts a search.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => {
      if (text.trim() !== url.get(param)) url.set({ [param]: text.trim() || null });
    }, 350);
    return () => clearTimeout(t);
  }, [text]);
  return (
    <SearchBar label={placeholder} placeholder={placeholder} value={text} onChange={setText} className="md:w-72" />
  );
}

export interface ListOption {
  id: string;
  label: string;
  count?: number;
}

/** One menu filter bound to a URL key; the first option is "All" (`ALL`). */
export function ListFilter({
  param,
  name,
  icon,
  options,
}: {
  param: string;
  name: string;
  icon?: Parameters<typeof FilterMenu>[0]["icon"];
  options: readonly ListOption[];
}) {
  const url = useListUrl();
  const value = url.get(param) || ALL;
  return (
    <FilterMenu
      label={name}
      name={name}
      icon={icon}
      options={options}
      value={options.some((o) => o.id === value) ? value : ALL}
      onChange={(v) => url.set({ [param]: v })}
    />
  );
}

/** The days a "since" filter offers, read by the page as a start date (`sinceDay`). */
export const SINCE_OPTIONS: readonly ListOption[] = [
  { id: ALL, label: "Any time" },
  { id: "7", label: "Last 7 days" },
  { id: "30", label: "Last 30 days" },
  { id: "90", label: "Last 3 months" },
  { id: "365", label: "Last 12 months" },
];

/** "Registered" / "Joined" over the last few days, as `?since=30`. */
export function SinceFilter({ name, param = "since" }: { name: string; param?: string }) {
  return <ListFilter param={param} name={name} icon="Calendar" options={SINCE_OPTIONS} />;
}

/** The narrowest place chosen: "Gasabo", or "Kigali City" when only the province is. */
const placeWords = (chain: PlaceChain): string =>
  [chain.village, chain.cell, chain.sector, chain.district, chain.province].find(Boolean)?.name ?? "";

/** The area, picked down the place cascade to `depth`, as `provinceId` … ids in the URL. */
export function AreaFilter({ chain, depth = "district" }: { chain: PlaceChain; depth?: PlaceLevel }) {
  const url = useListUrl();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<PlaceChain>(chain);
  const words = placeWords(chain);
  const clear = Object.fromEntries(AREA_KEYS.map((k) => [k, null]));
  return (
    <>
      <span className="flex items-center">
        <ActionButton
          icon="MapPin"
          size="sm"
          intent={words ? "secondary" : "ghost"}
          onPress={() => {
            setDraft(chain);
            setOpen(true);
          }}
          className="h-9 max-w-56 rounded-lg border border-separator"
        >
          <span className="truncate">{words ? `Area: ${words}` : "Area: All"}</span>
        </ActionButton>
        {words ? <IconAction icon="Xmark" label="Every area" onPress={() => url.set(clear)} /> : null}
      </span>
      {open ? (
        <FormDialog
          isOpen
          onOpenChange={(o) => (o ? undefined : setOpen(false))}
          title="Show one area"
          submitLabel="Apply"
          onSubmit={(event) => {
            event.preventDefault();
            const ids: Record<string, string | null> = { ...clear };
            const level = {
              provinceId: "province",
              districtId: "district",
              sectorId: "sector",
              cellId: "cell",
              villageId: "village",
            } as const;
            for (const k of AREA_KEYS) {
              const p = draft[level[k]];
              if (p) ids[k] = String(p.id);
            }
            url.set(ids);
            setOpen(false);
          }}
        >
          <PlacePicker
            label="Area"
            value={draft}
            depth={depth}
            onChange={setDraft}
            loadPlaces={loadGuestPlaces}
            reserveSpace={false}
          />
          <p className="text-sm text-muted">Stop at any level: a province shows everything in it.</p>
        </FormDialog>
      ) : null}
    </>
  );
}

/**
 * The row above a list: filters, then the search pushed to the end, then "Clear all" when any of `keys` is
 * set, and the number found.
 */
export function ListBar({
  keys,
  found,
  noun,
  children,
  search,
}: {
  keys: readonly string[];
  found: number;
  noun: { one: string; many: string };
  children?: ReactNode;
  search?: ReactNode;
}) {
  const url = useListUrl();
  const set = [...keys, ...AREA_KEYS].some((k) => url.get(k));
  return (
    <div className="flex flex-col gap-2">
      <ListToolbar>
        {search}
        {children}
        {set ? (
          <ActionButton
            size="sm"
            intent="ghost"
            onPress={() => url.set(Object.fromEntries([...keys, ...AREA_KEYS].map((k) => [k, null])))}
          >
            Clear all
          </ActionButton>
        ) : null}
      </ListToolbar>
      <p className="text-sm text-muted" aria-live="polite">
        {url.pending
          ? "Loading…"
          : `${found.toLocaleString("en-GB")} ${found === 1 ? noun.one : noun.many}${set ? " match" : ""}`}
      </p>
    </div>
  );
}

/** Counts above a list that are also its quickest filter: pressing one shows those, pressing it again all. */
export function CountStrip({
  label,
  param,
  items,
}: {
  label: string;
  param: string;
  items: readonly (Omit<KpiItem, "format" | "href" | "isCurrent"> & { id: string })[];
}) {
  const url = useListUrl();
  const current = url.get(param);
  return (
    <StatCards
      label={label}
      columns={items.length <= 3 || items.length === 6 ? 3 : items.length === 4 ? 4 : 5}
      stats={items.map((i) => ({
        id: i.id,
        label: i.label,
        value: i.value,
        icon: i.icon ?? "Persons",
        tone: i.status ?? "accent",
        footnote: i.footnote,
        isCurrent: current === i.id,
        href: url.hrefWith({ [param]: current === i.id ? null : i.id }),
      }))}
    />
  );
}
