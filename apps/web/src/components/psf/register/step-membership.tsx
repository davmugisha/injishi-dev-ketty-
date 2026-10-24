"use client";

import { Check, Crown, Info, MapPin, Medal, Sprout, Wallet, type LucideIcon } from "lucide-react";
import {
  PSF_FAMILY_LABEL,
  PSF_OFFERED_FAMILIES,
  type PsfFeesView,
  type PsfMembershipFamily,
  type PsfTier,
} from "@injishi/contracts";

import { TextInput } from "@/app/(app)/(entry)/register/wizard-ui";

import { rwf, type Errors, type PsfDraft } from "./draft";

const ICON: Partial<Record<PsfMembershipFamily, LucideIcon>> = { golden_circle: Crown, indashyikirwa: Medal, indatwa: Sprout };

function bandLabel(t: PsfTier): string {
  const n = (v: number | null) => (v ?? 0).toLocaleString("en-US");
  if (t.priceKind === "range") return `${n(t.annualFeeMinRwf)} – ${n(t.annualFeeMaxRwf)}`;
  if (t.priceKind === "minimum") return `${n(t.annualFeeMinRwf)} and up`;
  return t.priceKind === "fixed" ? n(t.annualFeeRwf) : "Set by PSF";
}

/**
 * Step 3, Membership: the level the business can afford. PSF's officers set
 * each band's price in the business's district (2026-10-20); the business
 * pays at least that, and may pay more up to the top of the band's range, or
 * just under the next band's price for a band with none (2026-10-23). It
 * starts at the price, and the API refuses anything outside.
 *
 * The membership is the one payment when the form is sent: PSF reviews only
 * paid applications. There is no registration fee, and nothing is refunded.
 */
