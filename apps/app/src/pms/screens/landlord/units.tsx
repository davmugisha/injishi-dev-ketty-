"use client";

/**
 * Units & rents (F-R02) — the inventory the rent roll runs on.
 *
 * Occupancy is *derived* from leases, never stored: a unit is occupied because
 * an active lease points at it. That is why there is no "mark vacant" button.
 *
 * A rent change applies from the next lease. An active lease keeps its signed
 * rent until it ends — the tenant agreed to a number, and the landlord cannot
 * move it underneath them.
 */

import { useState } from "react";
import { Input } from "@injishi/ui";
import { fmt } from "../../lib/format";
import { usePms } from "../../store";
import { ActionButton, Badge, StatCard, surfaceClass } from "../../components/ui";
import { cn } from "@/lib/utils";

const COLS = "minmax(80px,.7fr) minmax(110px,1fr) minmax(150px,1.4fr) minmax(130px,1.1fr) minmax(120px,1fr) auto";

export function Units() {
  const { residence, dispatch } = usePms();
  const [editing, setEditing] = useState<string | null>(null);
  const [value, setValue] = useState("");

  const occupied = (unit: string) =>
    residence.leases.find((l) => l.unit === unit && (l.st === "active" || l.st === "ending"));
  const incoming = (unit: string) =>
    residence.leases.find((l) => l.unit === unit && (l.st === "awaiting" || l.st === "draft"));

  const vacant = residence.units.filter((u) => !occupied(u.id));
  const monthly = residence.units.reduce((a, u) => (occupied(u.id) ? a + u.rent : a), 0);

  const save = (unit: string) => {
    const rent = parseInt(value.replace(/\D/g, ""), 10);
    if (!rent) return;
    dispatch({ type: "setUnitRent", unit, rent });
    setEditing(null);
    setValue("");
  };

  return (
    <div className="pms-enter flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard n={String(residence.units.length)} label="Units in the portfolio" />
        <StatCard n={String(vacant.length)} label="Vacant — listable to brokers" />
        <StatCard n={fmt(monthly)} label="Contracted rent per month" />
      </div>

      <div className={cn(surfaceClass, "scrollbar overflow-x-auto")}>
        <div className="min-w-[820px]">
          <div
            className="grid gap-2.5 border-b border-line px-[18px] py-[11px] text-2xs font-bold tracking-[0.05em] uppercase text-[var(--muted2)]"
            style={{ gridTemplateColumns: COLS }}
          >
            <span>Unit</span>
            <span>Type</span>
            <span>Who lives there</span>
            <span className="text-right">Rent / month</span>
            <span>State</span>
            <span />
          </div>
          {residence.units.map((u, i) => {
            const lease = occupied(u.id);
            const next = incoming(u.id);
            const isEditing = editing === u.id;
            return (
              <div
                key={u.id}
                className={cn(
                  "grid items-center gap-2.5 px-[18px] py-2.5",
                  i === 0 ? "border-t border-transparent" : "border-t border-line",
                )}
                style={{ gridTemplateColumns: COLS }}
              >
                <span className="pms-num text-sm font-bold whitespace-nowrap text-ink">{u.id}</span>
                <span className="text-sm text-ink2">{u.type}</span>
                <span className="min-w-0 truncate text-sm text-ink">
                  {lease?.tenant ?? (next ? `${next.tenant} — from ${next.start}` : "—")}
                </span>
                <span className="text-right">
                  {isEditing ? (
                    <Input
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && save(u.id)}
                      inputMode="numeric"
                      aria-label={`New rent for ${u.id}`}
                      autoFocus
                      className="h-9 border-line2 bg-field text-right text-sm rounded"
                    />
                  ) : (
                    <span className="pms-num text-sm font-semibold whitespace-nowrap text-ink">{fmt(u.rent)}</span>
                  )}
                </span>
                <span>
                  {lease ? (
                    <Badge intent="ok">Occupied</Badge>
                  ) : next ? (
                    <Badge intent="info">Lease pending</Badge>
                  ) : (
                    <Badge intent="warn">Vacant</Badge>
                  )}
                </span>
                <span className="flex justify-end gap-2">
                  {isEditing ? (
                    <>
                      <ActionButton onClick={() => setEditing(null)}>Cancel</ActionButton>
                      <ActionButton variant="primary" onClick={() => save(u.id)}>
                        Save rent
                      </ActionButton>
                    </>
                  ) : (
                    <ActionButton
                      onClick={() => {
                        setEditing(u.id);
                        setValue(String(u.rent));
                      }}
                    >
                      Change rent
                    </ActionButton>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-2xs text-muted-foreground">
        A rent change applies from the next lease — an active lease keeps its signed rent until it ends. Vacant units
        can be listed to brokers under Directory listing.
      </p>
    </div>
  );
}
