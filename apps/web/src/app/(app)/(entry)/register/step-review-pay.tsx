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
import { BadgeCheck, Info, Landmark, Receipt, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

import {
  readFeeOverrides,
  type RegistrationFeeOverrides,
} from "@/data/registration-fees";
import { resolveRegistrationFee } from "@/data/registration";
import { formatNationalId } from "@/lib/rwanda-id";

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
  formatRwf,
} from "./wizard-ui";

/**
 * Step 5 — read it back, then pay (ADR-026, AC-9; D23).
 *
 * The pay step used to open on a price and a paragraph. Everything a person had
 * typed over four screens was behind a Back button, which is the wrong place
 * for it at the one moment money moves and the one moment a wrong TIN becomes
 * an officer's rejection rather than a typo.
 *
 * So this reads it all back first, with a Change link per block that lands on
 * the step that asked. Then the bill.
 *
 * TWO PRESSES, NOT ONE, and that part is unchanged. The first creates the
 * registration and shows the real bill the server raised; the second settles
 * it. Collapsing them would mean quoting a price from the catalog and charging
 * whatever the server decided, and those are allowed to differ — the amount is
 * LOCKED onto the invoice at creation (D8), so the bill is the only figure
 * worth showing once one exists.
 */

export function StepReviewPay({
  kind,
  personal,
  profile,
  editingProfile,
  capacity,
  business,
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
  business: BusinessDraft;
  certificates: CertificateDraft[];
  quote: RegistrationFeeQuote | null;
  summary: RegistrationSummary | null;
  busy: boolean;
  error: string;
  onCreate: () => void;
  onPay: () => void;
  onBack: () => void;
  onEditStep: (step: "place" | "about" | "business" | "documents") => void;
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
  // The tile's own word first. `fee.configured.label` is the same word for
  // every priced type and differs only when a type has fallen through to the
  // "Other" row — in which case naming that row is more honest than naming the
  // tile, because "Other" is the rate actually being quoted.
  const feeLabel =
    fee.configured === null
      ? null
      : fee.configured.accommodationType === kind
        ? kindEntry?.label ?? fee.configured.label
        : fee.configured.label;
  // Derived from the tile, never from whether a field happens to be filled in.
  // Reading `business.tin !== ""` would have been true for a host who typed a
  // TIN and then went back and switched to Residence, and false for a host who
  // reached this screen with the field somehow blank — two ways to show the
  // wrong half of the summary. `registrationForKind` is the one derivation.
  const isHospitality = kind !== null && registrationForKind(kind).role === "host";

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
        Check it, then pay
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Read this back before anything is charged. A wrong number here comes back
        as a rejection later.
      </p>

      <div className="mt-6 space-y-4">
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
                label="Chamber of Tourism"
                value={business.chamberOfTourismMember ? "Yes" : "No"}
                onEdit={() => onEditStep("business")}
              />
              <SummaryRow
                label="PSF"
                value={business.psfMember ? "Yes" : "No"}
                onEdit={() => onEditStep("business")}
              />
            </>
          ) : (
            <SummaryRow
              label="UPI"
              value={business.upi || "—"}
              onEdit={() => onEditStep("business")}
            />
          )}
        </SummaryCard>

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

        {/* The bill. Its own surface rather than another summary card: it is
            the one block on this page that is about to take money, and it
            should not read as a sixth row of answers. */}
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
          {/* The fee differs by what is being registered, so the figure has to
              say which type it is the figure FOR. A lone amount invites the
              reader to assume it is the same for everyone, which is the exact
              belief this feature exists to correct. */}
          {feeLabel === null ? null : (
            <p className="mt-1 text-sm text-muted-foreground">
              The {feeLabel} rate — registration is priced by accommodation type.
            </p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Charged once. It is not refunded if the review goes against you, and
            you are never charged a second time to correct and resubmit.
          </p>
        </div>

        {/* Said plainly, and only when it is true: this figure came from the
            schedule this app carries rather than from the platform. Quietly
            substituting a local number for a server price and letting it read
            as a bill is the one thing a demo may not do. */}
        {fee.source === "configured" && fee.configured !== null ? (
          <aside
            className="flex items-start gap-3 rounded-card border border-dashed border-input bg-secondary px-4 py-3 text-secondary-foreground"
            aria-label="Demo data notice"
          >
            <Info
              size={16}
              aria-hidden
              className="mt-0.5 shrink-0 text-muted-foreground"
            />
            <p className="text-xs leading-relaxed">
              <span className="font-semibold">Demo data.</span>{" "}
              <span className="text-muted-foreground">
                The platform did not quote this registration, so the amount above
                is the {fee.configured.label} rate this demonstration carries —
                set by {fee.configured.setBy}, with effect from{" "}
                {fee.configured.effectiveFrom}. Nothing has been charged.
              </span>
            </p>
          </aside>
        ) : null}

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

        {error ? <Notice tone="danger">{error}</Notice> : null}
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
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {summary.legalName} is created and waiting for payment.
          </span>
          <span className="grow" />
          <Button
            variant="primary"
            onPress={onPay}
            isDisabled={busy}
            isPending={busy}
          >
            {busy ? "Paying…" : `Pay ${amount === null ? "" : formatRwf(amount)}`}
          </Button>
        </div>
      )}
    </section>
  );
}
