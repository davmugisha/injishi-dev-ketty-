"use client";

import { Button, Chip, Popover, Switch } from "@heroui/react";
import { Segment } from "@heroui-pro/react";
import type { LeaderFilters, LeaderScope } from "@injishi/contracts";
import { tidyPlaceName } from "@injishi/contracts";
import { formatNumber, Icon, SelectField } from "@injishi/ui";
import { type ReactNode, useRef, useState } from "react";

type Go = (changes: Record<string, string | null>) => void;
type Params = { get: (key: string) => string | null };

/** The guest filters a leader can set; the area is apart because it is bounded by the post. */
export const GUEST_FILTER_KEYS = ["origin", "nationality", "relationship", "flagged"] as const;
const AREA_KEYS = ["sectorId", "cellId", "villageId"] as const;

/** The level a leader's widest post covers: what their area filter can go below. */
function widest(scopes: readonly LeaderScope[]): LeaderScope["level"] {
  const order = ["village", "cell", "sector", "district"] as const;
  return scopes.reduce<LeaderScope["level"]>(
    (best, s) => (order.indexOf(s.level) > order.indexOf(best) ? s.level : best),
    "village",
  );
}

function FilterPopover({
  label,
  icon,
  count,
  title,
  children,
}: {
  label: string;
  icon: "MapPin" | "Funnel";
  count: number;
  title: string;
  children: ReactNode;
}) {
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <Popover isOpen={open} onOpenChange={setOpen}>
      <Button ref={anchor} variant={count > 0 ? "secondary" : "tertiary"} size="md" className="gap-2">
        <Icon name={icon} className="size-4" />
        <span className="max-w-48 truncate">{label}</span>
        {count > 0 ? (
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

/**
 * The leader's filters, in one row: the area (only the places inside their own post, never above it: a cell
 * officer picks among their villages, a sector officer among their cells, a district officer among its
 * sectors), Rwandan or foreign, and More (nationality, relationship, flagged) in a popover. What is set
 * shows as chips under the row, each with its own remove, plus Clear all. Every choice is in the address,
 * so the API filters the list, the figures and the downloads alike.
 */
export function GuestFilters({
  params,
  go,
  scopes,
  filters,
  nationalities,
  relationships,
  flagged = false,
  leading,
  trailing,
}: {
  params: Params;
  go: Go;
  scopes: readonly LeaderScope[];
  filters: LeaderFilters;
  nationalities: readonly { code: string; name: string; count: number }[];
  /** Offered on reports; the list has no relationship filter. */
  relationships?: readonly { code: string; label: string; count: number }[];
  /** Offer "Flagged only" (reports; the list has a Flagged tab instead). */
  flagged?: boolean;
  /** Before the filters (the period on reports). */
  leading?: ReactNode;
  /** At the end of the row (the search on the list). */
  trailing?: ReactNode;
}) {
  const level = widest(scopes);
  const sectorId = params.get("sectorId");
  const cellId = params.get("cellId");
  const villageId = params.get("villageId");
  const origin = params.get("origin") ?? "all";
  const nationality = params.get("nationality");
  const relationship = params.get("relationship");
  const flaggedOnly = params.get("flagged") === "only";

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

  const moreCount = [nationality, relationship, flaggedOnly ? "1" : null].filter(Boolean).length;
  const nationalityName = nationalities.find((n) => n.code === nationality)?.name ?? nationality;
  const relationshipLabel = relationships?.find((r) => r.code === relationship)?.label ?? relationship;

  const chips: { key: string; label: string; clear: Record<string, null> }[] = [
    ...(sectorName
      ? [
          {
            key: "sector",
            label: `${tidyPlaceName(sectorName)} sector`,
            clear: { sectorId: null, cellId: null, villageId: null },
          },
        ]
      : []),
    ...(cellName
      ? [{ key: "cell", label: `${tidyPlaceName(cellName)} cell`, clear: { cellId: null, villageId: null } }]
      : []),
    ...(villageName
      ? [{ key: "village", label: `${tidyPlaceName(villageName)} village`, clear: { villageId: null } }]
      : []),
    ...(origin !== "all"
      ? [
          {
            key: "origin",
            label: origin === "nationals" ? "Rwandan guests" : "Foreign guests",
            clear: { origin: null },
          },
        ]
      : []),
    ...(nationality ? [{ key: "nat", label: nationalityName ?? "", clear: { nationality: null } }] : []),
    ...(relationship ? [{ key: "rel", label: relationshipLabel ?? "", clear: { relationship: null } }] : []),
    ...(flaggedOnly ? [{ key: "flag", label: "Flagged only", clear: { flagged: null } }] : []),
  ];
  const clearAll = () =>
    go(Object.fromEntries([...GUEST_FILTER_KEYS, ...AREA_KEYS].map((k) => [k, null])) as Record<string, null>);

  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {leading}
        {canNarrow ? (
          <FilterPopover
            label={areaLabel}
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
        <Segment
          aria-label="Guests by nationality"
          size="sm"
          selectedKey={origin}
          onSelectionChange={(k) => go({ origin: k === "all" ? null : String(k), nationality: null })}
        >
          <Segment.Item id="all">All guests</Segment.Item>
          <Segment.Item id="nationals">Rwandan</Segment.Item>
          <Segment.Item id="international">Foreign</Segment.Item>
        </Segment>
        {nationalities.length > 1 || (relationships?.length ?? 0) > 1 || flagged ? (
          <FilterPopover label="More filters" icon="Funnel" count={moreCount} title="More filters">
            {nationalities.length > 0 ? (
              <SelectField
                label="Nationality"
                value={nationality ?? ""}
                options={[
                  { id: "", label: "Any nationality" },
                  ...nationalities.map((n) => ({ id: n.code, label: `${n.name} (${formatNumber(n.count)})` })),
                ]}
                onChange={(v) => go({ nationality: v || null, origin: null })}
              />
            ) : null}
            {relationships && relationships.length > 0 ? (
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
            {flagged ? (
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
        {trailing ? <div className="ml-auto w-full sm:w-auto">{trailing}</div> : null}
      </div>
      {chips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((c) => (
            <Chip key={c.key} size="sm" variant="soft" className="gap-1 pr-1">
              {c.label}
              <button
                type="button"
                aria-label={`Remove ${c.label}`}
                onClick={() => go(c.clear)}
                className="flex size-4 items-center justify-center rounded-full hover:bg-default"
              >
                <Icon name="Xmark" className="size-3" />
              </button>
            </Chip>
          ))}
          <Button size="sm" variant="ghost" onPress={clearAll} className="h-6 px-2 text-xs">
            Clear all
          </Button>
        </div>
      ) : null}
    </div>
  );
}
