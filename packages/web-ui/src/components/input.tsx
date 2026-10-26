"use client";

/* Same boundary note as button.tsx, and it is not optional. `@heroui/react`
 * has a single entry point that re-exports react-aria-components, which imports
 * `client-only`, so ANY module a Server Component touches through this file
 * fails the build. `(auth)`'s /sign-in is a Server Component on purpose, which
 * is what lets its form post without JavaScript, so the boundary starts here
 * rather than there. React still renders the field on the server, so the markup
 * is in the first response either way. */

import * as React from "react";
import { Input as HeroInputBase } from "@heroui/react";
import { cn } from "@injishi/utils";

/* heroui-alias */
// HeroUI types require `children` explicitly; this adapter forwards it through
// a spread TypeScript cannot see through. Looseness stops at this boundary —
// the exported component keeps a plain DOM-input signature.
const HeroInput = HeroInputBase as unknown as React.ComponentType<
  Record<string, unknown>
>;

type InputShape = "field" | "pill";
type InputSize = "sm" | "md" | "lg";

/**
 * `field` is the ordinary form control and it is the default. `pill` is the
 * marketplace filter and search box, which is a different object: it reads as
 * something you type INTO on a page, not a row in a form.
 *
 * `field` resolves to `rounded`, which is `--radius` at 0.5rem. That is exactly
 * what the three copies this file replaced already rendered: `apps/web`'s
 * `rounded-lg` was 8px and `apps/app`'s `rounded-md` was 8px in its own scale.
 * So consolidating changed no field on any screen, which is the point: ADR-036
 * is a standard, not a redesign.
 */
const SHAPE: Record<InputShape, string> = {
  field: "rounded",
  pill: "rounded-full",
};

/** Heights the three copies actually used, kept rather than averaged. */
const SIZE: Record<InputSize, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-10 px-3 text-sm",
  lg: "h-11 px-5 text-base",
};

/**
 * `size` is omitted from the DOM props on purpose. `<input>` has a NATIVE
 * `size` attribute typed `number` (a width in characters), so declaring a
 * string `size` beside it is a type error rather than an override. The native
 * one is not something this design system uses: width comes from the layout,
 * not from a character count. Anyone who genuinely needs it can set it through
 * a ref.
 */
export interface InputProps
  extends Omit<React.ComponentProps<"input">, "size"> {
  shape?: InputShape;
  size?: InputSize;
}

/**
 * The product's text field, on HeroUI 3. There is exactly one (ADR-036 call 1).
 *
 * React Aria's Input is a bare <input>, the same element both the capture and
 * shadcn rendered, so the field keeps its exact box. Deliberately NOT HeroUI's
 * TextField, which wraps the control in label and description slots and would
 * change every layout that uses it.
 *
 * Every colour below is a `@injishi/design-tokens` role. The four colour names
 * the original capture's field used were defined only inside its own 99 KB
 * stylesheet and they died with it; ADR-017 verifies this by grepping for those
 * names, so they are not restated here even as an example.
 */
function Input({
  className,
  type,
  shape = "field",
  size = "md",
  ...props
}: InputProps) {
  return (
    <HeroInput
      type={type}
      data-slot="input"
      data-shape={shape}
      data-size={size}
      className={cn(
        "w-full min-w-0 border border-input bg-field font-normal text-foreground",
        "outline-none transition-[color,box-shadow]",
        "placeholder:text-muted-foreground",
        "focus:border-ring focus:ring-2 focus:ring-ring/40",
        "disabled:cursor-not-allowed disabled:opacity-60",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/30",
        "file:border-0 file:bg-transparent file:text-sm file:font-medium",
        SHAPE[shape],
        SIZE[size],
        className,
      )}
      {...(props as Record<string, unknown>)}
    />
  );
}

export { Input };
