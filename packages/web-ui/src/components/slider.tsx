"use client";

import * as React from "react";
import { Slider as HeroSlider } from "@heroui/react";
import { cn } from "@injishi/utils";

/**
 * A value, or a range, along a track, on HeroUI 3 (React Aria). The explore
 * price filter is the caller: two thumbs, redrawn while they move
 * (`onValueChange`) and committed only when they are let go (`onValueCommit`).
 *
 * THE API IS RADIX'S, ON PURPOSE. This file was Radix until 2026-10-06, and
 * the price filter still speaks Radix, so the adapter translates:
 *
 *  - Values are always an array, one entry per thumb; with neither `value` nor
 *    `defaultValue` there is one thumb at `min`.
 *  - `onValueChange` fires only when a value really changed, and
 *    `onValueCommit` only when the gesture ended somewhere other than where it
 *    began. React Aria reports both on every move and every release; Radix did
 *    not, and the price filter writes the URL on commit.
 *  - A range's thumbs are named "Minimum" and "Maximum", inside the slider's
 *    own name, as Radix named them.
 *  - `min`, `max`, `disabled` and `name` keep Radix's spelling.
 *
 * The thumbs stay inside the track's ends, as Radix kept them: a thumb at the
 * minimum sits flush with the left end rather than half past it. React Aria
 * centres a thumb on its value, so the track carries a transparent border of
 * half a thumb on each side, and the thumbs and the fill are placed inside it.
 * Pointer to value is measured over the track's full width in both, so a press
 * lands on the same value it always did.
 *
 * What React Aria adds: a labelled group around the thumbs, a real range
 * input under each thumb (so a form posts it and a screen reader reads its
 * value as text), and a value held inside `min` and `max` and snapped to
 * `step`, where Radix drew an out-of-range value past the end of the track.
 *
 * What it does differently, and the price filter is fine with both:
 *
 *  - A thumb stops at its neighbour. Radix let a dragged thumb run on past the
 *    other and the two swapped roles; React Aria bounds each thumb by the next
 *    one, which is the WAI-ARIA multi-thumb pattern, and each thumb reports
 *    those bounds as its own minimum and maximum.
 *  - Home and End move the thumb that has focus. Radix's Home always moved
 *    the first thumb and its End the last, whichever one was focused.
 *  - Page Up, Page Down and Shift with an arrow move a tenth of the range.
 *    Radix moved ten steps; the two agree whenever the range is a hundred
 *    steps, which the price filter's usually is.
 *
 * Not carried over, because nothing used them and React Aria has no
 * counterpart: `inverted`, `minStepsBetweenThumbs`, `dir` (the direction is
 * the page's locale) and `asChild`.
 */
type SliderProps = Omit<React.ComponentProps<"div">, "defaultValue" | "dir" | "onChange"> & {
  value?: number[];
  defaultValue?: number[];
  onValueChange?(value: number[]): void;
  onValueCommit?(value: number[]): void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  orientation?: "horizontal" | "vertical";
  /** Posted with a form; a range posts `name[]`, once per thumb, as in Radix. */
  name?: string;
  form?: string;
};

/** Radix's names for the thumbs of a range. One thumb is named by the slider alone. */
function thumbLabel(index: number, count: number): string | undefined {
  if (count > 2) return `Value ${index + 1} of ${count}`;
  if (count === 2) return index === 0 ? "Minimum" : "Maximum";
  return undefined;
}

const asArray = (value: number | number[]) => (Array.isArray(value) ? value : [value]);
const same = (a: readonly number[], b: readonly number[]) =>
  a.length === b.length && a.every((v, i) => v === b[i]);

function Slider({
  className,
  value,
  defaultValue,
  onValueChange,
  onValueCommit,
  min = 0,
  max = 100,
  step = 1,
  disabled,
  orientation = "horizontal",
  name,
  form,
  ...props
}: SliderProps) {
  // The values on screen, and where the gesture under way began.
  const shown = React.useRef<readonly number[]>([]);
  const before = React.useRef<readonly number[] | null>(null);

  return (
    <HeroSlider
      data-slot="slider"
      value={value}
      defaultValue={value === undefined ? (defaultValue ?? [min]) : undefined}
      minValue={min}
      maxValue={max}
      step={step}
      isDisabled={disabled}
      orientation={orientation}
      onChange={(next) => {
        const values = asArray(next);
        if (same(values, shown.current)) return;
        before.current ??= shown.current;
        onValueChange?.(values);
      }}
      onChangeEnd={(end) => {
        const values = asArray(end);
        const start = before.current;
        before.current = null;
        if (start && !same(start, values)) onValueCommit?.(values);
      }}
      // `.slider` is a labelled grid; this one has no label or output inside
      // it, so it is the flex row it was. Its height is the track's: the
      // thumbs overhang above and below, as they did.
      className={cn(
        "relative flex w-full touch-none select-none items-center",
        "data-[disabled]:opacity-50",
        className,
      )}
      {...(props as Record<string, unknown>)}
    >
      {({ state }) => {
        shown.current = state.values;
        const count = state.values.length;
        return (
          <HeroSlider.Track
            data-slot="slider-track"
            // `.slider__track` is a 20px bar on `bg-default`. This is the 4px
            // rail it was, with ends half a thumb (9px) wide that take the
            // fill's ink when the fill reaches them, as Radix's range ran to
            // the end of the rail; otherwise they are the rail's own colour.
            className={cn(
              "bg-secondary relative h-1 w-full grow rounded-full border-x-[9px] border-transparent",
              "data-fill-start:border-s-ink data-fill-end:border-e-ink",
            )}
          >
            <HeroSlider.Fill data-slot="slider-range" className="bg-ink absolute h-full" />
            {state.values.map((_, index) => (
              <HeroSlider.Thumb
                key={index}
                index={index}
                data-slot="slider-thumb"
                aria-label={thumbLabel(index, count)}
                name={name ? name + (count > 1 ? "[]" : "") : undefined}
                form={form}
                // `.slider__thumb` is an accent pill with a white tab drawn in
                // `::after`; this is the white disc with an ink ring it was.
                // Focus lands on the range input inside it, so the ring keys
                // on React Aria's flag rather than on `:focus-visible`.
                className={cn(
                  "border-ink block size-[18px] rounded-full border-2 bg-white shadow-control after:hidden",
                  "transition-transform hover:scale-110",
                  "data-focus-visible:ring-ring data-focus-visible:ring-2 data-focus-visible:ring-offset-2",
                )}
              />
            ))}
          </HeroSlider.Track>
        );
      }}
    </HeroSlider>
  );
}

export { Slider };
