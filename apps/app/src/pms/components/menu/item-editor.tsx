"use client";

/**
 * Add or edit a menu item, RRA codes and modifiers included (ADR-050 D-m,
 * slice 3 task 17).
 *
 * ONE form for both, for the reason `dining/product-editor.tsx` gives: two
 * copies drift within an hour. INLINE, not a dialog, so the gallery underneath
 * stays in view while an owner prices one drink against the others.
 *
 * Four groups, in the order an owner answers them: what it is and what it
 * costs; the RRA codes a receipt needs; the choices a guest can make; and
 * whether it is on sale. The last one says plainly what the server will refuse:
 * an item cannot go on sale without every RRA value, and an item that was on
 * sale before the codes existed is held back on every channel until it has
 * them.
 *
 * What the SERVER decides and this form never second guesses: the item code
 * (minted once, never typed), whether the item may sell, and every price on a
 * placed order. A refusal arrives as the server's own sentence.
 */

import type {
  OperatorServiceCategory,
  OperatorServiceItem,
  ServiceCatalogStatus,
  ServiceItemOption,
  TaxCode,
} from "@injishi/contracts";
import { Input, Textarea } from "@injishi/ui";
import { cn } from "@/lib/utils";
import { useState } from "react";

import { fmt, parseAmount } from "../../lib/format";
import { ActionButton, Badge, SelectField, surfaceClass } from "../ui";
import { ModifierEditor, modifiersError } from "./modifier-editor";
import { RraCodesFields, type RraCodesDraft } from "./rra-codes-fields";

export interface ItemDraft extends RraCodesDraft {
  name: string;
  description: string;
  priceRwf: number;
  taxCode: TaxCode;
  stockQty: number | null;
  status: ServiceCatalogStatus;
  guestOrderable: boolean;
  options: ServiceItemOption[];
}

/** The four rate bands a receipt can carry (EBM 7.21.5). Only A and B are named in the corpus. */
export const TAX_CODES: ReadonlyArray<{ value: TaxCode; label: string }> = [
  { value: "TAX_B", label: "B · standard VAT, 18%" },
  { value: "TAX_A", label: "A · exempt" },
  { value: "TAX_C", label: "C" },
  { value: "TAX_D", label: "D" },
];

/** What a new item on this menu starts as: the menu's prefills, and nothing on sale yet. */
export function draftForNewItem(category: OperatorServiceCategory): ItemDraft {
  return {
    name: "",
    description: "",
    priceRwf: 0,
    taxCode: category.defaultTaxCode ?? "TAX_B",
    stockQty: null,
    status: "active",
    guestOrderable: false,
    options: [],
    rraItemClsCd: category.defaultRraItemClsCd ?? "",
    rraItemClsName: null,
    rraItemTyCd: category.defaultRraItemTyCd ?? "",
    rraPkgUnitCd: category.defaultRraPkgUnitCd ?? "",
    rraQtyUnitCd: category.defaultRraQtyUnitCd ?? "",
  };
}

export function draftFromItem(item: OperatorServiceItem): ItemDraft {
  return {
    name: item.name,
    description: item.description ?? "",
    priceRwf: item.priceRwf,
    taxCode: item.taxCode,
    stockQty: item.stockQty,
    status: item.status,
    guestOrderable: item.guestOrderable,
    options: item.options,
    rraItemClsCd: item.rraItemClsCd ?? "",
    rraItemClsName: item.rraItemClsName,
    rraItemTyCd: item.rraItemTyCd ?? "",
    rraPkgUnitCd: item.rraPkgUnitCd ?? "",
    rraQtyUnitCd: item.rraQtyUnitCd ?? "",
  };
}

/** The RRA values a draft still lacks, worded for the owner. The item code is the server's. */
export function missingForSale(draft: RraCodesDraft): string[] {
  const missing: string[] = [];
  if (!draft.rraItemClsCd) missing.push("a classification");
  if (!draft.rraItemTyCd) missing.push("a product type");
  if (!draft.rraPkgUnitCd) missing.push("a packaging unit");
  if (!draft.rraQtyUnitCd) missing.push("a quantity unit");
  return missing;
}

function draftError(draft: ItemDraft): string | null {
  if (draft.name.trim().length < 2) return "Give the item a name a guest will recognise.";
  if (draft.priceRwf <= 0) return "A price of zero is not a price. Enter what it sells for.";
  const modifiers = modifiersError(draft.options);
  if (modifiers) return modifiers;
  if (draft.guestOrderable && missingForSale(draft).length > 0) {
    return `It cannot go on sale without ${missingForSale(draft).join(", ")}. Add them, or leave it off sale for now.`;
  }
  return null;
}

const labelClass = "text-2xs font-bold tracking-[0.08em] uppercase text-[var(--muted2)]";

export interface ItemEditorProps {
  workspaceId: string | null;
  mode: "add" | "edit";
  category: OperatorServiceCategory;
  /** The item being edited, for the code the server minted. */
  item?: OperatorServiceItem;
  initial: ItemDraft;
  onSave: (draft: ItemDraft) => void;
  onCancel: () => void;
  saving?: boolean;
  /** The server's own sentence, when it refused the last save. */
  serverError?: string | null;
  deniedReason?: string;
}

