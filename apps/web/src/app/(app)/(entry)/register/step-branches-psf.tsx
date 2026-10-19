"use client";

import { useState } from "react";
import { MAX_REGISTRATION_BRANCHES, type PsfTier } from "@injishi/contracts";
import { Button } from "@injishi/ui";
import { GitBranch, Plus, Trash2 } from "lucide-react";

import { AddressPicker, useAddressLine, type AddressDraft } from "./address-picker";
import { branchReady, newBranchDraft, type BranchDraft, type BusinessDraft } from "./business-draft";
import { PsfApplication, type PsfDraft } from "./psf-application";
import { ChoiceTile, Field, TextInput } from "./wizard-ui";

/**
 * Step 3, Branches and PSF (Register.dc.html). Both optional.
 *
 * BRANCHES are the other sites that trade under the same TIN (ADR-054): up to
 * twenty now, more after approval. Each is named and placed to the sector; a
 * branch becomes a property, which has no village column, so the village is
 * not asked. The artboard's optional pin is not drawn, for the reason given in
 * `section-location.tsx`.
 *
 * PSF asks whether the business is a member. Yes takes the membership number,
 * which PSF's officer sees as the business's own claim; No offers to apply now,
 * with PSF's form, or later from the workspace. PSF never holds up a
 * registration.
 */
