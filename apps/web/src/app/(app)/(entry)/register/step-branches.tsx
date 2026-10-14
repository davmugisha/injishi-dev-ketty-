"use client";

import { Button } from "@heroui/react";
import { MAX_REGISTRATION_BRANCHES } from "@injishi/contracts";
import { MapPin, Plus } from "lucide-react";

import {
  AddressPicker,
  EMPTY_ADDRESS,
  type AddressDraft,
} from "./address-picker";
import { Field, Notice, TextInput } from "./wizard-ui";

/**
 * A hotel's other locations under the same TIN (ADR-054), declared on the
 * Business step since ADR-060.
 *
 * They had a screen of their own (ADR-054 AC-R1), which every single location
 * business — most of them — walked through to press "Continue with one
 * location". Folded into the Business step, that screen is gone for them, and
 * a business with branches adds them where it describes itself. What an
 * officer approves is unchanged: every branch is still declared before the fee
 * and read back to the officer (AC-R4).
 *
 * A location with its own TIN is not a branch. It is its own business and
 * registers on its own. Nothing here is required.
 */

export interface BranchDraft {
  /** A stable React key. Never sent: the server mints the property id. */
  key: string;
  name: string;
  address: AddressDraft;
}

let nextKey = 0;

/**
 * A new, empty branch. Given the head office, it starts in the head office's
 * province and district (ADR-059): most branches are in the same town, and the
 * sector below is still the person's to pick.
 */
export function newBranchDraft(headOffice?: AddressDraft): BranchDraft {
  nextKey += 1;
  return {
    key: `branch-${nextKey}`,
    name: "",
    address: {
      ...EMPTY_ADDRESS,
      ...(headOffice?.country === "RW"
        ? { provinceId: headOffice.provinceId, districtId: headOffice.districtId }
        : {}),
    },
  };
}

export function BranchesEditor({
  headOfficeAddress,
  drafts,
  onChange,
  errors,
}: {
  headOfficeAddress: AddressDraft;
  drafts: BranchDraft[];
  onChange: (next: BranchDraft[]) => void;
  errors: Record<string, string>;
}) {
  const atCap = drafts.length >= MAX_REGISTRATION_BRANCHES;
  const update = (index: number, next: BranchDraft) =>
    onChange(drafts.map((d, i) => (i === index ? next : d)));

  return (
    <div className="rounded-card border border-border p-4">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <MapPin size={16} aria-hidden className="text-muted-foreground" />
        Other locations under this TIN
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Optional. If you run more than one location under the same TIN, add the
        others here; one registration fee covers them all. A location with its
        own TIN registers as its own business.
      </p>

      {drafts.length > 0 ? (
        <ol className="mt-4 space-y-4" aria-label="Branches">
          {drafts.map((draft, index) => (
            <li key={draft.key} className="rounded-card border border-border bg-card p-4">
              <div className="flex items-center gap-2">
                <p className="grow text-sm font-semibold">Branch {index + 1}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onPress={() => onChange(drafts.filter((_, i) => i !== index))}
                >
                  Remove
                </Button>
              </div>
              <div className="mt-4 space-y-4">
                <Field
                  label="Branch name"
                  required
                  hint="How guests and your staff know this location."
                  error={errors[`business.branches.${index}.name`]}
                >
                  <TextInput
                    id={`${draft.key}-name`}
                    value={draft.name}
                    onChange={(e) => update(index, { ...draft, name: e.target.value })}
                  />
                </Field>
                <AddressPicker
                  idPrefix={draft.key}
                  errorPrefix={`business.branches.${index}.address`}
                  rwandaOnly
                  draft={draft.address}
                  onChange={(address) => update(index, { ...draft, address })}
                  errors={errors}
                />
              </div>
            </li>
          ))}
        </ol>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          isDisabled={atCap}
          onPress={() => onChange([...drafts, newBranchDraft(headOfficeAddress)])}
        >
          <Plus size={16} aria-hidden />
          {drafts.length === 0 ? "Add a location" : "Add another location"}
        </Button>
        {drafts.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            {atCap
              ? "That is the most you can list now. Add more after approval."
              : `${drafts.length} of ${MAX_REGISTRATION_BRANCHES}`}
          </p>
        ) : null}
      </div>

      {errors["business.branches"] ? (
        <div className="mt-3">
          <Notice tone="danger">{errors["business.branches"]}</Notice>
        </div>
      ) : null}
    </div>
  );
}
