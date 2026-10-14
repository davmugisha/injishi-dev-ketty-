"use client";

import { Check, CircleXmark, Clock } from "@gravity-ui/icons";
import { ToggleButton } from "@heroui/react";
import { screenHref } from "@injishi/data";
import type { AvailabilityCalendarGroupBlock, AvailabilityCalendarNight } from "@injishi/data/fixtures/commercial";
import NextLink from "next/link";
import type { CSSProperties, RefObject } from "react";
import type {
  CalendarCell,
  CalendarCellFill,
  CalendarRow,
  CalendarSelection,
  CalendarSyncState,
} from "./AvailabilityCalendarModel";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/**
 * Cell look per state. HeroUI ToggleButton reads its colours from these variables, so hover and
 * pressed feedback keep working; selection is shown with an inset ring instead of a fill.
 */
const CELL_FILL: Record<CalendarCellFill, string> = {
  over: "[--toggle-button-bg:var(--danger-soft)] [--toggle-button-bg-hover:var(--danger-soft-hover)]",
  closed:
    "[--toggle-button-bg:var(--surface-secondary)] [--toggle-button-bg-hover:var(--surface-tertiary)] bg-[repeating-linear-gradient(135deg,var(--surface-secondary)_0_6px,var(--surface-tertiary)_6px_12px)]",
  override: "[--toggle-button-bg:var(--accent-soft)] [--toggle-button-bg-hover:var(--accent-soft-hover)]",
  weekend: "[--toggle-button-bg:var(--surface-secondary)] [--toggle-button-bg-hover:var(--surface-tertiary)]",
  open: "[--toggle-button-bg:transparent] [--toggle-button-bg-hover:var(--surface-secondary)]",
};

const CELL_BASE =
  "h-full w-full min-w-0 flex-col gap-px rounded-none border-l border-separator px-[2px] text-[12px] leading-4 font-normal data-[pressed=true]:transform-none [--toggle-button-fg:var(--foreground)] [--toggle-button-fg-selected:var(--foreground)] [--toggle-button-bg-selected:var(--toggle-button-bg)] [--toggle-button-bg-selected-hover:var(--toggle-button-bg-hover)] [--toggle-button-bg-pressed:var(--toggle-button-bg-hover)] [--toggle-button-bg-selected-pressed:var(--toggle-button-bg-hover)]";

const AVAIL_TONE: Record<CalendarCell["availTone"], string> = {
  danger: "text-danger",
  muted: "text-muted",
  default: "text-foreground",
};

const TAG_TONE: Record<CalendarCell["tagTone"], string> = {
  danger: "text-danger",
  warning: "text-warning",
  muted: "text-muted",
};

const SYNC: Record<CalendarSyncState, { label: string; className: string; Icon: typeof Check }> = {
  ok: { label: "OK", className: "text-success", Icon: Check },
  queued: { label: "Queued", className: "text-warning", Icon: Clock },
  failed: { label: "Failed", className: "text-danger", Icon: CircleXmark },
};

const pct = (part: number, whole: number) => `${((part / whole) * 100).toFixed(1)}%`;

