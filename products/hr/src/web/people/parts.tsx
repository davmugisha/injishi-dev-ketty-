import { CircleInfo } from "@gravity-ui/icons";
import { Avatar, Card, Pagination, ProgressCircle, Tooltip } from "@heroui/react";
import type { ReactNode } from "react";

/** "Jeanne Nyiraneza" → "JN" (first letters of the first two names, as the artifact does). */
export function initials(name: string): string {
  return name
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("");
}

export function firstName(name: string): string {
  return name.split(" ")[0] ?? name;
}

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/**
 * The boards' default panel: a Card with an 18px (or 16px) inset, a 15px title, an optional
 * description and an optional trailing action in the header row (artifact: card card--default).
 */
export function PanelCard({
  id,
  title,
  description,
  action,
  leading,
  dense = false,
  className,
  children,
}: {
  id: string;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  leading?: ReactNode;
  /** 16px inset (roster, attendance) instead of 18px. */
  dense?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card
      aria-labelledby={id}
      className={cx("min-w-0", dense ? "p-4" : "p-[18px]", className ?? "gap-3")}
      render={(props) => <section {...(props as object)} />}
    >
      <Card.Header className="flex flex-row items-start gap-2.5">
        {leading}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <Card.Title
            id={id}
            className="text-[15px] leading-[22px] font-semibold"
            render={(props) => <h2 {...(props as object)} />}
          >
            {title}
          </Card.Title>
          {description ? <Card.Description>{description}</Card.Description> : null}
        </div>
        {action}
      </Card.Header>
      {children}
    </Card>
  );
}

/**
 * A tab of the HR screens: muted until chosen, the chosen one bold in the accent over its line.
 * Keyboard focus is a ring, never a filled block, so a focused tab is never read as a second
 * selected one.
 */
export const TAB_CLASS = [
  "w-auto flex-none gap-1.5 px-3 text-muted",
  "hover:opacity-100 data-[hovered=true]:opacity-100 hover:text-foreground data-[hovered=true]:text-foreground",
  "data-[selected=true]:font-semibold data-[selected=true]:text-accent",
  "rounded-lg outline-none data-[focus-visible=true]:bg-transparent data-[focus-visible=true]:ring-2 data-[focus-visible=true]:ring-inset data-[focus-visible=true]:ring-focus",
].join(" ");

const AVATAR_COLORS = ["accent", "success", "warning", "default"] as const;

/** One colour per person, the same on every screen: picked from the name. */
export function avatarColor(name: string): (typeof AVATAR_COLORS)[number] {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

/** A person in a list: avatar, name, and one muted line under it. */
export function Person({
  name,
  sub,
  size = "sm",
  className,
}: {
  name: string;
  sub?: ReactNode;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <span className={cx("flex min-w-0 items-center gap-2.5", className)}>
      <Avatar size={size} variant="soft" color={avatarColor(name)} className="shrink-0">
        <Avatar.Fallback>{initials(name)}</Avatar.Fallback>
      </Avatar>
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-medium">{name}</span>
        {sub ? <span className="text-xs leading-4 text-muted">{sub}</span> : null}
      </span>
    </span>
  );
}

/** Rows per page on the HR lists: a list fits a screen. */
export const PAGE_SIZE = 12;

/** Page numbers under a list, drawn only when the list runs past one page. */
export function Pager({ page, total, onPage }: { page: number; total: number; onPage: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (pages <= 1) return null;
  const at = Math.min(page, pages);
  return (
    <Pagination size="sm" className="flex flex-wrap items-center justify-between gap-2">
      <Pagination.Summary className="text-xs text-muted tabular">
        {(at - 1) * PAGE_SIZE + 1}–{Math.min(at * PAGE_SIZE, total)} of {total}
      </Pagination.Summary>
      <Pagination.Content>
        <Pagination.Item>
          <Pagination.Previous aria-label="Previous page" isDisabled={at === 1} onPress={() => onPage(at - 1)}>
            <Pagination.PreviousIcon />
          </Pagination.Previous>
        </Pagination.Item>
        {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
          <Pagination.Item key={n}>
            <Pagination.Link
              isActive={n === at}
              aria-label={`Page ${n}`}
              aria-current={n === at ? "page" : undefined}
              onPress={() => onPage(n)}
            >
              {n}
            </Pagination.Link>
          </Pagination.Item>
        ))}
        <Pagination.Item>
          <Pagination.Next aria-label="Next page" isDisabled={at === pages} onPress={() => onPage(at + 1)}>
            <Pagination.NextIcon />
          </Pagination.Next>
        </Pagination.Item>
      </Pagination.Content>
    </Pagination>
  );
}

/** One page of a list; a page past the end shows the last one. */
export function pageOf<T>(rows: T[], page: number): T[] {
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const at = Math.min(page, pages);
  return rows.slice((at - 1) * PAGE_SIZE, at * PAGE_SIZE);
}

/** The detail a line of text used to carry, behind an info dot. */
export function Hint({ children, label = "More detail" }: { children: ReactNode; label?: string }) {
  return (
    <Tooltip delay={150} closeDelay={0}>
      <Tooltip.Trigger
        aria-label={label}
        className="inline-flex size-5 shrink-0 cursor-help items-center justify-center rounded-full text-muted outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-focus"
      >
        <CircleInfo className="size-3.5" aria-hidden="true" />
      </Tooltip.Trigger>
      <Tooltip.Content className="max-w-[260px] text-xs leading-4">{children}</Tooltip.Content>
    </Tooltip>
  );
}

/** Wraps anything in a tooltip: the element stays, its explanation shows on hover or focus. */
export function Tip({ tip, children, className }: { tip: ReactNode; children: ReactNode; className?: string }) {
  return (
    <Tooltip delay={150} closeDelay={0}>
      <Tooltip.Trigger className={cx("inline-flex cursor-default whitespace-nowrap outline-none", className)}>
        {children}
      </Tooltip.Trigger>
      <Tooltip.Content className="max-w-[260px] text-xs leading-4">{tip}</Tooltip.Content>
    </Tooltip>
  );
}

/** KPI.Progress takes only status colours; a healthy bar wears the accent, which is the brand colour in both themes. */
export const ACCENT_WHEN_GOOD = "[&_.progress-bar--success]:[--progress-bar-fill:var(--accent)]";

/** A progress ring with its count in the middle: "8 of 12" read at a glance. */
export function Ring({
  value,
  max,
  label,
  color = "success",
  size = "size-14",
  children,
}: {
  value: number;
  max: number;
  label: string;
  color?: "accent" | "success" | "warning" | "danger" | "default";
  /** Tailwind size of the ring. */
  size?: string;
  /** The centre; the count by default. */
  children?: ReactNode;
}) {
  return (
    <ProgressCircle
      aria-label={label}
      value={max > 0 ? Math.min(value, max) : 0}
      maxValue={Math.max(max, 1)}
      color={color}
      className="relative inline-flex shrink-0 items-center justify-center"
    >
      <ProgressCircle.Track className={size}>
        <ProgressCircle.TrackCircle />
        <ProgressCircle.FillCircle />
      </ProgressCircle.Track>
      <span className="absolute inset-0 flex items-center justify-center text-[13px] font-semibold tabular">
        {children ?? value}
      </span>
    </ProgressCircle>
  );
}
