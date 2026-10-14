"use client";

import { Card, Description, Label, ListBox, Select } from "@heroui/react";
import { type ItemCard, Navbar, Timeline } from "@heroui-pro/react";
import type { ProcessStep, Tone } from "@injishi/data/fixtures/shared";
import { Icon } from "@injishi/ui";
import NextLink from "next/link";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/brand";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/** Underline tabs sized to their label, left-aligned (artifact: .ij-tabs-line / .ij-tab). */
export const LINE_TAB = "h-10 w-auto flex-none gap-2 px-3 text-[14px]";
/** Tab list spacing of the underline tabs (artifact: 4px). */
export const LINE_LIST = "gap-1";

/** ItemCard's own render-prop type, so the props match whichever React types HeroUI Pro resolves. */
type PressableRender = NonNullable<Parameters<typeof ItemCard<"button">>[0]["render"]>;
/** Renders an ItemCard as one button (HeroUI's documented pressable ItemCard pattern). */
export const PressableCard: PressableRender = (props) => <button type="button" {...props} />; // heroui-ok: documented pressable ItemCard

/** Header of the public pages (artifact: .navbar--static with the Injishi mark). */
export function PublicBar({
  label = "Injishi",
  maxWidth = 1240,
  height = 56,
  children,
}: {
  label?: string;
  maxWidth?: number;
  height?: number;
  children?: ReactNode;
}) {
  return (
    <Navbar
      position="static"
      maxWidth="full"
      height={`${height}px`}
      className="border-b border-separator bg-background"
    >
      <Navbar.Header className="mx-auto w-full gap-3 px-4 sm:px-8" style={{ maxWidth }}>
        <NextLink href="/" className="flex items-center gap-2.5 text-foreground no-underline">
          <BrandMark size={28} />
          <span className="text-[16px] font-semibold">{label}</span>
        </NextLink>
        {children}
      </Navbar.Header>
    </Navbar>
  );
}

/** Card title as an h2: the artifact's cards are page sections (h1 → h2), while Card.Title renders an h3. */
export function CardHeading({ id, children, className }: { id?: string; children: ReactNode; className?: string }) {
  return (
    <Card.Title
      id={id}
      className={cx("text-[15px] leading-[22px] font-semibold", className)}
      render={(props) => <h2 {...props} />}
    >
      {children}
    </Card.Title>
  );
}

const TILE_TONE: Record<Tone | "neutral", string> = {
  neutral: "bg-surface-secondary text-foreground",
  default: "bg-default text-foreground",
  accent: "bg-accent-soft text-accent-soft-foreground",
  info: "bg-accent-soft text-accent-soft-foreground",
  success: "bg-success-soft text-success-soft-foreground",
  warning: "bg-warning-soft text-warning-soft-foreground",
  danger: "bg-danger-soft text-danger-soft-foreground",
};

/** Rounded square behind an icon (artifact: inline 36–48px icon tiles). Decorative. */
export function IconTile({
  icon,
  tone = "neutral",
  size = 40,
  className,
}: {
  icon: ReactNode;
  tone?: Tone | "neutral";
  size?: 32 | 36 | 40 | 48;
  className?: string;
}) {
  const box = {
    32: "size-8 rounded-[10px]",
    36: "size-9 rounded-xl",
    40: "size-10 rounded-[13px]",
    48: "size-12 rounded-2xl",
  }[size];
  return (
    <span
      aria-hidden="true"
      className={cx("inline-flex shrink-0 items-center justify-center", box, TILE_TONE[tone], className)}
    >
      {icon}
    </span>
  );
}

/** Small muted note with a leading icon (artifact: 12px .ij-muted paragraphs with an icon). */
export function IconNote({
  icon,
  children,
  className,
  id,
}: {
  icon: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <p id={id} className={cx("flex gap-2 text-[12px] leading-[17px] text-muted", className)}>
      <span aria-hidden="true" className="mt-px flex-none [&>svg]:size-3.5">
        {icon}
      </span>
      <span>{children}</span>
    </p>
  );
}

/**
 * Single-choice HeroUI Select over plain string options (artifact: select__trigger), with a visible label
 * and optional help text.
 */
export function ChoiceSelect({
  id,
  label,
  options,
  value,
  onChange,
  help,
  labelExtra,
  className,
}: {
  id?: string;
  label: string;
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
  help?: string;
  labelExtra?: ReactNode;
  className?: string;
}) {
  const items = options.includes(value) ? options : [value, ...options];
  return (
    <Select
      id={id}
      variant="secondary"
      value={value}
      onChange={(k) => (k == null ? null : onChange(String(k)))}
      className={cx("flex flex-col gap-1", className)}
    >
      {labelExtra ? (
        <span className="flex items-center gap-1.5">
          <Label>{label}</Label>
          {labelExtra}
        </span>
      ) : (
        <Label>{label}</Label>
      )}
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      {help ? <Description>{help}</Description> : null}
      <Select.Popover>
        <ListBox>
          {items.map((o) => (
            <ListBox.Item key={o} id={o} textValue={o}>
              {o}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

/** A short process as a compact timeline (fees, claims, what happens next). */
export function ProcessTimeline({
  steps,
  label,
  className,
}: {
  steps: (ProcessStep & { extra?: ReactNode })[];
  label?: string;
  className?: string;
}) {
  return (
    <Timeline size="sm" density="compact" aria-label={label} className={className}>
      {steps.map((s) => (
        <Timeline.Item key={s.id} status={s.status}>
          <Timeline.Rail>
            <Timeline.Marker>{s.icon ? <Icon name={s.icon} className="size-3" /> : null}</Timeline.Marker>
            <Timeline.Connector />
          </Timeline.Rail>
          <Timeline.Content className="flex flex-col pb-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{s.title}</span>
              {s.extra}
            </span>
            <span className="text-[12px] leading-4 text-muted">{s.detail}</span>
          </Timeline.Content>
        </Timeline.Item>
      ))}
    </Timeline>
  );
}
