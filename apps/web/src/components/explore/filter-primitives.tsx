"use client";

import { Check, ChevronDown, Minus } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@injishi/ui";
import { cn } from "@injishi/utils";
import type { FacetGroup, FacetOption } from "@/data/explore-facets";
import { formatRateNumber } from "@/lib/price";

/**
 * The parts every block of the explore filter rail is built from.
 *
 * One section component, one row component per control shape, and one
 * expander. The reference rail has around twenty blocks; written out
 * longhand that is twenty chances to give one of them a different heading
 * size, a different hit target or a count in a different place, and a rail
 * whose blocks disagree with each other reads as broken software rather than
 * as a filter.
 *
 * **The whole row is the control.** Not a box with a label beside it. A 16px
 * checkbox is a 16px hit target, and this rail asks a guest to hit sixty of
 * them; the row is ~230x36. This is also why the rows are `<button>` and
 * `<label>` elements rather than divs with click handlers — the keyboard and
 * the screen reader get the same affordance the mouse does.
 *
 * **No numbered ramp classes anywhere in this file.** The public layer imports
 * `@injishi/design-tokens/heroui.css`, which ships the semantic roles without
 * the `green-*` and `ink-*` ramps, so a class like `bg-green-800` would
 * silently resolve to Tailwind's own default green rather than to the brand
 * one. `accent-text` is the role that carries the brand green here.
 */

/* ------------------------------------------------------------- section */

export function FilterSection({
  id,
  title,
  children,
  className,
}: {
  /** Becomes `data-facet-group`, which is also the checker's handle on it. */
  id: string;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      data-facet-group={id}
      className={cn("border-t border-separator py-5 first:border-t-0", className)}
    >
      <h3 className="mb-2 text-base font-bold text-foreground">{title}</h3>
      {children}
    </section>
  );
}

/* ---------------------------------------------------------------- rows */

/** The count and the "From" rate, right-aligned, as the reference sets them. */
function RowMeta({ option, showFrom }: { option: FacetOption; showFrom?: boolean }) {
  if (showFrom) {
    return (
      <span
        data-facet-count
        className="ml-auto shrink-0 text-right text-xs leading-tight text-muted-foreground"
      >
        {option.fromRwf === null ? (
          <>({option.count})</>
        ) : (
          <>
            {formatRateNumber(option.fromRwf)}
            <span className="sr-only"> RWF, </span>
            <span aria-hidden> RWF</span>
          </>
        )}
      </span>
    );
  }
  return (
    <span
      data-facet-count
      className="ml-auto shrink-0 text-sm text-muted-foreground"
    >
      ({option.count})
    </span>
  );
}

/**
 * A checkbox row.
 *
 * A real `<input type="checkbox">` behind a drawn box, not a `<button
 * role="checkbox">`. The native control brings the label association, the
 * space-bar behaviour and the form semantics for free, and the drawn box only
 * has to follow `peer-checked`. `@injishi/ui`'s `Checkbox` is HeroUI's field,
 * which is right for a form and heavier than a rail of sixty rows needs.
 */
export function CheckboxRow({
  label,
  option,
  checked,
  onToggle,
  showFrom,
}: {
  label: string;
  option: FacetOption;
  checked: boolean;
  onToggle: () => void;
  showFrom?: boolean;
}) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      data-facet-option="checkbox"
      className="flex cursor-pointer items-center gap-2.5 rounded py-1.5 pl-1 pr-1.5 transition-colors hover:bg-surface-secondary"
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className={cn(
          "flex size-[17px] shrink-0 items-center justify-center rounded-[3px] border transition-colors",
          "border-field-outline bg-field-background",
          "peer-checked:border-accent-text peer-checked:bg-accent-text",
          "peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-1",
        )}
      >
        <Check
          className="size-3 text-white opacity-0 peer-checked:opacity-100"
          strokeWidth={3.5}
        />
      </span>
      <span className="min-w-0 truncate text-sm leading-snug text-foreground">
        {label}
      </span>
      <RowMeta option={option} showFrom={showFrom} />
    </label>
  );
}

