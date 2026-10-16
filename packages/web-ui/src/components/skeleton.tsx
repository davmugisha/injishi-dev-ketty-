"use client";

import * as React from "react";
import { Skeleton as HeroSkeleton } from "@heroui/react";
import { cn } from "@injishi/utils";

/**
 * The loading placeholder, on HeroUI 3.
 *
 * HeroUI's default animation is `shimmer` rather than the old `animate-pulse`.
 * That is the whole point of moving: a shimmer reads as "this is arriving",
 * a pulse reads as "this is broken and blinking". Pass
 * `animationType="pulse"` or `"none"` where a screen needs the quieter one.
 */
function Skeleton({
  className,
  ...props
}: React.ComponentProps<typeof HeroSkeleton>) {
  return (
    <HeroSkeleton
      data-slot="skeleton"
      className={cn("rounded", className)}
      {...props}
    />
  );
}

export { Skeleton };
