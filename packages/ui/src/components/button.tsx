"use client";

/* This boundary is not optional. `@heroui/react` has a single entry point that
 * re-exports react-aria-components, which imports `client-only`, so ANY module
 * a Server Component touches through this file fails the build. React still
 * renders the button on the server, so the markup is in the first response
 * either way; what the boundary costs is the React Aria runtime in the bundle,
 * which is the price of the keyboard, focus and press behaviour. */

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { Button as HeroButtonBase, buttonVariants } from "@heroui/react";
import type { ButtonSize, ButtonVariant } from "@injishi/ui-contract";
import { cn } from "@injishi/utils";

/* heroui-alias */
// HeroUI types require `children` explicitly; this adapter forwards it through
// a spread TypeScript cannot see through. Looseness stops at this boundary —
// the exported component keeps a plain DOM-button signature.
const HeroButton = HeroButtonBase as unknown as React.ComponentType<
  Record<string, unknown>
>;

/**
 * The web vocabulary: the core both platforms implement plus the three web only
 * extensions. It is NOT declared here. `@injishi/ui-contract` owns the names
 * (ADR-040 call 4) and `apps/mobile` imports the same core, so renaming one in
 * either place fails the other platform's typecheck. Adding or renaming a name
 * is still a decision, not a patch; it is now also a change to the contract.
 */
type CanonicalVariant = ButtonVariant<"web">;

/**
 * Names that USED to mean something, kept so no call site broke on the day the
 * copies were deleted (ADR-036 calls 3 and 4). Every one resolves to `primary`.
 *
 * `injishi/no-duplicate-shared-component` warns on each use, so the removal in
 * ADR-036's Follow-up has a list to work from rather than a grep. Do not add to
 * this map: a new alias is a new vocabulary, which is the thing ADR-036 exists
 * to stop.
 */
const VARIANT_ALIAS = {
  solid: "primary",
  accent: "primary",
  default: "primary",
} as const;

type VariantAlias = keyof typeof VARIANT_ALIAS;
type InjishiVariant = CanonicalVariant | VariantAlias;

/** Same source: the core sizes plus web's two icon only squares. */
type CanonicalSize = ButtonSize<"web">;

/** Same story as `VARIANT_ALIAS`, for the eight sizes `apps/app` used to have. */
const SIZE_ALIAS = {
  default: "md",
  xs: "sm",
  tab: "sm",
  "icon-xs": "icon-sm",
  "icon-lg": "icon",
} as const;

type SizeAlias = keyof typeof SIZE_ALIAS;
type InjishiSize = CanonicalSize | SizeAlias;

type InjishiShape = "pill" | "rounded" | "square";

type HeroVariant = Parameters<typeof buttonVariants>[0] extends
  | { variant?: infer V }
  | undefined
  ? NonNullable<V>
  : never;

/**
 * Injishi variant -> HeroUI variant, plus whatever the HeroUI variant cannot
 * express on its own.
 *
 * Read it as a decision list rather than a lookup table:
 *
 *  - `primary` fills with `--accent`. It is THE main action, and there is one
 *    weight for it. Three fills for "the main action" (fixed navy, near-black,
 *    brand green) is what made the old surface read as unconsidered.
 *  - `secondary` is a quiet fill that sits beside a primary without competing.
 *    It is what `apps/web`'s `(auth)` group called `solid`: an identity
 *    provider button is conventionally neutral, and the capture painted Google,
 *    Apple and Continue identically. Mapping that to `primary` would have
 *    repainted the sign in screen as a side effect of a refactor.
 *  - `danger` is a delete or a refusal. It was `destructive` here until
 *    ADR-040 ruled the core set: HeroUI calls it `danger` on web and native,
 *    and so does mobile, so the one web spelling was the odd one out.
 *  - `inverse` keeps a FIXED white fill in both themes. It sits on photography
 *    and on the search bar, which pins itself white in dark mode, so it cannot
 *    follow the theme. HeroUI has no always-white variant, so `tertiary`
 *    supplies the shape and the two token classes supply the colour.
 *  - `outline-light` is `outline` on a dark ground. Same border geometry, white
 *    ink, because the bordered button over a hero photo is the same control.
 *  - `link` keeps HeroUI's focus and press behaviour but drops the button box.
 */
const VARIANT: Record<
  CanonicalVariant,
  { hero: HeroVariant; extra?: string }
> = {
  primary: { hero: "primary" },
  secondary: { hero: "secondary" },
  danger: { hero: "danger" },
  outline: { hero: "outline" },
  "outline-light": {
    hero: "outline",
    extra: "text-white border-white/60 hover:border-white",
  },
  inverse: {
    hero: "tertiary",
    extra: "bg-white text-ink hover:bg-surface-tint",
  },
  ghost: { hero: "ghost" },
  link: {
    hero: "ghost",
    extra: "h-auto bg-transparent px-0 underline-offset-4 hover:underline",
  },
};

/** Injishi size -> HeroUI size + whether it is an icon-only square. */
const SIZE: Record<
  CanonicalSize,
  { hero: "sm" | "md" | "lg"; iconOnly: boolean }
> = {
  sm: { hero: "sm", iconOnly: false },
  md: { hero: "md", iconOnly: false },
  lg: { hero: "lg", iconOnly: false },
  icon: { hero: "md", iconOnly: true },
  "icon-sm": { hero: "sm", iconOnly: true },
};