/**
 * A radio row.
 *
 * Radios in this rail are DESELECTABLE, which a native radio group is not:
 * "Guest rating: Good 7+" has no "any rating" member, so without a second
 * click that clears it a guest who ticks it can never get back to an unfiltered
 * list except by reloading. So the group renders `role="radio"` buttons and
 * handles the toggle itself.
 */
export function RadioRow({
  label,
  option,
  checked,
  onToggle,
  showFrom,
}: {
  label: string;
  option: FacetOption;
  checked: boolean;
  onToggle: () => void;
  showFrom?: boolean;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onToggle}
      data-facet-option="radio"
      className="flex w-full cursor-pointer items-center gap-2.5 rounded py-1.5 pl-1 pr-1.5 text-left transition-colors hover:bg-surface-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span
        aria-hidden
        className={cn(
          "flex size-[17px] shrink-0 items-center justify-center rounded-full border transition-colors",
          checked ? "border-accent-text" : "border-field-outline",
        )}
      >
        {checked ? <span className="size-[9px] rounded-full bg-accent-text" /> : null}
      </span>
      <span className="min-w-0 truncate text-sm leading-snug text-foreground">
        {label}
      </span>
      <RowMeta option={option} showFrom={showFrom} />
    </button>
  );
}

/* ------------------------------------------------------------ expander */

/**
 * The "See more" / "See less" disclosure.
 *
 * The reference keeps a twenty-block rail scannable by showing four or five
 * options per block and hiding the tail. Rendering the hidden rows and setting
 * `hidden` on them, rather than not rendering them, keeps the expander's own
 * position stable and lets the browser find text in a collapsed block.
 */
export function SeeMore({
  count,
  expanded,
  onToggle,
}: {
  count: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      data-see-more
      aria-expanded={expanded}
      className="mt-1 flex items-center gap-1 px-1 py-1 text-sm font-bold text-accent-text underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
    >
      {expanded ? (
        <>
          <Minus className="size-3.5" strokeWidth={2.5} aria-hidden />
          See less
        </>
      ) : (
        <>
          <ChevronDown className="size-3.5" strokeWidth={2.5} aria-hidden />
          See more ({count})
        </>
      )}
    </button>
  );
}

/* --------------------------------------------------------------- group */

/**
 * One whole facet block: heading, rows, and the expander when there is a tail.
 *
 * `selected` is a set of the values currently ticked and `onToggle` is handed
 * the value. The block knows nothing about `ExploreRefinement`, which is what
 * lets the same component render a group that writes an intent field
 * (neighbourhood) and one that writes a refinement field (everything else).
 */
export function FacetBlock({
  group,
  selected,
  onToggle,
}: {
  group: FacetGroup;
  selected: readonly string[];
  onToggle: (value: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const Row = group.shape === "radio" ? RadioRow : CheckboxRow;
  const hidden = Math.max(0, group.options.length - group.visible);

  return (
    <FilterSection id={group.id} title={group.title}>
      <div role={group.shape === "radio" ? "radiogroup" : undefined}>
        {group.options.map((option, index) => (
          <div key={option.value} hidden={!expanded && index >= group.visible}>
            <Row
              label={option.label}
              option={option}
              checked={selected.includes(option.value)}
              onToggle={() => onToggle(option.value)}
              showFrom={group.showFrom}
            />
          </div>
        ))}
      </div>
      {hidden > 0 ? (
        <SeeMore
          count={hidden}
          expanded={expanded}
          onToggle={() => setExpanded((open) => !open)}
        />
      ) : null}
    </FilterSection>
  );
}

/* --------------------------------------------------------------- misc */

/** The rail's own small "Clear" affordance, used by the header and the sheet. */
export function ClearButton({
  count,
  onClear,
  className,
}: {
  count: number;
  onClear: () => void;
  className?: string;
}) {
  if (count === 0) return null;
  return (
    <Button
      variant="ghost"
      size="sm"
      shape="rounded"
      onClick={onClear}
      className={cn("h-auto px-2 py-1 text-sm font-bold text-accent-text", className)}
    >
      Clear {count}
    </Button>
  );
}
