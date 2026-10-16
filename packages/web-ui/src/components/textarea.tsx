"use client"

/* Added when this file moved into the package (ADR-036 call 10). It imports
 * `@heroui/react`, whose single entry point re-exports react-aria-components,
 * which imports `client-only` — so any Server Component that touches this file
 * fails the build. It got away without the boundary in `apps/app`, where no
 * Server Component happened to reach it; a shared package cannot rely on that,
 * because it does not know its callers. */

import * as React from "react"
import { TextArea as HeroTextAreaBase } from "@heroui/react"

/* heroui-alias */
// HeroUI types require `children` explicitly; these adapters forward it via
// a spread that TypeScript cannot see through. Looseness stops at this
// boundary — the exported components keep their exact shadcn signatures.
const HeroTextArea = HeroTextAreaBase as unknown as React.ComponentType<Record<string, unknown>>

import { cn } from "@injishi/utils"

/**
 * On HeroUI (React Aria). Class string unchanged from the shadcn original.
 *
 * React Aria's TextArea is a bare <textarea>, the same element shadcn
 * rendered, so `field-sizing-content` and the focus ring behave identically.
 */
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <HeroTextArea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full rounded border border-input bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...(props as Record<string, unknown>)}
    />
  )
}

export { Textarea }
