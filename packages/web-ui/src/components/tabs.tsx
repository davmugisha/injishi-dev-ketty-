"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@injishi/utils";

const Tabs = TabsPrimitive.Root;

/**
 * Two looks, one primitive (2026-09-12).
 *
 * `pill` is the segmented control: the selected tab is a filled ink pill and
 * the rest are outlined. `underline` is a row of plain labels with a 2px rule
 * under the selected one and a hairline under the whole row, for a tab row
 * that sits above content it must not compete with — a marketplace band, a
 * result list. Both marketplace rows that needed the second look had built it
 * from bare `<button>`s, and `apps/web`'s public stylesheet rounds every bare
 * button into a pill, so the 2px rule rendered as a curve. The variant carries
 * `rounded-none`, which is what opts a button out of that rule.
 *
 * The list owns the variant and hands it to its triggers through context, so
 * a call site sets it once on `TabsList` and cannot mix the two looks in one
 * row.
 */
type TabsVariant = "pill" | "underline";

const TabsVariantContext = React.createContext<TabsVariant>("pill");

const LIST: Record<TabsVariant, string> = {
  pill: "inline-flex items-center justify-center gap-2",
  // The hairline is an inset shadow, not a `border-b`, and the triggers do not
  // pull themselves down over it with a negative margin. A border sits outside
  // the padding box, so a trigger can only cover it by overflowing, and on a
  // phone this row is `overflow-x-auto`: a one pixel vertical overflow is a
  // scrollbar. The shadow is painted inside the box, under the content, so
  // the selected trigger's 2px rule simply covers it and the two read as one
  // line, at every scroll position.
  underline:
    "flex items-end gap-6 shadow-[inset_0_-1px_0_0_var(--color-border)]",
};

const TRIGGER: Record<TabsVariant, string> = {
  pill: cn(
    "inline-flex items-center justify-center whitespace-nowrap rounded-full px-5 py-2.5 text-sm font-medium transition-all duration-quick",
    "border border-transparent disabled:pointer-events-none disabled:opacity-50",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "data-[state=active]:bg-ink data-[state=active]:text-white",
    "data-[state=inactive]:border-slate-line data-[state=inactive]:hover:border-ink",
  ),
  // The focus ring is INSET, and the trigger wears `-mx-1 px-1` so the ring
  // clears the glyphs: this row is `overflow-x-auto` on a phone, and a ring
  // drawn outside the box is clipped by it. A list that scrolls should carry
  // the same `-mx-1 px-1`, so the first trigger's ring is inside its padding.
  // `items-end` with a coarse-pointer minimum height: the label keeps sitting
  // on its rule, and the box above it grows to the 44px a thumb needs.
  underline: cn(
    "-mx-1 inline-flex shrink-0 items-end whitespace-nowrap rounded-none border-b-2 px-1 pb-3 text-sm font-medium transition-colors pointer-coarse:min-h-11",
    "disabled:pointer-events-none disabled:opacity-50",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
    "data-[state=active]:border-accent-text data-[state=active]:text-foreground",
    "data-[state=inactive]:border-transparent data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground",
  ),
};

function TabsList({
  className,
  variant = "pill",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> & { variant?: TabsVariant }) {
  return (
    <TabsVariantContext.Provider value={variant}>
      <TabsPrimitive.List
        data-slot="tabs-list"
        data-variant={variant}
        className={cn(LIST[variant], className)}
        {...props}
      />
    </TabsVariantContext.Provider>
  );
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  const variant = React.useContext(TabsVariantContext);
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      data-variant={variant}
      className={cn(TRIGGER[variant], className)}
      {...props}
    />
  );
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    // Radix makes the panel a tab stop (`tabIndex=0`), so it needs a visible
    // focus. A call site whose panel opens with a focusable control can pass
    // `tabIndex={-1}` and skip the stop, which the APG allows.
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn(
        "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent, type TabsVariant };
