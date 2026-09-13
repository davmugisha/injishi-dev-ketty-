"use client";

/**
 * Add a menu, or change one: its name, whether guests see it, and the RRA
 * values every new item on it starts with (ADR-050 D-m).
 *
 * The prefills are a convenience, never a rule. A drinks menu where every
 * bottle is a finished product counted in units saves the owner answering the
 * same three questions per item, and the item is still the source of truth and
 * may say otherwise. Changing a prefill changes no item already on the menu.
 *
 * A new menu needs a revenue department. The department is chosen once, here,
 * and never changes after, because every bill line from an item on this menu
 * credits it.
 */

import type { OperatorServiceCategory, TaxCode } from "@injishi/contracts";
import { Input } from "@injishi/ui";
import { cn } from "@/lib/utils";
import { useState } from "react";

import { ActionButton, SelectField, surfaceClass } from "../ui";
import { TAX_CODES } from "./item-editor";
import { RraCodesFields, type RraCodesDraft } from "./rra-codes-fields";

export interface CategoryDraft extends RraCodesDraft {
  name: string;
  departmentId: string;
  propertyId: string;
  guestVisible: boolean;
  defaultTaxCode: TaxCode | "";
}

export interface DepartmentChoice {
  id: string;
  propertyId: string;
  label: string;
}

export function draftForNewCategory(departments: DepartmentChoice[]): CategoryDraft {
  const only = departments.length === 1 ? departments[0] : undefined;
  return {
    name: "",
    departmentId: only?.id ?? "",
    propertyId: only?.propertyId ?? "",
    guestVisible: true,
    defaultTaxCode: "",
    rraItemClsCd: "",
    rraItemClsName: null,
    rraItemTyCd: "",
    rraPkgUnitCd: "",
    rraQtyUnitCd: "",
  };
}

export function draftFromCategory(category: OperatorServiceCategory): CategoryDraft {
  return {
    name: category.name,
    departmentId: category.departmentId,
    propertyId: "",
    guestVisible: category.guestVisible,
    defaultTaxCode: category.defaultTaxCode ?? "",
    rraItemClsCd: category.defaultRraItemClsCd ?? "",
    rraItemClsName: null,
    rraItemTyCd: category.defaultRraItemTyCd ?? "",
    rraPkgUnitCd: category.defaultRraPkgUnitCd ?? "",
    rraQtyUnitCd: category.defaultRraQtyUnitCd ?? "",
  };
}

const labelClass = "text-2xs font-bold tracking-[0.08em] uppercase text-[var(--muted2)]";

export function CategoryEditor({
  workspaceId,
  mode,
  initial,
  departments,
  onSave,
  onCancel,
  saving,
  serverError,
  deniedReason,
}: {
  workspaceId: string | null;
  mode: "add" | "edit";
  initial: CategoryDraft;
  /** Revenue departments a new menu may belong to. Ignored when editing. */
  departments: DepartmentChoice[];
  onSave: (draft: CategoryDraft) => void;
  onCancel: () => void;
  saving?: boolean;
  serverError?: string | null;
  deniedReason?: string;
}) {
  const [draft, setDraft] = useState<CategoryDraft>(initial);
  const [showError, setShowError] = useState(false);
  const locked = Boolean(deniedReason);

  const error =
    draft.name.trim().length < 2
      ? "Give the menu a name, like Drinks or Room service."
      : mode === "add" && !draft.departmentId
        ? "Choose the department this menu earns for."
        : null;

  function save() {
    if (error) {
      setShowError(true);
      return;
    }
    onSave({ ...draft, name: draft.name.trim() });
  }

  return (
    <section aria-labelledby="category-editor" className={cn(surfaceClass, "flex flex-col gap-5 p-4")}>
      <header className="flex flex-wrap items-baseline gap-2">
        <h3 id="category-editor" className="text-sm font-bold text-foreground">
          {mode === "add" ? "Add a menu" : `${initial.name}: menu settings`}
        </h3>
        <span className="text-2xs text-muted-foreground">
          A menu groups what one department sells, and can start every new item with its RRA codes.
        </span>
      </header>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Name</span>
          <Input
            autoFocus
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="Drinks"
            maxLength={120}
            disabled={locked}
            className="h-10 rounded border-line2 bg-field text-sm"
          />
        </label>

        {mode === "add" ? (
          <span className="flex flex-col gap-1.5">
            <span className={labelClass}>Department it earns for</span>
            <SelectField
              label="Department it earns for"
              value={draft.departmentId}
              onChange={(value) => {
                const picked = departments.find((d) => d.id === value);
                setDraft({ ...draft, departmentId: value, propertyId: picked?.propertyId ?? "" });
              }}
              placeholder={departments.length ? "Which revenue department?" : "No revenue department yet"}
              disabled={locked || departments.length === 0}
              options={departments.map((d) => ({ value: d.id, label: d.label }))}
            />
          </span>
        ) : (
          <span className="flex flex-col gap-1.5">
            <span className={labelClass}>Department</span>
            <span className="flex h-10 items-center text-sm text-muted-foreground">
              Fixed once a menu exists, because its bill lines credit it.
            </span>
          </span>
        )}

        <label className="flex items-center gap-2 text-sm font-semibold text-foreground md:col-span-2">
          <input
            type="checkbox"
            checked={draft.guestVisible}
            onChange={(e) => setDraft({ ...draft, guestVisible: e.target.checked })}
            disabled={locked}
            className="size-4 accent-[var(--accent)]"
          />
          Guests see this menu
        </label>
      </div>

      <fieldset className="flex flex-col gap-3 border-t border-line pt-4">
        <legend className="flex flex-wrap items-baseline gap-2 pb-2">
          <span className="text-sm font-bold text-foreground">What new items start with</span>
          <span className="text-2xs text-muted-foreground">
            Optional. Each item can still say otherwise, and changing these changes no item already here.
          </span>
        </legend>
        <RraCodesFields
          workspaceId={workspaceId}
          draft={draft}
          disabled={locked}
          onChange={(codes) => setDraft({ ...draft, ...codes })}
        />
        <span className="flex flex-col gap-1.5 md:max-w-form">
          <span className={labelClass}>Tax band</span>
          <SelectField
            label="Tax band new items start with"
            value={draft.defaultTaxCode}
            onChange={(value) => setDraft({ ...draft, defaultTaxCode: value as TaxCode | "" })}
            placeholder="Standard, unless you say"
            disabled={locked}
            options={TAX_CODES}
          />
        </span>
      </fieldset>

      <div className="flex flex-col gap-2 border-t border-line pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex-1" />
          <ActionButton onClick={onCancel}>Cancel</ActionButton>
          <ActionButton variant="primary" deniedReason={deniedReason} pending={saving} onClick={save}>
            {mode === "add" ? "Add the menu" : "Save settings"}
          </ActionButton>
        </div>
        {showError && error && (
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
