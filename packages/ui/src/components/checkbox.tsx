"use client";

import * as React from "react";
import { Checkbox as HeroCheckbox } from "@heroui/react";
import { cn } from "@injishi/utils";

/**
 * The checkbox, on HeroUI 3.
 *
 * Pass the label as children rather than putting a separate `<Label>` beside
 * it: a click on the label toggles the box and a screen reader reads the pair.
 *
 * THIS WRAPPER BUILDS THE ANATOMY, and it has to. In HeroUI 3.2 the root
 * `Checkbox` is only React Aria's `CheckboxField`, a wrapper with no control of
 * its own. The clickable part (the element carrying the input) is
 * `Checkbox.Content`, and the visible box is `Checkbox.Control` holding
 * `Checkbox.Indicator`. Children passed straight to the root render as text
 * inside an empty field: no box, no input, nothing the keyboard can reach and
 * nothing a click can tick. Every `<Checkbox>label</Checkbox>` in the apps was
 * that, silently, until this assembled the parts itself.
 *
 * `className` lands on `Checkbox.Content`, the clickable row, so layout and
 * `data-selected` styling apply to the thing a person actually presses.
 *
 * State props follow React Aria — `isSelected` / `onChange`, not Radix's
 * `checked` / `onCheckedChange`. `defaultSelected` covers the uncontrolled case.
 */
function Checkbox({
  className,
  children,
  ...props
}: React.ComponentProps<typeof HeroCheckbox>) {
  return (
    <HeroCheckbox data-slot="checkbox" {...props}>
      {(state) => (
        <HeroCheckbox.Content className={cn(className)}>
          <HeroCheckbox.Control>
            <HeroCheckbox.Indicator />
          </HeroCheckbox.Control>
          {typeof children === "function" ? children(state) : children}
        </HeroCheckbox.Content>
      )}
    </HeroCheckbox>
  );
}

export { Checkbox };
