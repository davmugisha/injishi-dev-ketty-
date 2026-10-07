"use client";

/**
 * Step 1, the property profile: its name, a few lines for guests, and when they
 * may arrive and must leave (Onboarding board). A landlord is asked for house
 * rules instead of times, which is what the contract's residence step names.
 *
 * Writes through `PATCH /inventory/properties/:id` with `useUpdateProperty`, the
 * same hook and route Settings · Property saves through, so there is one write
 * path for these fields. It is not that screen embedded: Settings edits the
 * profile and the contact card together under one Save, while set-up asks for
 * them as two steps, each saved by its own "Save and continue".
 *
 * The parent keys it on the property id, so choosing another property in the
 * picker opens a fresh form rather than one still holding the last one's words.
 *
 * The CLASS and the ADDRESS are shown, not edited. The class is what the
 * business was registered and approved as, and the address is the one the field
 * verifier visited; changing either is a registration matter, not a setting.
 */

import {
  ACCOMMODATION_CLASS_LABEL,
  currentAccommodationClass,
  PUBLISH_BLOCKER_LABEL,
  type OperatorProperty,
} from "@injishi/contracts";
import { Input, Textarea } from "@injishi/ui";
import { useState } from "react";

import { humanError } from "../../data/api";
import { useUpdateProperty } from "../../data/inventory";
import { SectorPicker } from "../sector-picker";
import { StepFooter } from "./step-footer";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

interface Draft {
  name: string;
  description: string;
  checkInTime: string;
  checkOutTime: string;
  houseRules: string;
}

function draftOf(p: OperatorProperty): Draft {
  return {
    name: p.name,
    description: p.description ?? "",
    checkInTime: p.checkInTime?.slice(0, 5) ?? "",
    checkOutTime: p.checkOutTime?.slice(0, 5) ?? "",
    houseRules: p.houseRules ?? "",
  };
}

/** The board's checks, in its words. */
function problemWith(d: Draft, residence: boolean): string | null {
  if (d.name.trim().length < 2) return "Enter the property's name, as guests will see it.";
  if (d.description.trim().length < 20) {
    return `Write at least a line for ${residence ? "tenants" : "guests"}: 20 characters or more.`;
  }
  if (!residence && (!TIME.test(d.checkInTime.trim()) || !TIME.test(d.checkOutTime.trim()))) {
    return "Give check-in and check-out as times, like 14:00 and 10:00.";
  }
  return null;
}

export function ProfileStep({
  workspaceId,
  property,
  domain,
  accommodationClass,
  onBack,
  onDone,
}: {
  workspaceId: string;
  property: OperatorProperty;
  domain: "hospitality" | "residence";
  accommodationClass: string | null;
  onBack?: () => void;
  onDone: () => void;
}) {
  const update = useUpdateProperty(workspaceId, property.id);
  const [draft, setDraft] = useState<Draft>(() => draftOf(property));
  const [error, setError] = useState<string | null>(null);
  /** Asked only when the address has none: a listing cannot go live without it. */
  const [sectorId, setSectorId] = useState<number | null>(null);
  const residence = domain === "residence";
  const needsSector = property.address.sectorId === null;

  const set = (patch: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setError(null);
  };

  const save = () => {
    const problem = problemWith(draft, residence);
    if (problem) return setError(problem);
    if (needsSector && sectorId === null) return setError(PUBLISH_BLOCKER_LABEL.missing_sector);
    const sector = needsSector && sectorId !== null ? { sectorId } : {};
    update.mutate(
      residence
        ? {
            ...sector,
            name: draft.name.trim(),
            description: draft.description.trim(),
            houseRules: draft.houseRules.trim() || undefined,
          }
        : {
            ...sector,
            name: draft.name.trim(),
            description: draft.description.trim(),
            checkInTime: draft.checkInTime.trim(),
            checkOutTime: draft.checkOutTime.trim(),
          },
      { onSuccess: onDone, onError: (err) => setError(humanError(err)) },
    );
  };

  const kind = residence
    ? "Residential property"
    : ACCOMMODATION_CLASS_LABEL[currentAccommodationClass(accommodationClass)];
  const place = [property.address.street, property.address.sectorName, property.address.districtName]
    .filter(Boolean)
    .join(", ");

  return (
    <form
      className="flex flex-col gap-4"
      data-step-form="property"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-semibold text-foreground">Property name</span>
        <Input value={draft.name} onChange={(e) => set({ name: e.target.value })} autoComplete="organization" />
      </label>

      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded bg-surface-secondary px-3.5 py-2.5 text-sm">
        <span className="font-semibold text-foreground">{kind}</span>
        <span className="text-muted-foreground">
          {residence ? "Your property, as registered and approved." : "Your accommodation class, as registered and approved."}
          {!needsSector && place
            ? ` The address is the one the field verifier visited: ${place}.`
            : " The address names no sector yet, and a listing cannot go live without one."}
        </span>
      </div>

      {needsSector && (
        <SectorPicker
          onSector={(id) => {
            setSectorId(id);
            setError(null);
          }}
        />
      )}

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-semibold text-foreground">
          What {residence ? "tenants" : "guests"} should know, in a few lines
        </span>
        <Textarea
          value={draft.description}
          onChange={(e) => set({ description: e.target.value })}
          placeholder={
            residence
              ? "Secure building with parking and water on site, five minutes from the market…"
              : "Quiet rooms ten minutes from the city centre, breakfast on the terrace…"
          }
          className="min-h-24 bg-field text-sm"
        />
      </label>

      {residence ? (
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-semibold text-foreground">House rules</span>
          <Textarea
            value={draft.houseRules}
            onChange={(e) => set({ houseRules: e.target.value })}
            placeholder="Quiet hours, visitors, rubbish collection…"
            className="min-h-20 bg-field text-sm"
          />
        </label>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-semibold text-foreground">Check-in from</span>
            <Input
              type="time"
              className="pms-num"
              value={draft.checkInTime}
              onChange={(e) => set({ checkInTime: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-semibold text-foreground">Check-out by</span>
            <Input
              type="time"
              className="pms-num"
              value={draft.checkOutTime}
              onChange={(e) => set({ checkOutTime: e.target.value })}
            />
          </label>
        </div>
      )}

      <StepFooter error={error} onBack={onBack} submits saving={update.isPending} />
    </form>
  );
}
