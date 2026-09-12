"use client";

import { Badge } from "@injishi/ui";
import { Icon } from "@/components/app/icon";
import type { GuestStay } from "@/lib/guest-stay";
import { formatStayDate, nightsBetween } from "./stay-format";

/**
 * Where the guest is, in the four facts they would check against their key card.
 *
 * THE ROOM NUMBER IS THE LARGEST THING ON IT, and that is not decoration. Every
 * order placed from this screen is delivered to that number and to no other, so
 * a guest who has been moved rooms has to be able to catch it here rather than
 * when a tray arrives at the wrong door. It is the same string that goes onto
 * `RoomOrder.room`, read from the one stay record, never re-typed.
 *
 * The property name links out to the marketplace listing rather than to a
 * screen inside the shell: the hotel a guest is standing in is the same public
 * record anyone else can read, and forking it into a private copy is how two
 * descriptions of one hotel come to exist.
 */
export function StayHeader({ stay }: { stay: GuestStay }) {
  const nights = nightsBetween(stay.checkIn, stay.checkOut);

  return (
    <section className="rounded-card border border-border bg-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Badge variant="success" size="sm">
              Checked in
            </Badge>
            <span className="text-2xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
              In house now
            </span>
          </div>
          <h2 className="mt-3 font-display text-2xl font-bold leading-tight tracking-tight">
            <a href={`/property/${stay.propertySlug}`} className="hover:underline">
              {stay.propertyName}
            </a>
          </h2>
          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Icon name="calendar-days" className="h-4 w-4" />
              <span className="money">
                {formatStayDate(stay.checkIn)} to {formatStayDate(stay.checkOut)}
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Icon name="bed" className="h-4 w-4" />
              <span className="money">
                {nights} {nights === 1 ? "night" : "nights"}
              </span>
            </span>
          </p>
        </div>

        <div className="rounded-card border border-border bg-background px-5 py-4 text-center">
          <p className="text-2xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
            Your room
          </p>
          <p className="money mt-1 font-display text-3xl font-bold leading-none">
            {stay.room}
          </p>
        </div>
      </div>
    </section>
  );
}
