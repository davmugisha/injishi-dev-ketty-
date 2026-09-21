"use client";

import { Button } from "@heroui/react";
import {
  ACCOMMODATION_CLASS_LABEL,
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

import { useAddressLine } from "./address-picker";
import type { BranchDraft } from "./step-branches";
import type { CertificateDraft } from "./step-documents";
import type { BusinessDraft } from "./step-business";
import { composeFullName, type PersonalDraft } from "./step-about-you";
import type { RegistrationKind } from "./registration-kinds";
import { REGISTRATION_KINDS, registrationForKind } from "./registration-kinds";
import {
  Notice,
  StepActions,
  SummaryCard,
  SummaryRow,
} from "./wizard-ui";

/**
 * Step 5 — read it back, then, on a second visit, pay (ADR-026, AC-9; D23).
 *
 * NO FIGURE, ANYWHERE. The owner reversed ADR-026 AC-3 on 2026-09-21 and then
 * took the amount out of the contract and this screen too: the registration
 * flow says THAT a one time fee is charged and never how much. The first visit
 * is the read back; the second, after the contract, is the fee block and the
 * Pay button, after everything else. This file must not import `formatRwf`.
 * The fee is still RESOLVED, for one reason: a kind whose fee cannot be quoted
 * is a kind that is not open, and Create is disabled for it.
 *
 * The pay step used to open on a price and a paragraph. Everything a person had
 * typed over four screens was behind a Back button, which is the wrong place
 * for it at the one moment money moves and the one moment a wrong TIN becomes
 * an officer's rejection rather than a typo.
 *
 * So this reads it all back first, with a Change link per block that lands on
 * the step that asked. Then the bill.
 *
 * TWO VISITS, NOT ONE. The first press creates the registration and the wizard
 * moves on to the operator contract; after accepting it the registrant comes back here and the second
 * press settles it (ADR-053, AC-R8). The amount is LOCKED onto the invoice at
 * creation (D8), and the server charges that.
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
  onCreate,
  onPay,
  onBack,
  onEditStep,
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
  onCreate: () => void;
  onPay: () => void;
  onBack: () => void;
  onEditStep: (step: "place" | "about" | "business" | "branches" | "documents") => void;
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
        {summary ? `Pay for ${summary.legalName}` : "Check your answers"}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {summary
          ? "Your contract is accepted. Paying the registration fee sends the business for review."
          : "Read this back before you create the registration. A wrong number here comes back as a rejection later. You pay the registration fee after the contract, at the very end."}
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
              <SummaryRow
                label="Class"
                value={
                  business.accommodationClass === "other"
                    ? business.accommodationClassOther || "Other"
                    : business.accommodationClass
                      ? ACCOMMODATION_CLASS_LABEL[
                          business.accommodationClass as keyof typeof ACCOMMODATION_CLASS_LABEL
                        ]
                      : "—"
                }
                onEdit={() => onEditStep("place")}
              />
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
                value={answer(business.psfMember)}
                onEdit={() => onEditStep("business")}
              />
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
                onEdit={() => onEditStep("branches")}
                editLabel="Add"
              />
            ) : (
              branches.map((b, i) => (
                <BranchSummaryRow
                  key={b.key}
                  index={i}
                  branch={b}
                  onEdit={() => onEditStep("branches")}
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

        {/* On the pay visit the error sits under the bill, beside the button
            that raised it. */}
        {error && summary === null ? <Notice tone="danger">{error}</Notice> : null}
      </div>

      {summary === null ? (
        <StepActions
          onBack={onBack}
          onNext={onCreate}
          nextLabel="Create my registration"
          busy={busy}
          disabled={amount === null}
        />
      ) : (
        <>
          <div className="mt-4 space-y-4">
          {/* The bill. Its own surface rather than another summary card: it is
              the one block on this page that is about to take money, and it
              should not read as a sixth row of answers. */}
          <div className="rounded-card border border-accent-brand bg-accent-brand/10 p-5">
            <div className="flex items-baseline gap-4">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <Receipt size={16} aria-hidden />
                One time registration fee
              </span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Charged once. It is not refunded if the review goes against you, and
              you are never charged a second time to correct and resubmit.
            </p>
          </div>

          {error ? <Notice tone="danger">{error}</Notice> : null}
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {summary.contractAcceptedAt === null
                ? `${summary.legalName} is created. Accept the contract before paying.`
                : `${summary.legalName} is created, its contract is accepted, and it is waiting for payment.`}
            </span>
            <span className="grow" />
            <Button
              variant="primary"
              onPress={onPay}
              isDisabled={busy}
              isPending={busy}
            >
              {busy ? "Paying…" : "Pay the registration fee"}
            </Button>
          </div>
        </>
      )}
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
