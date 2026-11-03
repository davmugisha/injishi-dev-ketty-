"use client";

import { Button, Chip, Popover, Switch } from "@heroui/react";
import {
  GUEST_ARRIVED_LABEL,
  GUEST_LEAVING_LABEL,
  GUEST_LENGTH_LABEL,
  type GuestArrived,
  type GuestLeaving,
  type GuestLength,
  type LeaderAudience,
  type LeaderFilters,
  type LeaderScope,
  tidyPlaceName,
} from "@injishi/contracts";
import {
  ActionButton,
  BoundedDatePicker,
  BoundedDateRangePicker,
  FilterMenu,
  flagOf,
  formatNumber,
  Icon,
  type IconKey,
  SelectField,
} from "@injishi/ui";
import { type ReactNode, useRef, useState } from "react";

type Go = (changes: Record<string, string | null>) => void;
type Params = { get: (key: string) => string | null };

/** Every guest filter the address can carry; the area is apart because it is bounded by the post. */
export const GUEST_FILTER_KEYS = [
  "origin",
  "nationality",
  "relationship",
  "flagged",
  "placeType",
  "length",
  "arrived",
  "arrivedFrom",
  "arrivedTo",
  "presentOn",
  "leaving",
] as const;
export const AREA_KEYS = ["sectorId", "cellId", "villageId"] as const;

/** A nationality as a choice reads it: the flag, then the country. */
export function withFlag(code: string, name: string): string {
  const flag = flagOf(code);
  return flag ? `${flag} ${name}` : name;
}

/** The level a leader's widest post covers: what their area filter can go below. */
function widest(scopes: readonly LeaderScope[]): LeaderScope["level"] {
  const order = ["village", "cell", "sector", "district", "province", "country"] as const;
  return scopes.reduce<LeaderScope["level"]>(
    (best, s) => (order.indexOf(s.level) > order.indexOf(best) ? s.level : best),
    "village",
  );
}

function FilterPopover({
  label,
  name,
  icon,
  count,
  title,
  children,
}: {
  label: string;
  /** The visible name before the choice ("Area"). */
  name?: string;
  icon: IconKey;
  count: number;
  title: string;
  children: ReactNode;
}) {
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <Popover isOpen={open} onOpenChange={setOpen}>
      <Button
        ref={anchor}
        variant="ghost"
        className={
          count > 0
            ? "h-9 gap-2 rounded-lg border border-accent/50 bg-accent-soft px-3 font-normal text-accent-soft-foreground"
            : "h-9 gap-2 rounded-lg border border-separator bg-surface px-3 font-normal"
        }
      >
        <Icon name={icon} className={count > 0 ? "size-4 text-accent" : "size-4 text-muted"} />
        {name ? <span className={count > 0 ? "text-sm text-accent" : "text-sm text-muted"}>{name}</span> : null}
        <span className="max-w-48 truncate text-sm font-medium">{label}</span>
        {count > 0 && !name ? (
          <Chip size="sm" color="accent" variant="primary" className="min-w-5 justify-center tabular">
            {count}
          </Chip>
        ) : null}
        <Icon name="ChevronDown" className="size-3.5 text-muted" />
      </Button>
      <Popover.Content triggerRef={anchor} placement="bottom start" className="w-80 max-w-[calc(100vw-32px)]">
        <Popover.Dialog className="flex flex-col gap-4 p-4">
          <div className="flex items-center justify-between gap-2">
            <Popover.Heading level={2} className="text-sm font-semibold">
              {title}
            </Popover.Heading>
            <Button isIconOnly size="sm" variant="ghost" aria-label="Close" onPress={() => setOpen(false)}>
              <Icon name="Xmark" className="size-4" />
            </Button>
          </div>
          {children}
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}

const ARRIVED: GuestArrived[] = ["today", "yesterday", "last_7_days", "this_month"];
const LENGTHS: GuestLength[] = ["under_3", "week", "month"];

const SHORT_DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const shortDay = (iso: string): string => SHORT_DAY.format(new Date(`${iso}T12:00:00Z`));

