"use client";

/**
 * Broker directory (F-R09, FL18) — the private landlord listing board.
 *
 * Reads `GET /ops/broker/directory`: every unit type on every published
 * residence listing of an approved landlord, with how many of its rooms have no
 * active lease. It used to read six invented units from `data/broker.ts`.
 *
 * Two rules the screen exists to make felt:
 *  - A landlord's contact is hidden until a broker SPENDS a credit, and every
 *    reveal is logged. The server sends no contact at all until then, so there
 *    is nothing here to unmask. That log is what protects landlords from having
 *    their numbers harvested.
 *  - A reveal with no placement afterwards gets flagged for review, so the
 *    footer says so plainly rather than burying it in terms.
 *
 * A reveal buys a LISTING's contact, so every unit card on one property opens
 * together — it is one landlord and one number.
 */

import type { BrokerDirectoryListing, BrokerDirectoryUnit } from "@injishi/contracts";
import { Button, Card } from "@injishi/ui";
import { useState } from "react";
import { ConfirmAction } from "../../components/confirm-action";
import { Badge, Chip, EmptyState, LoadFailed, Skeleton } from "../../components/ui";
import { useBrokerDirectory, useRevealContact, useStartPlacement } from "../../data/broker-ops";
import { useWorkspaceId } from "../../data/capability";
import { fmt } from "../../lib/format";
import { usePms } from "../../store";

/** Deposit in the words Rwandan lettings use, when it is a whole number of months. */
function deposit(unit: BrokerDirectoryUnit): string {
  const { cautionRwf, monthlyRentRwf } = unit;
  if (cautionRwf === null) return "Not set";
  if (monthlyRentRwf && cautionRwf % monthlyRentRwf === 0) {
    const months = cautionRwf / monthlyRentRwf;
    return months === 1 ? "1 month" : `${months} months`;
  }
  return fmt(cautionRwf);
}

function vacancy(unit: BrokerDirectoryUnit): { text: string; intent: "ok" | "neutral" } {
  if (unit.totalUnits === 0) return { text: "No rooms yet", intent: "neutral" };
  if (unit.vacantUnits === 0) return { text: "Fully let", intent: "neutral" };
  return { text: `${unit.vacantUnits} of ${unit.totalUnits} free`, intent: "ok" };
}

interface CardRow {
  key: string;
  listing: BrokerDirectoryListing;
  unit: BrokerDirectoryUnit | null;
}

