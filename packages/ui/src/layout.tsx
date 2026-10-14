import { Chip } from "@heroui/react";
import type { ReactNode } from "react";
import { type Tone, toneBg } from "./tone.ts";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/** Page heading block of the workspace screens (artifact: .ij-ph — eyebrow, title, subtitle, actions). */
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
  /** "hello" = 28px greeting (home screens), "title" = 24px page title. */
  size?: "hello" | "title";
  className?: string;
}) {
  return (
    <div className={cx("flex flex-wrap items-end gap-x-4 gap-y-3", className)}>
      <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-1">
        {eyebrow ? (
          <p className="flex flex-wrap items-center gap-2 text-[13px] leading-[18px] font-medium text-muted">
            {eyebrow}
          </p>
        ) : null}
        <h1
          className={
            size === "hello"
              ? "text-[28px] leading-9 font-semibold tracking-[-0.02em]"
              : "text-2xl leading-8 font-semibold tracking-[-0.015em]"
          }
        >
          {title}
        </h1>
        {description ? <p className="text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex min-w-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** Section heading with optional description and trailing content (artifact: .ij-section-title). */
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
        <h2 id={id} className="text-[15px] leading-[22px] font-semibold">
          {title}
        </h2>
        {description ? <p className="text-[13px] leading-[18px] text-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

/** Small round status dot (artifact: .ij-dot). Decorative; pair it with text. */
export function StatusDot({ tone, className }: { tone?: Tone | null; className?: string }) {
  return (
    <span aria-hidden="true" className={cx("inline-block size-2 shrink-0 rounded-full", toneBg(tone), className)} />
  );
}

/** Outlined status pill used in top bars and filters (artifact: .ij-gate). */
export function GateChip({ icon, children, className }: { icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <Chip
      variant="tertiary"
      size="sm"
      className={cx(
        "h-[22px] gap-1.5 rounded-full px-2 text-xs font-medium whitespace-nowrap text-muted shadow-[inset_0_0_0_1px_var(--border)]",
        className,
      )}
    >
      {icon}
      <Chip.Label>{children}</Chip.Label>
    </Chip>
  );
}

/** Two-column label/value list (artifact: .ij-kv). */
export function KeyValueList({
  items,
  className,
}: {
  items: { label: ReactNode; value: ReactNode }[];
  className?: string;
}) {
  return (
    <dl
      className={cx(
        "grid grid-cols-[minmax(120px,max-content)_minmax(0,1fr)] gap-x-4 gap-y-2 text-[13px] leading-5",
        className,
      )}
    >
      {items.map((it, i) => (
        <div key={i} className="contents">
          <dt className="text-muted">{it.label}</dt>
          <dd className="font-medium">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Workspace page content column (artifact: .ij-content). */
export function PageContent({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        "mx-auto flex w-full max-w-[1400px] min-w-0 flex-col gap-5 px-4 pt-5 pb-10 sm:px-8 sm:pt-8 sm:pb-12",
        className,
      )}
    >
      {children}
    </div>
  );
}
