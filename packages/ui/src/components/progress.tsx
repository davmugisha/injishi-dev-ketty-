"use client"

import * as React from "react"
import { ProgressBar as HeroProgressBarBase } from "@heroui/react"

/* heroui-alias */
// HeroUI types require `children` explicitly; these adapters forward it via
// a spread that TypeScript cannot see through. Looseness stops at this
// boundary — the exported components keep their exact shadcn signatures.
const HeroProgressBar = HeroProgressBarBase as unknown as React.ComponentType<Record<string, unknown>>

import { cn } from "@injishi/utils"

/**
 * On HeroUI (React Aria). Both class strings are unchanged from the shadcn
 * original, and the track/indicator markup is still ours.
 *
 * React Aria's ProgressBar exposes the value through render props rather than
 * rendering a fill of its own, which is what lets the indicator keep the exact
 * `translateX` treatment shadcn used. Rendering HeroUI's own bar instead would
 * replace this markup and move the pixels.
 *
 * A NAME IS REQUIRED. React Aria renders `role="progressbar"`, and a
 * progressbar with no name is announced as "progress bar, 64%" of nothing. The
 * type refuses a call site that gives neither `aria-label` nor
 * `aria-labelledby`, which is how the oversight occupancy column shipped a
 * column of anonymous bars.
 *
 * The value is clamped to 0–100 before it reaches either the role or the
 * transform: 120 used to slide the fill out past the track's left edge.
 */
type ProgressName =
  | { "aria-label": string; "aria-labelledby"?: never }
  | { "aria-labelledby": string; "aria-label"?: never }

function Progress({
  className,
  // Injishi addition: callers set the fill independently of the track, so a
  // meter can wear the chart roles (`bg-chart-1` over `bg-chart-track`) or,
  // where the fill means good or bad, a status role. Upstream shadcn
  // hard-codes it to `bg-primary`.
  indicatorClassName,
  value,
  ...props
}: Omit<React.ComponentProps<"div">, "aria-label" | "aria-labelledby"> &
  ProgressName & {
    indicatorClassName?: string
    value?: number | null
  }) {
  const clamped = Math.min(100, Math.max(0, value ?? 0))
  return (
    <HeroProgressBar
      data-slot="progress"
      value={clamped}
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-primary/20",
        className
      )}
      {...(props as Record<string, unknown>)}
    >
      <div
        data-slot="progress-indicator"
        className={cn("h-full w-full flex-1 bg-primary transition-all", indicatorClassName)}
        style={{ transform: `translateX(-${100 - clamped}%)` }}
      />
    </HeroProgressBar>
  )
}

export { Progress }
