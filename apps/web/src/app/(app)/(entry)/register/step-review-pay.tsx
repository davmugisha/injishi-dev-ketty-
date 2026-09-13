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
import { fetchDistricts, fetchProvinces, fetchSectors } from "@/data/geography";
import { resolveRegistrationFee } from "@/data/registration";
import { formatNationalId } from "@/lib/rwanda-id";

import type { AddressDraft } from "./address-picker";
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
 * TWO VISITS, NOT ONE. The first press creates the registration and the wizard
 * moves on to the operator contract, which quotes the real bill the server
 * raised; after accepting it the registrant comes back here and the second
 * press settles it (ADR-053, AC-R8). Collapsing them would mean quoting a price from the catalog and charging
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
  intendedOwner,
  business,
  certificates,
  quote,
  summary,
  resumed,
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
  certificates: CertificateDraft[];
  quote: RegistrationFeeQuote | null;
  summary: RegistrationSummary | null;
  /**
   * Opened from the resume panel, so nothing was typed in this browser. The
   * read back cards would be a column of dashes; the bill is shown alone.
   */
  resumed: boolean;
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
        {resumed && summary ? `Pay for ${summary.legalName}` : "Check it, then pay"}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {resumed && summary
          ? "Your contract is accepted. Paying the registration fee sends the business for review."
          : "Read this back before anything is charged. A wrong number here comes back as a rejection later."}
      </p>

      <div className="mt-6 space-y-4">
        {resumed ? null : (
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
          {/* Only the offline demo prices by accommodation type (`data/registration-fees.ts`).
              The platform's fee is one catalogue row per business type (ADR-026,
              ratified in ADR-053), so saying "the hotel rate" over a real quote
              would describe a pricing model the platform does not have. */}
          {feeLabel === null || fee.source !== "configured" ? null : (
            <p className="mt-1 text-sm text-muted-foreground">
              The {feeLabel} rate in this offline demonstration.
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
            {busy ? "Paying…" : `Pay ${amount === null ? "" : formatRwf(amount)}`}
          </Button>
        </div>
      )}
    </section>
  );
}

/** A membership answer as read back: never "No" for a question nobody answered. */
function answer(value: boolean | null): string {
  return value === null ? "Not answered" : value ? "Yes" : "No";
}

/**
 * The business address as a line a person can check: street, sector, district,
 * province, in words (AC-9).
 *
 * The draft holds ids, because that is what the picker selects and what is sent,
 * so the names are read from the same geography the picker read them from. Each
 * list is small and the picker has usually just fetched it. An id that no longer
 * resolves reads as absent rather than as a number nobody can check.
 */
function useAddressLine(address: AddressDraft): string | null {
  const [line, setLine] = useState<string | null>(null);
  const { country, provinceId, districtId, sectorId, street, addressText } = address;

  useEffect(() => {
    let cancelled = false;
    if (country !== "RW") {
      setLine(addressText.trim() || null);
      return;
    }
    void (async () => {
      const [provinces, districts, sectors] = await Promise.all([
        fetchProvinces(),
        provinceId ? fetchDistricts(Number(provinceId)) : Promise.resolve(null),
        districtId ? fetchSectors(Number(districtId)) : Promise.resolve(null),
      ]);
      const nameIn = (
        res: Awaited<ReturnType<typeof fetchProvinces>> | null,
        id: string,
      ): string | null =>
        res && res.status === "ok" ? (res.data.find((x) => String(x.id) === id)?.name ?? null) : null;
      const parts = [
        street.trim() || null,
        nameIn(sectors, sectorId),
        nameIn(districts, districtId),
        nameIn(provinces, provinceId),
      ].filter((p): p is string => Boolean(p));
      if (!cancelled) setLine(parts.length > 0 ? parts.join(", ") : null);
    })();
    return () => {
      cancelled = true;
    };
  }, [country, provinceId, districtId, sectorId, street, addressText]);

  return line;
}
