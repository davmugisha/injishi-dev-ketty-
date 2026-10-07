"use client";

/**
 * The sidebar's business card: which business, which branches are in view, and
 * the way to change either (the Sidebar board; ADR-054 AC-S1, AC-S4).
 *
 * ONE CARD, where there were two switchers. The board draws the business once,
 * with the scope under its name ("All branches", or "Kiyovu · Kigali"), and
 * opens the branch menu from it. A person who holds several workspaces (a
 * hotel and a residence, two hotels) changes workspace from the same menu,
 * below the branches, so the sidebar has one place that answers "where am I".
 *
 * WHO GETS A MENU is coverage, never a role (ADR-054 AC-S4: "seeing a branch is
 * not a permission"). The branches are the grant's: the active branches this
 * member covers, head office first. A member who covers one branch and holds
 * one workspace has nothing to choose, so the card is a plain statement, which
 * is what the board shows the desk and the housekeeper who work one branch. A
 * member covering several gets the menu, All branches first when they cover
 * every branch.
 *
 * - No branch yet: the card says so, and links to Setup for someone who can
 *   set one up.
 *
 * The choice of branch goes into the URL through `BranchScope`, which owns it.
 */

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@injishi/ui";
import { ChevronRight, ChevronsUpDown } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

import { workspaceBase } from "../lib/nav";
import { useBranchInView } from "./branch-scope";

/** The card's frame, a button when it opens a menu and a plain box when not. */
const CARD =
  "flex w-full items-center gap-3 rounded-card px-3 py-2.5 text-left no-underline text-foreground";

/** The card sits on the sidebar's ground as a raised surface (the board's `sb-switch`). */
const CARD_STYLE: React.CSSProperties = {
  background: "var(--card)",
  boxShadow: "var(--surface-shadow)",
};

/** The menu is as wide as the card that opened it. */
const MENU_STYLE: React.CSSProperties = { width: "var(--radix-dropdown-menu-trigger-width)" };

/** A menu row: two lines, the name and where it is. */
const ROW = "min-h-11 gap-2.5 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";

/** The value for All branches. A branch id is a uuid, so it cannot collide. */
const ALL = "all";

/** A workspace this person may switch to. */
export interface SwitchableWorkspace {
  /** The address-bar id; the radio value. */
  workspaceId: string;
  name: string;
  /** What kind of workspace it is, in words ("Hotel", "Residence", "Broker"). */
  kind: string;
}

/** "Amahoro Hospitality Group" becomes "AH"; a one word name keeps one letter. */
export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

/** The business's mark: its initials on the accent tint, as the board draws it. */
function Mark({ name, small }: { name: string; small?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded font-bold",
        small ? "size-7 text-2xs" : "size-9 text-xs",
      )}
      style={{ background: "var(--accent-soft)", color: "var(--accent-soft-foreground)" }}
    >
      {initialsOf(name) || "·"}
    </span>
  );
}

function Lines({ name, line }: { name: string; line: string }) {
  return (
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="truncate text-sm font-semibold text-foreground">{name}</span>
      <span className="truncate text-xs text-muted-foreground">{line}</span>
    </span>
  );
}

export function BranchSwitcher({
  workspaceId,
  businessName,
  canSetUp,
  workspaces,
  onSwitchWorkspace,
}: {
  workspaceId: string;
  /** The workspace's own name, from the grant. */
  businessName: string;
  /** Whether this person can set a branch up (`listing.manage`), for the empty state. */
  canSetUp: boolean;
  /** Every workspace this person holds; a menu section only when there are two or more. */
  workspaces: readonly SwitchableWorkspace[];
  onSwitchWorkspace: (workspaceId: string) => void;
}) {
  const { branchId, branches, coversEvery, choose } = useBranchInView();

  const chosen = branches.find((b) => b.id === branchId) ?? null;
  const where = (b: (typeof branches)[number]) =>
    [b.isHeadOffice ? "Head office" : null, b.districtName].filter(Boolean).join(" · ");
  const branchLine = (b: (typeof branches)[number]) => [b.name, b.districtName].filter(Boolean).join(" · ");

  // What the card says under the business's name: the scope in view.
  const scope =
    branches.length === 0
      ? "No property yet"
      : chosen
        ? branchLine(chosen)
        : branches.length === 1
          ? branchLine(branches[0])
          : coversEvery
            ? "All branches"
            : `${branches.length} of your branches`;

  const switchesBranch = branches.length > 1;
  const switchesWorkspace = workspaces.length > 1;

  // Nothing to choose. The empty state links to Setup when it can be acted on.
  if (!switchesBranch && !switchesWorkspace) {
    const body: ReactNode = (
      <>
        <Mark name={businessName} />
        <Lines name={businessName} line={branches.length === 0 && canSetUp ? "No property yet · Set it up" : scope} />
      </>
    );
    if (branches.length === 0 && canSetUp) {
      return (
        <Link
          href={`${workspaceBase(workspaceId)}/setup`}
          className={cn(CARD, "hover:opacity-90")}
          style={CARD_STYLE}
          data-cy="property-card-empty"
        >
          {body}
          <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        </Link>
      );
    }
    return (
      <div className={CARD} style={CARD_STYLE} data-cy="branch-card">
        {body}
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(CARD, "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring")}
        style={CARD_STYLE}
        aria-label={`${businessName}, ${scope}. ${switchesBranch ? "Switch branch" : "Switch workspace"}`}
        data-cy="branch-switcher"
      >
        <Mark name={businessName} />
        <Lines name={businessName} line={scope} />
        <ChevronsUpDown aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" style={MENU_STYLE}>
        {switchesBranch && (
          <>
            <DropdownMenuLabel className="text-xs text-muted-foreground">Branches</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={branchId ?? ALL}
              onValueChange={(value) => choose(value === ALL ? null : value)}
            >
              {coversEvery && (
                <DropdownMenuRadioItem value={ALL} className={ROW}>
                  <Lines name="All branches" line={`${branches.length} branches`} />
                </DropdownMenuRadioItem>
              )}
              {branches.map((b) => (
                <DropdownMenuRadioItem key={b.id} value={b.id} className={ROW}>
                  <Lines name={b.name} line={where(b) || "Branch"} />
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </>
        )}
        {switchesBranch && switchesWorkspace && <DropdownMenuSeparator />}
        {switchesWorkspace && (
          <>
            <DropdownMenuLabel className="text-xs text-muted-foreground">Workspaces</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={workspaceId}
              onValueChange={(value) => {
                if (value !== workspaceId) onSwitchWorkspace(value);
              }}
            >
              {workspaces.map((w) => (
                <DropdownMenuRadioItem key={w.workspaceId} value={w.workspaceId} className={ROW}>
                  <Mark name={w.name} small />
                  <Lines name={w.name} line={w.kind} />
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
