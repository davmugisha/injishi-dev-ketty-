"use client";

/**
 * The sidebar's property card, for a real workspace (2026-09-13).
 *
 * The card beside it used to be the demo store's, keyed on two fixture
 * properties, and it rendered for EVERY host workspace — so a business
 * approved five minutes ago showed "Kivu Crest Hotel · 36 rooms" in its
 * sidebar while its Setup checklist said it had no property at all. On a
 * presentation that is the first thing an audience reads.
 *
 * This one reads `GET /inventory/properties`, the rows the business actually
 * owns. With none, it says so and links to Setup. Choosing a property opens
 * Inventory on it (`?property=`), the one place a property is in view.
 */

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@injishi/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

import { useProperties } from "../data/ops";
import { workspaceBase } from "../lib/nav";
import { Icon } from "./icon";

const TRIGGER =
  "mt-2 flex w-full items-center gap-2.5 rounded border border-border px-2.5 py-2 text-left hover:bg-hover";

export function LivePropertySwitcher({ workspaceId, unitWord }: { workspaceId: string; unitWord: string }) {
  const router = useRouter();
  const list = useProperties(workspaceId);
  const base = workspaceBase(workspaceId);
  const properties = list.data?.properties ?? [];

  if (list.isPending || list.isError) return null;

  if (properties.length === 0) {
    return (
      <Link href={`${base}/setup`} className={cn(TRIGGER, "no-underline")} data-cy="property-card-empty">
        <Icon name="building-2" size={16} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-sidebar-primary-foreground">No property yet</span>
          <span className="block truncate text-xs text-sidebar-foreground">Set it up to start trading</span>
        </span>
        <Icon name="chevron-right" size={14} color="var(--sb-muted)" />
      </Link>
    );
  }

  const first = properties[0];
  const meta = (p: (typeof properties)[number]) =>
    `${p.sellableRoomCount} ${unitWord} · ${p.listingStatus === "published" ? "Live" : "Draft"}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={TRIGGER} data-cy="property-card">
        <Icon name="building-2" size={16} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-sidebar-primary-foreground">{first.name}</span>
          <span className="block truncate text-xs text-sidebar-foreground">
            {properties.length > 1 ? `${properties.length} properties` : meta(first)}
          </span>
        </span>
        <Icon name="chevron-down" size={14} color="var(--sb-muted)" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>Properties</DropdownMenuLabel>
        {properties.map((p) => (
          <DropdownMenuItem
            key={p.id}
            onSelect={() => router.push(`${base}/inventory?property=${encodeURIComponent(p.id)}`)}
          >
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-semibold">{p.name}</span>
              <span className="truncate text-xs text-muted-foreground">{meta(p)}</span>
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
