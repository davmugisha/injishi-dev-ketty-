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

import { ListBox, Select } from "@heroui/react";
import { cva, type VariantProps } from "class-variance-authority";
import { useId, type CSSProperties, type ReactNode } from "react";
import { Badge as ShadBadge, Button, Card, Skeleton as ShadSkeleton } from "@injishi/ui";
import { cn } from "@/lib/utils";
import type { Intent } from "../data/types";

/* ── Badge ──────────────────────────────────────────────────────────────── */

/**
 * The intent sets HeroUI's own chip variables rather than a `bg-*`/`text-*`
 * pair.
 *
 * `.chip` declares `background-color: var(--chip-bg)` from an UNLAYERED rule,
 * and unlayered CSS beats Tailwind's `@layer utilities` whatever the source
 * order. A `bg-ok-bg` class therefore never landed once `@heroui/styles` was
 * imported: every intent rendered the same fill. Driving `--chip-bg` and
 * `--chip-fg` works with that rule instead of against it, and the six intents
 * still resolve to the same pms tokens they always did.
 */
const badgeIntent = cva("rounded-full font-semibold whitespace-nowrap border-transparent", {
  variants: {
    intent: {
      ok: "[--chip-bg:var(--ok-bg)] [--chip-fg:var(--ok)]",
      warn: "[--chip-bg:var(--warn-bg)] [--chip-fg:var(--warn)]",
      bad: "[--chip-bg:var(--bad-bg)] [--chip-fg:var(--bad)]",
      info: "[--chip-bg:var(--info-bg)] [--chip-fg:var(--info)]",
      accent: "[--chip-bg:var(--accent-soft)] [--chip-fg:var(--accent-text)]",
      neutral: "[--chip-bg:var(--hover)] [--chip-fg:var(--muted-foreground)]",
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
  // `ghost` maps to HeroUI's transparent chip, so the only thing setting
  // --chip-bg is the intent above.
  return (
    <ShadBadge variant="ghost" size="sm" className={cn(badgeIntent({ intent }), className)}>
      {children}
    </ShadBadge>
  );
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
      // Size and shape are PROPS (ADR-037 call 4). The height, border width
      // and font size this used to spell in `className` were the old copy of
      // `button.tsx` wearing a class string, and they made a chip here a
      // different control from a chip on the marketplace.
      size={size}
      shape="pill"
      className={cn(
        "gap-2 font-semibold",
        dot ? "items-center" : "items-baseline",
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
/**
 * The two fills, as classes rather than as a second CVA.
 *
 * Exported so `ConfirmAction` can dress its resting button as this one without
 * being this one: it swaps a button's variant in place, and two different
 * components at the same position would unmount the control under the finger
 * that just pressed it.
 */
export function actionButtonClass(variant: ButtonVariant, denied = false): string {
  return cn(
    "font-semibold whitespace-nowrap",
    variant === "primary"
      ? undefined
      : "border-card-bd text-ink2 [--button-bg:var(--card)] [--button-bg-hover:var(--hover)]",
    denied && "cursor-not-allowed opacity-50 [--button-bg-hover:var(--card)]",
  );
}

export function ActionButton({
  children,
  onClick,
  variant = "secondary",
  className,
  style,
  deniedReason,
  pending,
  ...rest
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: ButtonVariant;
  className?: string;
  style?: CSSProperties;
  /** Why this action is unavailable. Omit when it is available. */
  deniedReason?: string;
  /**
   * This button's work is under way. Prefer it to `disabled` for a wait: the
   * control keeps its focus and its label, refuses a second press, and shimmers
   * so the press visibly registered. `disabled` is for "not available", which
   * is a different state and reads as a dead control.
   */
  pending?: boolean;
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
        // The VARIANT is passed through, not spelled as `bg-*` classes.
        // `.button--primary` sets `background-color: var(--button-bg)` from an
        // unlayered rule and beats Tailwind's `@layer utilities`, so the two
        // variants here rendered identically the moment `@heroui/styles` was
        // imported — both took HeroUI's own `primary` default. The secondary
        // fill is a pms surface HeroUI has no variant for, so it drives
        // `--button-bg` instead of fighting it.
        variant={variant === "primary" ? "primary" : "outline"}
        // The SIZE is a prop too (ADR-037 call 4): `sm` is the row action, and
        // `rounded` is the operator surface's corner for a control.
        size="sm"
        shape="rounded"
        style={style}
        pending={pending}
        className={cn(actionButtonClass(variant, denied), className)}
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
 * A headline number over its label.
 *
 * A description list, label first in the DOM so a screen reader hears
 * "Declaration due, 15 January" rather than a number and then what it was;
 * `order` keeps the figure on top. No `pms-num`: tabular digits are for a
 * column of numbers, and a lone figure at this size reads loose in them.
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

/**
 * A read that did not answer.
 *
 * One component for all of them, because the shape of this message is a rule
 * rather than a preference. It has three parts and every screen needs all
 * three: what we could not load, the reassurance that the data is still there,
 * and a way to ask again.
 *
 * WHAT IT MUST NOT DO IS NAME A CAUSE. Twenty-five screens used to say "this is
 * a connection problem", which the app does not know: a 500, a refused read and
 * a dead socket all arrive here, and telling an operator their connection is at
 * fault sends them to restart a router while the fault is ours. Own it instead
 * — "this is on our side" is true of all three.
 */
export function LoadFailed({
  children,
  onRetry,
  retrying,
  className,
  style,
}: {
  /** What could not be loaded, and why the absence is not a fact. */
  children: ReactNode;
  /** Ask again. Omit only where the screen genuinely cannot refetch. */
  onRetry?: () => void;
  /** True while that ask is in flight. */
  retrying?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <EmptyState
      className={cn("flex flex-col items-center gap-3 text-center", className)}
      style={{ padding: 26, fontSize: 13.5, ...style }}
    >
      <span className="max-w-form">{children}</span>
      {onRetry && (
        <ActionButton onClick={onRetry} pending={retrying}>
          {retrying ? "Trying again" : "Try again"}
        </ActionButton>
      )}
    </EmptyState>
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

/**
 * A dropdown. Replaces the hand-styled `<select style={fieldStyle}>`.
 *
 * HeroUI's Select is a listbox rather than a native control, so its options are
 * DATA — React Aria has to read the collection to size the popover and drive
 * typeahead, and cannot do that through `<option>` children. This wrapper keeps
 * that structure in one place instead of five screens each spelling out a
 * Trigger, a Value, an Indicator, a Popover and a ListBox.
 *
 * The empty first row (`<option value="">Choose a room`) is gone: `placeholder`
 * says the same thing without being selectable, so nobody can pick "Choose a
 * room" and have it count as an answer.
 */
export interface SelectOption {
  value: string;
  label: string;
}

export function SelectField({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  invalid,
  label,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  options: readonly SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  /** Accessible name where the control has no visible label beside it. */
  label?: string;
  className?: string;
}) {
  return (
    <Select
      aria-label={label}
      // `null`, not `""` — React Aria reads an empty key as a selected item
      // with an empty id and renders a blank row instead of the placeholder.
      selectedKey={value === "" ? null : value}
      onSelectionChange={(key) => onChange(key == null ? "" : String(key))}
      isDisabled={disabled}
      isInvalid={invalid}
      placeholder={placeholder}
      className={cn("w-full", className)}
    >
      <Select.Trigger className="w-full">
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {options.map((option) => (
            <ListBox.Item
              key={option.value}
              id={option.value}
              textValue={option.label}
            >
              {option.label}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

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
 * `delay` is MILLISECONDS, which is what every caller has always passed
 * (`delay={i * 80}`). It was written into the style as seconds, so a stack of
 * three rows shimmered 80, 160 and 240 SECONDS apart — which is to say the
 * stagger never happened and rows two and three sat flat for the whole wait.
 */
export function Skeleton({ height, delay = 0, style }: { height: number; delay?: number; style?: CSSProperties }) {
  return (
    <ShadSkeleton
      style={{ height, animationDelay: `${delay}ms`, ...style }}
      className="rounded bg-hover"
    />
  );
}
