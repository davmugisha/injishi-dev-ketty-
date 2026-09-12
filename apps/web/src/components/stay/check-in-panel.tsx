"use client";

import { Button } from "@injishi/ui";
import { Icon } from "@/components/app/icon";
import {
  checkInAtProperty,
  DEMO_STAYS,
  type GuestStay,
} from "@/lib/guest-stay";
import { outletsForProperty, productsForProperty } from "@/data/dining";
import { formatStayRange, nightsBetween } from "./stay-format";

/**
 * What a person who is not in a hotel room sees here.
 *
 * TWO AUDIENCES, ONE SCREEN. The first is a real guest with no stay on this
 * account: they get a sentence explaining what the screen becomes and a route
 * back to the marketplace, not an error. The second is whoever is giving the
 * demonstration, who needs to be standing in room 412 within one click and in
 * front of an audience.
 *
 * SERVING THE SECOND WITHOUT LYING TO THE FIRST is the whole design of this
 * panel. The check-in controls are not disguised as a real front desk: they sit
 * under their own heading, they say in the heading that they are demo controls,
 * and the button verb is "Check in (demo)" rather than "Check in". A presenter
 * loses nothing by the label being honest, and a stakeholder who clicks it
 * themselves is never misled into thinking a reservation system answered.
 *
 * WHY A PICKER AND NOT ONE BUTTON. `checkInDemoGuest()` would put everyone in
 * the Kigali Serena, which has the longest menu and no sold-out line on it. The
 * three stays here are the three `DEMO_STAYS` fixtures, and the counts beside
 * each are MEASURED from `data/dining.ts` rather than typed, so a presenter can
 * pick the Radisson deliberately to show a guest meeting an item the kitchen
 * has stopped serving. Choosing the hotel is also what demonstrates the scoping
 * rule: the menu that appears afterwards is that hotel's and nobody else's.
 */
export function CheckInPanel({
  heading,
  intro,
  onCheckedIn,
}: {
  heading: string;
  intro: string;
  /** Called after the write, so the screen can re-read rather than wait for the event. */
  onCheckedIn?: (stay: GuestStay) => void;
}) {
  return (
    <section className="rounded-card border border-border bg-card p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-card bg-secondary text-secondary-foreground">
          <Icon name="key" className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-lg font-bold tracking-tight">{heading}</h2>
          <p className="mt-1 max-w-read text-sm text-muted-foreground">{intro}</p>
        </div>
      </div>

      <div className="mt-6 border-t border-border pt-5">
        <h3 className="text-2xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
          Demo controls — no reservation is involved
        </h3>
        <p className="mt-2 max-w-read text-sm text-muted-foreground">
          Nothing behind this button is a real check-in. It writes a stay into
          this browser so the rest of the feature can be shown; the front desk
          never hears about it, and clearing your site data removes it.
        </p>

        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {DEMO_STAYS.map((stay) => {
            const outlets = outletsForProperty(stay.propertySlug).length;
            const products = productsForProperty(stay.propertySlug).length;
            const nights = nightsBetween(stay.checkIn, stay.checkOut);
            return (
              <li
                key={stay.propertySlug}
                className="flex flex-col rounded-card border border-border bg-background p-4"
              >
                <p className="font-display text-base font-bold leading-snug">
                  {stay.propertyName}
                </p>
                <p className="money mt-1 text-xs text-muted-foreground">
                  Room {stay.room} · {nights} {nights === 1 ? "night" : "nights"} ·{" "}
                  {formatStayRange(stay.checkIn, stay.checkOut)}
                </p>
                <p className="mt-2 grow text-xs text-muted-foreground">
                  {outlets} {outlets === 1 ? "outlet" : "outlets"}, {products}{" "}
                  {products === 1 ? "item" : "items"} on the room-service card.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 w-full"
                  onClick={() => {
                    const next = checkInAtProperty(stay.propertySlug);
                    onCheckedIn?.(next);
                  }}
                >
                  Check in (demo) — room {stay.room}
                </Button>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
