import { Chip } from "@heroui/react";
import type { ReactNode } from "react";
import { type Tone, toneBg } from "./tone.ts";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/**
 * The heading block of a page: an optional eyebrow, the title, one helper line, and the page's actions
 * (`secondary` or `ghost` buttons, the one main action `primary`). On a phone the actions
 * wrap under the title.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  size = "title",
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** "hello" for a home screen's greeting, "title" for every other page. */
  size?: "hello" | "title";
  className?: string;
}) {
  return (
    <header className={cx("flex flex-wrap items-end gap-x-4 gap-y-3", className)}>
      <div className="flex min-w-0 flex-1 basis-72 flex-col gap-1">
        {eyebrow ? <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-muted">{eyebrow}</p> : null}
        <h1
          className={cx(
            "font-semibold text-balance text-foreground",
            size === "hello" ? "text-3xl tracking-tight" : "text-2xl",
          )}
        >
          {title}
        </h1>
        {description ? <p className="text-sm text-pretty text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex min-w-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

/** A section heading inside a page, with an optional helper line and trailing content. */
export function SectionHeader({
  title,
  description,
  action,
  id,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <div className={cx("flex flex-wrap items-end justify-between gap-2", className)}>
      <div className="flex min-w-0 flex-col gap-0.5">
        <h2 id={id} className="text-base font-semibold">
          {title}
        </h2>
        {description ? <p className="text-sm text-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

/** Small round status dot. Decorative; pair it with text. */
export function StatusDot({ tone, className }: { tone?: Tone | null; className?: string }) {
  return (
    <span aria-hidden="true" className={cx("inline-block size-2 shrink-0 rounded-full", toneBg(tone), className)} />
  );
}

/** Outlined status pill used in top bars and filters. */
export function GateChip({ icon, children, className }: { icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <Chip
      variant="tertiary"
      size="sm"
      className={cx(
        "h-6 gap-1.5 rounded-full px-2 text-xs font-medium whitespace-nowrap text-muted inset-ring inset-ring-border",
        className,
      )}
    >
      {icon}
      <Chip.Label>{children}</Chip.Label>
    </Chip>
  );
}

/** Two-column label and value list. Amounts in it should be `<Money>` (tabular figures). */
export function KeyValueList({
  items,
  className,
}: {
  items: { label: ReactNode; value: ReactNode }[];
  className?: string;
}) {
  return (
    <dl className={cx("grid grid-cols-[max-content_minmax(0,1fr)] gap-x-6 gap-y-2 text-sm", className)}>
      {items.map((it, i) => (
        <div key={i} className="contents">
          <dt className="text-muted">{it.label}</dt>
          <dd className="min-w-0 font-medium">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** The workspace page's content column: full width up to a comfortable maximum, padded for phones. */
export function PageContent({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        "mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-5 px-4 pt-4 pb-10 sm:px-8 sm:pt-6 sm:pb-12",
        className,
      )}
    >
      {children}
    </div>
  );
}
