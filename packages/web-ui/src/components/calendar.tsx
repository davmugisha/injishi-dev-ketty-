"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { cn } from "@injishi/utils";

/**
 * One month arrow. `aria-disabled` is what react-day-picker sets when there is
 * no month to go to (a `startMonth` or `endMonth` bound was reached), and the
 * click is already a no-op then; the fade and the dead pointer make the bound
 * visible instead of leaving an arrow that looks live and does nothing.
 */
const NAV_BUTTON = cn(
  "size-8 inline-flex items-center justify-center rounded-full opacity-60 transition-all",
  "hover:opacity-100 hover:bg-secondary",
  "aria-disabled:opacity-25 aria-disabled:pointer-events-none",
);

/**
 * A closed range's first and last cell carry the band behind their circle, so
 * the fill reads as one bar from check-in to check-out instead of a bar with a
 * gap at each end. The pseudo element paints the half; the button sits above
 * it (`relative`, later in the DOM) so the circle stays on top.
 */
const HALF_BAND =
  "relative before:absolute before:inset-y-0 before:w-1/2 before:bg-secondary [&>button]:relative";

/** The check-in / check-out picker behind the booking widget's date popover. */
function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        // `relative` HERE, because the nav is positioned against this box.
        // react-day-picker renders the nav as the first child of `months`, so
        // this is the box its arrows line up with: `top-1` on a 32px button
        // and `pt-1` on a 36px caption both centre at 20px. Consumers used to
        // supply a positioned wrapper outside the root, and the root's own
        // padding then put the arrows 11px above the month names.
        months: "relative flex flex-col sm:flex-row gap-4",
        month: "flex flex-col gap-4",
        month_caption: "flex justify-center pt-1 items-center h-9",
        caption_label: "text-sm font-semibold",
        // `z-10` is not decoration. The caption comes AFTER the nav in the DOM
        // and used to be `relative`, so it painted over the arrows: the
        // previous-month button could not be clicked on any surface, and with
        // the months stacked (a phone) neither button could. Measured with
        // `elementFromPoint` on the live demo, 2026-09-17.
        nav: "absolute inset-x-0 top-1 z-10 flex items-center justify-between gap-1 px-1",
        button_previous: NAV_BUTTON,
        button_next: NAV_BUTTON,
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday: "text-muted-foreground w-9 text-xs font-medium",
        week: "flex w-full mt-1",
        day: "size-9 p-0 text-center text-sm",
        day_button: cn(
          "size-9 rounded-full font-normal transition-colors",
          "hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        ),
        // THEME-FOLLOWING, not a pinned ink. `bg-ink text-white` put a
        // near-black circle on the dark popover, where the chosen night was
        // all but invisible; `foreground`/`background` inverts with the
        // surface. A consumer that pins its panel white (web's hero) gets the
        // light values anyway, because ADR-028's pin block redeclares both
        // roles inside `.bg-white`.
        selected:
          "[&>button]:bg-foreground [&>button]:text-background [&>button]:hover:bg-foreground",
        today: "[&>button]:font-semibold [&>button]:underline",
        outside: "text-muted-foreground opacity-40",
        disabled: "text-muted-foreground opacity-40 [&>button]:pointer-events-none",
        // Every day inside a range is ALSO `selected`, so the two class lists
        // land on the same cell and only stylesheet order decided which fill
        // won. `!` makes the middle explicit rather than alphabetical.
        range_middle:
          "[&>button]:bg-secondary! [&>button]:text-secondary-foreground! [&>button]:hover:bg-secondary! [&>button]:rounded-none",
        range_start: cn(HALF_BAND, "before:right-0"),
        range_end: cn(HALF_BAND, "before:left-0"),
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, ...rest }) =>
          orientation === "left" ? (
            <ChevronLeft className="size-4" {...rest} />
          ) : (
            <ChevronRight className="size-4" {...rest} />
          ),
      }}
      {...props}
    />
  );
}

export { Calendar, HALF_BAND };
