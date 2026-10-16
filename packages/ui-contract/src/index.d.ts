/**
 * `@injishi/ui-contract` — the one definition of the component vocabulary
 * (ADR-040 call 4).
 *
 * Two implementations satisfy it and neither consumes the other: `@injishi/ui`
 * on the web, for all three Next apps, and `apps/mobile` on native. Each side
 * IMPORTS its unions from here instead of declaring them, so a rename on either
 * side fails the other side's `tsc --noEmit`. Matched vocabulary is a build
 * failure, not a review miss.
 *
 * It holds NAMES and nothing else. Not props, not behaviour, not appearance:
 * two buttons can satisfy it and still look different, and `mobile-v1/parity.md`
 * owns that question. `shape` (pill, rounded, square) is deliberately absent,
 * because the button corner is an open appearance question and appearance is
 * not vocabulary. Do not add it "for completeness".
 *
 * A declaration file on purpose: it CANNOT hold a value, so "zero runtime code"
 * is enforced by the compiler rather than promised. Import it with
 * `import type`; there is nothing to import at runtime, and the package's
 * `exports` map offers only a `types` condition so a value import fails to
 * resolve rather than bundling nothing.
 *
 * The core set below was ruled on 2026-09-11 and is recorded, with its reasons,
 * in `adrs/040-one-component-vocabulary-everywhere/040-mobile-vocabulary-contract.md`.
 * That table is the record; this file is the machine copy.
 */

/**
 * The two implementations. `web` is `@injishi/ui`; `native` is `apps/mobile`.
 */
export type Platform = "web" | "native";

/**
 * One axis of one component's vocabulary (its variants, or its sizes).
 *
 *  - `core`: both platforms MUST implement every name. Each platform keys a
 *    `Record` on its full union, so a missing core name fails that platform.
 *  - `web` / `native`: names one platform adds beyond the core, because the
 *    other has no use for them (`link` means nothing on a phone). `never`
 *    when the platform adds nothing.
 *
 * An extension is legal; a disagreement INSIDE the core is not. Two platforms
 * may not spell one concept two ways, which is why an extension may never
 * repeat a core name (checked at the bottom of this file).
 *
 * Not an intersection, which would silently drop `link` and shrink the web
 * vocabulary; not a flat union, which would force mobile to implement
 * `outline-light` for no reason.
 */
interface Axis {
  core: string;
  web: string;
  native: string;
}

/* ------------------------------------------------------------------ Button */

interface ButtonVariants {
  core: "primary" | "secondary" | "outline" | "ghost" | "danger";
  /** Web only. `outline-light` and `inverse` sit on photography; `link` drops the box. */
  web: "outline-light" | "inverse" | "link";
  native: never;
}

interface ButtonSizes {
  core: "sm" | "md" | "lg";
  /** Web only. Mobile has no icon only `Button`; its icon controls are its own. */
  web: "icon" | "icon-sm";
  native: never;
}

/** The variants both platforms implement. */
export type ButtonVariantCore = ButtonVariants["core"];

/** Every variant a platform's `Button` accepts: the core plus its own extensions. */
export type ButtonVariant<P extends Platform> =
  | ButtonVariants["core"]
  | ButtonVariants[P];

/** The sizes both platforms implement. */
export type ButtonSizeCore = ButtonSizes["core"];

/** Every size a platform's `Button` accepts: the core plus its own extensions. */
export type ButtonSize<P extends Platform> =
  | ButtonSizes["core"]
  | ButtonSizes[P];

/* ------------------------------------------------------- Component names */

/**
 * The components `@injishi/ui` exports, by their root name. The package checks
 * its own index against this list, so a component cannot be renamed or dropped
 * on the web without this file moving with it.
 *
 * ADDING one is the direction the check cannot see: `contract-check.ts` asks
 * whether every name here is exported, not whether every export is here, and
 * the index also exports parts and helpers (`DialogPortal`, `buttonVariants`)
 * that are not components. So a new component is added to this list by hand,
 * in the same change. `NativeDialog` and `Toaster` were (ADR-040 phase 2).
 *
 * Mobile satisfies names one component at a time, as each is brought under
 * the contract. `Button` is the first (the Tracer Bullet); the 28 mobile only
 * components in `parity.md` section 6 are outside the contract for good.
 */
export type ComponentName =
  | "Accordion"
  | "Avatar"
  | "Badge"
  | "Button"
  | "Calendar"
  | "Card"
  | "Carousel"
  | "Checkbox"
  | "Dialog"
  | "DropdownMenu"
  | "Input"
  | "Label"
  /** ADR-040 call 3: the platform `<dialog>`, beside Radix `Dialog`, not a mode of it. */
  | "NativeDialog"
  | "Popover"
  | "Progress"
  | "ScrollArea"
  | "Select"
  | "Separator"
  | "Sheet"
  | "Skeleton"
  | "Slider"
  | "Switch"
  | "Tabs"
  | "Textarea"
  /** ADR-040 call 3: toasts rendered from a plain list the app owns. */
  | "Toaster"
  | "Tooltip";

/* ------------------------------------------------------------ Self checks */
/*
 * Checked by this package's own `typecheck` (skipLibCheck is off there for
 * exactly this reason). Each alias fails to compile when its condition is false.
 */

type Expect<T extends true> = T;
type Disjoint<A, B> = [A & B] extends [never] ? true : false;

type _ButtonVariantsIsAxis = Expect<ButtonVariants extends Axis ? true : false>;
type _ButtonSizesIsAxis = Expect<ButtonSizes extends Axis ? true : false>;
type _ButtonVariantExtensionsLeaveTheCoreAlone = Expect<
  Disjoint<ButtonVariants["core"], ButtonVariants["web"] | ButtonVariants["native"]>
>;
type _ButtonSizeExtensionsLeaveTheCoreAlone = Expect<
  Disjoint<ButtonSizes["core"], ButtonSizes["web"] | ButtonSizes["native"]>
>;
