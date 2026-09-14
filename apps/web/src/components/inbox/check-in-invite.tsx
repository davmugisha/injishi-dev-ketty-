"use client";

import { Button } from "@injishi/ui";

import { checkInDemoGuest, DEMO_STAYS, stayLabel } from "@/lib/guest-stay";
import {
  DEPARTMENTS,
  DEPARTMENT_BLURB,
  DEPARTMENT_LABEL,
  DEPARTMENT_LEAD,
} from "@/lib/order-store";
import { Icon } from "@/components/app/icon";
import { DEPARTMENT_ICON } from "./department-desk";

/**
 * What a guest who is not checked in sees, and WHY it is an offer rather than a
 * refusal.
 *
 * A department thread is not a feature of the app, it is a feature of a STAY:
 * housekeeping at the Lanternhouse will not take a message from somebody who
 * is not in a room there, and inventing a thread for a person with no stay
 * would be inventing a relationship with a named hotel. So the honest answer to
 * "who do I talk to" without a stay is "nobody yet", and this screen says that
 * in the first sentence instead of rendering five dead rows.
 *
 * It then does the two useful things rather than stopping there. It SHOWS the
 * five desks — the desk, its lead and what it covers — so the reader learns
 * what a stay unlocks without having to guess; and it offers the demo check-in,
 * labelled as one, because this build has no reservation system and a
 * presenter needs to be in a room in one click. `checkInDemoGuest` is the same
 * call the stay screens use, so checking in here lands the guest in exactly the
 * state room service expects.
 *
 * The three stays are the fixture's own (`DEMO_STAYS`): fictional catalogue
 * hotels with a fabricated room number, which is the trade `data/dining.ts` documents
 * at length and which the demo notice above this component discloses.
 */
export function CheckInInvite() {
  return (
    <div className="mx-auto w-full max-w-read px-4 py-10 sm:px-6">
      <span className="flex h-12 w-12 items-center justify-center rounded-card bg-secondary text-secondary-foreground">
        <Icon name="key" className="h-6 w-6" />
      </span>

      <h2 className="mt-4 font-display text-2xl font-bold tracking-tight">
        You are not checked in anywhere
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Department threads belong to a stay. Reception, housekeeping, the kitchen,
        maintenance and security are the desks of one hotel on the nights you are
        in it — so until you check in there is nobody on the other end, and this
        screen would rather say so than show you five conversations that reach
        nobody.
      </p>

      <div className="mt-6 rounded-card border border-border p-4">
        <h3 className="text-sm font-bold">Open a demo stay</h3>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          This build has no reservation system. These three put you in a room in
          this browser only — nothing is booked, nothing is charged, and no hotel
          is told anything.
        </p>
        <div className="mt-3 flex flex-col gap-2">
          {DEMO_STAYS.map((stay) => (
            <Button
              key={stay.propertySlug}
              variant="outline"
              className="h-auto w-full justify-start gap-3 whitespace-normal px-4 py-3 text-left"
              onClick={() => checkInDemoGuest(stay)}
            >
              <Icon name="bed" className="h-4 w-4 shrink-0" />
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{stay.propertyName}</span>
                <span className="money block text-xs text-muted-foreground">
                  {stayLabel(stay)} · {stay.checkIn} to {stay.checkOut}
                </span>
              </span>
            </Button>
          ))}
        </div>
      </div>

      <h3 className="mt-8 text-sm font-bold">The five desks a stay opens</h3>
      <ul className="mt-3 space-y-3">
        {DEPARTMENTS.map((department) => {
          const lead = DEPARTMENT_LEAD[department];
          return (
            <li key={department} className="flex items-start gap-3">
              <span
                aria-hidden
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-card bg-secondary text-secondary-foreground"
              >
                <Icon name={DEPARTMENT_ICON[department]} className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">
                  {DEPARTMENT_LABEL[department]}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {lead.name} · {lead.role}
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                  {DEPARTMENT_BLURB[department]}
                </span>
              </span>
            </li>
          );
        })}
      </ul>

      <p className="mt-8 text-sm text-muted-foreground">
        Not staying anywhere yet?{" "}
        <a href="/explore" className="font-semibold text-accent-text underline">
          Find somewhere to stay
        </a>
        .
      </p>
    </div>
  );
}
