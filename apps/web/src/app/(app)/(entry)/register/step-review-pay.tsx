"use client";

import { Button } from "@heroui/react";
import {
  CERTIFICATE_KIND_LABEL,
  type MyProfile,
  type RegistrantCapacity,
  type RegistrationFeeQuote,
  type RegistrationSummary,
} from "@injishi/contracts";
import { BadgeCheck, Landmark, Receipt, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

import {
  readFeeOverrides,
  type RegistrationFeeOverrides,
} from "@/data/registration-fees";
import { resolveRegistrationFee } from "@/data/registration";
import { formatNationalId } from "@/lib/rwanda-id";

import {
  type ContractSignature,
  type RegistrationContractInput,
} from "@/lib/registration-contract";

import { useAddressLine } from "./address-picker";
import { ContractSigner } from "./step-contract";
import type { BranchDraft } from "./step-branches";
import type { CertificateDraft } from "./step-documents";
import type { BusinessDraft } from "./step-business";
import { composeFullName, type PersonalDraft } from "./step-about-you";
import type { RegistrationKind } from "./registration-kinds";
import { REGISTRATION_KINDS, registrationForKind } from "./registration-kinds";
import { Notice, SummaryCard, SummaryRow, formatRwf } from "./wizard-ui";

/**
 * Step 5 — read it back, sign, and pay, on one screen (ADR-026, AC-9; D23; ADR-060).
 *
 * NO FIGURE UNTIL THE MOMENT OF PAYING, and then it is stated plainly.
 *
 * The owner reversed ADR-026 AC-3 on 2026-09-21, so the flow no longer quotes a
 * price early: `/host`, step 1 and the read back say THAT a one time fee
 * is charged and never how much. A second instruction that day took the figure
 * out of the operator contract and out of this screen as well, and THAT half is
 * amended here (2026-09-27): a person about to press Pay is told the amount
 * they are about to be charged. Being asked to authorise a payment whose size
 * is not on screen is the one place the reversal cost more than it bought.
 *
 * So the rule is a boundary, not a ban. No earlier screen names a figure, and
 * neither do the read back rows or the agreement on this one. The fee block and
 * the Sign and pay button, which are what charge, both carry the amount.
 *
 * The fee is resolved regardless, for the reason it always was: a kind whose
 * fee cannot be quoted is a kind that is not open, and Create is disabled for it.
 *
 * The pay step used to open on a price and a paragraph. Everything a person had
 * typed over four screens was behind a Back button, which is the wrong place
 * for it at the one moment money moves and the one moment a wrong TIN becomes
 * an officer's rejection rather than a typo.
 *
 * So this reads it all back first, with a Change link per block that lands on
 * the step that asked. Then the bill.
 *
 * ONE SCREEN, ONE PRESS (ADR-060). It used to be two visits with the contract
 * between them. Now the read back, the agreement and the fee sit here together,
 * and "Sign and pay" runs create, accept and pay in the server's own order
 * (ADR-053, AC-R8), each skipped once done. The amount is still LOCKED onto the
 * invoice at creation (D8), and the server charges that.
 */

export function StepReviewPay({
  kind,
  personal,
  profile,
  editingProfile,
  capacity,
  intendedOwner,
  business,
  branches,
  certificates,
  quote,
  summary,
  busy,
  error,
  contractInput,
  onSignAndPay,
  onBack,
  onEditStep,
  psf,
  onEditPsf,
}: {
  kind: RegistrationKind | null;
  personal: PersonalDraft;
  profile: MyProfile | null;
  editingProfile: boolean;
  capacity: RegistrantCapacity;
  /** Read back when registering for someone else: the claim binds to these three. */
  intendedOwner: { name: string; nationalId: string; email: string };
  business: BusinessDraft;
  /** The locations beyond the head office (ADR-054). Hospitality only. */
  branches: BranchDraft[];
  certificates: CertificateDraft[];
  quote: RegistrationFeeQuote | null;
  /**
   * Null on the first visit, which is the read back. Set on the second, after
   * the contract, which is the bill alone: the answers can no longer be changed
   * by then, and a registration opened from the resume panel never had any
   * typed in this browser.
   */
  summary: RegistrationSummary | null;
  busy: boolean;
  error: string;
  /** The agreement as it will be signed; its reference is filled in once the server names it. */
  contractInput: RegistrationContractInput;
  /** Sign (null when the contract is already accepted), then create, accept and pay. */
  onSignAndPay: (signature: ContractSignature | null) => Promise<void>;
  onBack: () => void;
  onEditStep: (step: "place" | "about" | "business" | "documents") => void;
  /**
   * ADR-056: the PSF application this registration carries, read back with a
   * Change control (AC-5). Null when the registrant is not applying.
   */
  psf: { tierName: string | null; contactName: string } | null;
  onEditPsf: () => void;
}) {
  // The console's edits, read ONCE after mount and never during render.
  // `readFeeOverrides` looks at `document.cookie`, which does not exist on the
  // server: reading it inline would render one price on the server and another
  // in the browser, and React would throw the whole bill away on hydration.
  // Starting empty means the first paint shows the published schedule and the
  // edited amount replaces it a frame later, which is the correct trade — a
  // stale figure for one frame beats a torn-down pay step.
  const [feeOverrides, setFeeOverrides] = useState<RegistrationFeeOverrides>({});
  useEffect(() => {
    setFeeOverrides(readFeeOverrides());
  }, []);

  // A broker pays nothing and is never brought here — `register-wizard.tsx`
  // finishes that branch at the business step. Passing `null` rather than the
  // tile keeps that true if the routing ever changes: the fallback lookup sends
  // an unpriced type to the "Other" row, and quoting a broker RWF 100,000
  // because a screen was reached by an unexpected path is the worst kind of
  // wrong number.
  const isBroker = kind !== null && registrationForKind(kind).role === "broker";
  const fee = resolveRegistrationFee({
    summary,
    quote,
    accommodationType: isBroker ? null : kind,
    overrides: feeOverrides,
  });
  const amount = fee.amountRwf;
  const kindEntry = kind
    ? REGISTRATION_KINDS.find((k) => k.value === kind) ?? null
    : null;
  // Derived from the tile, never from whether a field happens to be filled in.
  // Reading `business.tin !== ""` would have been true for a host who typed a
  // TIN and then went back and switched to Residence, and false for a host who
  // reached this screen with the field somehow blank — two ways to show the
  // wrong half of the summary. `registrationForKind` is the one derivation.
  const isHospitality = kind !== null && registrationForKind(kind).role === "host";
  const where = useAddressLine(business.address);

  // A returning registrant confirming stored details never retyped them, so
  // the profile is what to show back. An editing one typed a fresh block, and
  // that block is what will be sent.
  const usingStoredProfile = profile?.complete === true && !editingProfile;
  // Read back through the SAME composition that will be sent, not through a
  // second join written here. The three name boxes become one string exactly
  // once, and this screen's job is to show that string — a separate join on
  // this page could show a name the server never receives, on the one screen
  // whose whole purpose is to be trusted.
  const name = usingStoredProfile
    ? (profile?.fullName ?? "—")
    : composeFullName(personal) || "—";
  const phone = usingStoredProfile
    ? (profile?.phoneE164 ?? "—")
    : personal.phoneE164 || "—";
  // Grouped the way it is printed on the card, so a person checking a sixteen
  // digit number against the document in their hand is comparing two things
  // that look alike. An unbroken run of sixteen digits is the hardest possible
  // thing to proofread, and this is the screen whose entire job is proofreading.
  const documentLine = usingStoredProfile
    ? (profile?.document?.documentNumberMasked ?? "—")
    : personal.documentType === "national_id"
      ? formatNationalId(personal.documentNumber) || "—"
      : personal.documentNumber || "—";

  return (
    <section aria-labelledby="step-pay">
      <h2 id="step-pay" className="text-xl font-semibold tracking-tight">
        {summary ? `Sign and pay for ${summary.legalName}` : "Review, sign and pay"}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {summary
          ? "Your registration is created. Sign the agreement if you have not, then pay the registration fee to send it for review."
          : "Read your answers back, read and sign the agreement, and pay the registration fee, all on this screen. A wrong number here comes back as a rejection later."}
      </p>

      <div className="mt-6 space-y-4">
        {summary ? null : (
        <>
        <SummaryCard title="What you are registering">
          <SummaryRow
            label="Kind"
            value={kindEntry?.label ?? "—"}
            onEdit={() => onEditStep("place")}
          />
          <SummaryRow
            label="Name"
            value={business.legalName || "—"}
            onEdit={() => onEditStep("business")}
          />
          {isHospitality ? (
            <>
              {/* The class only where it says something the Kind row does not:
                  for every other tile the class IS the kind ("Guest house",
                  then "Guest house" again), and for a bar & restaurant it is
                  the tile's own name. Only Other carries a typed answer. */}
              {kind === "other" ? (
                <SummaryRow
                  label="What it is"
                  value={business.accommodationClassOther || "—"}
                  onEdit={() => onEditStep("business")}
                />
              ) : null}
              <SummaryRow
                label="TIN"
                value={business.tin || "—"}
                onEdit={() => onEditStep("business")}
              />
              <SummaryRow
                label="Tourism licence"
                value={business.tourismLicenseNumber || "Not given"}
                onEdit={() => onEditStep("business")}
              />
              <SummaryRow
                label="EAC star grade"
                value={business.eacStarGrade ? `${business.eacStarGrade} star` : "Not graded"}
                onEdit={() => onEditStep("business")}
              />
              <SummaryRow
                label="Chamber of Tourism"
                value={answer(business.chamberOfTourismMember)}
                onEdit={() => onEditStep("business")}
              />
              <SummaryRow
                label="PSF"
                value={
                  business.psfMember === true && business.psfMembershipNumber.trim()
                    ? `Yes, number ${business.psfMembershipNumber.trim()}`
                    : answer(business.psfMember)
                }
                onEdit={() => onEditStep("business")}
              />
              {psf ? (
                <SummaryRow
                  label="PSF application"
                  value={`${psf.tierName ?? "A tier"}, for ${psf.contactName || "the owner"}. Goes to PSF after your TIN check.`}
                  onEdit={onEditPsf}
                />
              ) : null}
            </>
          ) : (
            <>
              <SummaryRow
                label="Holding"
                value={
                  business.residenceClass === "residential_property_manager"
                    ? "I manage it for the owner"
                    : "I am the landlord"
                }
                onEdit={() => onEditStep("business")}
              />
              <SummaryRow
                label="UPI"
                value={business.upi || "—"}
                onEdit={() => onEditStep("business")}
              />
            </>
          )}
          <SummaryRow
            label="Where"
            value={where ?? "—"}
            onEdit={() => onEditStep("business")}
          />
        </SummaryCard>

        {/* Every location this one fee covers (ADR-054 AC-R1), the head office
            first. Read back because an officer approves the list as written. */}
        {isHospitality ? (
          <SummaryCard title="Branches">
            <SummaryRow
              label="Head office"
              value={where ? `${business.legalName || "—"} · ${where}` : business.legalName || "—"}
              onEdit={() => onEditStep("business")}
            />
            {branches.length === 0 ? (
              <SummaryRow
                label="Other branches"
                value="None, one location"
                onEdit={() => onEditStep("business")}
                editLabel="Add"
              />
            ) : (
              branches.map((b, i) => (
                <BranchSummaryRow
                  key={b.key}
                  index={i}
                  branch={b}
                  onEdit={() => onEditStep("business")}
                />
              ))
            )}
          </SummaryCard>
        ) : null}

        <SummaryCard title="Who you are">
          <SummaryRow
            label="Name"
            value={name}
            onEdit={() => onEditStep("about")}
          />
          <SummaryRow
            label="ID"
            value={documentLine}
            onEdit={() => onEditStep("about")}
          />
          <SummaryRow
            label="Phone"
            value={phone}
            onEdit={() => onEditStep("about")}
          />
          <SummaryRow
            label="Registering"
            value={capacity === "owner" ? "As the owner" : "For someone else"}
            onEdit={() => onEditStep("about")}
          />
        </SummaryCard>

        {/* The owner's details are answers too (ADR-026 AC-9), and the ones worth
            proofreading most: the claim mail goes to this email, and the claim is
            refused unless the owner's document matches this national id. */}
        {capacity === "owner" ? null : (
          <SummaryCard title="Who owns it">
            <SummaryRow
              label="Name"
              value={intendedOwner.name.trim() || "—"}
              onEdit={() => onEditStep("about")}
            />
            <SummaryRow
              label="National ID"
              value={formatNationalId(intendedOwner.nationalId) || "—"}
              onEdit={() => onEditStep("about")}
            />
            <SummaryRow
              label="Email"
              value={intendedOwner.email.trim() || "—"}
              onEdit={() => onEditStep("about")}
            />
          </SummaryCard>
        )}

        <SummaryCard title="Documents">
          {certificates.length === 0 ? (
            <SummaryRow
              label="Attached"
              value="Nothing yet — your officer will ask at the visit"
              onEdit={() => onEditStep("documents")}
              editLabel="Add"
            />
          ) : (
            certificates.map((c) => (
              <SummaryRow
                key={c.objectKey}
                label={
                  c.kind === "other"
                    ? c.kindOther || "Other"
                    : CERTIFICATE_KIND_LABEL[c.kind]
                }
                value={c.filename}
                onEdit={() => onEditStep("documents")}
              />
            ))
          )}
        </SummaryCard>
        </>
        )}

        {amount === null ? (
          <Notice tone="warning">
            We couldn&apos;t load the fee for this kind of registration. It may
            not be open yet.
          </Notice>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-3">
          {[
            {
              icon: ShieldCheck,
              title: "We check RRA",
              body: "Your TIN is verified automatically, in seconds.",
            },
            {
              icon: Landmark,
              title: "An officer visits",
              body: "A district officer confirms the premises and your documents.",
            },
            {
              icon: BadgeCheck,
              title: "You go live",
              body: "An approver decides. Your subscription only starts once you are live.",
            },
          ].map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="rounded-card border border-border bg-card p-4"
            >
              <span className="flex size-9 items-center justify-center rounded-full border border-border text-muted-foreground">
                <Icon size={16} aria-hidden />
              </span>
              <p className="mt-2.5 text-sm font-semibold">{title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>

        {/* The fee, with its amount: this is the screen that charges it (owner
            decision 2026-09-27). `justify-between` rather than a plain row: the
            figure is the second thing read here, not an afterthought at the end
            of a sentence. */}
        <div className="rounded-card border border-accent-brand bg-accent-brand/10 p-5">
          <div className="flex items-baseline justify-between gap-4">
            <span className="flex items-center gap-2 text-sm font-semibold">
              <Receipt size={16} aria-hidden />
              One time registration fee
            </span>
            <span className="text-2xl font-semibold tabular-nums">
              {amount === null ? "—" : formatRwf(amount)}
            </span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Charged once, when you sign and pay below. It is not refunded if the
            review goes against you, and you are never charged a second time to
            correct and resubmit.
          </p>
        </div>
      </div>

      <div className="mt-6">
        {amount === null ? null : summary !== null && summary.contractAcceptedAt !== null ? (
          <>
            {error ? <Notice tone="danger">{error}</Notice> : null}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className="text-sm text-muted-foreground">
                {summary.legalName} is created and its agreement is signed. It is waiting for payment.
              </span>
              <span className="grow" />
              <Button
                variant="primary"
                onPress={() => void onSignAndPay(null)}
                isDisabled={busy}
                isPending={busy}
              >
                {/* The amount in the label too: the block above can be scrolled past,
                    the control cannot, and a button that authorises a payment should
                    say what it authorises. */}
                {busy ? "Paying…" : `Pay ${formatRwf(amount)}`}
              </Button>
            </div>
          </>
        ) : (
          <ContractSigner
            input={contractInput}
            actionLabel={`Sign and pay ${formatRwf(amount)}`}
            busyLabel="Submitting…"
            busy={busy}
            error={error}
            onBack={summary === null ? onBack : undefined}
            onSign={(signature) => onSignAndPay(signature)}
            // The read back is on this screen until the registration exists,
            // so the agreement's own parties card would repeat it row for row.
            partiesShownAbove={summary === null}
          />
        )}
      </div>
    </section>
  );
}

/** One declared branch, its address read back in words. */
function BranchSummaryRow({
  index,
  branch,
  onEdit,
}: {
  index: number;
  branch: BranchDraft;
  onEdit: () => void;
}) {
  const where = useAddressLine(branch.address);
  const name = branch.name.trim() || "—";
  return (
    <SummaryRow
      label={`Branch ${index + 1}`}
      value={where ? `${name} · ${where}` : name}
      onEdit={onEdit}
    />
  );
}

/** A membership answer as read back: never "No" for a question nobody answered. */
function answer(value: boolean | null): string {
  return value === null ? "Not answered" : value ? "Yes" : "No";
}
