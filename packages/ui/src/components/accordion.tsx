"use client";

import * as React from "react";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { cva, type VariantProps } from "class-variance-authority";
import { ChevronDown } from "lucide-react";
import { cn } from "@injishi/utils";

const Accordion = AccordionPrimitive.Root;

function AccordionItem({
  className,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Item>) {
  return (
    <AccordionPrimitive.Item
      data-slot="accordion-item"
      className={cn("border-b last:border-b-0", className)}
      {...props}
    />
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
 * are one component with one behaviour and two markers. A fork would have to
 * re-derive Radix's data-state wiring, and the next surface that wants a round
 * marker would fork again.
 */
const accordionTriggerVariants = cva(
  cn(
    "flex flex-1 items-center justify-between gap-4 text-left font-medium transition-all",
    "focus-visible:outline-none",
    // The marker wrapper is always present, so the rotation is addressed
    // through it rather than through a direct-child `svg` selector.
    "[&[data-state=open]_[data-slot=accordion-marker]_svg]:rotate-180",
  ),
  {
    variants: {
      marker: {
        caret: "py-5 hover:underline",
        circle: cn(
          "group/accordion gap-6 py-6",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        ),
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
          "group-data-[state=open]/accordion:border-primary group-data-[state=open]/accordion:bg-primary group-data-[state=open]/accordion:text-primary-foreground",
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

function AccordionTrigger({
  className,
  children,
  marker,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Trigger> &
  VariantProps<typeof accordionTriggerVariants>) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        className={cn(accordionTriggerVariants({ marker }), className)}
        {...props}
      >
        {children}
        <span
          data-slot="accordion-marker"
          className={accordionMarkerVariants({ marker })}
        >
          <ChevronDown className={accordionChevronVariants({ marker })} />
        </span>
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}

function AccordionContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Content>) {
  return (
    <AccordionPrimitive.Content
      data-slot="accordion-content"
      className="data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden text-sm"
      {...props}
    >
      <div className={cn("pb-5 pt-0", className)}>{children}</div>
    </AccordionPrimitive.Content>
  );
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
