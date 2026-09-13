"use client";

/**
 * The four RRA values an item is declared with (ADR-050 D-m): classification,
 * product type, packaging unit and quantity unit.
 *
 * ONE set of fields for the item editor and the menu's prefills, so the two can
 * never ask for these differently. On a menu they are what a new item STARTS
 * with; on an item they are what its receipt says.
 *
 * The item code is not a field. The server mints it once the product type and
 * both units are set, in VSDC v1.0.5 §4.17's shape, and never changes it after,
 * so it is shown read only by the item editor and never typed.
 */

import type { RraItemTypeCode } from "@injishi/contracts";
import { Input } from "@injishi/ui";

import { SelectField } from "../ui";
import { RraClassificationPicker } from "./rra-classification-picker";

export interface RraCodesDraft {
  rraItemClsCd: string;
  rraItemClsName: string | null;
  rraItemTyCd: RraItemTypeCode | "";
  rraPkgUnitCd: string;
  rraQtyUnitCd: string;
}

/** VSDC v1.0.5 §4.3, worded for a menu rather than a customs form. */
export const PRODUCT_TYPES: ReadonlyArray<{ value: RraItemTypeCode; label: string }> = [
  { value: "2", label: "Finished product: a dish, a drink" },
  { value: "3", label: "Service: a massage, laundry" },
  { value: "1", label: "Raw material" },
];

/** Letters and digits, up to five, upper case: the Authority's unit codes. */
export function unitCode(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
}

const labelClass = "text-2xs font-bold tracking-[0.08em] uppercase text-[var(--muted2)]";

export function RraCodesFields({
  workspaceId,
  draft,
  onChange,
  disabled,
}: {
  workspaceId: string | null;
  draft: RraCodesDraft;
  onChange: (next: RraCodesDraft) => void;
  disabled?: boolean;
}) {
  const set = <K extends keyof RraCodesDraft>(key: K, value: RraCodesDraft[K]) =>
    onChange({ ...draft, [key]: value });

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="flex flex-col gap-1.5 md:col-span-2">
        <span className={labelClass}>Classification, from RRA&apos;s list</span>
        <RraClassificationPicker
          workspaceId={workspaceId}
          label="Search RRA's classification list"
          value={draft.rraItemClsCd}
          valueName={draft.rraItemClsName}
          disabled={disabled}
          onChange={(code, name) => onChange({ ...draft, rraItemClsCd: code, rraItemClsName: name })}
        />
      </div>

      <div className="flex flex-col gap-1.5 md:col-span-2">
        <span className={labelClass}>Product type</span>
        <SelectField
          label="Product type"
          value={draft.rraItemTyCd}
          onChange={(value) => set("rraItemTyCd", value as RraItemTypeCode | "")}
          placeholder="What kind of thing is it?"
          disabled={disabled}
          options={PRODUCT_TYPES}
        />
      </div>

      <label className="flex flex-col gap-1.5">
        <span className={labelClass}>Packaging unit</span>
        <Input
          value={draft.rraPkgUnitCd}
          onChange={(e) => set("rraPkgUnitCd", unitCode(e.target.value))}
          placeholder="NT"
          disabled={disabled}
          autoCapitalize="characters"
          spellCheck={false}
          className="pms-num h-10 rounded border-line2 bg-field text-sm"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className={labelClass}>Quantity unit</span>
        <Input
          value={draft.rraQtyUnitCd}
          onChange={(e) => set("rraQtyUnitCd", unitCode(e.target.value))}
          placeholder="U"
          disabled={disabled}
          autoCapitalize="characters"
          spellCheck={false}
          className="pms-num h-10 rounded border-line2 bg-field text-sm"
        />
      </label>

      <p className="text-2xs text-muted-foreground md:col-span-2">
        Both units are codes from RRA&apos;s own lists (VSDC §4.5 and §4.6), for example NT and U
        as the specification&apos;s samples use them.
      </p>
    </div>
  );
}
