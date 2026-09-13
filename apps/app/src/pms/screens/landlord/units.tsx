"use client";

/**
 * Units & rents (F-R02) — the building, its unit types and its units, on real
 * data (2026-09-13).
 *
 * This screen used to read `residence.units` out of the demo store and change
 * rents in a reducer, so a landlord approved on the real platform saw somebody
 * else's invented flats and could add none of their own. A unit is a `rooms`
 * row under a residence room type — the same row a lease names — so it is set up
 * through the same inventory routes a hotel uses, worded for a landlord: unit
 * types priced per month, units by the number on the door, photos, publishing.
 *
 * Occupancy is still derived from leases, never stored, and a rent change still
 * applies from the next lease: the price here is what a NEW lease is offered.
 */

import { RoomsRates } from "../rooms-rates";

export function Units() {
  return (
    <div className="flex flex-col gap-4" data-screen="units">
      <p className="text-xs text-muted-foreground">
        Rent set here is what the next lease on a unit is offered. An active lease keeps the rent its tenant signed until
        it ends.
      </p>
      <RoomsRates />
    </div>
  );
}
