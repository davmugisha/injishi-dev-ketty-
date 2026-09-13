"use client";

/**
 * The modifiers on an item: a size, an extra, a choice of side (ADR-050 D-m).
 *
 * Each option is a name, whether a guest must choose it, how many choices they
 * may take, and the choices with what each adds to the price. The server checks
 * every order against exactly this, and snapshots what was chosen onto the order
 * with its price, so changing an option here never changes an order already
 * placed.
 *
 * A delta may be zero (Small) or negative (No cheese), and is tax exclusive like
 * the item's own price.
 */

import type { ServiceItemOption } from "@injishi/contracts";
import { Input } from "@injishi/ui";

import { fmt, parseAmount } from "../../lib/format";
import { ActionButton } from "../ui";

const labelClass = "text-2xs font-bold tracking-[0.08em] uppercase text-[var(--muted2)]";

/** A blank option, ready to be named. */
function blankOption(): ServiceItemOption {
  return { name: "", required: false, maxChoices: 1, choices: [{ label: "", priceDeltaRwf: 0 }] };
}

/** What is wrong with the modifiers, or null when they may be saved. */
export function modifiersError(options: ServiceItemOption[]): string | null {
  const names = new Set<string>();
  for (const option of options) {
    const name = option.name.trim();
    if (!name) return "Every option needs a name, like Size or Extras.";
    if (names.has(name)) return `Two options are both called "${name}".`;
    names.add(name);
    if (option.choices.length === 0) return `"${name}" needs at least one choice.`;
    const labels = new Set<string>();
    for (const choice of option.choices) {
      const label = choice.label.trim();
      if (!label) return `Every choice under "${name}" needs a label.`;
      if (labels.has(label)) return `"${name}" lists "${label}" twice.`;
      labels.add(label);
    }
    if (option.maxChoices < 1 || option.maxChoices > option.choices.length) {
      return `"${name}" allows ${option.maxChoices} choices but lists ${option.choices.length}.`;
    }
  }
  return null;
}

export function ModifierEditor({
  options,
  onChange,
  disabled,
}: {
  options: ServiceItemOption[];
  onChange: (next: ServiceItemOption[]) => void;
  disabled?: boolean;
}) {
  function update(index: number, next: ServiceItemOption) {
    onChange(options.map((o, i) => (i === index ? next : o)));
  }

  return (
    <div className="flex flex-col gap-3">
      {options.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No options. Guests order this as it is, at its price.
        </p>
      )}

      {options.map((option, index) => (
        <fieldset key={index} className="flex flex-col gap-2.5 rounded border border-line2 bg-field p-3">
          <legend className="sr-only">{option.name || `Option ${index + 1}`}</legend>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className={labelClass}>Option</span>
              <Input
                value={option.name}
                onChange={(e) => update(index, { ...option, name: e.target.value })}
                placeholder="Size"
                maxLength={80}
                disabled={disabled}
                className="h-10 rounded border-line2 bg-card text-sm"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>Pick up to</span>
              <Input
                value={String(option.maxChoices)}
                onChange={(e) =>
                  update(index, { ...option, maxChoices: Math.max(1, Math.min(20, parseAmount(e.target.value) || 1)) })
                }
                inputMode="numeric"
                disabled={disabled}
                className="pms-num h-10 w-20 rounded border-line2 bg-card text-sm"
              />
            </label>
            <label className="flex h-10 items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={option.required}
                onChange={(e) => update(index, { ...option, required: e.target.checked })}
                disabled={disabled}
                className="size-4 accent-[var(--accent)]"
              />
              A guest must choose
            </label>
            <ActionButton
              onClick={() => onChange(options.filter((_, i) => i !== index))}
              aria-label={`Remove the option ${option.name || index + 1}`}
              deniedReason={disabled ? "You cannot change this menu." : undefined}
            >
              Remove
            </ActionButton>
          </div>

          <ul className="flex flex-col gap-2">
            {option.choices.map((choice, c) => (
              <li key={c} className="flex flex-wrap items-center gap-2">
                <Input
                  value={choice.label}
                  onChange={(e) =>
                    update(index, {
                      ...option,
                      choices: option.choices.map((x, j) => (j === c ? { ...x, label: e.target.value } : x)),
                    })
                  }
                  placeholder={c === 0 ? "Small" : "Large"}
                  aria-label={`Choice ${c + 1} under ${option.name || "this option"}`}
                  maxLength={80}
                  disabled={disabled}
                  className="h-9 min-w-0 flex-1 rounded border-line2 bg-card text-sm"
                />
                <Input
                  value={choice.priceDeltaRwf === 0 ? "" : String(choice.priceDeltaRwf)}
                  onChange={(e) => {
                    const negative = e.target.value.trim().startsWith("-");
                    const amount = parseAmount(e.target.value) || 0;
                    update(index, {
                      ...option,
                      choices: option.choices.map((x, j) =>
                        j === c ? { ...x, priceDeltaRwf: negative ? -amount : amount } : x,
                      ),
                    });
                  }}
                  placeholder="+ 0"
                  inputMode="numeric"
                  aria-label={`What ${choice.label || `choice ${c + 1}`} adds to the price, in francs`}
                  disabled={disabled}
                  className="pms-num h-9 w-28 rounded border-line2 bg-card text-sm"
                />
                <span className="pms-num w-24 text-xs text-muted-foreground">
                  {choice.priceDeltaRwf === 0
                    ? "no change"
                    : `${choice.priceDeltaRwf > 0 ? "+" : "−"} ${fmt(Math.abs(choice.priceDeltaRwf))}`}
                </span>
                {option.choices.length > 1 && (
                  <ActionButton
                    onClick={() =>
                      update(index, {
                        ...option,
                        choices: option.choices.filter((_, j) => j !== c),
                        maxChoices: Math.min(option.maxChoices, option.choices.length - 1),
                      })
                    }
                    aria-label={`Remove ${choice.label || `choice ${c + 1}`}`}
                  >
                    Remove
                  </ActionButton>
                )}
              </li>
            ))}
          </ul>
          <div>
            <ActionButton
              onClick={() =>
                update(index, { ...option, choices: [...option.choices, { label: "", priceDeltaRwf: 0 }] })
              }
              deniedReason={disabled ? "You cannot change this menu." : undefined}
            >
              Add a choice
            </ActionButton>
          </div>
        </fieldset>
      ))}

      <div>
        <ActionButton
          onClick={() => onChange([...options, blankOption()])}
          deniedReason={disabled ? "You cannot change this menu." : undefined}
        >
          Add an option
        </ActionButton>
      </div>
    </div>
  );
}
