"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Crown, Medal, Sprout, type LucideIcon } from "lucide-react";
import {
  PSF_FAMILY_BLURB,
  psfFamilyName,
  psfLevelsOf,
  PSF_OFFERED_FAMILIES,
  type PsfMembershipFamily,
  type PsfTier,
} from "@injishi/contracts";

import { fetchPsfTiers } from "@/data/psf";
import { retryWhileFailed } from "@/lib/api";

/**
 * PSF's memberships, live from `GET /psf/tiers`: the prices are admin's to
 * change, so this page never prints a figure of its own. Three families, each
 * kept short: who it is for, the price it starts at, its bands as a small
 * ladder where it has several, three of its benefits, and the way in. Borders,
 * not shadows, as every card on the site.
 */

const ICON: Partial<Record<PsfMembershipFamily, LucideIcon>> = {
  golden_circle: Crown,
  indashyikirwa: Medal,
  indatwa: Sprout,
};

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

  const levels = tiers === null ? PSF_OFFERED_FAMILIES.map((f) => ({ family: f, name: psfFamilyName(f), blurb: PSF_FAMILY_BLURB[f] ?? "" })) : psfLevelsOf(tiers);
  const families = levels.map((l) => ({
    family: l.family,
    name: l.name,
    blurb: l.blurb,
    group: (tiers ?? [])
      .filter((t) => t.family === l.family)
      .sort((a, b) => (a.annualFeeMinRwf ?? a.annualFeeRwf ?? 0) - (b.annualFeeMinRwf ?? b.annualFeeRwf ?? 0)),
  })).filter((x) => tiers === null || x.group.length > 0);

  return (
    <ul className="grid list-none grid-cols-1 items-start gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
      {families.map(({ family, name, blurb, group }) => (
        <MembershipCard key={family} family={family} name={name} blurb={blurb} group={group} loading={tiers === null} featured={family === "golden_circle"} />
      ))}
    </ul>
  );
}

/** A band's floor in short: 10k, 200k, 5M. */
function short(n: number): string {
  if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

/** The figure a family starts at. */
function floorOf(group: PsfTier[]): number | null {
  const lows = group.map((t) => t.annualFeeMinRwf ?? t.annualFeeRwf).filter((v): v is number => v !== null);
  return lows.length ? Math.min(...lows) : null;
}

/** The first sentence of a family's blurb: who it is for, in a few words. */
function tagline(blurb: string): string {
  return (blurb.split(". ")[0] ?? "").replace(/\.$/, "");
}

function MembershipCard({ family, name, blurb, group, loading, featured }: { family: PsfMembershipFamily; name: string; blurb: string; group: PsfTier[]; loading: boolean; featured: boolean }) {
  const Icon = ICON[family] ?? Sprout;
  const benefits = group[0]?.benefitsEn ?? [];
  const floor = floorOf(group);

  return (
    <li
      className={[
        "group relative flex flex-col overflow-hidden rounded-card border bg-card p-5 transition-colors",
        featured ? "border-accent-brand" : "border-border hover:border-accent-brand/50",
      ].join(" ")}
    >
      {/* The family's mark, large and faint, as the card's watermark. */}
      <Icon aria-hidden strokeWidth={1} className="pointer-events-none absolute -bottom-6 -right-6 size-36 text-accent-brand/10" />

      <div className="flex items-center gap-2.5">
        <span
          className={[
            "flex size-9 items-center justify-center rounded-full",
            featured ? "bg-accent-brand text-accent-brand-foreground" : "bg-accent-brand/10 text-accent-text",
          ].join(" ")}
        >
          <Icon size={18} strokeWidth={1.8} aria-hidden />
        </span>
        <h3 className="flex-1 text-lg font-semibold text-page-fg">{name}</h3>
        {featured ? (
          <span className="rounded-full border border-accent-brand px-2 py-0.5 text-2xs font-semibold uppercase tracking-widest text-accent-text">Top</span>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-page-fg-70">{tagline(blurb)}</p>

      {loading ? (
        <span className="mt-4 h-9 w-1/2 animate-pulse rounded bg-secondary" />
      ) : (
        <p className="mt-4 flex items-baseline gap-1.5 text-page-fg">
          <span className="text-xs text-page-fg-70">from RWF</span>
          <span className="text-3xl font-semibold tabular-nums tracking-tight">{floor === null ? "—" : floor.toLocaleString("en-US")}</span>
          <span className="text-xs text-page-fg-70">/ year</span>
        </p>
      )}

      {/* Several bands read as a ladder: each step a little higher. */}
      {group.length > 1 ? (
        <div className="mt-4 flex items-end gap-1.5" aria-label={`${group.length} bands`}>
          {group.map((t, i) => (
            <span key={t.code} className="flex flex-1 flex-col items-center gap-1" title={band(t)}>
              <span className="w-full rounded bg-accent-brand/25" style={{ height: `${10 + i * 7}px` }} />
              <span className="text-2xs tabular-nums text-page-fg-70">{short(t.annualFeeMinRwf ?? t.annualFeeRwf ?? 0)}</span>
            </span>
          ))}
        </div>
      ) : null}

      {benefits.length > 0 ? (
        <ul className="mt-4 flex list-none flex-col gap-2 border-t border-border p-0 pt-4">
          {benefits.slice(0, 3).map((b) => (
            <li key={b} className="flex gap-2 text-sm text-page-fg">
              <Check size={15} strokeWidth={2.6} aria-hidden className="mt-0.5 shrink-0 text-accent-text" />
              <span className="line-clamp-1" title={b}>
                {b}
              </span>
            </li>
          ))}
          {benefits.length > 3 ? <li className="pl-6 text-xs text-page-fg-70">+{benefits.length - 3} more</li> : null}
        </ul>
      ) : null}

      <Link
        href="/psf/register"
        className="relative mt-5 inline-flex items-center gap-1.5 self-start text-sm font-semibold text-accent-text underline-offset-4 hover:underline"
      >
        Apply <ArrowRight size={15} aria-hidden className="transition-transform group-hover:translate-x-0.5" />
      </Link>
    </li>
  );
}
