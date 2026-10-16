"use client";

import { Label, ListBox, Modal, Select, toast } from "@heroui/react";
import { Timeline } from "@heroui-pro/react";
import type { HistoryEvent } from "@injishi/data/fixtures/operations";
import { toneStatus } from "@injishi/ui";
import { type Key, type ReactNode, useEffect, useId, useState } from "react";

/** The prototype clock of the boards still drawn from fixtures (Loyalty, Distribution, Outlets). */
export const NOW = "12:20";

const KIGALI = "Africa/Kigali";

/** "07:12" in Kigali. */
export function kigaliClock(at: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: KIGALI,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(at);
}

/** "15 Oct" in Kigali. */
export function kigaliDayMonth(at: Date): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: KIGALI, day: "numeric", month: "short" }).format(at);
}

/** "Thursday 15 October 2026" in Kigali. */
export function kigaliLongDate(at: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: KIGALI,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).formatToParts(at);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("weekday")} ${part("day")} ${part("month")} ${part("year")}`;
}

/**
 * The real time in Kigali for the live boards, refreshed every minute. Null during the server render
 * and the first client render, so the two always agree; the clock appears once the page is mounted.
 */
export function useKigaliNow(): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

/** Show an action's refusal in a toast. True when the action went through. */
export function reported(result: { ok: true } | { ok: false; error: string }): boolean {
  if (!result.ok) toast.danger(result.error);
  return result.ok;
}

/** One key per press, for a command the API lets a replay land once (`Idempotency-Key`). */
export function pressKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Field label used above groups inside cards (artifact: .label). */
export function FieldLabel({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <span id={id} className="text-[13px] leading-[18px] font-medium">
      {children}
    </span>
  );
}

/** A dated history (status changes, custody, work order steps) as a compact Pro Timeline. */
export function HistoryTimeline({ events, label }: { events: HistoryEvent[]; label: string }) {
  return (
    <Timeline size="sm" density="compact" aria-label={label}>
      {events.map((e) => (
        <Timeline.Item key={`${e.what}·${e.who}`} status={toneStatus(e.tone)}>
          <Timeline.Rail>
            <Timeline.Marker />
            <Timeline.Connector />
          </Timeline.Rail>
          <Timeline.Content className="flex flex-col pb-0.5">
            <span className="text-[13px] leading-[18px] font-medium">{e.what}</span>
            <span className="text-[12px] leading-4 text-muted">{e.who}</span>
          </Timeline.Content>
        </Timeline.Item>
      ))}
    </Timeline>
  );
}

/** Append the next steps to a history; the step that was current until now becomes a past step. */
export function advance(events: HistoryEvent[], ...next: HistoryEvent[]): HistoryEvent[] {
  return [...events.map((e) => (e.tone === "current" ? { ...e, tone: "default" as const } : e)), ...next];
}

/** A labelled single-choice select (artifact: .select__trigger with a .label above). */
export function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: (string | { id: string; label: string })[];
  onChange: (v: string) => void;
}) {
  const items = options.map((o) => (typeof o === "string" ? { id: o, label: o } : o));
  return (
    <Select fullWidth value={value} onChange={(k) => k != null && onChange(String(k))} className="gap-1">
      <Label>{label}</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {items.map((o) => (
            <ListBox.Item key={o.id} id={o.id} textValue={o.label}>
              {o.label}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

/** A modal dialog for a short form or decision (artifact: .ij-dialog on .ij-scrim). */
export function FormDialog({
  isOpen,
  onOpenChange,
  title,
  description,
  children,
  footer,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer: ReactNode;
}) {
  const id = useId();
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container size="md">
        <Modal.Dialog aria-labelledby={id}>
          <Modal.CloseTrigger aria-label="Close" />
          <Modal.Header className="flex flex-col items-start gap-1">
            <Modal.Heading id={id} className="text-lg leading-[26px] font-semibold">
              {title}
            </Modal.Heading>
            {description ? <p className="text-[13px] text-muted">{description}</p> : null}
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-4">{children}</Modal.Body>
          <Modal.Footer className="flex flex-wrap items-center justify-end gap-2">{footer}</Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

/** Muted helper line that sits at the start of a dialog footer. */
export function FooterHint({ children }: { children: ReactNode }) {
  return <span className="mr-auto min-w-0 flex-[1_1_200px] text-[12px] leading-4 text-muted">{children}</span>;
}

/** Download rows as a CSV file (exports of registers and ledgers). */
export function downloadCsv(filename: string, rows: (string | number | null | undefined)[][]) {
  const cell = (v: string | number | null | undefined) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const blob = new Blob([`${rows.map((r) => r.map(cell).join(",")).join("\n")}\n`], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** First selected key of a single-selection collection (tables, lists). */
export function firstKey(keys: "all" | Set<Key>): string | null {
  if (keys === "all") return null;
  const [k] = [...keys];
  return k == null ? null : String(k);
}

/** Next sequential id after the highest numeric suffix in use, e.g. nextId("WO-", ["WO-318", "WO-329"]) → "WO-330". */
export function nextId(prefix: string, ids: string[], offset = 0): string {
  const max = Math.max(0, ...ids.map((id) => Number(id.replace(/\D/g, "")) || 0));
  return `${prefix}${max + 1 + offset}`;
}
