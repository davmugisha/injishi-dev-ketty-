"use client";

import * as React from "react";
import { Accordion as HeroAccordion, type Key } from "@heroui/react";
import { cva, type VariantProps } from "class-variance-authority";
import { ChevronDown } from "lucide-react";
import { cn } from "@injishi/utils";

/**
 * Questions that open in place, on HeroUI 3 (React Aria's disclosure group).
 *
 * THE API IS RADIX'S, ON PURPOSE. This file was Radix until 2026-10-06, and
 * every call site still speaks Radix: `type="single"` or `"multiple"`,
 * `collapsible`, `value` / `defaultValue` / `onValueChange` in strings, and a
 * `value` on each item. The adapter translates that into React Aria's
 * expanded keys and back, so no caller changed. What it keeps from Radix,
 * because React Aria does not do it:
 *
 *  - `type="single"` without `collapsible` keeps one row open: pressing the
 *    open row is refused, and its trigger says so with `aria-disabled`.
 *  - The arrow keys move between triggers (Up and Down, or Left and Right with
 *    `orientation="horizontal"`, reversed by `dir="rtl"`), Home and End jump to
 *    the ends, and disabled rows are skipped.
 *  - `data-state="open" | "closed"` on the item, heading, trigger and content,
 *    so a caller's `data-[state=open]:` class still matches.
 *  - The panel is a `region` named by its trigger.
 *
 * What changes, deliberately: a closed answer stays in the document, hidden
 * with `hidden="until-found"`, so the browser's find-in-page reaches it and
 * opens the row; Radix removed it. And a keyboard user now sees where focus
 * is on the default `caret` marker too, which never drew a ring.
 *
 * `asChild` is gone from every part: nothing used it, and React Aria composes
 * through `render` instead.
 *
 * HeroUI's own classes paint a padded `text-sm` bar with a hover wash, a
 * separator of its own and a fade. The overrides below put back the look this
 * file always had; each says which HeroUI rule it answers.
 */

type Orientation = "vertical" | "horizontal";
type Direction = "ltr" | "rtl";

type AccordionSharedProps = Omit<React.ComponentProps<"div">, "defaultValue" | "dir" | "onChange"> & {
  /** Every row refuses to open or close. */
  disabled?: boolean;
  /** Which arrow keys move between triggers. Nothing about the layout. */
  orientation?: Orientation;
  /** Reverses Left and Right for a horizontal accordion. Never written to the DOM, as in Radix. */
  dir?: Direction;
};

type AccordionSingleProps = AccordionSharedProps & {
  type: "single";
  value?: string;
  defaultValue?: string;
  /** Called with the open row's value, or `""` when the open row closes. */
  onValueChange?(value: string): void;
  /** Whether the open row may close, leaving none open. Off by default, as in Radix. */
  collapsible?: boolean;
};

type AccordionMultipleProps = AccordionSharedProps & {
  type: "multiple";
  value?: string[];
  defaultValue?: string[];
  onValueChange?(value: string[]): void;
  collapsible?: never;
};

type AccordionProps = AccordionSingleProps | AccordionMultipleProps;

type RootState = {
  open: readonly string[];
  collapsible: boolean;
  disabled: boolean;
  orientation: Orientation;
  dir: Direction;
};

type ItemState = { open: boolean; disabled: boolean };

const RootContext = React.createContext<RootState | null>(null);
const ItemContext = React.createContext<ItemState | null>(null);

function useRequired<T>(context: React.Context<T | null>, part: string, parent: string): T {
  const value = React.useContext(context);
  if (!value) throw new Error(`\`${part}\` must be used within \`${parent}\``);
  return value;
}

const asList = (value: string | readonly string[] | undefined): string[] =>
  value === undefined ? [] : typeof value === "string" ? (value === "" ? [] : [value]) : [...value];

const state = (open: boolean) => (open ? "open" : "closed");

