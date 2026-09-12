"use client";

import * as React from "react";
import { Checkbox as HeroCheckbox } from "@heroui/react";
import { cn } from "@injishi/utils";

/**
 * The checkbox, on HeroUI 3.
 *
 * HeroUI's checkbox is a FIELD, not a bare box: it renders the control and its
 * label together and wires them through React Aria, so a click on the label
 * toggles the box and a screen reader reads the pair. Pass the label as
 * children rather than putting a separate `<Label>` beside it.
 *
 * State props follow React Aria — `isSelected` / `onChange`, not Radix's
 * `checked` / `onCheckedChange`. `defaultSelected` covers the uncontrolled case.
 */
function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof HeroCheckbox>) {
  return (
    <HeroCheckbox
      data-slot="checkbox"
      className={cn(className)}
      {...props}
    />
  );
}

export { Checkbox };
