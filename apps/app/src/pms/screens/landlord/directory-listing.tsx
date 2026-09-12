"use client";

/**
 * Directory listing (F-R07) — which vacant units brokers can see.
 *
 * Two constraints make this screen behave the way it does:
 *  - **Only vacant units can be listed.** Occupancy is derived from leases, so a
 *    unit delists itself the day a lease activates. The toggle is simply absent
 *    on an occupied unit, with the reason shown instead.
 *  - **The landlord's number is never on the listing.** A broker sees the unit
 *    and the rent; they must spend a logged reveal to get the contact.
 */

import { Card, Switch } from "@injishi/ui";
import { fmt } from "../../lib/format";
import { usePms } from "../../store";
import { Badge, StatCard, surfaceClass } from "../../components/ui";
import { cn } from "@/lib/utils";

export function DirectoryListing() {
  const { residence, dispatch } = usePms();

  const occupiedBy = (unit: string) =>
    residence.leases.find((l) => l.unit === unit && (l.st === "active" || l.st === "ending"));
  const pendingOn = (unit: string) =>
    residence.leases.find((l) => l.unit === unit && (l.st === "awaiting" || l.st === "draft"));

  const listed = residence.units.filter((u) => residence.dirListed.includes(u.id));
  const vacant = residence.units.filter((u) => !occupiedBy(u.id));

  return (
    <div className="pms-enter flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard n={String(listed.length)} label="Listed to brokers" />
        <StatCard n={String(vacant.length)} label="Vacant and listable" />
        <StatCard n={String(residence.reveals)} label="Contact reveals spent on you" />
      </div>

      <div className="text-xs text-muted-foreground">
        Private to registered brokers — never public. Your number stays hidden until a broker reveals it, and every
        reveal is logged.
      </div>

      <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(250px,1fr))]">
        {residence.units.map((u) => {
          const lease = occupiedBy(u.id);
          const pending = pendingOn(u.id);
          const listable = !lease && !pending;
          const on = residence.dirListed.includes(u.id);
          return (
            <Card
              key={u.id}
              className={cn(surfaceClass, "gap-0 px-[17px] py-4 shadow-none", on && "border-accent-text")}
            >
              <div className="flex items-baseline gap-2">
                <span className="pms-num text-base font-bold text-ink">{u.id}</span>
                <span className="text-xs text-muted-foreground">{u.type}</span>
              </div>
              <div className="pms-num mt-1.5 text-base font-bold tracking-[-0.2px] text-ink">
                {fmt(u.rent)}
                <span className="text-2xs font-medium text-muted-foreground"> / month</span>
              </div>

              <div className="mt-2.5">
                {lease ? (
                  <Badge intent="neutral">Occupied · {lease.tenant}</Badge>
                ) : pending ? (
                  <Badge intent="info">Lease pending</Badge>
                ) : (
                  <Badge intent="warn">Vacant</Badge>
                )}
              </div>

              <div className="mt-3 border-t border-line pt-3">
                {listable ? (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-ink">Listed to brokers</span>
                      <Switch
                        checked={on}
                        onCheckedChange={() => dispatch({ type: "toggleListing", unit: u.id })}
                        aria-label={`${on ? "Unlist" : "List"} ${u.id} to brokers`}
                      />
                    </div>
                    {on && (
                      <div className="mt-1.5 text-2xs text-muted-foreground">
                        Deposit · 1 month · brokers see the unit, never your contact
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-2xs text-muted-foreground">
                    {lease
                      ? "Occupied — a unit delists itself the day a lease activates."
                      : "A lease is already pending on this unit."}
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <p className="text-2xs text-muted-foreground">
        Only vacant units can be listed — occupancy is derived from leases, so a unit delists itself the day a lease
        activates. A reveal with no placement afterwards gets flagged for review.
      </p>
    </div>
  );
}
