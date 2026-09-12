"use client";

/**
 * "This is demo data" — said on the screen, not only in a file header.
 *
 * The dining catalogue attaches invented menus and invented prices to NAMED
 * REAL hotels, and the room orders attach invented tickets to invented guests
 * in real room numbers. A demo may simulate all of that; it may not let anyone
 * in the room believe it is a record of something that happened. So every
 * screen that renders the catalogue carries this line, and it names the
 * property it is standing in for rather than saying "some data".
 *
 * It is not `MockBanner`. That one shows only on a sample database (ADR-043),
 * and it counts SCREENS still on fixtures. This one is about a
 * particular fabricated dataset and has to be visible wherever that dataset is,
 * including in front of an audience.
 */

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

import { Icon } from "../icon";

export function DemoNotice({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded border border-line2 bg-field px-3.5 py-2.5",
        className,
      )}
    >
      <span className="mt-px flex shrink-0 text-warn">
        <Icon name="flag" size={14} />
      </span>
      <span className="text-2xs leading-relaxed text-muted-foreground">{children}</span>
    </div>
  );
}