/**
 * The leader's filters, in one toolbar row, each read on the server so the list, the figures and the
 * downloads are the same view, and each kept in the address so a view can be shared:
 *
 * - on the list, the status (all, arriving, staying, left, flagged), when guests arrived (a preset or a
 *   range), who was here on a given day, and who leaves today or this week;
 * - on both pages, the length of stay, the type of place, the nationality (with flags; DGIE reads guests
 *   from abroad only, so it has no Rwandan or foreign choice), the area inside the post, and under More,
 *   who the guests are to their hosts (and, on reports, flagged only).
 *
 * Nothing is chosen for the leader.
 */
export function GuestFilters({
  mode,
  params,
  go,
  today,
  audience,
  scopes,
  filters,
  nationalities,
  relationships,
  status,
  leading,
  trailing,
}: {
  mode: "list" | "report";
  params: Params;
  go: Go;
  /** The Kigali day, from the server. */
  today: string;
  audience: LeaderAudience;
  scopes: readonly LeaderScope[];
  filters: LeaderFilters;
  nationalities: readonly { code: string; name: string; count: number }[];
  relationships: readonly { code: string; label: string; count: number }[];
  /** The list's status menu (with counts). */
  status?: { value: string; options: { id: string; label: string; count?: number }[]; onChange: (v: string) => void };
  /** Before the filters (the search on the list, the period on reports). */
  leading?: ReactNode;
  /** At the end of the row (the downloads). */
  trailing?: ReactNode;
}) {
  const level = widest(scopes);
  const dgie = audience === "dgie";
  const sectorId = params.get("sectorId");
  const cellId = params.get("cellId");
  const villageId = params.get("villageId");
  const origin = params.get("origin") ?? "all";
  const nationality = params.get("nationality");
  const relationship = params.get("relationship");
  const flaggedOnly = params.get("flagged") === "only";
  const arrived = params.get("arrived");
  const arrivedFrom = params.get("arrivedFrom");
  const arrivedTo = params.get("arrivedTo");
  const presentOn = params.get("presentOn");
  const custom = Boolean(arrivedFrom || arrivedTo);
  // "Custom range" and "Pick a day" show their field before a day is chosen.
  const [picking, setPicking] = useState<{ arrived: boolean; present: boolean }>({ arrived: false, present: false });

  const sectorName = filters.sectors.find((s) => String(s.id) === sectorId)?.name;
  const cellName = filters.cells.find((c) => String(c.id) === cellId)?.name;
  const villageName = filters.villages.find((v) => String(v.id) === villageId)?.name;
  const ownArea = scopes[0]?.area ?? "Your area";
  const areaLabel = villageName
    ? `${tidyPlaceName(villageName)} village`
    : cellName
      ? `${tidyPlaceName(cellName)} cell`
      : sectorName
        ? `${tidyPlaceName(sectorName)} sector`
        : `All of ${ownArea.split(",")[0]}`;
  const canNarrow = level !== "village" && filters.sectors.length + filters.cells.length + filters.villages.length > 0;
  const moreCount = [relationship, flaggedOnly ? "1" : null].filter(Boolean).length;
  const placeTypes = filters.placeTypes ?? [];
  const pickingDay = (presentOn !== null && presentOn !== today) || picking.present;

  const leaving = params.get("leaving") as GuestLeaving | null;
  const length = params.get("length") as GuestLength | null;
  const whenWords = [
    arrived && GUEST_ARRIVED_LABEL[arrived as GuestArrived]
      ? `Arrived ${GUEST_ARRIVED_LABEL[arrived as GuestArrived].toLowerCase()}`
      : null,
    custom ? `Arrived ${arrivedFrom ? shortDay(arrivedFrom) : "…"} to ${arrivedTo ? shortDay(arrivedTo) : "…"}` : null,
    presentOn ? (presentOn === today ? "Here today" : `Here on ${shortDay(presentOn)}`) : null,
    leaving && GUEST_LEAVING_LABEL[leaving] ? `Leaving ${GUEST_LEAVING_LABEL[leaving].toLowerCase()}` : null,
    length && GUEST_LENGTH_LABEL[length] ? GUEST_LENGTH_LABEL[length] : null,
  ].filter((w): w is string => Boolean(w));
  const whenCount = whenWords.length;
  const whenLabel =
    whenCount === 0 ? "Any time" : whenCount === 1 ? (whenWords[0] ?? "") : `${whenWords[0]} +${whenCount - 1}`;

  const anySet =
    [...GUEST_FILTER_KEYS, ...AREA_KEYS].some((k) => params.get(k)) ||
    (status ? status.value !== "all" : false) ||
    Boolean(mode === "list" && params.get("q"));
  const clearAll = () => {
    setPicking({ arrived: false, present: false });
    go({
      ...(Object.fromEntries([...GUEST_FILTER_KEYS, ...AREA_KEYS].map((k) => [k, null])) as Record<string, null>),
      ...(mode === "list" ? { tab: null, when: null, q: null } : {}),
    });
  };

  const countries = nationalities
    .filter((n) => n.code !== "RW")
    .map((n) => ({ id: `nat:${n.code}`, label: withFlag(n.code, n.name), count: n.count }));
  const nationalityOptions = dgie
    ? [{ id: "all", label: "Every country" }, ...countries]
    : [
        { id: "all", label: "Everyone" },
        { id: "nationals", label: "Rwandan" },
        { id: "international", label: "Foreign" },
        ...countries,
      ];

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      {leading}
      {status ? (
        <FilterMenu
          label="Status"
          name="Status"
          icon="ListUl"
          options={status.options}
          value={status.value}
          onChange={status.onChange}
        />
      ) : null}
      {mode === "list" ? (
        <FilterPopover
          label={whenLabel}
          name="Dates"
          icon="Calendar"
          count={whenCount}
          title="Dates and length of stay"
        >
          <SelectField
            label="Arrived"
            value={custom || picking.arrived ? "custom" : (arrived ?? "")}
            options={[
              { id: "", label: "Any day" },
              ...ARRIVED.map((a) => ({ id: a, label: GUEST_ARRIVED_LABEL[a] })),
              { id: "custom", label: "Between two days" },
            ]}
            onChange={(v) => {
              setPicking((p) => ({ ...p, arrived: v === "custom" }));
              if (v !== "custom") go({ arrived: v || null, arrivedFrom: null, arrivedTo: null });
            }}
          />
          {custom || picking.arrived ? (
            <BoundedDateRangePicker
              label="Arrived between"
              value={arrivedFrom && arrivedTo ? { start: arrivedFrom, end: arrivedTo } : null}
              onChange={(r) => go({ arrived: null, arrivedFrom: r?.start ?? null, arrivedTo: r?.end ?? null })}
            />
          ) : null}
          <SelectField
            label="Here on"
            description="Who was in the area that day"
            value={pickingDay ? "day" : presentOn === today ? "today" : ""}
            options={[
              { id: "", label: "Any day" },
              { id: "today", label: "Today" },
              { id: "day", label: "A day I pick" },
            ]}
            onChange={(v) => {
              setPicking((p) => ({ ...p, present: v === "day" }));
              if (v !== "day") go({ presentOn: v === "today" ? today : null });
            }}
          />
          {pickingDay ? (
            <BoundedDatePicker label="The day" value={presentOn} onChange={(d) => go({ presentOn: d })} />
          ) : null}
          <SelectField
            label="Leaving"
            value={params.get("leaving") ?? ""}
            options={[
              { id: "", label: "Any day" },
              { id: "today", label: GUEST_LEAVING_LABEL.today },
              { id: "next_7_days", label: GUEST_LEAVING_LABEL.next_7_days },
            ]}
            onChange={(v) => go({ leaving: v || null })}
          />
          <SelectField
            label="Length of stay"
            value={params.get("length") ?? ""}
            options={[
              { id: "", label: "Any length" },
              ...LENGTHS.map((l) => ({ id: l, label: GUEST_LENGTH_LABEL[l] })),
            ]}
            onChange={(v) => go({ length: v || null })}
          />
        </FilterPopover>
      ) : (
        <FilterMenu
          label="Length of stay"
          name="Stay"
          icon="Clock"
          value={params.get("length") ?? "any"}
          options={[
            { id: "any", label: "Any length" },
            ...LENGTHS.map((l) => ({ id: l, label: GUEST_LENGTH_LABEL[l] })),
          ]}
          onChange={(v) => go({ length: v === "any" ? null : v })}
        />
      )}
      <FilterMenu
        label="Type of place"
        name="Place"
        icon="Suitcase"
        value={params.get("placeType") ?? "any"}
        options={[
          { id: "any", label: "Any place" },
          ...placeTypes.map((p) => ({ id: p.type, label: p.label, count: p.count })),
        ]}
        onChange={(v) => go({ placeType: v === "any" ? null : v })}
      />
      <FilterMenu
        label="Nationality"
        name={dgie ? "Nationality" : "Guests"}
        icon="Globe"
        value={nationality ? `nat:${nationality}` : dgie ? "all" : origin}
        options={nationalityOptions}
        onChange={(k) =>
          k.startsWith("nat:")
            ? go({ nationality: k.slice(4), origin: null })
            : go({ origin: k === "all" ? null : k, nationality: null })
        }
      />
      {canNarrow ? (
        <FilterPopover
          label={areaLabel}
          name="Area"
          icon="MapPin"
          count={[sectorId, cellId, villageId].filter(Boolean).length}
          title="Area"
        >
          <p className="text-xs text-muted">Inside your post: {ownArea}.</p>
          {filters.sectors.length > 0 ? (
            <SelectField
              label="Sector"
              value={sectorId ?? ""}
              options={[
                { id: "", label: "Every sector" },
                ...filters.sectors.map((s) => ({ id: String(s.id), label: tidyPlaceName(s.name) })),
              ]}
              onChange={(v) => go({ sectorId: v || null, cellId: null, villageId: null })}
            />
          ) : null}
          {filters.cells.length > 0 ? (
            <SelectField
              label="Cell"
              value={cellId ?? ""}
              options={[
                { id: "", label: "Every cell" },
                ...filters.cells.map((c) => ({ id: String(c.id), label: tidyPlaceName(c.name) })),
              ]}
              onChange={(v) => go({ cellId: v || null, villageId: null })}
            />
          ) : null}
          {filters.villages.length > 0 ? (
            <SelectField
              label="Village"
              value={villageId ?? ""}
              options={[
                { id: "", label: "Every village" },
                ...filters.villages.map((v) => ({ id: String(v.id), label: tidyPlaceName(v.name) })),
              ]}
              onChange={(v) => go({ villageId: v || null })}
            />
          ) : null}
        </FilterPopover>
      ) : null}
      {relationships.length > 1 || mode === "report" ? (
        <FilterPopover
          label={moreCount > 0 ? `More · ${moreCount}` : "More"}
          icon="Funnel"
          count={moreCount}
          title="More filters"
        >
          {relationships.length > 0 ? (
            <SelectField
              label="Who they are to the host"
              value={relationship ?? ""}
              options={[
                { id: "", label: "Any relationship" },
                ...relationships.map((r) => ({ id: r.code, label: `${r.label} (${formatNumber(r.count)})` })),
              ]}
              onChange={(v) => go({ relationship: v || null })}
            />
          ) : null}
          {mode === "report" ? (
            <div className="flex items-center justify-between gap-3">
              <span className="flex flex-col">
                <span className="text-sm font-medium" id="flagged-only">
                  Flagged only
                </span>
                <span className="text-xs text-muted">Guests a leader marked for a closer look</span>
              </span>
              <Switch
                isSelected={flaggedOnly}
                onChange={(on) => go({ flagged: on ? "only" : null })}
                aria-labelledby="flagged-only"
              >
                <Switch.Content>
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch.Content>
              </Switch>
            </div>
          ) : null}
        </FilterPopover>
      ) : null}
      {anySet ? (
        <ActionButton icon="Xmark" intent="ghost" size="sm" onPress={clearAll}>
          Clear
        </ActionButton>
      ) : null}
      {trailing ? <div className="ml-auto flex items-center gap-2">{trailing}</div> : null}
    </div>
  );
}
