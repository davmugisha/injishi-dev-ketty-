"use client";

import { Info, Smartphone, Wallet } from "lucide-react";
import {
  ENTERPRISE_REGISTRATION_KIND_LABEL,
  PSF_COMPANY_TYPE_LABEL,
  PSF_CONTACT_ROLE_LABEL,
  PSF_FAMILY_LABEL,
  PSF_OWNER_GROUP_SHORT,
  PSF_OWNERSHIP_LABEL,
  type PsfCatalogue,
  type PsfTier,
} from "@injishi/contracts";
import { Checkbox } from "@injishi/web-ui";

import { PhoneInput } from "@/app/(app)/(entry)/register/phone-input";
import { Field, Notice } from "@/app/(app)/(entry)/register/wizard-ui";

import { rwf, type Errors, type PsfDraft, type StepKey } from "./draft";

/** What the business agrees to share, in the words PSF's consent was written in. */
export const PSF_PUBLIC_CONSENT =
  "These details are true, and this application goes to the Private Sector Federation (PSF): the business details, and my name, ID number, date of birth, phone and email, so that PSF can find my business and decide my membership.";

/**
 * Step 4, Check and pay: one last look at everything, a Change beside each part
 * that opens the step that asked, and the one payment: the first year's
 * membership, because PSF reviews only paid applications. There is no
 * registration fee, and nothing is refunded (2026-10-23).
 */
