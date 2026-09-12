"use client";

/**
 * The one form that adds a product and the one that edits it.
 *
 * Deliberately ONE component for both. They were two on the first pass, and the
 * two drifted within an hour: the add form asked for an outlet and the edit
 * form did not, so a dish put on the wrong card could never be moved. An owner
 * changing an outlet is exactly the correction this screen exists to make
 * possible, and a single form is what guarantees both paths offer it.
 *
 * INLINE, NOT A DIALOG. The list underneath is the context — an owner pricing a
 * beer wants to see what the other beers cost while they type it — and a modal
 * is what takes that away. It is also the pattern the neighbouring operator
 * screens already use for a rename.
 *
 * The price is typed, not spun. `parseAmount` keeps the digits out of "9,500"
 * and "9 500 RWF" alike, because that is how the number arrives when somebody
 * reads it off a printed card.
 */

import { Button, Input, Textarea } from "@injishi/ui";
import { cn } from "@/lib/utils";
import { useState } from "react";

import type { DiningOutlet } from "../../data/dining";
import { fmt, parseAmount } from "../../lib/format";
import { ActionButton, FieldLabel, SelectField, surfaceClass } from "../ui";
import type { ProductDraft } from "./menu-store";

export interface ProductEditorProps {
  /** "Add a product" or "Edit <name>" — the heading and the save button both. */
  mode: "add" | "edit";
  outlets: DiningOutlet[];
  categories: string[];
  initial: ProductDraft;
  onSave: (draft: ProductDraft) => void;
  onCancel: () => void;
  /** The refusal sentence, when this operator may not manage the menu. */
  deniedReason?: string;
}

/** What is wrong with the draft, or null when it may be saved. */
function draftError(draft: ProductDraft): string | null {
  if (draft.name.trim().length < 2) return "Give the product a name a guest will recognise.";
  if (draft.outletSlug === "") return "Choose which outlet sells it.";
  if (draft.category === "") return "Choose a section of the menu for it.";
  if (draft.priceRwf <= 0) return "A price of zero is not a price. Enter what it sells for.";
  return null;
}

export function ProductEditor({
  mode,
  outlets,
  categories,
  initial,
  onSave,
  onCancel,
  deniedReason,
}: ProductEditorProps) {
  const [draft, setDraft] = useState<ProductDraft>(initial);
  /* The error appears on the first SAVE, not on the first keystroke: a form
     that turns red while somebody is still typing the second letter of a name
     is telling them they are wrong before they have finished being right. */
  const [showError, setShowError] = useState(false);

  const error = draftError(draft);
  const outlet = outlets.find((o) => o.slug === draft.outletSlug);

  function set<K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function save() {
    if (error !== null) {
      setShowError(true);
      return;
    }
    onSave({ ...draft, name: draft.name.trim(), description: draft.description.trim() });
  }

  return (
    <section className={cn(surfaceClass, "flex flex-col gap-3.5 p-4")}>
      <div className="flex flex-wrap items-baseline gap-2">
        <h3 className="text-sm font-bold text-foreground">
          {mode === "add" ? "Add a product" : `Edit ${initial.name}`}
        </h3>
        <span className="text-2xs text-muted-foreground">
          {outlet
            ? `It goes on the ${outlet.name} card and sells at ${fmt(draft.priceRwf)}.`
            : "Choose the outlet that sells it."}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <FieldLabel>Name</FieldLabel>
          <Input
            autoFocus
            value={draft.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Beef brochettes"
            maxLength={80}
            className="h-10 rounded border-line2 bg-field text-sm"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <FieldLabel>Price, in Rwandan francs</FieldLabel>
          <Input
            value={draft.priceRwf === 0 ? "" : String(draft.priceRwf)}
            onChange={(e) => set("priceRwf", parseAmount(e.target.value))}
            inputMode="numeric"
            placeholder="9500"
            aria-label="Price in Rwandan francs"
            className="pms-num h-10 rounded border-line2 bg-field text-sm"
          />
        </label>

        <span className="flex flex-col gap-1.5">
          <FieldLabel>Outlet</FieldLabel>
          <SelectField
            label="Outlet"
            value={draft.outletSlug}
            onChange={(value) => set("outletSlug", value)}
            placeholder="Which bar or restaurant?"
            options={outlets.map((o) => ({ value: o.slug, label: `${o.name} · ${o.hours}` }))}
          />
        </span>

        <span className="flex flex-col gap-1.5">
          <FieldLabel>Menu section</FieldLabel>
          <SelectField
            label="Menu section"
            value={draft.category}
            onChange={(value) => set("category", value)}
            placeholder="Which part of the card?"
            options={categories.map((c) => ({ value: c, label: c }))}
          />
        </span>
      </div>

      <label className="flex flex-col gap-1.5">
        <FieldLabel>What a guest reads</FieldLabel>
        <Textarea
          value={draft.description}
          onChange={(e) => set("description", e.target.value)}
          rows={2}
          maxLength={280}
          placeholder="Four skewers of beef over charcoal, with grilled plantain."
          className="rounded border-line2 bg-field text-sm"
        />
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          shape="pill"
          onClick={() => set("available", !draft.available)}
          aria-pressed={draft.available}
          className={cn(
            "font-semibold",
            draft.available
              ? "border-accent-text bg-accent-soft text-accent-text hover:bg-accent-soft"
              : "border-card-bd text-ink2 hover:bg-hover",
          )}
        >
          {draft.available ? "On the menu today" : "Off the menu today"}
        </Button>

        <span className="flex-1" />

        <ActionButton onClick={onCancel}>Cancel</ActionButton>
        <ActionButton variant="primary" deniedReason={deniedReason} onClick={save}>
          {mode === "add" ? "Add it to the menu" : "Save changes"}
        </ActionButton>
      </div>

      {showError && error !== null && (
        <p role="alert" className="text-xs font-semibold text-bad">
          {error}
        </p>
      )}
    </section>
  );
}