export function StepMembership({
  draft,
  onChange,
  errors,
  tiers,
  fees,
  districtName,
}: {
  draft: PsfDraft;
  onChange: (next: Partial<PsfDraft>) => void;
  errors: Errors;
  tiers: PsfTier[] | null;
  /** PSF's prices in the business's district; null while they load. */
  fees: PsfFeesView | null;
  districtName: string;
}) {
  const feeOf = (code: string) => fees?.fees.find((f) => f.tierCode === code) ?? null;
  const families = PSF_OFFERED_FAMILIES.map((family) => ({
    family,
    group: (tiers ?? [])
      // A band PSF prices itself cannot be paid up front, and PSF reviews only paid applications.
      .filter((t) => t.family === family && (fees === null || feeOf(t.code)?.amountRwf != null))
      .sort((a, b) => (b.annualFeeMinRwf ?? b.annualFeeRwf ?? 0) - (a.annualFeeMinRwf ?? a.annualFeeRwf ?? 0)),
  })).filter((f) => f.group.length > 0);

  const current = families.find((f) => f.family === draft.family) ?? null;
  const tier = tiers?.find((t) => t.code === draft.tierCode) ?? null;
  const picked = tier ? feeOf(tier.code) : null;
  const priceOf = (t: PsfTier) => feeOf(t.code)?.amountRwf ?? null;
  const amountFor = (t: PsfTier) => {
    const p = priceOf(t);
    return p === null ? "" : String(p);
  };

  const pickTier = (t: PsfTier) => onChange({ tierCode: t.code, amount: amountFor(t) });
  const bands = current ? [...current.group].sort((a, b) => (priceOf(a) ?? 0) - (priceOf(b) ?? 0)) : [];
  const benefits = (tier ?? current?.group[0])?.benefitsEn.slice(0, 6) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-2xl font-semibold tracking-tight">Choose your membership</h2>
        {districtName ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
            <MapPin size={12} aria-hidden /> Prices for {districtName}
          </span>
        ) : null}
      </header>

      {/* The three memberships */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Membership">
        {tiers === null
          ? [0, 1, 2].map((i) => <span key={i} className="h-28 animate-pulse rounded-card bg-secondary" />)
          : families.map(({ family, group }) => {
              const Icon = ICON[family] ?? Sprout;
              const on = draft.family === family;
              const prices = group.map(priceOf).filter((v): v is number => v !== null);
              return (
                <button
                  key={family}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => {
                    if (on) return;
                    const only = group.length === 1 ? group[0] : null;
                    onChange({ family, tierCode: only?.code ?? "", amount: only ? amountFor(only) : "" });
                  }}
                  className={[
                    "group relative flex flex-col gap-4 rounded-card border-2 p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    on ? "border-accent-brand bg-accent-brand/10" : "border-border bg-card hover:border-accent-brand/50",
                  ].join(" ")}
                >
                  <span className="flex items-center justify-between">
                    <span
                      className={[
                        "flex size-10 items-center justify-center rounded-full transition-colors",
                        on ? "bg-accent-brand text-accent-brand-foreground" : "bg-secondary text-foreground",
                      ].join(" ")}
                    >
                      <Icon size={20} strokeWidth={1.7} aria-hidden />
                    </span>
                    <span
                      aria-hidden
                      className={[
                        "flex size-5 items-center justify-center rounded-full border-2 transition-colors",
                        on ? "border-accent-brand bg-accent-brand text-accent-brand-foreground" : "border-input",
                      ].join(" ")}
                    >
                      {on ? <Check size={12} strokeWidth={3.5} /> : null}
                    </span>
                  </span>
                  <span>
                    <span className="block font-semibold">{PSF_FAMILY_LABEL[family]}</span>
                    <span className="mt-0.5 block text-sm tabular-nums text-muted-foreground">
                      {prices.length === 0 ? "…" : prices.length > 1 ? `From ${rwf(Math.min(...prices))}` : rwf(prices[0]!)}
                    </span>
                  </span>
                </button>
              );
            })}
      </div>
      {errors["membership.family"] ? <p className="-mt-3 text-sm text-destructive">{errors["membership.family"]}</p> : null}

      {/* A family with several bands: pick one */}
      {current && bands.length > 1 ? (
        <section aria-label="Band">
          <p className="mb-2 text-sm font-semibold">Pick your band</p>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4" role="radiogroup">
            {bands.map((t) => {
              const on = draft.tierCode === t.code;
              const price = priceOf(t);
              return (
                <button
                  key={t.code}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => pickTier(t)}
                  className={[
                    "flex flex-col rounded-card border-2 px-4 py-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    on ? "border-accent-brand bg-accent-brand text-accent-brand-foreground" : "border-border bg-card hover:border-accent-brand/50",
                  ].join(" ")}
                >
                  <span className="text-lg font-semibold tabular-nums">{price === null ? "…" : price.toLocaleString("en-US")}</span>
                  <span className={["text-xs", on ? "opacity-80" : "text-muted-foreground"].join(" ")}>Band {bandLabel(t)}</span>
                </button>
              );
            })}
          </div>
          {errors["membership.tierCode"] ? <p className="mt-2 text-sm text-destructive">{errors["membership.tierCode"]}</p> : null}
        </section>
      ) : null}

      {/* What it costs, and what it brings */}
      {tier ? (
        <section
          className={[
            "overflow-hidden rounded-card border bg-card",
            errors["membership.declaredFeeRwf"] ? "border-destructive" : "border-border",
          ].join(" ")}
        >
          <div className="flex flex-col gap-2 bg-secondary/70 px-5 py-4">
            <label htmlFor="psf-amount" className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              {PSF_FAMILY_LABEL[tier.family]} · what you pay a year
            </label>
            <div className="flex items-center gap-2">
              <span className="text-xl font-semibold text-muted-foreground">RWF</span>
              <TextInput
                id="psf-amount"
                className="w-full text-2xl font-semibold tabular-nums sm:max-w-tile"
                inputMode="numeric"
                value={draft.amount ? Number(draft.amount).toLocaleString("en-US") : ""}
                onChange={(ev) => onChange({ amount: ev.target.value.replace(/[^\d]/g, "").slice(0, 12) })}
                aria-invalid={Boolean(errors["membership.declaredFeeRwf"])}
                aria-describedby="psf-amount-range"
              />
            </div>
            <p id="psf-amount-range" className="text-sm text-muted-foreground">
              {picked?.amountRwf == null
                ? "Loading PSF's price for your district…"
                : picked.ceilingRwf != null
                  ? `Any amount from ${rwf(picked.amountRwf)} to ${rwf(picked.ceilingRwf)}. PSF's price for this band is ${rwf(picked.amountRwf)}.`
                  : `${rwf(picked.amountRwf)} or more. PSF's price for this band is ${rwf(picked.amountRwf)}.`}
            </p>
          </div>
          {errors["membership.declaredFeeRwf"] ? (
            <p role="alert" className="border-t border-border px-5 py-2 text-sm text-destructive">
              {errors["membership.declaredFeeRwf"]}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-x-6 gap-y-2 border-t border-border px-5 py-3 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Wallet size={14} aria-hidden className="text-accent-text" /> Paid when you send the form
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Info size={14} aria-hidden className="text-accent-text" /> Not refunded if PSF declines
            </span>
          </div>
          {benefits.length ? (
            <ul className="grid list-none grid-cols-1 gap-x-6 gap-y-2 border-t border-border p-5 sm:grid-cols-2">
              {benefits.map((b) => (
                <li key={b} className="flex gap-2 text-sm">
                  <Check size={15} strokeWidth={2.6} aria-hidden className="mt-0.5 shrink-0 text-accent-text" />
                  {b}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