export function StepBranchesPsf({
  tinLabel,
  headOffice,
  branches,
  onBranchesChange,
  business,
  onBusinessChange,
  psf,
  onPsfChange,
  onApplyNow,
  tiers,
  documentLine,
  errors,
}: {
  tinLabel: string;
  headOffice: AddressDraft;
  branches: BranchDraft[];
  onBranchesChange: (next: BranchDraft[]) => void;
  business: BusinessDraft;
  onBusinessChange: (next: BusinessDraft) => void;
  psf: PsfDraft;
  onPsfChange: (next: PsfDraft) => void;
  /** "Apply now" pressed: the wizard fills what it already knows into the form. */
  onApplyNow: () => void;
  tiers: PsfTier[] | null;
  documentLine: string | null;
  errors: Record<string, string>;
}) {
  /** The branch being added or edited, and which one (null: a new one). */
  const [editing, setEditing] = useState<{ draft: BranchDraft; index: number | null } | null>(null);
  const atCap = branches.length >= MAX_REGISTRATION_BRANCHES;

  const save = () => {
    if (!editing || !branchReady(editing.draft)) return;
    onBranchesChange(
      editing.index === null
        ? [...branches, editing.draft]
        : branches.map((b, i) => (i === editing.index ? editing.draft : b)),
    );
    setEditing(null);
  };

  return (
    <>
      <section aria-labelledby="register-branches-title" className="flex flex-col gap-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="register-branches-title" className="text-base font-semibold">
            Branches
          </h3>
          <span className="text-xs text-muted-foreground">
            {branches.length} of {MAX_REGISTRATION_BRANCHES}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          Your head office is the address from step 2. Add the other sites that share TIN {tinLabel}: up to{" "}
          {MAX_REGISTRATION_BRANCHES} now, more after approval. A site with its own TIN registers on its own.
        </p>

        {branches.length ? (
          <ul className="flex flex-col divide-y divide-border rounded-card bg-secondary">
            {branches.map((b, i) => (
              <BranchRow
                key={b.key}
                branch={b}
                onEdit={() => setEditing({ draft: { ...b, address: { ...b.address } }, index: i })}
                onRemove={() => onBranchesChange(branches.filter((_, j) => j !== i))}
              />
            ))}
          </ul>
        ) : null}

        {errors["business.branches"] ? (
          <p role="alert" className="text-sm text-destructive">
            {errors["business.branches"]}
          </p>
        ) : null}

        {editing ? (
          <div className="flex flex-col gap-4 rounded-card border border-border p-4 sm:p-5">
            <h4 className="text-base font-semibold">{editing.index === null ? "New branch" : "Edit branch"}</h4>
            <div className="max-w-form">
              <Field label="Branch name" hint="The name guests see">
                <TextInput
                  id="register-branch-name"
                  className="w-full"
                  value={editing.draft.name}
                  onChange={(e) => setEditing({ ...editing, draft: { ...editing.draft, name: e.target.value } })}
                />
              </Field>
            </div>
            <AddressPicker
              idPrefix="register-branch"
              rwandaOnly
              draft={editing.draft.address}
              onChange={(address) => setEditing({ ...editing, draft: { ...editing.draft, address } })}
              errors={{}}
            />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={save} disabled={!branchReady(editing.draft)}>
                {editing.index === null ? "Add branch" : "Save branch"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <Button
              variant="secondary"
              disabled={atCap}
              onClick={() => setEditing({ draft: newBranchDraft(headOffice), index: null })}
            >
              <Plus size={16} aria-hidden />
              Add a branch
            </Button>
          </div>
        )}
      </section>

      <hr className="border-border" />

      <section aria-labelledby="register-psf-title" className="flex flex-col gap-3.5">
        <h3 id="register-psf-title" className="text-base font-semibold">
          PSF membership
        </h3>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-semibold">
            Is the business a member of the Private Sector Federation (PSF)?
          </legend>
          <div className="flex flex-wrap gap-x-7 gap-y-1">
            {(
              [
                [true, "Yes"],
                [false, "No"],
              ] as const
            ).map(([value, label]) => (
              <label key={label} className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="psf-member"
                  checked={business.psfMember === value}
                  onChange={() =>
                    onBusinessChange({
                      ...business,
                      psfMember: value,
                      ...(value ? { psfApply: null } : { psfMembershipNumber: "" }),
                    })
                  }
                  className="size-4"
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        {business.psfMember === true ? (
          <div className="max-w-form">
            <Field
              label="PSF membership number"
              hint="PSF's officer sees this as your claim. Injishi does not check it."
              error={errors["business.psfMembershipNumber"]}
            >
              <TextInput
                className="w-full tabular-nums"
                placeholder="PSF-0412-2019"
                value={business.psfMembershipNumber}
                onChange={(e) => onBusinessChange({ ...business, psfMembershipNumber: e.target.value })}
              />
            </Field>
          </div>
        ) : null}

        {business.psfMember === false ? (
          <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Apply for PSF membership">
            <ChoiceTile
              name="psf-plan"
              checked={business.psfApply === true}
              title="Apply now"
              description="PSF's full form, here. It goes to PSF once Injishi approves your business."
              onSelect={() => {
                onBusinessChange({ ...business, psfApply: true });
                onApplyNow();
              }}
            />
            <ChoiceTile
              name="psf-plan"
              checked={business.psfApply === false}
              title="Not now"
              description="Apply from your workspace whenever you like."
              onSelect={() => onBusinessChange({ ...business, psfApply: false })}
            />
          </div>
        ) : null}

        {business.psfMember === false && business.psfApply === true ? (
          <PsfApplication draft={psf} onChange={onPsfChange} tiers={tiers} documentLine={documentLine} errors={errors} />
        ) : null}
        {business.psfMember === false && business.psfApply === false ? (
          <p className="text-xs text-muted-foreground">PSF never holds up your registration.</p>
        ) : null}
      </section>
    </>
  );
}

function BranchRow({ branch, onEdit, onRemove }: { branch: BranchDraft; onEdit: () => void; onRemove: () => void }) {
  const where = useAddressLine(branch.address);
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-card text-muted-foreground">
        <GitBranch size={16} aria-hidden />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-semibold">{branch.name}</span>
        <span className="text-xs text-muted-foreground">{where ?? "Placed in Rwanda"}</span>
      </span>
      <Button variant="ghost" size="sm" onClick={onEdit}>
        Edit<span className="sr-only"> {branch.name}</span>
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label={`Remove ${branch.name}`} title="Remove" onClick={onRemove}>
        <Trash2 size={16} aria-hidden />
      </Button>
    </li>
  );
}
