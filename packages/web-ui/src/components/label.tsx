"use client";

import * as React from "react";
import { Label as HeroLabel } from "@heroui/react";
import { cn } from "@injishi/utils";

/**
 * A form field's label, on HeroUI 3.
 *
 * Inside a HeroUI field (`TextField`, `Select`, `Checkbox`) the label wires
 * itself to the input through React Aria context — no `htmlFor` needed. Outside
 * one, pass `htmlFor` as before.
 */
function Label({
  className,
  ...props
}: React.ComponentProps<typeof HeroLabel>) {
  return (
    <HeroLabel data-slot="label" className={cn(className)} {...props} />
  );
}

export { Label };