export function StepReview({
  draft,
  onChange,
  errors,
  tiers,
  catalogue,
  goTo,
}: {
  draft: PsfDraft;
  onChange: (next: Partial<PsfDraft>) => void;
  errors: Errors;
  tiers: PsfTier[] | null;
  catalogue: PsfCatalogue | null;
  goTo: (step: StepKey) => void;
}) {
  const tier = tiers?.find((t) => t.code === draft.tierCode);
  const membershipRwf = Number(draft.amount.replace(/[^\d]/g, "")) || 0;
  const cluster = catalogue?.clusters.find((c) => c.code === draft.clusterCode);
  const association = cluster?.associations.find((a) => a.code === draft.associationCode);
  const registration =
    draft.registrationKind === "tin"
      ? `TIN ${draft.tin}`
      : draft.registrationKind && draft.registrationKind !== "none"
        ? `${ENTERPRISE_REGISTRATION_KIND_LABEL[draft.registrationKind]} · ${draft.registrationNumber}`
        : "Not registered yet";

  const groups: { step: StepKey; title: string; rows: [string, string][] }[] = [
    {
      step: "you",
      title: "You",
      rows: [
        ["Name", draft.applicant?.fullName ?? "—"],
        ["National ID", draft.applicant?.documentNumberMasked ?? "—"],
        ["Role", PSF_CONTACT_ROLE_LABEL[draft.role]],
        ["Phone", draft.phone],
        ["Email", draft.email || "Not given"],
      ],
    },
    {
      step: "business",
      title: "Your business",
      rows: [
        ["Name", draft.legalName],
        ["Logo", draft.logoObjectKey ? draft.logoName || "Added" : "None"],
        ["Registration", registration],
        ["Company", `${draft.companyType ? PSF_COMPANY_TYPE_LABEL[draft.companyType] : "—"} · ${draft.ownership === "other" ? draft.ownershipOther : draft.ownership ? PSF_OWNERSHIP_LABEL[draft.ownership] : "—"}`],
        ["Sector", [cluster?.nameEn, draft.associationOther.trim() && association?.code.endsWith("_other") ? `${draft.associationOther.trim()} (not on PSF's list)` : association?.nameEn].filter(Boolean).join(" · ") || "—"],
        [
          "Kind",
          draft.subsectorId === "__type_it__"
            ? `${draft.subsectorOther.trim()} (typed)`
            : (cluster?.subsectors.find((x) => x.id === draft.subsectorId)?.nameEn ?? "—"),
        ],
        ["Does", draft.businessActivity],
        ["Owned by", draft.ownerGroups.length ? draft.ownerGroups.map((g) => PSF_OWNER_GROUP_SHORT[g]).join(", ") : "Not marked"],
        ["Where", [draft.street, draft.placeNames.village, draft.placeNames.cell, draft.placeNames.sector, draft.placeNames.district, draft.placeNames.province].filter(Boolean).join(", ")],
        [
          "Branches",
          draft.branches.length
            ? draft.branches.map((b) => [b.street.trim(), b.placeNames.sector, b.placeNames.district].filter(Boolean).join(", ")).join(" · ")
            : "None",
        ],
      ],
    },
    {
      step: "membership",
      title: "Membership",
      rows: [
        ["Membership", draft.family ? PSF_FAMILY_LABEL[draft.family] : "—"],
        ["Band", tier?.nameEn ?? "—"],
        ["A year", draft.amount ? rwf(Number(draft.amount)) : "Set by PSF"],
      ],
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">Check and pay</h2>
        <p className="mt-1.5 text-muted-foreground">One last look. Change anything here, and it opens the step that asked.</p>
      </header>

      <div className="flex flex-col gap-4">
        {groups.map((g) => (
          <section key={g.step} className="overflow-hidden rounded-card border border-border">
            <div className="flex items-center justify-between bg-secondary/60 px-5 py-3">
              <h3 className="text-sm font-semibold">{g.title}</h3>
              <button type="button" onClick={() => goTo(g.step)} className="text-sm font-medium text-accent-text underline-offset-4 hover:underline">
                Change
              </button>
            </div>
            <dl className="divide-y divide-border">
              {g.rows.map(([k, v]) => (
                <div key={k} className="grid grid-cols-3 gap-4 px-5 py-2.5 text-sm">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="col-span-2 break-words font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>

      <section className="flex flex-col gap-5 rounded-card border border-border bg-card p-5 sm:p-6">
        <div className="flex items-center gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent-brand/15 text-accent-text">
            <Wallet size={20} aria-hidden />
          </span>
          <div className="flex-1">
            <p className="font-semibold">One payment</p>
            <p className="text-sm text-muted-foreground">PSF reviews only paid applications, so your first year is paid now.</p>
          </div>
        </div>
        <dl className="divide-y divide-border rounded-card border border-border text-sm">
          <div className="flex items-baseline justify-between gap-4 px-4 py-3">
            <dt>
              <span className="font-medium">Membership, first year</span>
              <span className="block text-xs text-muted-foreground">
                {tier ? `${tier.nameEn}. ` : ""}Goes to PSF.
              </span>
            </dt>
            <dd className="font-semibold tabular-nums">{membershipRwf ? rwf(membershipRwf) : "—"}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 bg-secondary/60 px-4 py-3">
            <dt className="font-semibold">You pay now</dt>
            <dd className="text-2xl font-semibold tabular-nums">{membershipRwf ? rwf(membershipRwf) : "—"}</dd>
          </div>
        </dl>
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <Info size={15} aria-hidden className="mt-0.5 shrink-0 text-accent-text" />
          <span>The membership fee is not refunded, even if PSF declines. Once you have paid, the application cannot be withdrawn.</span>
        </p>
        <Field
          label="Mobile money number"
          hint={<span className="inline-flex items-center gap-1"><Smartphone size={12} aria-hidden /> MTN MoMo or Airtel Money. The prompt goes to this phone.</span>}
          required
          error={errors.payerPhoneE164}
        >
          <PhoneInput id="psf-payer" value={draft.payer} onChange={(v) => onChange({ payer: v })} invalid={Boolean(errors.payerPhoneE164)} />
        </Field>
        <div>
          <Checkbox isSelected={draft.agree} onChange={(on: boolean) => onChange({ agree: on })} className="items-start gap-3" controlClassName="mt-0.5">
            <span className="text-sm">{PSF_PUBLIC_CONSENT}</span>
          </Checkbox>
          {errors.consent ? <p className="mt-1 text-sm text-destructive">{errors.consent}</p> : null}
        </div>
        <Notice tone="info">
          This is a demo: payment is recorded here, and no prompt goes to your phone yet.
        </Notice>
      </section>
    </div>
  );
}
