"use client";

/**
 * The sidebar's branch switcher (ADR-054 AC-S1, AC-S4).
 *
 * It replaced `LivePropertySwitcher`, which read `/inventory/properties` and was
 * shown only to `listing.manage`. Choosing a branch is not a listing operation:
 * a receptionist working one desk chooses it too. So this reads `branches` from
 * the grant, which every member holds, and seeing a branch is coverage rather
 * than a permission (`property.switch` is gone).
 *
 * - No branch yet: a link to Setup, for someone who can set one up.
 * - One branch: its name, and nothing to choose.
 * - Several: a menu. All branches first, for a member covering every branch.
 *
 * The choice goes into the URL through `BranchScope`, which owns it.
 */

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@injishi/ui";
import Link from "next/link";
import { cn } from "@/lib/utils";

import { workspaceBase } from "../lib/nav";
import { useBranchInView } from "./branch-scope";
import { Icon } from "./icon";

const TRIGGER =
  "mt-2 flex w-full items-center gap-2.5 rounded border border-border px-2.5 py-2 text-left hover:bg-hover";

/** The radio value for All branches. A branch id is a uuid, so it cannot collide. */
const ALL = "all";

export function BranchSwitcher({ workspaceId, canSetUp }: { workspaceId: string; canSetUp: boolean }) {
  const { branchId, branches, coversEvery, choose } = useBranchInView();

  if (branches.length === 0) {
    if (!canSetUp) return null;
    return (
      <Link
        href={`${workspaceBase(workspaceId)}/setup`}
        className={cn(TRIGGER, "no-underline")}
        data-cy="property-card-empty"
      >
        <Icon name="building-2" size={16} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-sidebar-primary-foreground">No property yet</span>
          <span className="block truncate text-xs text-sidebar-foreground">Set it up to start trading</span>
        </span>
        <Icon name="chevron-right" size={14} color="var(--sb-muted)" />
      </Link>
    );
  }

  const chosen = branches.find((b) => b.id === branchId) ?? null;
  const subtitle = (b: (typeof branches)[number]) =>
    [b.isHeadOffice ? "Head office" : null, b.districtName].filter(Boolean).join(" · ");

  if (branches.length === 1) {
    const only = branches[0];
    return (
      <div className={cn(TRIGGER, "hover:bg-transparent")} data-cy="branch-card">
        <Icon name="building-2" size={16} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-sidebar-primary-foreground">{only.name}</span>
          <span className="block truncate text-xs text-sidebar-foreground">{subtitle(only) || "Your branch"}</span>
        </span>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={TRIGGER} data-cy="branch-switcher">
        <Icon name="building-2" size={16} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-sidebar-primary-foreground">
            {chosen ? chosen.name : coversEvery ? "All branches" : "Your branches"}
          </span>
          <span className="block truncate text-xs text-sidebar-foreground">
            {chosen ? subtitle(chosen) : `${branches.length} branches`}
          </span>
        </span>
        <Icon name="chevron-down" size={14} color="var(--sb-muted)" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>Branch</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={branchId ?? ALL}
          onValueChange={(value) => choose(value === ALL ? null : value)}
        >
          {coversEvery && (
            <DropdownMenuRadioItem value={ALL}>
              <span className="text-sm font-semibold">All branches</span>
            </DropdownMenuRadioItem>
          )}
          {branches.map((b) => (
            <DropdownMenuRadioItem key={b.id} value={b.id}>
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-semibold">{b.name}</span>
                <span className="truncate text-xs text-muted-foreground">{subtitle(b)}</span>
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
