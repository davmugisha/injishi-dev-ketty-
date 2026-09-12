"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { cn } from "@injishi/utils";

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
        months: "flex flex-col sm:flex-row gap-4",
        month: "flex flex-col gap-4",
        month_caption: "flex justify-center pt-1 relative items-center h-9",
        caption_label: "text-sm font-semibold",
        nav: "flex items-center gap-1 absolute inset-x-0 top-1 justify-between px-1",
        button_previous:
          "size-8 inline-flex items-center justify-center rounded-full opacity-60 hover:opacity-100 hover:bg-secondary transition-all",
        button_next:
          "size-8 inline-flex items-center justify-center rounded-full opacity-60 hover:opacity-100 hover:bg-secondary transition-all",
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday: "text-muted-foreground w-9 text-xs font-medium",
        week: "flex w-full mt-1",
        day: "size-9 p-0 text-center text-sm",
        day_button: cn(
          "size-9 rounded-full font-normal transition-colors",
          "hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        ),
        selected: "[&>button]:bg-ink [&>button]:text-white [&>button]:hover:bg-ink",
        today: "[&>button]:font-semibold [&>button]:underline",
        outside: "text-muted-foreground opacity-40",
        disabled: "text-muted-foreground opacity-40 [&>button]:pointer-events-none",
        range_middle:
          "[&>button]:bg-secondary [&>button]:text-ink [&>button]:rounded-none",
        range_start: "[&>button]:rounded-l-full",
        range_end: "[&>button]:rounded-r-full",
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

export { Calendar };
