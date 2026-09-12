"use client";

import { Button } from "@injishi/ui";
import { Icon } from "@/components/app/icon";

/**
 * Minus, a number, plus.
 *
 * It replaces "Add" turning into a stepper in place, which is the pattern the
 * marketplace's guest picker uses and which is wrong here: a menu of twenty
 * lines under three headings needs the same control in the same place on every
 * row, or the eye has to re-find it each time.
 *
 * The number is TEXT, not an input. A numeric field on a menu row invites a
 * keyboard on a phone, and a guest who types "12" for what should have been two
 * has no way to notice before the ticket prints. Two taps for two brochettes is
 * the right cost.
 *
 * ACCESSIBILITY. The quantity is announced through the buttons' labels rather
 * than by the bare digit, because "2" read out on its own says nothing about
 * what there are two of. `aria-live` is deliberately absent: a stepper that
 * announces on every press talks over a guest working down a menu.
 */
export function QuantityStepper({
  label,
  quantity,
  onDecrease,
  onIncrease,
  disabled = false,
}: {
  /** What is being counted, for the screen-reader labels. */
  label: string;
  quantity: number;
  onDecrease: () => void;
  onIncrease: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        disabled={disabled || quantity === 0}
        onClick={onDecrease}
        aria-label={`One fewer ${label}`}
      >
        <Icon name="minus" className="h-4 w-4" />
      </Button>
      <span
        className="money w-6 text-center text-sm font-semibold tabular-nums"
        aria-hidden={quantity === 0}
      >
        {quantity === 0 ? "" : quantity}
      </span>
      <Button
        variant="ghost"
        size="icon"
        disabled={disabled}
        onClick={onIncrease}
        aria-label={`One more ${label}`}
      >
        <Icon name="plus" className="h-4 w-4" />
      </Button>
    </div>
  );
}
