import * as React from "react"

import { cn } from "@injishi/utils"

/** One row of a `BarList`: a thing, how much of it, and that amount as words. */
type BarListRow = {
  key: string
  /** What the row is: a district, a department. */
  label: React.ReactNode
  /** The magnitude the bar draws. Below zero draws as an empty track. */
  value: number
  /** The same magnitude as text, formatted by the caller. Always shown. */
  display: React.ReactNode
  /** A trailing note: a month-on-month badge, a share of the total. */
  detail?: React.ReactNode
  /**
   * Set aside by a filter. The bar keeps its length and loses its colour; the
   * label and value stay readable. Fading the whole row is what this replaced.
   */
  muted?: boolean
}

/**
 * A ranked horizontal bar chart: one series, one row per thing, the value
 * written at every bar.
 *
 * THE SCALE IS SHARED, which is the whole reason this is a component. Every
 * row sits on the same subgrid, so every track is the same length and a bar
 * half as long means half as much. Two hand-built copies of this (the admin
 * density list and the operator revenue table) each drew their own track, and a
 * value column of varying width made the tracks, and so the scale, differ from
 * row to row.
 *
 * The marks follow the one chart spec: a bar grows from a square baseline to a
 * `rounded` (4px) data end, 10px thick, in `chart-1` over a `chart-track` of the
 * same hue. A non-zero value never renders as nothing: 1 of 250 still shows a
 * 2px sliver, so "a little" and "none" do not look alike.
 *
 * The bar is `aria-hidden`. The value is text in the row, so the list is its
 * own table view: a screen reader hears "Gasabo, 12, up 2", and nobody needs a
 * tooltip or colour to read any number. There is no hover layer for the same
 * reason: it would have nothing to add.
 *
 * Order is the caller's. Rank by value for a comparison; keep a fixed order
 * when readers look for the same row in the same place every month.
 */
function BarList({
  rows,
  max,
  className,
  style,
  ...props
}: Omit<React.ComponentProps<"ul">, "children"> & {
  rows: readonly BarListRow[]
  /** The value a full-length bar stands for. Defaults to the largest row. */
  max?: number
}) {
  const peak = max ?? rows.reduce((m, row) => Math.max(m, row.value), 0)
  const hasDetail = rows.some((row) => row.detail != null)

  return (
    <ul
      data-slot="bar-list"
      // Tailwind's preflight strips the list style, and Safari drops the list
      // role with it. Saying so keeps "list, 30 items" for VoiceOver.
      role="list"
      className={cn("grid items-center gap-x-3 gap-y-2", className)}
      style={{
        gridTemplateColumns: `fit-content(40%) minmax(3rem, 1fr) auto${hasDetail ? " auto" : ""}`,
        ...style,
      }}
      {...props}
    >
      {rows.map((row) => {
        const share = peak > 0 ? Math.min(Math.max(row.value, 0) / peak, 1) : 0
        return (
          <li
            key={row.key}
            data-muted={row.muted || undefined}
            className="col-span-full grid grid-cols-subgrid items-center"
          >
            <span
              className={cn(
                "min-w-0 truncate text-sm font-semibold",
                row.muted ? "text-muted-foreground" : "text-foreground"
              )}
              title={typeof row.label === "string" ? row.label : undefined}
            >
              {row.label}
            </span>
            <span aria-hidden className="relative block h-2.5 rounded-r bg-chart-track">
              <span
                className={cn(
                  "absolute inset-y-0 left-0 rounded-r transition-colors",
                  row.muted ? "bg-chart-muted" : "bg-chart-1"
                )}
                style={{ width: `${share * 100}%`, minWidth: row.value > 0 ? 2 : 0 }}
              />
            </span>
            <span
              className={cn(
                "text-right text-sm font-bold tabular-nums",
                row.muted ? "text-muted-foreground" : "text-foreground"
              )}
            >
              {row.display}
            </span>
            {hasDetail ? <span className="justify-self-end">{row.detail}</span> : null}
          </li>
        )
      })}
    </ul>
  )
}

export { BarList, type BarListRow }
