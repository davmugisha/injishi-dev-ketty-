"use client";

import * as React from "react";
import { Separator as HeroSeparator } from "@heroui/react";
import { cn } from "@injishi/utils";

/**
 * A rule between sections, on HeroUI 3.
 *
 * `decorative` is gone: React Aria decides the ARIA role from `orientation`
 * and from whether the separator is inside a menu or toolbar, so an explicit
 * flag could only disagree with it. Every call site passed the default anyway.
 */
function Separator({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof HeroSeparator>) {
  return (
    <HeroSeparator
      data-slot="separator"
      orientation={orientation}
      className={cn(className)}
      {...props}
    />
  );
}

export { Separator };