/** Room types × nights: rooms left, price for the shown plan and restrictions, with click-to-select ranges. */
export function AvailabilityCalendarGrid({
  nights,
  planLabel,
  rows,
  occupancy,
  sync,
  groupBlocks,
  selection,
  anchorRef,
  onPick,
}: {
  nights: AvailabilityCalendarNight[];
  planLabel: string;
  rows: CalendarRow[];
  occupancy: { value: number; over: boolean }[];
  sync: CalendarSyncState[];
  groupBlocks: AvailabilityCalendarGroupBlock[];
  selection: CalendarSelection;
  /** Attached to the first selected night; the edit popover opens under it. */
  anchorRef: RefObject<HTMLButtonElement | null>;
  onPick: (type: string, night: number) => void;
}) {
  const cols: CSSProperties = { gridTemplateColumns: `170px repeat(${nights.length}, minmax(0, 1fr))` };
  const label = "flex items-center px-[10px] text-muted";

  return (
    <div className="min-w-0 overflow-x-auto">
      <div className="min-w-[1040px] text-[12px] leading-4">
        <div className="grid h-[48px] border-b border-separator" style={cols}>
          <div className={label}>RWF per room · {planLabel}</div>
          {nights.map((n) => (
            <div
              key={n.id}
              className={cx(
                "flex flex-col items-center justify-center border-l border-separator",
                n.isWeekend && "bg-surface-secondary",
              )}
            >
              <span className="text-muted">{n.weekday}</span>
              <span
                className={cx(
                  "text-[14px] leading-5 tabular",
                  n.isToday ? "font-bold text-accent" : "font-medium text-foreground",
                )}
              >
                {n.day}
              </span>
            </div>
          ))}
        </div>

        <div className="grid h-[30px] border-b border-separator" style={cols}>
          <div className={label}>Hotel occupancy</div>
          {occupancy.map((o, i) => (
            <div
              key={nights[i]?.id ?? i}
              className={cx(
                "flex items-center justify-center border-l border-separator font-medium tabular",
                o.over ? "text-danger" : "text-foreground",
              )}
            >
              {o.value}%
            </div>
          ))}
        </div>

        <div className="grid h-[30px] border-b border-separator" style={cols}>
          <div className={label}>Group blocks</div>
          <div className="relative" style={{ gridColumn: `2 / span ${nights.length}` }}>
            {groupBlocks.map((g) => (
              <NextLink
                key={g.id}
                href={screenHref(g.board)}
                className="absolute top-[4px] bottom-[4px] z-[1] flex items-center overflow-hidden rounded-[10px] bg-accent-soft px-[10px] text-[12px] font-medium whitespace-nowrap text-foreground no-underline shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--accent)_35%,transparent)] hover:bg-accent-soft-hover"
                style={{ left: pct(g.firstNight, nights.length), width: pct(g.nights, nights.length) }}
              >
                {g.label}
              </NextLink>
            ))}
          </div>
        </div>

        {rows.map((r) => (
          <div key={r.roomType.id} className="grid h-[66px] border-b border-separator" style={cols}>
            <div className="flex flex-col justify-center gap-[2px] px-[10px]">
              <span className="text-[13px] font-semibold">{r.roomType.name}</span>
              <span className="text-muted">{r.meta}</span>
            </div>
            {r.cells.map((c) => (
              <ToggleButton
                key={nights[c.night]?.id ?? c.night}
                ref={r.roomType.id === selection.type && c.night === selection.a ? anchorRef : undefined}
                isSelected={c.isSelected}
                onChange={() => onPick(r.roomType.id, c.night)}
                aria-label={c.aria}
                className={cx(
                  CELL_BASE,
                  CELL_FILL[c.fill],
                  c.isSelected && "shadow-[inset_0_0_0_2px_var(--accent)]",
                  c.isPending && !c.isSelected && "outline-1 outline-offset-[-4px] outline-warning outline-dashed",
                )}
              >
                <span className={cx("font-semibold", AVAIL_TONE[c.availTone])}>{c.avail}</span>
                <span className={cx("tabular", c.isOverride ? "text-accent-soft-foreground" : "text-muted")}>
                  {c.rate}
                </span>
                <span
                  className={cx("max-w-full truncate text-[11px] leading-[14px] tracking-tight", TAG_TONE[c.tagTone])}
                >
                  {c.tag}
                </span>
              </ToggleButton>
            ))}
          </div>
        ))}

        <div className="grid h-[34px]" style={cols}>
          <div className={label}>Channel sync</div>
          {sync.map((s, i) => {
            const { label: text, className, Icon } = SYNC[s];
            return (
              <div
                key={nights[i]?.id ?? i}
                className={cx(
                  "flex items-center justify-center gap-[3px] border-l border-separator text-[11px]",
                  className,
                )}
              >
                <Icon className="size-3" aria-hidden="true" />
                {text}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
