"use client";

/**
 * PMS UI primitives — the Injishi vocabulary, built on shadcn/ui.
 *
 * shadcn owns the mechanics (variants via CVA, Radix behaviour, focus rings);
 * this file owns the Injishi meaning. `Badge intent="ok"` is a domain word, not
 * a colour, and it resolves through the shadcn → token bridge in globals.css,
 * so pms-tokens.css stays the single place a colour literal lives
 * (ui-tokens.md invariant).
 *
 * Screens import from here, never from `@injishi/ui` directly, so the
 * whole surface can be re-skinned in one file.
 *
 * `surface` and `fieldStyle` remain CSSProperties: they are spread into
 * container elements by screens that predate the shadcn pass. New code should
 * use `surfaceClass` / `fieldClass` instead.
 */

import { cva, type VariantProps } from "class-variance-authority";
import { useId, type CSSProperties, type ReactNode } from "react";
import { Badge as ShadBadge, Button, Card, Skeleton as ShadSkeleton } from "../../legacy-ui";
import { cn } from "@/lib/utils";
import type { Intent } from "../data/types";

/* ── Badge ──────────────────────────────────────────────────────────────── */

const badgeIntent = cva("rounded-full px-2.5 py-[3px] text-2xs font-semibold whitespace-nowrap border-transparent", {
  variants: {
    intent: {
      ok: "bg-ok-bg text-ok",
      warn: "bg-warn-bg text-warn",
      bad: "bg-bad-bg text-bad",
      info: "bg-info-bg text-info",
      accent: "bg-accent-soft text-accent-text",
      neutral: "bg-hover text-muted-foreground",
    },
  },
  defaultVariants: { intent: "neutral" },
});

/**
 * Status badge. Always renders its text — colour never carries meaning alone
 * (WCAG 2.1 AA, ui-tokens.md invariant).
 */
export function Badge({
  children,
  intent = "neutral",
  className,
}: {
  children: ReactNode;
  className?: string;
} & VariantProps<typeof badgeIntent>) {
  return <ShadBadge className={cn(badgeIntent({ intent }), className)}>{children}</ShadBadge>;
}

/* ── Chip ───────────────────────────────────────────────────────────────── */

/**
 * A filter chip. These are actionable counts, not decoration: tapping one
 * filters the list beneath it (blueprint §7).
 */
export function Chip({
  n,
  label,
  active,
  onClick,
  dot,
  size = "md",
}: {
  n?: number | string;
  label: string;
  active: boolean;
  onClick: () => void;
  /** A status dot instead of a count (Room status). */
  dot?: string;
  size?: "md" | "sm";
}) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "gap-2 rounded-full border-[1.5px] text-sm font-semibold",
        dot ? "items-center" : "items-baseline",
        size === "md" ? "h-11 px-4" : "h-10 px-[15px]",
        active
          ? "border-accent-text bg-accent-soft text-accent-text hover:bg-accent-soft"
          : "border-card-bd bg-card text-ink2 hover:bg-hover",
      )}
    >
      {dot && <span className="size-[9px] rounded-full" style={{ background: dot }} />}
      {n !== undefined && (
        <span className={cn("pms-num font-bold", size === "md" ? "text-lg" : "text-base")}>{n}</span>
      )}
      {label}
    </Button>
  );
}

/* ── Buttons ────────────────────────────────────────────────────────────── */

type ButtonVariant = "primary" | "secondary";

/**
 * A row/panel action. Primary is the green accent with ink text (never white).
 *
 * `deniedReason` is how a screen refuses without lying (ADR-012, AC-5). Pass the
 * sentence `useCapability().reasonFor(...)` returned and the control turns
 * inert, states why, and stays reachable.
 *
 * It deliberately does NOT use the `disabled` attribute, which looks like the
 * obvious answer and is wrong twice over:
 *
 *   - a disabled button leaves the tab order, so a keyboard user never lands on
 *     it and never hears the reason at all;
 *   - browsers suppress pointer events on a disabled control, so the `title`
 *     tooltip meant to carry the reason never appears on hover either.
 *
 * `aria-disabled` keeps it focusable and announced as unavailable, the click is
 * dropped here rather than by the browser, and the reason rides in both a
 * `title` (for the mouse) and a screen reader only description (for everyone
 * else). Keep `disabled` for "busy right now", which is a different state.
 */