function Accordion({
  type,
  value,
  defaultValue,
  onValueChange,
  collapsible,
  disabled = false,
  orientation = "vertical",
  dir,
  className,
  children,
  ...props
}: AccordionProps) {
  const controlled = value !== undefined;
  const [uncontrolled, setUncontrolled] = React.useState(() => asList(defaultValue));
  const open = controlled ? asList(value) : uncontrolled;
  // Radix: a multiple accordion can always close a row; a single one only when asked.
  const canClose = type === "multiple" || collapsible === true;

  const handleExpandedChange = (keys: Set<Key>) => {
    const next = [...keys].map(String);
    if (next.length === 0 && open.length > 0 && !canClose) return;
    if (!controlled) setUncontrolled(next);
    if (type === "single") (onValueChange as ((v: string) => void) | undefined)?.(next[0] ?? "");
    else (onValueChange as ((v: string[]) => void) | undefined)?.(next);
  };

  return (
    <RootContext value={{ open, collapsible: canClose, disabled, orientation, dir: dir ?? "ltr" }}>
      <HeroAccordion
        data-slot="accordion"
        data-orientation={orientation}
        // HeroUI draws a rule of its own under every item; the item's border
        // below is the one this file has always drawn.
        hideSeparator
        allowsMultipleExpanded={type === "multiple"}
        expandedKeys={open}
        onExpandedChange={handleExpandedChange}
        isDisabled={disabled}
        // `.accordion` is `w-full` with `contain: layout style`, which makes it
        // a containing block and a stacking context. A Radix root was neither.
        className={cn("w-auto contain-none", className)}
        {...(props as Record<string, unknown>)}
      >
        {children}
      </HeroAccordion>
    </RootContext>
  );
}

