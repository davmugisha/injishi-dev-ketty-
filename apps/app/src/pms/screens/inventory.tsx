"use client";

/**
 * Inventory: what is sellable, and what it includes (ADR-018, AC-12).
 *
 * `rooms-rates` and `offer` merged. Inventory is SETUP; Room status is today's
 * operations. Those two used to be one word apart, `rooms` and `rooms-rates`,
 * and the names did not say which was which.
 *
 * "What you offer" became Amenities on the way in, because it was not a noun
 * anyone searches for.
 */

import { LensPage, type LensLink } from "../components/lens-page";
import { Offer } from "./offer";
import { RatePlans } from "./rate-plans";
import { RoomsRates } from "./rooms-rates";
import { useWorkspaceId } from "../data/capability";
import { workspaceBase } from "../lib/nav";

export function Inventory({ lens }: { lens: string }) {
  const workspaceId = useWorkspaceId();
  const base = `${workspaceBase(workspaceId)}/inventory`;

  const lenses: LensLink[] = [
    { key: "room-types", label: "Room types", href: base },
    { key: "rate-plans", label: "Rate plans", href: `${base}/rate-plans` },
    { key: "amenities", label: "Amenities", href: `${base}/amenities` },
  ];

  return (
    <LensPage lenses={lenses} active={lens}>
      {lens === "rate-plans" ? (
        <RatePlans />
      ) : lens === "amenities" ? (
        <Offer />
      ) : (
        <RoomsRates />
      )}
    </LensPage>
  );
}
