"use client";

import { Description, Label } from "@heroui/react";
import { RadioButtonGroup } from "@heroui-pro/react";
import type { BrokerFeeTerms, BrokerPick } from "@injishi/contracts";
import { EmptyBlock, Icon, SearchBar } from "@injishi/ui";
import { useEffect, useRef, useState } from "react";
import { type BrokerFeeDraft, BrokerFeeFields, EMPTY_FEE, feeDraftOf, feeTermsOf } from "../rentals/BrokerFeeFields";
import { SwitchRow } from "../rentals/fields";
import { searchBrokers } from "./broker-actions";

/** The broker on a lease being drafted: who, from which placement, and the fee agreed. */
export interface BrokerDraft {
  on: boolean;
  broker: Pick<BrokerPick, "id" | "name" | "phone"> | null;
  placementId: string | null;
  fee: BrokerFeeDraft;
}

export const noBroker = (): BrokerDraft => ({ on: false, broker: null, placementId: null, fee: EMPTY_FEE });

/** The request's broker fields; nothing when no broker is named. */
export function brokerBody(d: BrokerDraft): { brokerId?: string; placementId?: string; brokerFee?: BrokerFeeTerms } {
  if (!d.on || !d.broker) return {};
  const fee = feeTermsOf(d.fee);
  return {
    brokerId: d.broker.id,
    ...(d.placementId ? { placementId: d.placementId } : {}),
    ...(fee ? { brokerFee: fee } : {}),
  };
}

export function brokerProblems(d: BrokerDraft): Record<string, string> {
  if (!d.on) return {};
  if (!d.broker) return { brokerId: "Pick the broker, or switch this off." };
  if (!feeTermsOf(d.fee)) return { brokerFee: "Enter the fee agreed." };
  return {};
}

function stars(avg: number | null, count: number): string {
  return avg !== null && count > 0 ? `${avg.toFixed(1)} stars (${count})` : "No ratings yet";
}

/**
 * "A broker brought the tenant": search the active brokers (the ones with an open placement on your
 * units first), pick one, and agree the fee. The fee starts from the unit's broker fee, else your default.
 */
export function BrokerPicker({
  value,
  onChange,
  unitId,
  unitFee,
  rentRwf,
  errors,
}: {
  value: BrokerDraft;
  onChange: (next: BrokerDraft) => void;
  unitId: string | null;
  /** The unit's broker fee, else the landlord's default. */
  unitFee: BrokerFeeTerms | null;
  rentRwf: number | null;
  errors: Record<string, string>;
}) {
  const [found, setFound] = useState<BrokerPick[] | null>(null);
  const [lookFor, setLookFor] = useState("");
  const typing = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!value.on || found !== null) return;
    let live = true;
    searchBrokers("").then((r) => live && setFound(r.ok ? r.value : []));
    return () => {
      live = false;
    };
  }, [value.on, found]);

  const onLookFor = (q: string) => {
    setLookFor(q);
    if (typing.current) clearTimeout(typing.current);
    typing.current = setTimeout(() => searchBrokers(q).then((r) => setFound(r.ok ? r.value : [])), 300);
  };

  const pick = (id: string) => {
    const b = found?.find((x) => x.id === id);
    if (!b) return;
    const placement = b.placements.find((p) => p.unitId === unitId) ?? null;
    onChange({
      ...value,
      broker: { id: b.id, name: b.name, phone: b.phone },
      placementId: placement?.id ?? null,
      fee: feeTermsOf(value.fee) ? value.fee : feeDraftOf(unitFee),
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <SwitchRow
        label="A broker brought the tenant"
        description="Their fee is recorded on the lease."
        isSelected={value.on}
        onChange={(on) =>
          onChange(on ? { ...value, on, fee: feeTermsOf(value.fee) ? value.fee : feeDraftOf(unitFee) } : noBroker())
        }
      />
      {value.on ? (
        <>
          <SearchBar
            label="Find a broker"
            value={lookFor}
            onChange={onLookFor}
            placeholder="Name or phone"
            className="sm:w-full"
          />
          {found === null ? (
            <p className="text-sm text-muted">Looking up brokers…</p>
          ) : found.length === 0 ? (
            <EmptyBlock
              size="sm"
              icon="Persons"
              title={lookFor ? "Nobody matches" : "No brokers yet"}
              description="Brokers register on Injishi."
            />
          ) : (
            <RadioButtonGroup
              aria-label="Broker"
              layout="grid"
              value={value.broker?.id ?? ""}
              onChange={pick}
              className="grid-cols-1 gap-2.5 sm:grid-cols-2"
            >
              {found.map((b) => {
                const here = b.placements.find((p) => p.unitId === unitId);
                return (
                  <RadioButtonGroup.Item key={b.id} value={b.id} className="gap-1 px-3.5 py-3">
                    <RadioButtonGroup.Indicator>
                      <Icon name="CircleCheckFill" />
                    </RadioButtonGroup.Indicator>
                    <RadioButtonGroup.ItemContent>
                      <Label className="font-semibold">{b.name ?? "Broker"}</Label>
                      <Description className="text-xs">
                        {[
                          here
                            ? `Placement on ${here.unitLabel ?? "this unit"}${here.tenantName ? ` for ${here.tenantName}` : ""}`
                            : b.placements[0]
                              ? `Placement on ${b.placements[0].unitLabel ?? "a unit"}`
                              : (b.phone ?? null),
                          stars(b.ratingAverage, b.ratingCount),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </Description>
                    </RadioButtonGroup.ItemContent>
                  </RadioButtonGroup.Item>
                );
              })}
            </RadioButtonGroup>
          )}
          {errors.brokerId || errors.placementId ? (
            <p className="text-xs text-danger">{errors.brokerId ?? errors.placementId}</p>
          ) : null}
          {value.broker ? (
            <BrokerFeeFields
              value={value.fee}
              onChange={(fee) => onChange({ ...value, fee })}
              rentRwf={rentRwf}
              errorMessage={errors.brokerFee}
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}
