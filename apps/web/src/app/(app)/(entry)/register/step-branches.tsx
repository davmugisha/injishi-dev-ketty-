"use client";

import { Button } from "@heroui/react";
import { MAX_REGISTRATION_BRANCHES } from "@injishi/contracts";
import { Building2, MapPin, Plus } from "lucide-react";

import {
  AddressPicker,
  EMPTY_ADDRESS,
  useAddressLine,
  type AddressDraft,
} from "./address-picker";
import { Field, Notice, StepActions, TextInput } from "./wizard-ui";

/**
 * Step 4, hospitality only — Your branches (ADR-054 AC-R1).
 *
 * A business with several locations under ONE TIN lists them here, once, and
 * pays one fee. The head office is not typed again: it is the business itself,
 * named with its legal name at the address on the Business step, and it is
 * shown here read only so the list reads as the whole business.
 *
 * A location with its own TIN is not a branch. It is its own business and
 * registers on its own, which the notice says before anyone types a name.
 *
 * Nothing here is required. Most businesses have one location, and continuing
 * with an empty list is the common path.
 */

export interface BranchDraft {
  /** A stable React key. Never sent: the server mints the property id. */
  key: string;
  name: string;
  address: AddressDraft;
}

let nextKey = 0;

export function newBranchDraft(): BranchDraft {
  nextKey += 1;
  return { key: `branch-${nextKey}`, name: "", address: { ...EMPTY_ADDRESS } };
}

export function StepBranches({
  legalName,
  headOfficeAddress,
  drafts,
  onChange,
  errors,
  formError,
  busy,
  onBack,
  onNext,
  onEditBusiness,
}: {
  legalName: string;
  headOfficeAddress: AddressDraft;
  drafts: BranchDraft[];
  onChange: (next: BranchDraft[]) => void;
  errors: Record<string, string>;
  formError: string;
  busy: boolean;
  onBack: () => void;
  onNext: () => void;
  /** Back to the Business step, which owns the head office's name and address. */
  onEditBusiness: () => void;
}) {
  const headOfficeLine = useAddressLine(headOfficeAddress);
  const atCap = drafts.length >= MAX_REGISTRATION_BRANCHES;

  const update = (index: number, next: BranchDraft) =>
    onChange(drafts.map((d, i) => (i === index ? next : d)));

  return (
    <section aria-labelledby="step-branches">
      <h2 id="step-branches" className="text-xl font-semibold tracking-tight">
        Your branches
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        If you run more than one location under the same TIN, list the others
        here. You pay one registration fee for all of them.
      </p>

      <div className="mt-6 space-y-6">
        <Notice tone="info">
          A location with its own TIN is not a branch. Register it as its own
          business.
        </Notice>

        {/* The head office, shown and not asked. It is what the business already
            is, so typing it again would only invite a second spelling. */}
        <div className="flex items-start gap-3 rounded-card border border-border bg-secondary p-4">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground">
            <Building2 size={16} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">
              {legalName.trim() || "Your business"}
            </p>
            <p className="text-xs text-muted-foreground">
              Head office{headOfficeLine ? ` · ${headOfficeLine}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onEditBusiness}
            className="shrink-0 text-xs font-semibold text-accent-text underline underline-offset-2"
          >
            Change
          </button>
        </div>

        {drafts.length > 0 ? (
          <ol className="space-y-4" aria-label="Branches">
            {drafts.map((draft, index) => (
              <li
                key={draft.key}
                className="rounded-card border border-border bg-card p-4"
              >
                <div className="flex items-center gap-2">
                  <MapPin size={16} aria-hidden className="text-muted-foreground" />
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
                      onChange={(e) =>
                        update(index, { ...draft, name: e.target.value })
                      }
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

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            isDisabled={atCap}
            onPress={() => onChange([...drafts, newBranchDraft()])}
          >
            <Plus size={16} aria-hidden />
            {drafts.length === 0 ? "Add a branch" : "Add another branch"}
          </Button>
          <p className="text-xs text-muted-foreground">
            {atCap
              ? "That is the most you can list now. Add more after approval."
              : `${drafts.length} of ${MAX_REGISTRATION_BRANCHES}`}
          </p>
        </div>

        {errors["business.branches"] ? (
          <Notice tone="danger">{errors["business.branches"]}</Notice>
        ) : null}
        {formError ? <Notice tone="danger">{formError}</Notice> : null}
      </div>

      <StepActions
        onBack={onBack}
        onNext={onNext}
        nextLabel={drafts.length === 0 ? "Continue with one location" : "Continue"}
        busy={busy}
      />
    </section>
  );
}
