"use client";

/**
 * Settings · Property: the property's profile and contact card (2026-09-13).
 *
 * Was a `Placeholder`. It edits what `PATCH /inventory/properties/:id` accepts
 * and nothing else: name, street, description, check-in and check-out, house
 * rules, and the front desk phone and email the setup checklist asks for. The
 * address SECTOR is chosen when the property is created and stays there, which
 * is why it is shown rather than edited here.
 */

import type { OperatorProperty } from "@injishi/contracts";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

import { ActionButton, EmptyState, LoadFailed, Skeleton, surfaceClass } from "../components/ui";
import { humanError } from "../data/api";
import { useCapability, useWorkspaceId } from "../data/capability";
import { useUpdateProperty } from "../data/inventory";
import { useProperty } from "../data/ops";
import { usePms } from "../store";
import { PropertyPicker, usePropertyInView } from "./inventory-property";

const inputClass = "h-10 w-full rounded border border-line2 bg-field px-3 text-sm text-foreground";
const areaClass = "min-h-24 w-full rounded border border-line2 bg-field px-3 py-2 text-sm text-foreground";

interface Draft {
  name: string;
  street: string;
  description: string;
  checkInTime: string;
  checkOutTime: string;
  houseRules: string;
  contactPhone: string;
  contactEmail: string;
}

function draftOf(p: OperatorProperty): Draft {
  return {
    name: p.name,
    street: p.address.street ?? "",
    description: p.description ?? "",
    checkInTime: p.checkInTime?.slice(0, 5) ?? "",
    checkOutTime: p.checkOutTime?.slice(0, 5) ?? "",
    houseRules: p.houseRules ?? "",
    contactPhone: p.contactPhone ?? "",
    contactEmail: p.contactEmail ?? "",
  };
}

export function PropertyProfile() {
  const workspaceId = useWorkspaceId();
  const { toast } = usePms();
  const { can, reasonFor } = useCapability();
  const { list, properties, current, select } = usePropertyInView(workspaceId);
  const detail = useProperty(workspaceId, current?.id ?? null);
  const update = useUpdateProperty(workspaceId, current?.id ?? null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (detail.data) setDraft(draftOf(detail.data));
  }, [detail.data]);

  if (!can("listing.manage")) {
    return <EmptyState className="p-6 text-sm">{reasonFor("listing.manage")}</EmptyState>;
  }
  if (list.isPending || (current && detail.isPending)) return <Skeleton height={360} />;
  if (list.isError || detail.isError) {
    return (
      <LoadFailed onRetry={() => void (list.isError ? list.refetch() : detail.refetch())}>
        We couldn&apos;t load the property. Nothing is lost — this is on our side.
      </LoadFailed>
    );
  }
  if (!current || !detail.data || !draft) {
    return (
      <EmptyState className="p-6 text-sm">
        No property on this business yet. Add it from Setup or Inventory first, then its profile is edited here.
      </EmptyState>
    );
  }

  const p = detail.data;
  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });
  const field = (label: string, key: keyof Draft, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-semibold text-ink">{label}</span>
      <input
        aria-label={label}
        value={draft[key]}
        onChange={(e) => set({ [key]: e.target.value } as Partial<Draft>)}
        className={inputClass}
        {...props}
      />
    </label>
  );

  const save = () => {
    setError(null);
    if (draft.name.trim().length < 2) return setError("Give the property a name guests will recognise.");
    update.mutate(
      {
        name: draft.name.trim(),
        street: draft.street.trim() || undefined,
        description: draft.description.trim() || undefined,
        checkInTime: draft.checkInTime || undefined,
        checkOutTime: draft.checkOutTime || undefined,
        houseRules: draft.houseRules.trim() || undefined,
        contactPhone: draft.contactPhone.trim() || null,
        contactEmail: draft.contactEmail.trim() || null,
      },
      {
        onSuccess: () => toast("Property profile saved", "ok"),
        onError: (err) => setError(humanError(err)),
      },
    );
  };

  return (
    <form
      className="pms-enter flex flex-col gap-4"
      data-screen="property-profile"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <PropertyPicker properties={properties} current={current} onSelect={select} />

      <section className={cn(surfaceClass, "flex flex-col gap-3 p-4")}>
        <span className="text-sm font-semibold text-ink">Contact details</span>
        <p className="text-xs text-muted-foreground">
          How guests, tenants and officers reach the property itself — usually the front desk.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {field("Phone number", "contactPhone", { inputMode: "tel", placeholder: "+250 788 123 456" })}
          {field("Email", "contactEmail", { type: "email", placeholder: "frontdesk@example.com" })}
        </div>
      </section>

      <section className={cn(surfaceClass, "flex flex-col gap-3 p-4")}>
        <span className="text-sm font-semibold text-ink">Profile</span>
        <div className="grid gap-3 sm:grid-cols-2">
          {field("Property name", "name")}
          {field("Street", "street", { placeholder: "KG 11 Ave" })}
          {field("Check-in from", "checkInTime", { type: "time" })}
          {field("Check-out by", "checkOutTime", { type: "time" })}
        </div>
        <span className="text-xs text-muted-foreground">
          {[p.address.sectorName, p.address.districtName, p.address.provinceName].filter(Boolean).join(", ")}
        </span>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-semibold text-ink">Description</span>
          <textarea
            aria-label="Description"
            value={draft.description}
            onChange={(e) => set({ description: e.target.value })}
            className={areaClass}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-semibold text-ink">House rules</span>
          <textarea
            aria-label="House rules"
            value={draft.houseRules}
            onChange={(e) => set({ houseRules: e.target.value })}
            className={areaClass}
          />
        </label>
      </section>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <div className="flex justify-end">
        <ActionButton variant="primary" type="submit" pending={update.isPending}>
          {update.isPending ? "Saving" : "Save property"}
        </ActionButton>
      </div>
    </form>
  );
}
