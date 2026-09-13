"use client";

/**
 * Which property Inventory is looking at, shared by its lenses (ADR-053).
 *
 * A business can hold several properties, and room types, photographs, rate
 * plans and publishing all belong to one of them. The choice lives in the URL
 * (`?property=`) rather than in component state, so moving from Room types to
 * Rate plans keeps the same property in view and a link to a lens opens on the
 * property it was copied from. With no choice made, the first property is shown.
 *
 * The picker is a native select, not a pill rail: a hotel group with twenty
 * properties turned the rail into a wall of buttons above the thing it chose.
 */

import type { OperatorPropertySummary } from "@injishi/contracts";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

import { useProperties } from "../data/ops";

export function usePropertyInView(workspaceId: string | null) {
  const list = useProperties(workspaceId);
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const properties = list.data?.properties ?? [];
  const wanted = params.get("property");
  const current = properties.find((p) => p.id === wanted) ?? properties[0] ?? null;

  const select = useCallback(
    (id: string) => {
      const next = new URLSearchParams(params.toString());
      next.set("property", id);
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [params, pathname, router],
  );

  return { list, properties, current, select };
}

/** `?property=<id>` for a lens link, so the lens opens on the same property. */
export function propertyQuery(propertyId: string | null): string {
  return propertyId ? `?property=${encodeURIComponent(propertyId)}` : "";
}

export function PropertyPicker({
  properties,
  current,
  onSelect,
}: {
  properties: OperatorPropertySummary[];
  current: OperatorPropertySummary;
  onSelect: (id: string) => void;
}) {
  // One property is the common case, and a picker with one choice is noise.
  if (properties.length < 2) return null;
  return (
    <label className="flex flex-wrap items-center gap-2.5 text-sm">
      <span className="font-semibold text-ink">Property</span>
      <select
        aria-label="Property in view"
        value={current.id}
        onChange={(e) => onSelect(e.target.value)}
        className="h-10 min-w-0 max-w-full rounded border border-line2 bg-field px-2 text-sm text-foreground"
      >
        {properties.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </label>
  );
}
