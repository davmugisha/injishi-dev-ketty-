"use client";

/**
 * A listing row's actions: ONE primary command for the row's state, and a
 * "more" menu holding the rest (Reservations, 2026-10-06).
 *
 * It used to be every command as its own button, so a confirmed booking showed
 * "On the grid" and "Cancel booking" side by side while a request showed
 * "Decline" and "Approve", and the action column's `auto` track took whatever
 * width each row's buttons added up to. That is what made Dates and Status
 * drift from row to row: every row was its own grid sized by its own buttons.
 * Now the cell holds two things of a known size, and the column has a fixed
 * width, so nothing in the row can move it.
 *
 * The menu is `@injishi/ui`'s DropdownMenu (Radix). It is NON-modal: a command
 * in it may open a dialog (decline, cancel), and two modal layers handing the
 * page's pointer lock between them is how a Radix menu leaves the body
 * unclickable. A refused item stays in the menu, inert, with the refusal as its
 * description, for the same reason `ActionButton` never hides a refusal.
 */

import { forwardRef, type ReactNode } from "react";
import { Ellipsis, type LucideIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@injishi/ui";
import { cn } from "@/lib/utils";

export interface MenuAction {
  key: string;
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  /** Why it is unavailable; the item stays, disabled, and says so. */
  deniedReason?: string;
  /** A command that gives money back or takes a stay away. Drawn apart, last. */
  danger?: boolean;
}

/** The trigger, as a ref target so a closing dialog can put focus back on it. */
export const MoreTrigger = forwardRef<HTMLButtonElement, { label: string }>(function MoreTrigger({ label }, ref) {
  return (
    <DropdownMenuTrigger
      ref={ref}
      aria-label={label}
      className={cn(
        "inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded border border-card-bd bg-card text-ink2",
        "transition-colors duration-quick ease-settle hover:bg-hover data-[state=open]:bg-hover",
      )}
    >
      <Ellipsis aria-hidden="true" className="size-4" strokeWidth={2.2} />
    </DropdownMenuTrigger>
  );
});

export function RowActions({
  primary,
  more,
  moreLabel,
  triggerRef,
  className,
}: {
  /** The row's one command, already a button. */
  primary: ReactNode;
  /** Everything else. An empty list draws a spacer, not a menu with nothing in it. */
  more: readonly MenuAction[];
  /** The trigger's accessible name: "More for Josiane Mukamana". */
  moreLabel: string;
  triggerRef?: React.Ref<HTMLButtonElement>;
  className?: string;
}) {
  const safe = more.filter((a) => !a.danger);
  const danger = more.filter((a) => a.danger);
  return (
    <span className={cn("flex items-center justify-end gap-2", className)}>
      {primary}
      {more.length === 0 ? (
        /* Holds the menu's width so this row's primary button lines up with
           every other row's. */
        <span aria-hidden="true" className="size-9 shrink-0" />
      ) : (
        <DropdownMenu modal={false}>
          <MoreTrigger ref={triggerRef} label={moreLabel} />
          <DropdownMenuContent align="end" className="min-w-56 border border-panel-bd bg-panel">
            {safe.map((a) => (
              <Item key={a.key} action={a} />
            ))}
            {safe.length > 0 && danger.length > 0 && <DropdownMenuSeparator className="bg-line" />}
            {danger.map((a) => (
              <Item key={a.key} action={a} />
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </span>
  );
}

/**
 * One command. A refused one is NOT Radix's `disabled`, which takes the item
 * out of the keyboard's path so the reason printed on it is never reached; it
 * stays focusable, says `aria-disabled`, and swallows the press with the menu
 * left open, the way `ActionButton` refuses.
 */
function Item({ action: a }: { action: MenuAction }) {
  const IconCmp = a.icon;
  const denied = Boolean(a.deniedReason);
  return (
    <DropdownMenuItem
      aria-disabled={denied || undefined}
      onSelect={(e) => {
        if (denied) {
          e.preventDefault();
          return;
        }
        a.onSelect();
      }}
      className={cn(
        "items-start",
        a.danger ? "text-bad focus:bg-bad-bg" : "text-ink2 focus:bg-hover",
        denied && "cursor-not-allowed opacity-60",
      )}
    >
      <IconCmp aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
      <span className="flex min-w-0 flex-col">
        <span className="font-semibold">{a.label}</span>
        {a.deniedReason && <span className="text-xs text-muted-foreground">{a.deniedReason}</span>}
      </span>
    </DropdownMenuItem>
  );
}