/**
 * Shape overrides HeroUI's own radius, which is `rounded-3xl` on the base
 * class. `pill` is the default (ADR-036 call 5): it is what the marketplace
 * already renders everywhere, and it is the more distinctive of the two looks.
 */
const SHAPE: Record<InjishiShape, string> = {
  pill: "rounded-full",
  rounded: "rounded",
  square: "rounded-none",
};

function resolveVariant(v: InjishiVariant): CanonicalVariant {
  return v in VARIANT_ALIAS
    ? VARIANT_ALIAS[v as VariantAlias]
    : (v as CanonicalVariant);
}

function resolveSize(s: InjishiSize): CanonicalSize {
  return s in SIZE_ALIAS ? SIZE_ALIAS[s as SizeAlias] : (s as CanonicalSize);
}

export interface ButtonProps extends React.ComponentProps<"button"> {
  variant?: InjishiVariant;
  size?: InjishiSize;
  shape?: InjishiShape;
  /** Render the child element instead of a `<button>`, styled as one. */
  asChild?: boolean;
  /** Stretch to the container width. */
  fullWidth?: boolean;
  /**
   * The button's work is under way. It stays focusable and announced (React
   * Aria's `isPending`), refuses a second press, stops being a `submit` so the
   * form cannot go twice, and the shimmer from `styles.css` passes across the
   * label so the press visibly registered.
   *
   * Prefer this to `disabled` while waiting: `disabled` drops focus off the
   * button the person just pressed, and a dead-looking control is how a
   * second press or a "is it broken?" happens. Keep the label, and word it for
   * the wait ("Sending your code") rather than swapping in "Loading…".
   *
   * Ignored with `asChild`: a link has nothing to wait on.
   */
  pending?: boolean;
}

/**
 * The product's button, on HeroUI 3. There is exactly one, and this is it
 * (ADR-036 call 1).
 *
 * HeroUI supplies both halves: React Aria behaviour AND the look, through the
 * BEM classes in `@heroui/styles` (`.button`, `.button--primary`). Those
 * classes read `--accent`, `--default`, `--border` and the rest, which
 * `@injishi/design-tokens/heroui.css` defines, so the palette is still one
 * source and HeroUI's stock blue never renders.
 *
 * Do NOT re-add a local CVA of colour classes. That was the old shape of this
 * file, and it meant every HeroUI state HeroUI already styles — pressed,
 * pending, focus-visible, hover on a hover-capable pointer only — had to be
 * re-derived by hand, and was not. `apps/web` and `apps/app` each kept a copy
 * that did exactly that; ADR-036 deleted both.
 */
function Button({
  className,
  variant = "primary",
  size = "md",
  shape = "pill",
  asChild = false,
  fullWidth,
  disabled,
  pending,
  onClick,
  type = "button",
  children,
  ...props
}: ButtonProps) {
  const canonicalVariant = resolveVariant(variant);
  const canonicalSize = resolveSize(size);
  const v = VARIANT[canonicalVariant];
  const s = SIZE[canonicalSize];

  /*
   * The BEM classes are built ONCE, and by whichever of the two paths below
   * renders. Passing `buttonVariants(...)` INTO HeroUI's Button is the trap,
   * and it is not hypothetical: it is the bug ADR-036 measured live on
   * `/sign-in`, where a button asking for `variant="ghost"` rendered
   * `button--primary`.
   *
   * HeroUI's Button calls `buttonVariants` itself, with its own defaults, so
   * the element ends up carrying `button--md button--primary button--md
   * button--ghost` and which one wins is decided by their order in HeroUI's
   * stylesheet rather than by this file. `tailwind-merge` does not dedupe them
   * because they are not Tailwind utilities.
   *
   * So: the element path passes variant/size as PROPS, and only the `asChild`
   * path — where there is no HeroUI Button to do it — builds the string.
   */
  const trim = cn(SHAPE[shape], v.extra, className);

  // `asChild` renders a Link (or any element) wearing the button. HeroUI's own
  // composition guide points at `buttonVariants` for exactly this, because a
  // React Aria Button cannot BE an anchor. Behaviour comes from the element,
  // so a link keeps its middle-click, its context menu and its href preview.
  if (asChild) {
    return (
      <Slot
        data-slot="button"
        data-variant={canonicalVariant}
        className={cn(
          buttonVariants({
            variant: v.hero,
            size: s.hero,
            isIconOnly: s.iconOnly,
            fullWidth,
          }),
          trim,
        )}
        {...props}
      >
        {children}
      </Slot>
    );
  }

  return (
    <HeroButton
      data-slot="button"
      data-variant={canonicalVariant}
      data-size={canonicalSize}
      type={type}
      // React Aria owns disabled state; the bare `disabled` prop would not
      // reach it and the button would stay pressable while looking dead.
      isDisabled={disabled}
      // Stamps `data-pending`, which `styles.css` draws, and `aria-disabled`,
      // which HeroUI dims. The dim is cancelled there: pending is not disabled.
      isPending={pending}
      // RAC 1.20 accepts `onClick` as an alias for `onPress` and hands the
      // handler a real MouseEvent, so the existing call sites keep their
      // signature. New code should prefer `onPress`.
      onClick={onClick}
      variant={v.hero}
      size={s.hero}
      isIconOnly={s.iconOnly}
      fullWidth={fullWidth}
      className={trim}
      {...(props as Record<string, unknown>)}
    >
      {children}
    </HeroButton>
  );
}

export { Button, buttonVariants };