export function ActionButton({
  children,
  onClick,
  variant = "secondary",
  className,
  style,
  deniedReason,
  ...rest
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: ButtonVariant;
  className?: string;
  style?: CSSProperties;
  /** Why this action is unavailable. Omit when it is available. */
  deniedReason?: string;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "style" | "onClick" | "className">) {
  const reasonId = useId();
  const denied = Boolean(deniedReason);

  return (
    <>
      <Button
        type="button"
        onClick={denied ? undefined : onClick}
        aria-disabled={denied || undefined}
        aria-describedby={denied ? reasonId : undefined}
        title={deniedReason}
        style={style}
        className={cn(
          "h-[38px] border px-4 text-xs font-semibold whitespace-nowrap rounded",
          variant === "primary"
            ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
            : "border-card-bd bg-card text-ink2 hover:bg-hover",
          denied && "opacity-50 cursor-not-allowed hover:bg-card",
          className,
        )}
        {...rest}
      >
        {children}
      </Button>
      {denied && (
        <span id={reasonId} className="sr-only">
          {deniedReason}
        </span>
      )}
    </>
  );
}

/* ── Surfaces ───────────────────────────────────────────────────────────── */

/** The standard panel: hairline border, card fill, soft radius. */
export const surfaceClass = "rounded border border-panel-bd bg-card";

/** @deprecated Prefer `surfaceClass`. Kept for screens written before shadcn. */
export const surface: CSSProperties = {
  border: "1px solid var(--panel-bd)",
  background: "var(--card)",
  borderRadius: "var(--radius-surface)",
};

/**
 * The uppercase column-header strip above a listing table.
 *
 * Only the track sizing ever differs between screens, so it is the one argument.
 * Everything else — the 10.5px bold uppercase treatment, the 11/18 padding and
 * the hairline underline — is the shared row rhythm, and it drifted the moment
 * it lived in two files.
 */
export function tableHeadStyle(gridTemplateColumns: string): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns,
    gap: 10,
    padding: "11px 18px",
    fontSize: 10.5,
    fontWeight: 700,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    color: "var(--muted2)",
    borderBottom: "1px solid var(--line)",
  };
}

/**
 * A headline number over its label. The same markup as the operator app's
 * `StatCard`: a description list, label first in the DOM, figure on top by
 * `order`, proportional digits.
 */
export function StatCard({ n, label }: { n: string; label: string }) {
  return (
    <Card as="dl" className={cn(surfaceClass, "gap-0 px-4 py-3.5 shadow-none")}>
      <dt className="order-2 mt-[3px] text-xs text-muted-foreground">{label}</dt>
      <dd className="order-1 text-xl font-bold tracking-[-0.3px] whitespace-nowrap text-ink">{n}</dd>
    </Card>
  );
}

/** A section's uppercase eyebrow, with an optional count. */
export function SectionHeading({ children, n }: { children: ReactNode; n?: string | number }) {
  return (
    <div className="flex items-baseline gap-2">
      <h2 className="text-2xs font-bold tracking-[0.09em] uppercase text-[var(--muted2)]">{children}</h2>
      {n !== undefined && <span className="pms-num text-2xs text-faint">{n}</span>}
    </div>
  );
}

/**
 * An empty state. It always gives direction — never a bare zero
 * (blueprint §5 copy rules).
 */
export function EmptyState({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      style={style}
      className={cn("border border-dashed border-line2 px-5 py-[18px] text-sm text-muted-foreground rounded", className)}
    >
      {children}
    </div>
  );
}

/** Avatar circle with initials. */
export function Initials({ children, size = 36 }: { children: ReactNode; size?: number }) {
  return (
    <span
      style={{ width: size, height: size }}
      className="flex shrink-0 items-center justify-center rounded-full border border-line2 bg-field text-2xs font-bold text-ink2"
    >
      {children}
    </span>
  );
}

/* ── Fields ─────────────────────────────────────────────────────────────── */

/** The standard input skin — used by `Input`/`select` alike. */
const fieldClass =
  "h-10 w-full border border-line2 bg-field px-3 text-sm text-foreground focus-visible:ring-2 focus-visible:ring-ring rounded";

/** @deprecated Prefer `fieldClass`. Kept for screens written before shadcn. */
export const fieldStyle: CSSProperties = {
  width: "100%",
  minHeight: 40,
  border: "1px solid var(--line2)",
  background: "var(--field)",
  color: "var(--foreground)",
  borderRadius: "var(--radius-surface)",
  padding: "0 12px",
  fontSize: 13,
};

/** Uppercase field label. */
export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label className="text-2xs font-bold tracking-[0.08em] uppercase text-[var(--muted2)]">{children}</label>
  );
}

/* ── Skeleton ───────────────────────────────────────────────────────────── */

/**
 * Loading placeholder. Shape matches the screen it stands in for.
 *
 * `delay` is MILLISECONDS, as every caller passes it. Written as seconds, the
 * stagger was three orders of magnitude out and simply never ran.
 */
export function Skeleton({ height, delay = 0, style }: { height: number; delay?: number; style?: CSSProperties }) {
  return (
    <ShadSkeleton
      style={{ height, animationDelay: `${delay}ms`, ...style }}
      className="rounded bg-hover"
    />
  );
}
