"use client";

import { useEffect, useState } from "react";
import { looksLikePsfNumber, MAX_REGISTRATION_BRANCHES, type PsfTier } from "@injishi/contracts";
import { Button } from "@injishi/web-ui";
import { FileCheck, FileText, GitBranch, Plus, Trash2, Upload } from "lucide-react";

import { uploadCertificate } from "@/data/uploads";
import { apiResultMessage } from "@/lib/api";

import { AddressPicker, useAddressLine, type AddressDraft } from "./address-picker";
import { branchReady, newBranchDraft, type BranchDraft, type BusinessDraft, type DocumentDraft } from "./business-draft";
import { PsfApplication, type PsfDraft } from "./psf-application";
import { ChoiceCard, ChoiceTile, Field, Fieldset, TextInput } from "./wizard-ui";

/**
 * Branches and PSF, the end of Business once its sections are done
 * (Register.dc.html). Both optional.
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
  tiersFailed,
  onRetryTiers,
  documentLine,
  card,
  onCardChange,
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
  tiersFailed: boolean;
  onRetryTiers: () => void;
  documentLine: string | null;
  /** The PSF membership card a member sends with its claim (2026-11-02), filed with its documents. */
  card: DocumentDraft | null;
  onCardChange: (next: DocumentDraft | null) => void;
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
          Your head office is the location above. Add the other sites that share TIN {tinLabel}: up to{" "}
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
        <Fieldset legend="Is the business a member of the Private Sector Federation (PSF)?">
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                [true, "yes", "Yes, we hold a PSF card"],
                [false, "no", "No"],
              ] as const
            ).map(([member, value, label]) => (
              <ChoiceCard
                key={value}
                name="psf-member"
                value={value}
                checked={business.psfMember === member}
                title={label}
                onSelect={() => {
                  onBusinessChange({
                    ...business,
                    psfMember: member,
                    ...(member ? { psfApply: null } : { psfMembershipNumber: "" }),
                  });
                  // Not a member: no card travels with the registration.
                  if (!member) onCardChange(null);
                }}
              />
            ))}
          </div>
        </Fieldset>

        {business.psfMember === true ? (
          <div className="max-w-form">
            <Field
              label="Number on your old card (optional)"
              hint="If your card has one. PSF checks the card you send below, then gives you a new membership number and your certificate. Until then your business shows as a card holder, not a member."
              error={
                errors["business.psfMembershipNumber"] ??
                (business.psfMembershipNumber.trim().length > 3 && !looksLikePsfNumber(business.psfMembershipNumber)
                  ? "That does not look like a PSF membership number. Type it in full, as on your card."
                  : undefined)
              }
            >
              <TextInput
                className="w-full tabular-nums"
                placeholder="PSF-0412-2019"
                value={business.psfMembershipNumber}
                onChange={(e) => onBusinessChange({ ...business, psfMembershipNumber: e.target.value })}
              />
            </Field>
            <MembershipCard card={card} onChange={onCardChange} />
          </div>
        ) : null}

        {business.psfMember === false ? (
          <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Apply for PSF membership">
            <ChoiceTile
              name="psf-plan"
              checked={business.psfApply === true}
              title="Apply now"
              description="Fill PSF’s form here. It is filed with this registration; PSF reviews it alongside Injishi’s checks."
              onSelect={() => {
                onBusinessChange({ ...business, psfApply: true });
                onApplyNow();
              }}
            />
            <ChoiceTile
              name="psf-plan"
              checked={business.psfApply === false}
              title="Not now"
              description="Register on Injishi only. Apply for PSF later from your workspace."
              onSelect={() => onBusinessChange({ ...business, psfApply: false })}
            />
          </div>
        ) : null}

        {business.psfMember === false && business.psfApply === true ? (
          <PsfApplication draft={psf} onChange={onPsfChange} tiers={tiers} tiersFailed={tiersFailed} onRetryTiers={onRetryTiers} documentLine={documentLine} errors={errors} />
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

const CARD_ACCEPT = "application/pdf,image/jpeg,image/png,image/webp";
/** The ceiling `POST /uploads/certificate` enforces. */
const CARD_MAX_BYTES = 10 * 1024 * 1024;

/**
 * The PSF membership card (2026-11-02): a photo or scan, sent with the claim so the PSF District
 * Manager can check the number against it. Uploaded the moment it is chosen, as a `psf_certificate`.
 */
function MembershipCard({ card, onChange }: { card: DocumentDraft | null; onChange: (next: DocumentDraft | null) => void }) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  /** The picked file, shown from memory (2026-11-02): after a reload only its name is left to show. */
  const [preview, setPreview] = useState<{ url: string; pdf: boolean } | null>(null);
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview.url);
  }, [preview]);

  const pick = async (file: globalThis.File | undefined) => {
    if (!file) return;
    if (file.size > CARD_MAX_BYTES) return setProblem("That file is larger than 10 MB. Send a smaller photo or scan.");
    if (!/\.(pdf|jpe?g|png|webp)$/i.test(file.name) && !CARD_ACCEPT.split(",").includes(file.type)) {
      return setProblem("Send the card as a PDF, JPEG or PNG.");
    }
    setBusy(true);
    setProblem(null);
    const res = await uploadCertificate(file);
    setBusy(false);
    if (res.status !== "ok") return setProblem(apiResultMessage(res));
    setPreview({ url: URL.createObjectURL(file), pdf: file.type === "application/pdf" || /\.pdf$/i.test(file.name) });
    onChange({ kind: "psf_certificate", kindOther: "", objectKey: res.data.objectKey, filename: res.data.filename, sizeBytes: res.data.sizeBytes });
  };

  return (
    <div className="mt-5">
      <Field label="Your PSF card" hint="A photo or scan of the card, front side. PSF checks your membership against it." required error={problem ?? undefined}>
        {card ? (
          <div className="flex flex-wrap items-center gap-4 rounded-card border border-border bg-card p-3">
            {preview ? (
              <a href={preview.url} target="_blank" rel="noreferrer" title="Open the card in full" className="shrink-0">
                {preview.pdf ? (
                  <span className="flex h-20 w-28 items-center justify-center rounded-md bg-secondary text-muted-foreground ring-1 ring-border">
                    <FileText size={28} aria-hidden />
                  </span>
                ) : (
                  // A local blob of the picked file; next/image has nothing to optimise here.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={preview.url} alt="Your PSF membership card" className="h-20 w-28 rounded-md object-cover ring-1 ring-border" />
                )}
              </a>
            ) : (
              <FileCheck size={18} aria-hidden className="shrink-0 text-accent-text" />
            )}
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-sm font-medium">{card.filename}</span>
              {preview ? (
                <a href={preview.url} target="_blank" rel="noreferrer" className="text-xs font-medium text-accent-text hover:underline">
                  View it in full
                </a>
              ) : null}
            </span>
            <button
              type="button"
              onClick={() => {
                setPreview(null);
                onChange(null);
              }}
              className="text-sm font-medium text-accent-text hover:underline"
            >
              Replace
            </button>
          </div>
        ) : (
          <label className="flex cursor-pointer items-center gap-3 rounded-card border border-dashed border-border bg-card px-4 py-3 hover:bg-secondary">
            <Upload size={18} aria-hidden className="text-muted-foreground" />
            <span className="text-sm">{busy ? "Uploading…" : "Choose a photo or PDF of the card"}</span>
            <input type="file" accept={CARD_ACCEPT} className="sr-only" disabled={busy} onChange={(e) => void pick(e.target.files?.[0])} />
          </label>
        )}
      </Field>
    </div>
  );
}