function AccordionItem({
  value,
  disabled = false,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & { value: string; disabled?: boolean }) {
  const root = useRequired(RootContext, "AccordionItem", "Accordion");
  const item: ItemState = { open: root.open.includes(value), disabled: disabled || root.disabled };
  return (
    <ItemContext value={item}>
      <HeroAccordion.Item
        id={value}
        isDisabled={disabled}
        data-slot="accordion-item"
        data-state={state(item.open)}
        data-orientation={root.orientation}
        // `.accordion__item` is `relative border-none`, and `border-none` also
        // sets `--tw-border-style: none`, which every `border-b` reads. So
        // `border-solid` first, then the hairline on the bottom edge, where
        // Radix's item drew it.
        className={cn("border-solid border-b last:border-b-0", className)}
        {...(props as Record<string, unknown>)}
      >
        {children}
      </HeroAccordion.Item>
    </ItemContext>
  );
}

/**
 * The trigger has exactly one axis: how the open/closed state is marked.
 *
 * `caret` is the original — a bare chevron in muted ink, the treatment the
 * Services FAQ already renders — and stays the default so no existing call site
 * moves. `circle` boxes that chevron in a hairline circle, which is the
 * affordance the host funnel's reference uses: a full-width hairline-separated
 * bar with the question on the left and a round button on the right, filling to
 * ink when the row is open.
 *
 * This lives here rather than in a second copy under `apps/web` because the two
 * are one component with one behaviour and two markers.
 *
 * Open is read from `aria-expanded`, which React Aria sets on the trigger, so
 * the marker follows the same fact a screen reader announces.
 */
const accordionTriggerVariants = cva(
  cn(
    "flex flex-1 items-center justify-between gap-4 text-left font-medium transition-all",
    // `.accordion__trigger` is `px-4 py-4 text-sm` with a hover wash. The row
    // takes no padding across, inherits the size and leading of the text it
    // sits in (a `<button>` does), and marks hover through its marker.
    "bg-transparent px-0 text-[length:inherit] leading-[inherit]",
    // React Aria's keyboard-focus flag, not `:focus-visible`: it is the one
    // HeroUI paints its own ring on, so this ring replaces that one exactly.
    "focus-visible:outline-none data-focus-visible:ring-2 data-focus-visible:ring-ring data-focus-visible:ring-offset-2 data-focus-visible:ring-offset-background",
    // The open row of a single, non-collapsible accordion is `aria-disabled`
    // (it cannot close). HeroUI fades `aria-disabled`; this row is not off.
    "aria-disabled:pointer-events-auto aria-disabled:cursor-default aria-disabled:opacity-100",
    // The marker wrapper is always present, so the rotation is addressed
    // through it rather than through a direct-child `svg` selector.
    "[&[aria-expanded=true]_[data-slot=accordion-marker]_svg]:rotate-180",
  ),
  {
    variants: {
      marker: {
        caret: "py-5 hover:underline",
        circle: "group/accordion gap-6 py-6",
      },
    },
    defaultVariants: { marker: "caret" },
  },
);

const accordionMarkerVariants = cva(
  "inline-flex shrink-0 items-center justify-center transition-colors duration-quick",
  {
    variants: {
      marker: {
        caret: "text-muted-foreground size-5",
        circle: cn(
          "size-10 rounded-full border border-border text-foreground",
          "group-hover/accordion:border-foreground",
          // Flat by rule: the open row separates by filling, never by lifting.
          "group-aria-expanded/accordion:border-primary group-aria-expanded/accordion:bg-primary group-aria-expanded/accordion:text-primary-foreground",
        ),
      },
    },
    defaultVariants: { marker: "caret" },
  },
);

const accordionChevronVariants = cva("transition-transform duration-settle", {
  variants: {
    marker: { caret: "size-5", circle: "size-4" },
  },
  defaultVariants: { marker: "caret" },
});

type TriggerKeyEvent = Parameters<
  NonNullable<React.ComponentProps<typeof HeroAccordion.Trigger>["onKeyDown"]>
>[0];

const MOVE_KEYS = new Set(["Home", "End", "ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight"]);

/** Radix's roving focus between the triggers of one accordion, nested ones excluded. */
function moveFocus(event: TriggerKeyEvent, root: RootState) {
  const from = event.target as HTMLElement;
  const accordion = from.closest("[data-slot=accordion]");
  if (!MOVE_KEYS.has(event.key) || !accordion) return;
  const triggers = [
    ...accordion.querySelectorAll<HTMLButtonElement>("[data-slot=accordion-trigger]"),
  ].filter((t) => !t.disabled && t.closest("[data-slot=accordion]") === accordion);
  const at = triggers.indexOf(from as HTMLButtonElement);
  if (at === -1) return;
  event.preventDefault();
  const last = triggers.length - 1;
  const next = () => (at + 1 > last ? 0 : at + 1);
  const prev = () => (at - 1 < 0 ? last : at - 1);
  const horizontal = root.orientation === "horizontal";
  const ltr = root.dir === "ltr";
  let to = at;
  if (event.key === "Home") to = 0;
  else if (event.key === "End") to = last;
  else if (event.key === "ArrowDown" && !horizontal) to = next();
  else if (event.key === "ArrowUp" && !horizontal) to = prev();
  else if (event.key === "ArrowRight" && horizontal) to = ltr ? next() : prev();
  else if (event.key === "ArrowLeft" && horizontal) to = ltr ? prev() : next();
  triggers[to]?.focus();
}

function AccordionTrigger({
  className,
  children,
  marker,
  onKeyDown,
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof accordionTriggerVariants>) {
  const root = useRequired(RootContext, "AccordionTrigger", "Accordion");
  const item = useRequired(ItemContext, "AccordionTrigger", "AccordionItem");
  // Radix: the open row of a single accordion that cannot close says so.
  const locked = item.open && !root.collapsible;
  const stamp = {
    "data-state": state(item.open),
    "data-disabled": item.disabled ? "" : undefined,
    "data-orientation": root.orientation,
  };
  return (
    <HeroAccordion.Heading className="flex" {...stamp}>
      <HeroAccordion.Trigger
        data-slot="accordion-trigger"
        {...stamp}
        className={cn(accordionTriggerVariants({ marker }), className)}
        onKeyDown={(event) => {
          onKeyDown?.(event as unknown as React.KeyboardEvent<HTMLButtonElement>);
          moveFocus(event, root);
          // React Aria stops a key at the trigger unless told otherwise;
          // Radix let every key bubble, and so does this.
          event.continuePropagation();
        }}
        render={(dom) => <button {...dom} aria-disabled={locked ? true : dom["aria-disabled"]} />}
        {...(props as Record<string, unknown>)}
      >
        {children}
        <span data-slot="accordion-marker" className={accordionMarkerVariants({ marker })}>
          <ChevronDown className={accordionChevronVariants({ marker })} />
        </span>
      </HeroAccordion.Trigger>
    </HeroAccordion.Heading>
  );
}

function AccordionContent({
  className,
  children,
  // Radix's way to keep a closed panel mounted. React Aria always does.
  forceMount: _forceMount,
  ...props
}: React.ComponentProps<"div"> & { forceMount?: true }) {
  const root = useRequired(RootContext, "AccordionContent", "Accordion");
  const item = useRequired(ItemContext, "AccordionContent", "AccordionItem");
  return (
    <HeroAccordion.Panel
      data-slot="accordion-content"
      data-state={state(item.open)}
      data-disabled={item.disabled ? "" : undefined}
      data-orientation={root.orientation}
      // Radix's role. React Aria's default is `group`.
      role="region"
      className={cn(
        // `.accordion__panel` fades as it folds; Radix only folded, so the
        // answer stays opaque while its height moves. It also hints
        // `will-change` on an open panel, which moves the answer onto its own
        // layer and changes how its text is smoothed; an open answer is at
        // rest, so the hint goes.
        "overflow-hidden text-sm opacity-100 will-change-auto",
        // The fold is React Aria's: it animates `--disclosure-panel-height`.
        // These are the times the Radix keyframes had (motion.ts): open over
        // `settle` on the settle curve, close faster over `quick` on `leave`.
        "duration-quick ease-leave data-expanded:duration-settle data-expanded:ease-settle",
      )}
      {...(props as Record<string, unknown>)}
    >
      <div className={cn("pb-5 pt-0", className)}>{children}</div>
    </HeroAccordion.Panel>
  );
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
