"use client";

import { Card, type Selection } from "@heroui/react";
import { KPIGroup, Timeline } from "@heroui-pro/react";
import { KPI } from "@heroui-pro/react/kpi";
import { formatNumber, formatRwf, Icon } from "@injishi/ui";
import { Fragment, type ReactNode } from "react";
import type { AccountingKpi, KpiStatus, LogEntry } from "../model/accounting.ts";

/** "RWF 410,000"; negatives as "−RWF 11,800" (typographic minus, as on the artifact). */
export function rwf(value: number): string {
  return value < 0 ? `−${formatRwf(-value)}` : formatRwf(value);
}

/** "88,331". */
export function num(value: number): string {
  return formatNumber(value);
}

/** One headline figure of a KPI strip. */
export interface KpiItem {
  id: string;
  label: string;
  value: number;
  format: AccountingKpi["format"];
  suffix?: string;
  text?: string;
  foot: string;
  icon: string;
  status: KpiStatus;
}

/** Horizontal KPI strip (artifact: .kpi-group--horizontal with icon, title, value and a muted foot). */
export function KpiStrip({
  items,
  label,
  minWidth = "180px",
  valueClassName = "tabular",
}: {
  items: KpiItem[];
  label: string;
  minWidth?: "180px" | "200px" | "220px";
  valueClassName?: string;
}) {
  const sizing = {
    "180px": "min-w-[min(180px,100%)] flex-[1_1_180px]",
    "200px": "min-w-[min(200px,100%)] flex-[1_1_200px]",
    "220px": "min-w-[min(220px,100%)] flex-[1_1_220px]",
  }[minWidth];
  return (
    <section aria-label={label}>
      <KPIGroup className="flex-wrap">
        {items.map((k, i) => (
          <Fragment key={k.id}>
            {i > 0 ? <KPIGroup.Separator /> : null}
            <KPI className={sizing}>
              <KPI.Header>
                <KPI.Icon status={k.status === "default" ? undefined : k.status}>
                  <Icon name={k.icon} />
                </KPI.Icon>
                <KPI.Title>{k.label}</KPI.Title>
              </KPI.Header>
              <KPI.Content className="flex-none">
                {k.text ? (
                  <KPI.Value value={0} className={valueClassName}>
                    {() => k.text}
                  </KPI.Value>
                ) : (
                  <KPI.Value
                    value={k.value}
                    className={valueClassName}
                    formatOptions={k.format === "rwf" ? { style: "currency", currency: "RWF" } : undefined}
                  >
                    {(formatted) => `${formatted}${k.suffix ?? ""}`}
                  </KPI.Value>
                )}
              </KPI.Content>
              <KPI.Footer className="mt-auto">
                <p className="mt-1.5 text-xs leading-4 text-muted">{k.foot}</p>
              </KPI.Footer>
            </KPI>
          </Fragment>
        ))}
      </KPIGroup>
    </section>
  );
}

/** Compact status timeline (artifact: .timeline--sm.timeline--compact with plain markers). */
export function LogTimeline({ entries, label }: { entries: LogEntry[]; label: string }) {
  return (
    <Timeline size="sm" density="compact" aria-label={label}>
      {entries.map((l) => (
        <Timeline.Item key={`${l.title}|${l.detail}`} status={l.status}>
          <Timeline.Rail>
            <Timeline.Marker />
            <Timeline.Connector />
          </Timeline.Rail>
          <Timeline.Content className="flex flex-col pb-0.5 text-sm">
            <span className="font-medium">{l.title}</span>
            <span className="text-xs leading-4 text-muted">{l.detail}</span>
          </Timeline.Content>
        </Timeline.Item>
      ))}
    </Timeline>
  );
}

/** Muted helper line under a section (artifact: .ij-muted, 12px). */
export function Note({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={`text-xs leading-4 text-muted ${className ?? ""}`}>{children}</p>;
}

/** Two-line table cell: primary text over a muted 12px line (artifact: .ij-stack in a cell). */
export function Stack({
  primary,
  secondary,
  primaryClassName,
  secondaryClassName,
}: {
  primary: ReactNode;
  secondary?: ReactNode;
  primaryClassName?: string;
  secondaryClassName?: string;
}) {
  return (
    <span className="flex min-w-0 flex-col">
      <span className={primaryClassName}>{primary}</span>
      {secondary ? <span className={`text-xs text-muted ${secondaryClassName ?? ""}`}>{secondary}</span> : null}
    </span>
  );
}

/** Underline tabs sized to their label, left-aligned (artifact: .ij-tabs-line / .ij-tab). */
export const LINE_TAB = "h-10 w-auto flex-none gap-2 px-3 text-[14px]";
/** Tab list spacing of the underline tabs (artifact: 4px). */
export const LINE_LIST = "gap-1";
/** Tab panels start flush with the page column. */
export const LINE_PANEL = "mt-3 p-0";

/** Card title as an h2: the artifact's cards are page sections (h1 → h2), while Card.Title defaults to h3. */
export function CardHeading({ id, children, className }: { id: string; children: ReactNode; className?: string }) {
  return (
    <Card.Title
      id={id}
      className={`text-[15px] font-semibold ${className ?? ""}`}
      render={(props) => <h2 {...props} />}
    >
      {children}
    </Card.Title>
  );
}

/** Compact label/value list (artifact: .ij-kv at 12px), for metadata inside detail rows and previews. */
export function MetaList({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-[minmax(110px,max-content)_minmax(0,1fr)] gap-x-4 gap-y-1 text-xs leading-[18px]">
      {items.map((it) => (
        <div key={it.label} className="contents">
          <dt className="text-muted">{it.label}</dt>
          <dd className="font-medium">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** The single key of a single-selection table (RAC Selection), or null. */
export function firstKey(keys: Selection): string | null {
  if (keys === "all") return null;
  const [k] = [...keys];
  return k === undefined ? null : String(k);
}
