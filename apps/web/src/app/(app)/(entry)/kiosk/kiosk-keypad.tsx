"use client";

/**
 * The on-screen keypad. Every key is a real button with its own label, so a
 * screen reader reads "1", "Clear" and "Delete the last digit", and a hardware
 * keyboard still types into the field beside it.
 *
 * It never holds a value: it reports a digit, a clear or a delete, and the
 * screen applies it to whichever field is open.
 */
import { Delete } from "lucide-react";
import { Button } from "@injishi/ui";

const DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;

/** Board k-key: a 64px pill, the figure large and tabular. */
/* `text-foreground`: HeroUI paints a secondary label in the accent, and a
 * keypad digit is a figure to read, not a link to follow. */
const KEY = "h-16 w-full text-2xl font-semibold tabular-nums text-foreground";

export function KioskKeypad({
  onDigit,
  onClear,
  onDelete,
  disabled,
}: {
  onDigit: (digit: string) => void;
  onClear: () => void;
  onDelete: () => void;
  disabled?: boolean;
}) {
  return (
    <div role="group" aria-label="Keypad" className="grid grid-cols-3 gap-3">
      {DIGITS.map((d) => (
        <Button key={d} type="button" variant="secondary" className={KEY} disabled={disabled} onClick={() => onDigit(d)}>
          {d}
        </Button>
      ))}
      <Button type="button" variant="secondary" className="h-16 w-full text-base font-semibold text-foreground" disabled={disabled} onClick={onClear}>
        Clear
      </Button>
      <Button type="button" variant="secondary" className={KEY} disabled={disabled} onClick={() => onDigit("0")}>
        0
      </Button>
      <Button
        type="button"
        variant="secondary"
        className="h-16 w-full text-foreground"
        aria-label="Delete the last digit"
        disabled={disabled}
        onClick={onDelete}
      >
        <Delete aria-hidden className="size-6" strokeWidth={1.8} />
      </Button>
    </div>
  );
}
