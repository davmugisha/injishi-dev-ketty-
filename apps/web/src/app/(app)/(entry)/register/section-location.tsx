"use client";

import { Info } from "lucide-react";
import { Button } from "@injishi/web-ui";

import { AddressPicker, type AddressDraft } from "./address-picker";
import { Callout } from "./register-shell";

/**
 * Location (Register.dc.html, a section of Business): province to village,
 * and a street or landmark. When RRA holds an address for the TIN, its province,
 * district and sector are filled in already and only the cell and village are
 * left to pick.
 *
 * All five levels are asked, as the artboard asks them: an officer walks to
 * this address. The artboard's optional map pin is NOT drawn: the API's address
 * has no coordinates (`RwandanAddress`), so a pin would be collected and then
 * dropped. It is listed as an owner decision.
 */

/** The levels still to pick, in words, or empty when the address is complete. */
export function missingLevels(a: AddressDraft): string[] {
  const out: string[] = [];
  if (!a.provinceId) out.push("province");
  if (!a.districtId) out.push("district");
  if (!a.sectorId) out.push("sector");
  if (!a.cellId) out.push("cell");
  if (!a.villageId) out.push("village");
  return out;
}

export function SectionLocation({
  address,
  onChange,
  prefilled,
  errors,
  errorPrefix,
  onSave,
}: {
  address: AddressDraft;
  onChange: (next: AddressDraft) => void;
  /** RRA's address filled the first three levels. */
  prefilled: boolean;
  errors: Record<string, string>;
  errorPrefix: string;
  onSave: () => void;
}) {
  const missing = missingLevels(address);
  return (
    <>
      <Callout tone="info" icon={<Info size={16} aria-hidden />} title={prefilled ? "Filled in from RRA" : "Where it is"}>
        {prefilled
          ? "Filled in from the address RRA holds for this TIN. Pick the cell and village to finish."
          : "Pick where it is, level by level. A district officer visits this address."}
      </Callout>
      <AddressPicker
        idPrefix="register-location"
        errorPrefix={errorPrefix}
        rwandaOnly
        collectVillage
        requireVillage
        streetLabel="Street or landmark (optional)"
        streetHint="A road, or something a visitor can find it by."
        draft={address}
        onChange={onChange}
        errors={errors}
      />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button onClick={onSave} disabled={missing.length > 0} aria-describedby="register-location-why">
          Save location
        </Button>
        <span id="register-location-why" className="text-xs text-muted-foreground">
          {missing.length ? `Pick the ${missing.join(" and ")} to save.` : "You can change it until you pay."}
        </span>
      </div>
    </>
  );
}