export function ItemEditor({
  workspaceId,
  mode,
  category,
  item,
  initial,
  onSave,
  onCancel,
  saving,
  serverError,
  deniedReason,
}: ItemEditorProps) {
  const [draft, setDraft] = useState<ItemDraft>(initial);
  /* The error appears on the first SAVE, not the first keystroke, as the
     product editor already decided. */
  const [showError, setShowError] = useState(false);

  const error = draftError(draft);
  const missing = missingForSale(draft);
  const locked = Boolean(deniedReason);

  function set<K extends keyof ItemDraft>(key: K, value: ItemDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function save() {
    if (error !== null) {
      setShowError(true);
      return;
    }
    onSave({ ...draft, name: draft.name.trim(), description: draft.description.trim() });
  }

  const headingId = `item-editor-${item?.id ?? "new"}`;

  return (
    <section aria-labelledby={headingId} className={cn(surfaceClass, "flex flex-col gap-5 p-4")}>
      <header className="flex flex-wrap items-baseline gap-2">
        <h3 id={headingId} className="text-sm font-bold text-foreground">
          {mode === "add" ? `Add an item to ${category.name}` : `Edit ${initial.name}`}
        </h3>
        <span className="text-2xs text-muted-foreground">
          Changes never touch an order already placed: it keeps the price and name it was ordered at.
        </span>
      </header>

      {/* 1. What it is and what it costs */}
      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Name</span>
          <Input
            autoFocus
            value={draft.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Fresh passion juice"
            maxLength={160}
            disabled={locked}
            className="h-10 rounded border-line2 bg-field text-sm"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Price, before tax, in Rwandan francs</span>
          <Input
            value={draft.priceRwf === 0 ? "" : String(draft.priceRwf)}
            onChange={(e) => set("priceRwf", parseAmount(e.target.value) || 0)}
            inputMode="numeric"
            placeholder="3000"
            disabled={locked}
            className="pms-num h-10 rounded border-line2 bg-field text-sm"
          />
        </label>

        <span className="flex flex-col gap-1.5">
          <span className={labelClass}>Tax band</span>
          <SelectField
            label="Tax band"
            value={draft.taxCode}
            onChange={(value) => set("taxCode", value as TaxCode)}
            disabled={locked}
            options={TAX_CODES}
          />
        </span>

        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Stock left, blank for no count</span>
          <Input
            value={draft.stockQty === null ? "" : String(draft.stockQty)}
            onChange={(e) =>
              set("stockQty", e.target.value.trim() === "" ? null : Math.max(0, parseAmount(e.target.value) || 0))
            }
            inputMode="numeric"
            placeholder="No count kept"
            disabled={locked}
            className="pms-num h-10 rounded border-line2 bg-field text-sm"
          />
        </label>

        <label className="flex flex-col gap-1.5 md:col-span-2">
          <span className={labelClass}>What a guest reads</span>
          <Textarea
            value={draft.description}
            onChange={(e) => set("description", e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder="Pressed to order from ripe passion fruit, no sugar added."
            disabled={locked}
            className="rounded border-line2 bg-field text-sm"
          />
        </label>
      </div>

      {/* 2. The RRA codes */}
      <fieldset className="flex flex-col gap-3 border-t border-line pt-4">
        <legend className="flex flex-wrap items-baseline gap-2 pb-2">
          <span className="text-sm font-bold text-foreground">RRA codes</span>
          <span className="text-2xs text-muted-foreground">
            Every line on an RRA receipt names what was sold with the Authority&apos;s own codes.
          </span>
        </legend>
        <RraCodesFields
          workspaceId={workspaceId}
          draft={draft}
          disabled={locked}
          onChange={(codes) => setDraft((current) => ({ ...current, ...codes }))}
        />
        <div className="flex flex-wrap items-baseline gap-2 rounded border border-dashed border-line2 px-3 py-2">
          <span className={labelClass}>Item code</span>
          {item?.rraItemCd ? (
            <>
              <span className="pms-num text-sm font-bold text-foreground">{item.rraItemCd}</span>
              <span className="text-2xs text-muted-foreground">Minted once. It stays with this item for good.</span>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">
              Minted by Injishi when you save with a product type and both units.
            </span>
          )}
        </div>
      </fieldset>

      {/* 3. The choices a guest can make */}
      <fieldset className="flex flex-col gap-3 border-t border-line pt-4">
        <legend className="flex flex-wrap items-baseline gap-2 pb-2">
          <span className="text-sm font-bold text-foreground">Options</span>
          <span className="text-2xs text-muted-foreground">
            Sizes, extras, sides. What a guest picks is locked onto their order with its price.
          </span>
        </legend>
        <ModifierEditor options={draft.options} onChange={(next) => set("options", next)} disabled={locked} />
      </fieldset>

      {/* 4. On sale */}
      <div className="flex flex-col gap-3 border-t border-line pt-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <input
              type="checkbox"
              checked={draft.guestOrderable}
              onChange={(e) => set("guestOrderable", e.target.checked)}
              disabled={locked}
              className="size-4 accent-[var(--accent)]"
            />
            Guests can order it
          </label>
          {missing.length === 0 ? (
            <Badge intent="ok">Ready to sell</Badge>
          ) : (
            <Badge intent="warn">Needs {missing.join(", ")}</Badge>
          )}
          {draft.priceRwf > 0 && (
            <span className="pms-num text-xs text-muted-foreground">Sells at {fmt(draft.priceRwf)} before tax</span>
          )}
        </div>
        {missing.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Until it has every RRA value it is not sold anywhere: not in the guest app, and not at the desk.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <span className="flex-1" />
          <ActionButton onClick={onCancel}>Cancel</ActionButton>
          <ActionButton variant="primary" deniedReason={deniedReason} pending={saving} onClick={save}>
            {mode === "add" ? "Add it to the menu" : "Save changes"}
          </ActionButton>
        </div>

        {showError && error !== null && (
          <p role="alert" className="text-xs font-semibold text-bad">
            {error}
          </p>
        )}
        {serverError && (
          <p role="alert" className="text-xs font-semibold text-bad">
            {serverError}
          </p>
        )}
      </div>
    </section>
  );
}
