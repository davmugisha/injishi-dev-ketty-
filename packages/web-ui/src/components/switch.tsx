"use client"

import * as React from "react"
import { Switch as HeroSwitchBase } from "@heroui/react"

/* heroui-alias */
// HeroUI types require `children` explicitly; these adapters forward it via
// a spread that TypeScript cannot see through. Looseness stops at this
// boundary — the exported components keep their exact shadcn signatures.
const HeroSwitch = HeroSwitchBase as unknown as React.ComponentType<Record<string, unknown>>

import { cn } from "@injishi/utils"

/**
 * On HeroUI (React Aria).
 *
 * The one place a class string had to change, and why: shadcn styled this off
 * radix's `data-[state=checked]` / `data-[state=unchecked]` attributes, which
 * React Aria does not emit — it exposes selection through render props and a
 * `data-selected` attribute. Left as-is the selectors would silently match
 * nothing and the switch would render unstyled.
 *
 * So the state-dependent classes are bound through the render prop instead of
 * an attribute selector. Every colour, size and transform value is carried
 * over unchanged, which is what keeps the rendered result identical — the
 * selector mechanism moved, the appearance did not.
 */
function Switch({
  className,
  size = "default",
  checked,
  defaultChecked,
  onCheckedChange,
  disabled,
  ...props
}: Omit<React.ComponentProps<"button">, "onChange"> & {
  size?: "sm" | "default"
  checked?: boolean
  defaultChecked?: boolean
  onCheckedChange?: (checked: boolean) => void
}) {
  return (
    <HeroSwitch
      data-slot="switch"
      data-size={size}
      isSelected={checked}
      defaultSelected={defaultChecked}
      onChange={onCheckedChange}
      isDisabled={disabled}
      className={({
        isSelected,
        isDisabled,
      }: {
        isSelected: boolean
        isDisabled: boolean
      }) =>
        cn(
          "peer group/switch inline-flex shrink-0 items-center rounded-full border border-transparent shadow-xs transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
          size === "default" ? "h-[1.15rem] w-8" : "h-3.5 w-6",
          isSelected ? "bg-primary" : "bg-input dark:bg-input/80",
          // `disabled:` is a pseudo-class variant and only matches real form
          // controls; React Aria renders a div, so the disabled treatment is
          // bound here instead. Same values shadcn used.
          isDisabled && "cursor-not-allowed opacity-50",
          className
        )
      }
      {...(props as Record<string, unknown>)}
    >
      {({ isSelected }: { isSelected: boolean }) => (
        <span
          data-slot="switch-thumb"
          className={cn(
            "pointer-events-none block rounded-full bg-background ring-0 transition-transform",
            size === "default" ? "size-4" : "size-3",
            isSelected
              ? "translate-x-[calc(100%-2px)] dark:bg-primary-foreground"
              : "translate-x-0 dark:bg-foreground"
          )}
        />
      )}
    </HeroSwitch>
  )
}

export { Switch }
