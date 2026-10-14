"use client";

import { Chip, Label, ListBox, Modal, ProgressBar, Select } from "@heroui/react";
import type { Tone } from "@injishi/data/fixtures/residence";
import { formatNumber, formatRwf, toneColor } from "@injishi/ui";
import type { Key, ReactNode } from "react";
import { useId } from "react";

/** "RWF 1,400,000"; negatives use a true minus sign. */
export function money(value: number): string {
  return formatRwf(value).replace(/^-/, "−");
}

/** "1,400,000" (no currency), for ranges and form defaults. */
export function plain(value: number): string {
  return formatNumber(value);
}

/** Underline tabs sized to their label (artifact: ij-tabs-line / ij-tab). */
export const lineTab = "w-auto whitespace-nowrap";

/** Rows of a master list: the selected row takes the default fill (artifact: aria-pressed rows). */
export const selectableRow = "cursor-pointer data-[selected=true]:*:bg-default";

/** First key of a single-selection collection (tables, lists, kanban). */
export function firstKey(keys: "all" | Set<Key>): string | null {
  if (keys === "all") return null;
  const [k] = [...keys];
  return k == null ? null : String(k);
}

/** Small soft status chip for a semantic tone (artifact: chip chip--{tone} chip--soft chip--sm). */
export function ToneChip({
  tone,
  children,
  size = "sm",
  className,
}: {
  tone: Tone | null | undefined;
  children: ReactNode;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <Chip size={size} variant="soft" color={toneColor(tone)} className={className}>
      {children}
    </Chip>
  );
}

/** Count badge inside a tab label (artifact: ij-tab + chip chip--sm). */
export function TabCount({ children, tone }: { children: ReactNode; tone?: Tone }) {
  return (
    <Chip size="sm" variant={tone ? "soft" : undefined} color={toneColor(tone)} className="ml-1.5 tabular">
      {children}
    </Chip>
  );
}

/** Section title inside a card (artifact: h3.ij-section-title). */
export function SubHeading({
  children,
  id,
  className = "text-[15px] leading-[22px]",
}: {
  children: ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <h3 id={id} className={`font-semibold ${className}`}>
      {children}
    </h3>
  );
}

const DOT_BG: Record<Tone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  accent: "bg-accent",
  // The theme has no info colour; a lighter chart tone keeps "pending" apart from accent ("notice", "paid late").
  info: "bg-[var(--chart-5)]",
  default: "bg-muted",
};

/** Small round status dot (artifact: ij-dot ij-dot--{tone}). Decorative; pair it with text. */
export function Dot({ tone, className }: { tone: Tone | null | undefined; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block size-2 shrink-0 rounded-full ${DOT_BG[tone ?? "default"]} ${className ?? ""}`}
    />
  );
}

/** Colour key under a chart or grid (artifact: ij-legend with an ij-dot). */
export function Legend({ items, className }: { items: { tone: Tone | null; label: string }[]; className?: string }) {
  return (
    <ul
      className={`m-0 flex list-none flex-wrap items-center gap-x-4 gap-y-1.5 p-0 text-[12px] leading-4 ${className ?? ""}`}
    >
      {items.map((it) => (
        <li key={it.label} className="inline-flex items-center gap-1.5 text-muted">
          <Dot tone={it.tone} />
          {it.label}
        </li>
      ))}
    </ul>
  );
}

/** Thin horizontal bar (artifact: ij-hbar), as a ProgressBar. */
export function HBar({
  value,
  label,
  color = "success",
  className,
}: {
  value: number;
  label: string;
  color?: "default" | "accent" | "success" | "warning" | "danger";
  className?: string;
}) {
  return (
    <ProgressBar value={value} size="sm" color={color} aria-label={label} className={className}>
      <ProgressBar.Track>
        <ProgressBar.Fill className={value > 0 ? undefined : "hidden"} />
      </ProgressBar.Track>
    </ProgressBar>
  );
}

/** A labelled single-choice select (artifact: .label above a .select__trigger). */
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
  size = "md",
  className,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer: ReactNode;
  size?: "md" | "lg";
  /** Extra classes on the dialog, e.g. a wider max-width for two-column forms. */
  className?: string;
}) {
  const id = useId();
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container size={size}>
        <Modal.Dialog aria-labelledby={id} className={className}>
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

/** Download rows as a CSV file (registers, logs and summaries exported from these screens). */
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
