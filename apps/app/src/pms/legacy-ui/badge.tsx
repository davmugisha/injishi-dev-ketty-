"use client";

import * as React from "react";
import { Chip, chipVariants } from "@heroui/react";
import { cn } from "@injishi/utils";

/**
 * The site's pill label, on HeroUI 3's `Chip`.
 *
 * It is `Chip` and not HeroUI's own `Badge` on purpose: HeroUI reserves `Badge`
 * for the count dot pinned to an avatar or an icon. This component has always
 * been the standalone pill — "Superhost", "Verified", a status word — which is
 * what `Chip` is.
 *
 * The five original variants are intent names and are kept. Three of them now
 * resolve through HeroUI's own colour system; `light` and `glass` cannot,
 * because both sit on photography and therefore must NOT follow the theme.
 * Four status variants are added because the system supplies them free and a
 * status word rendered as a neutral pill is a hierarchy bug.
 */
const VARIANT = {
  /** The standard marker. HeroUI's neutral chip. */
  default: { color: "default", variant: "secondary" },
  /** On a dark surface or a photo: fixed white, never theme-following. */
  light: {
    color: "default",
    variant: "tertiary",
    extra: "bg-white text-ink",
  },
  /** Quiet marker on a light surface. */
  subtle: {
    color: "default",
    variant: "tertiary",
    extra: "bg-surface-secondary text-surface-secondary-foreground",
  },
  outline: {
    color: "default",
    variant: "tertiary",
    extra: "border border-current",
  },
  /**
   * No fill and no border, so the CALLER's class is the only thing that paints
   * it. The operator app's status badge needs this: it maps a domain intent
   * (`ok`, `warn`, `late`) onto a colour pair of its own, and any fill here
   * would sit underneath and fight it.
   *
   * Added by ADR-036 call 1, when `apps/app` moved onto this package and the
   * copy it had been using turned out to carry a variant this one lacked. Same
   * story as `secondary` and `destructive` on Button: consolidation is what
   * surfaced the gap, and the honest fix is to name the thing rather than to
   * bend an existing variant into it.
   */
  ghost: { color: "default", variant: "tertiary" },
  /** Sits on photography — the listing cards' "Superhost" chip. */
  glass: {
    color: "default",
    variant: "tertiary",
    extra: "bg-ink/40 text-white backdrop-blur-sm",
  },
  accent: { color: "accent", variant: "primary" },
  success: { color: "success", variant: "primary" },
  warning: { color: "warning", variant: "primary" },
  danger: { color: "danger", variant: "primary" },
} as const satisfies Record<
  string,
  { color: string; variant: string; extra?: string }
>;

type BadgeVariant = keyof typeof VARIANT;

export interface BadgeProps
  extends Omit<React.ComponentProps<"span">, "color"> {
  variant?: BadgeVariant;
  size?: "sm" | "md" | "lg";
}

function Badge({
  className,
  variant = "default",
  size = "md",
  children,
  ...props
}: BadgeProps) {
  const v = VARIANT[variant];
  return (
    <Chip
      /* eslint-disable-next-line injishi/surface-refusals --
       * FALSE POSITIVE, kept rather than worked around. `surface-refusals`
       * reads every STRING in a file rather than only a `className`, which
       * is what lets it catch a class built through a variable or a `cn()`
       * call. The cost is that a slot NAME spelled like a legacy class trips
       * it. This is the `data-slot` API every component in this package
       * exposes, not a CSS class, and renaming it to satisfy a linter would
       * break the attribute consumers select on. If a second slot name ever
       * collides, narrow the rule to skip `data-*` attribute values instead
       * of adding a second disable here. */
      data-slot="badge"
      data-variant={variant}
      color={v.color as never}
      variant={v.variant as never}
      size={size}
      className={cn(
        "rounded-full",
        "extra" in v ? v.extra : undefined,
        className,
      )}
      {...(props as Record<string, unknown>)}
    >
      {children}
    </Chip>
  );
}

export { Badge, chipVariants as badgeVariants };
