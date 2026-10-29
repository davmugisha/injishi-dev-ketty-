import { Chip, Label } from "@heroui/react";
import { NativeSelect } from "@heroui-pro/react";
import { formatRwf, Icon, toneColor } from "@injishi/ui";
import { type ReactNode, useId } from "react";
import type { Tone } from "../../model/shared.ts";
import type { ChipEmphasis } from "../../model/stays.ts";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/** "RWF 9,000", or "− RWF 9,000" for reversals and credits (the artifact's signed amounts). */
export function rwf(n: number): string {
  return n < 0 ? `− ${formatRwf(-n)}` : formatRwf(n);
}

/** Whole francs of a typed amount ("12,000" → 12000); a decimal part is refused, never folded in. */
export { parseAmount, readFrancs } from "@injishi/utils/francs";

/** Status chip from a semantic tone (artifact: chip chip--{tone} chip--soft|tertiary). */
export function ToneChip({
  tone,
  emphasis = "soft",
  size = "md",
  icon,
  children,
  className,
}: {
  tone: Tone;
  emphasis?: ChipEmphasis;
  size?: "sm" | "md";
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Chip
      size={size}
      color={toneColor(tone)}
      variant={emphasis === "tertiary" ? "tertiary" : "soft"}
      className={cx("shrink-0", className)}
    >
      {icon}
      <Chip.Label>{children}</Chip.Label>
    </Chip>
  );
}

/** Card heading: h2 section title with a muted line under it and optional trailing content. */
export function CardHeading({
  id,
  title,
  sub,
  action,
  nowrap = false,
  className,
}: {
  id: string;
  title: ReactNode;
  sub?: ReactNode;
  action?: ReactNode;
  /** Keep the trailing content beside the title (the title wraps instead). */
  nowrap?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "flex items-start justify-between gap-x-3 gap-y-2",
        nowrap ? "flex-nowrap" : "flex-wrap",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <h2 id={id} className="text-[15px] leading-[22px] font-semibold">
          {title}
        </h2>
        {sub ? <span className="text-[12px] leading-4 text-muted">{sub}</span> : null}
      </div>
      {action}
    </div>
  );
}

/** Icon, title and detail with a trailing state chip (keys, documents, consent, rails…). */
export function InfoRow({
  icon,
  title,
  detail,
  trailing,
  as: As = "div",
  titleClassName,
}: {
  icon: string;
  title: ReactNode;
  detail: ReactNode;
  trailing?: ReactNode;
  as?: "div" | "li";
  titleClassName?: string;
}) {
  return (
    <As className="flex items-start gap-2.5">
      <Icon name={icon} className="mt-0.5 size-4 shrink-0 text-muted" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={cx("text-[13px] leading-[18px] font-medium tabular", titleClassName)}>{title}</span>
        <span className="text-[12px] leading-4 text-muted tabular">{detail}</span>
      </span>
      {trailing}
    </As>
  );
}

/** Small figure tile on a secondary surface (artifact: stat blocks on var(--surface-secondary)). */
export function StatTile({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("flex min-w-0 flex-col gap-0.5 rounded-[14px] bg-surface-secondary px-3 py-2.5", className)}>
      {children}
    </div>
  );
}

/** Rounded icon tile used in list rows (artifact: item-card__icon at 32px). */
export function IconTile({ name, className }: { name: string; className?: string }) {
  return (
    <span
      className={cx(
        "flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-default text-foreground",
        className,
      )}
    >
      <Icon name={name} className="size-4" />
    </span>
  );
}

/** Inline note with a leading icon: bold lead sentence followed by muted detail. */
export function Note({
  icon,
  lead,
  children,
  iconClassName = "text-warning",
  size = "sm",
  role,
}: {
  icon: string;
  lead?: ReactNode;
  children?: ReactNode;
  iconClassName?: string;
  size?: "sm" | "xs";
  role?: "status";
}) {
  return (
    <p
      role={role}
      className={cx("flex items-start gap-2", size === "xs" ? "text-[12px] leading-4" : "text-[13px] leading-[18px]")}
    >
      <Icon name={icon} className={cx("mt-px size-4 shrink-0", iconClassName)} />
      <span>
        {lead ? <span className="font-medium">{lead}</span> : null}
        {lead && children ? " " : null}
        {children ? <span className="text-muted">{children}</span> : null}
      </span>
    </p>
  );
}

/** A labelled native select (artifact: native-select with label). The label is tied to the select by id. */
export function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  className,
}: {
  label: ReactNode;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  /** Empty first option, e.g. "Choose a reason". */
  placeholder?: string;
  className?: string;
}) {
  const id = useId();
  return (
    <NativeSelect variant="secondary" fullWidth className={className}>
      <Label htmlFor={id}>{label}</Label>
      <NativeSelect.Trigger id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {placeholder === undefined ? null : <NativeSelect.Option value="">{placeholder}</NativeSelect.Option>}
        {options.map((o) => (
          <NativeSelect.Option key={o} value={o}>
            {o}
          </NativeSelect.Option>
        ))}
        <NativeSelect.Indicator />
      </NativeSelect.Trigger>
    </NativeSelect>
  );
}
