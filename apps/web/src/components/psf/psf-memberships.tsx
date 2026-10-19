"use client";

import { useEffect, useState } from "react";
import { Check, Crown, Medal, Sprout, type LucideIcon } from "lucide-react";
import {
  PSF_FAMILY_BLURB,
  PSF_FAMILY_LABEL,
  PSF_OFFERED_FAMILIES,
  type PsfMembershipFamily,
  type PsfTier,
} from "@injishi/contracts";

import { fetchPsfTiers } from "@/data/psf";
import { retryWhileFailed } from "@/lib/api";

/**
 * PSF's memberships, live from `GET /psf/tiers`: the prices are admin's to
 * change, so this page never prints a figure of its own. Three families, each
 * with its span, the bands inside it where it has several, and what it gives.
 */

const ICON: Partial<Record<PsfMembershipFamily, LucideIcon>> = {
  golden_circle: Crown,
  indashyikirwa: Medal,
  indatwa: Sprout,
};

const rwf = (n: number) => `RWF ${n.toLocaleString("en-US")}`;

function span(group: PsfTier[]): string {
  const lows = group.map((t) => t.annualFeeMinRwf ?? t.annualFeeRwf).filter((v): v is number => v !== null);
  if (lows.length === 0) return "Set by PSF";
  const low = Math.min(...lows);
  if (group.some((t) => t.priceKind === "minimum")) return `From ${rwf(low)}`;
  const highs = group.map((t) => t.annualFeeMaxRwf ?? t.annualFeeRwf).filter((v): v is number => v !== null);
  // "RWF" once: the second amount repeating it is what made the line wrap on a phone.
  return `${rwf(low)} – ${Math.max(...highs).toLocaleString("en-US")}`;
}

function band(t: PsfTier): string {
  const n = (v: number | null) => (v ?? 0).toLocaleString("en-US");
  if (t.priceKind === "range") return `${n(t.annualFeeMinRwf)} – ${n(t.annualFeeMaxRwf)}`;
  if (t.priceKind === "minimum") return `${n(t.annualFeeMinRwf)}+`;
  return t.priceKind === "fixed" ? n(t.annualFeeRwf) : "Set by PSF";
}

export function PsfMemberships() {
  const [tiers, setTiers] = useState<PsfTier[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    // A visitor pressed nothing to start this read, so a blip heals itself.
    void retryWhileFailed(fetchPsfTiers).then((res) => {
      if (!live) return;
      if (res.status === "ok") setTiers(res.data);
      else setFailed(true);
    });
    return () => {
      live = false;
    };
  }, []);

  if (failed) {
    return (
      <p className="rounded-card border border-border p-5 text-page-fg-70">
        We could not load PSF’s memberships just now. You see them all when you apply, after registering.
      </p>
    );
  }

  const families = PSF_OFFERED_FAMILIES.map((f) => ({
    family: f,
    group: (tiers ?? [])
      .filter((t) => t.family === f)
      .sort((a, b) => (b.annualFeeMinRwf ?? b.annualFeeRwf ?? 0) - (a.annualFeeMinRwf ?? a.annualFeeRwf ?? 0)),
  })).filter((x) => tiers === null || x.group.length > 0);

  return (
    <ul className="grid list-none grid-cols-1 gap-4 p-0 lg:grid-cols-3">
      {families.map(({ family, group }) => {
        const Icon = ICON[family] ?? Sprout;
        const benefits = group[0]?.benefitsEn ?? [];
        return (
          <li key={family} className="flex flex-col gap-4 rounded-card border border-border bg-card p-6">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-full border border-border text-page-fg">
                <Icon size={22} strokeWidth={1.3} aria-hidden />
              </span>
              <div>
                <h3 className="text-lg font-medium text-page-fg">{PSF_FAMILY_LABEL[family]}</h3>
                <p className="text-sm text-page-fg-70">{PSF_FAMILY_BLURB[family]}</p>
              </div>
            </div>

            {tiers === null ? (
              <span className="h-8 w-2/3 animate-pulse rounded bg-secondary" />
            ) : (
              <p className="text-2xl font-semibold tabular-nums text-page-fg">
                {span(group)}
                <span className="ml-1 text-sm font-normal text-page-fg-70">a year</span>
              </p>
            )}

            {group.length > 1 ? (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium uppercase tracking-widest text-page-fg-70">Bands, RWF a year</p>
                <ul className="flex list-none flex-wrap gap-2 p-0">
                  {group.map((t) => (
                    <li key={t.code} className="rounded-full border border-border px-3 py-1 text-sm tabular-nums text-page-fg">
                      {band(t)}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {benefits.length > 0 ? (
              <ul className="mt-auto flex list-none flex-col gap-2 border-t border-border p-0 pt-4">
                {benefits.slice(0, 4).map((b) => (
                  <li key={b} className="flex gap-2 text-sm text-page-fg-70">
                    <Check size={16} strokeWidth={2} aria-hidden className="mt-0.5 shrink-0 text-page-fg" />
                    {b}
                  </li>
                ))}
                {benefits.length > 4 ? (
                  <li className="text-sm text-page-fg-70">And {benefits.length - 4} more.</li>
                ) : null}
              </ul>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
