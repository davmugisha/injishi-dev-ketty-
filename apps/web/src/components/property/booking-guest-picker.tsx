"use client";

import { MAX_INFANTS } from "@injishi/contracts";
import { Button } from "@injishi/web-ui";
import { cn } from "@injishi/utils";
import { StepButton } from "@/components/shared/step-button";
import {
  billableGuests,
  GUEST_AGES,
  GUEST_LIMITS,
  type GuestCounts,
} from "@/lib/stay-search";

/**
 * The booking card's guest picker.
 *
 * The search bar has its own stepper panel, but the two are not the same
 * control and sharing one would make both worse. Search filters a catalogue, so
 * its bounds are the widest a party can plausibly be. This one is bounded by a
 * specific property: adults plus children cannot exceed what the stay sleeps.
 * The rows and the footer sentence differ for the same reason.
 *
 * Infants sit outside the cap, which is why the footer spells that out rather
 * than leaving a guest to discover it when the `+` stops responding.
 */
export function BookingGuestPicker({
  guests,
  onChange,
  onClose,
  maxGuests,
}: {
  guests: GuestCounts;
  onChange: (next: GuestCounts) => void;
  onClose: () => void;
  maxGuests: number;
}) {
  const billable = billableGuests(guests);
  const atCapacity = billable >= maxGuests;
  /*
   * Infants are free, but not unlimited: "2 guests, 5 infants" in a room that
   * sleeps two is a party no host can take. At most MAX_INFANTS, and never more
   * than the stay sleeps.
   */
  const infantCap = Math.min(MAX_INFANTS, GUEST_LIMITS.infants.max, maxGuests);

  return (
    <div className="w-[min(370px,calc(100vw-2rem))] p-6">
      <Row
        label="Adults"
        helper={GUEST_AGES.adults}
        singular="adult"
        value={guests.adults}
        canDecrease={guests.adults > GUEST_LIMITS.adults.min}
        canIncrease={!atCapacity && guests.adults < GUEST_LIMITS.adults.max}
        onChange={(adults) => onChange({ ...guests, adults })}
      />
      <Row
        label="Children"
        helper={GUEST_AGES.children}
        singular="child"
        value={guests.children}
        canDecrease={guests.children > GUEST_LIMITS.children.min}
        canIncrease={!atCapacity && guests.children < GUEST_LIMITS.children.max}
        onChange={(children) => onChange({ ...guests, children })}
      />
      <Row
        label="Infants"
        helper={GUEST_AGES.infants}
        singular="infant"
        value={guests.infants}
        canDecrease={guests.infants > GUEST_LIMITS.infants.min}
        canIncrease={guests.infants < infantCap}
        onChange={(infants) => onChange({ ...guests, infants })}
        last
      />
      {/*
        The pets row is gone with the fixtures. None of the real sources
        publish a pet policy, and the old copy stated one either way — telling
        guests that a named, operating hotel does not accept pets is a claim
        about that business we have nothing to support.
      */}

      <p className="mt-4 text-sm leading-snug text-page-fg-70">
        This place has a maximum of {maxGuests} guests, not including infants.
        The price is per guest, per night; infants stay free (up to {infantCap}).
      </p>

      {/* A filled button, matching the date panel — an underlined word alone
          did not read as the way out of the popover. */}
      <div className="mt-4 flex justify-end border-t border-input pt-4">
        <Button variant="primary" shape="rounded" onClick={onClose} className="px-5 text-base">
          Close
        </Button>
      </div>
    </div>
  );
}

function Row({
  label,
  helper,
  singular,
  value,
  canDecrease,
  canIncrease,
  onChange,
  last = false,
}: {
  label: string;
  helper: React.ReactNode;
  singular: string;
  value: number;
  canDecrease: boolean;
  canIncrease: boolean;
  onChange: (next: number) => void;
  last?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 py-4",
        !last && "border-b border-input",
      )}
    >
      <span>
        <span className="block text-base leading-tight text-page-fg">{label}</span>
        <span className="block text-sm leading-tight text-page-fg-70">{helper}</span>
      </span>

      <span className="flex shrink-0 items-center gap-1">
        <StepButton
          tone="card"
          sign="minus"
          label={`Remove one ${singular}`}
          disabled={!canDecrease}
          onClick={() => onChange(value - 1)}
        />
        <span
          aria-live="polite"
          className="w-8 text-center text-base tabular-nums text-page-fg"
        >
          {value}
        </span>
        <StepButton
          tone="card"
          sign="plus"
          label={`Add one ${singular}`}
          disabled={!canIncrease}
          onClick={() => onChange(value + 1)}
        />
      </span>
    </div>
  );
}

