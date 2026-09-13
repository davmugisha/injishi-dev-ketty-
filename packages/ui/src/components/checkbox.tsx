"use client";

import * as React from "react";
import { Checkbox as HeroCheckbox } from "@heroui/react";
import { cn } from "@injishi/utils";

type CheckboxProps = Omit<React.ComponentProps<typeof HeroCheckbox>, "children"> & {
  /** The label. Everything passed here sits beside the box and toggles it. */
  children?: React.ReactNode;
  /**
   * Classes for the box itself. A two-line label laid out with `items-start`
   * wants `mt-0.5` here, so the box sits on the first line rather than above it.
   */
  controlClassName?: string;
};

/**
 * The checkbox, on HeroUI 3.
 *
 * HeroUI's checkbox is a FIELD, and its root is not the thing a person presses.
 * In 3.2 the root is React Aria's `CheckboxField`: it holds the state and draws
 * nothing. The pressable row is `Checkbox.Content` (a `CheckboxButton`), and the
 * visible box is `Checkbox.Control` > `Checkbox.Indicator`. A root with plain
 * children renders the label text, no box, and ignores every press, with no
 * error and a clean typecheck. Three web screens shipped exactly that until
 * this adapter composed the parts itself (ADR-049 J26).
 *
 * So pass the label as children and style the ROW through `className`: it lands
 * on `Checkbox.Content`, the element that takes the press. A full-width row
 * needs `w-full`, because the field lays its content out as a column that does
 * not stretch.
 *
 * State props follow React Aria — `isSelected` / `onChange`, not Radix's
 * `checked` / `onCheckedChange`. `defaultSelected` covers the uncontrolled case.
 */
function Checkbox({ className, controlClassName, children, ...props }: CheckboxProps) {
  return (
    <HeroCheckbox data-slot="checkbox" {...props}>
      <HeroCheckbox.Content className={cn("cursor-pointer", className)}>
        <HeroCheckbox.Control className={cn("shrink-0", controlClassName)}>
          <HeroCheckbox.Indicator />
        </HeroCheckbox.Control>
        {children}
      </HeroCheckbox.Content>
    </HeroCheckbox>
  );
}

export { Checkbox };
export type { CheckboxProps };