export function Directory() {
  const { toast, toastError } = usePms();
  const workspaceId = useWorkspaceId();
  const query = useBrokerDirectory(workspaceId);
  const reveal = useRevealContact(workspaceId);
  const place = useStartPlacement(workspaceId);
  const [filter, setFilter] = useState("all");

  if (query.isPending) {
    return (
      <div className="pms-enter grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(250px,1fr))]">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} height={210} delay={i * 60} />
        ))}
      </div>
    );
  }

  if (query.isError) {
    return (
      <LoadFailed onRetry={() => void query.refetch()} retrying={query.isFetching}>
        We couldn&apos;t load the directory. {query.error.message}
      </LoadFailed>
    );
  }

  const { listings, balance, revealCost, brokerStatus } = query.data;
  const suspended = brokerStatus !== "active";

  // One card per unit type; a listing with none still gets one, so a landlord
  // who has not described their units yet is not hidden from the broker.
  const cards: CardRow[] = listings.flatMap((listing): CardRow[] =>
    listing.units.length === 0
      ? [{ key: listing.listingId, listing, unit: null }]
      : listing.units.map((unit) => ({ key: `${listing.listingId}:${unit.roomTypeId}`, listing, unit })),
  );

  const districts = Array.from(new Set(listings.map((l) => l.district ?? "Unknown district")));
  const chips = [
    { key: "all", label: "All", n: cards.length },
    ...districts.map((d) => ({
      key: d,
      label: d,
      n: cards.filter((c) => (c.listing.district ?? "Unknown district") === d).length,
    })),
  ];
  const shown = cards.filter((c) => filter === "all" || (c.listing.district ?? "Unknown district") === filter);

  const revealDenied = suspended
    ? "Your broker account is suspended."
    : balance < revealCost
      ? "You have no reveal credits left."
      : undefined;

  function doReveal(listing: BrokerDirectoryListing) {
    reveal.mutate(
      { listingId: listing.listingId },
      {
        onSuccess: (r) =>
          toast(
            r.charged
              ? `Contact revealed: ${listing.landlordName}. Logged. ${r.balance} ${r.balance === 1 ? "credit" : "credits"} left.`
              : `You had already revealed ${listing.landlordName}. No credit spent.`,
            "ok",
          ),
        onError: toastError,
      },
    );
  }

  function doPlace(listing: BrokerDirectoryListing) {
    place.mutate(
      { listingId: listing.listingId },
      {
        onSuccess: () =>
          toast(
            `Placement started with ${listing.landlordName}. It converts when they record you on the lease.`,
            "ok",
          ),
        onError: toastError,
      },
    );
  }

  return (
    <div className="pms-enter flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2.5">
        {chips.map((c) => (
          <Chip key={c.key} label={c.label} n={c.n} active={filter === c.key} onClick={() => setFilter(c.key)} />
        ))}
        <span className="flex-1" />
        <span className="text-xs text-muted-foreground">Private to brokers. These units are never public</span>
        <Badge intent={balance > 0 ? "info" : "warn"}>
          {balance} {balance === 1 ? "reveal" : "reveals"} left
        </Badge>
      </div>

      {suspended && (
        <EmptyState>
          Your broker account is suspended. You can still read the directory, but not reveal landlords or start
          placements.
        </EmptyState>
      )}

      {cards.length === 0 ? (
        <EmptyState>No landlord has published a unit to the directory yet.</EmptyState>
      ) : shown.length === 0 ? (
        <EmptyState>No units in that district right now. Clear the filter to see the whole directory.</EmptyState>
      ) : (
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(250px,1fr))]">
          {shown.map(({ key, listing, unit }) => {
            const busyReveal = reveal.isPending && reveal.variables?.listingId === listing.listingId;
            const busyPlace = place.isPending && place.variables?.listingId === listing.listingId;
            const free = unit ? vacancy(unit) : null;
            return (
              <Card key={key} className="gap-0 rounded border-panel-bd bg-card px-[17px] py-4 shadow-none">
                <div className="flex items-baseline gap-2">
                  <span className="text-base font-bold text-ink">{unit?.name ?? "Units not listed yet"}</span>
                  {free && <Badge intent={free.intent}>{free.text}</Badge>}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {listing.propertyName}
                  {listing.district ? ` · ${listing.district}` : ""}
                </div>
                {unit && (
                  <>
                    <div className="pms-num mt-1.5 text-base font-bold tracking-[-0.2px] text-ink">
                      {unit.monthlyRentRwf === null ? "Rent not set" : fmt(unit.monthlyRentRwf)}
                      {unit.monthlyRentRwf !== null && (
                        <span className="text-2xs font-medium text-muted-foreground"> / month</span>
                      )}
                    </div>
                    <div className="mt-[3px] text-2xs text-muted-foreground">Deposit · {deposit(unit)}</div>
                  </>
                )}

                <div className="mt-3 border-t border-line pt-[11px]">
                  {listing.contact ? (
                    <>
                      <div className="flex items-center gap-[7px]">
                        <span className="text-xs font-semibold text-ink">{listing.landlordName}</span>
                        <Badge intent="neutral">Reveal logged</Badge>
                      </div>
                      {listing.contact.phone && (
                        <div className="pms-num mt-0.5 text-sm text-ink2">{listing.contact.phone}</div>
                      )}
                      {listing.contact.email && (
                        <div className="mt-0.5 truncate text-sm text-ink2">{listing.contact.email}</div>
                      )}
                      {listing.openPlacementId ? (
                        <div className="mt-2.5">
                          <Badge intent="info">Placement in progress</Badge>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          disabled={suspended || busyPlace}
                          onClick={() => doPlace(listing)}
                          className="mt-2.5 h-[38px] w-full bg-primary text-xs font-bold text-primary-foreground hover:bg-primary/90 rounded"
                        >
                          {busyPlace ? "Starting the placement" : "Start a placement"}
                        </Button>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="text-2xs text-faint">
                        Landlord contact stays hidden until you reveal it. Every reveal is logged and costs{" "}
                        {revealCost} {revealCost === 1 ? "credit" : "credits"}.
                      </div>
                      <ConfirmAction
                        className="mt-2.5 w-full"
                        fullWidth
                        tone="primary"
                        onConfirm={() => doReveal(listing)}
                        confirmLabel={`Yes, spend ${revealCost} ${revealCost === 1 ? "credit" : "credits"}`}
                        keepLabel="Not now"
                        deniedReason={revealDenied}
                        pending={busyReveal}
                      >
                        {busyReveal ? "Revealing" : "Reveal contact"}
                      </ConfirmAction>
                    </>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <p className="text-2xs text-muted-foreground">
        A reveal with no placement afterwards gets flagged for review. The log protects landlords from contact
        harvesting.
      </p>
    </div>
  );
}
