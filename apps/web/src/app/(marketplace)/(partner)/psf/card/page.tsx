import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, CircleAlert } from "lucide-react";
import { PsfMemberCard } from "@injishi/contracts";

import { apiFetchParsed } from "@/lib/api";

export const metadata: Metadata = {
  title: "PSF membership card",
  robots: { index: false, follow: false },
};

const day = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Kigali" }).format(new Date(`${iso}T12:00:00Z`)) : "—";

/**
 * The member's card (2026-11-02): what the QR code on a PSF certificate opens. Anyone holding the
 * certificate may scan it, so it shows what the certificate already prints, and whether the
 * membership is valid today.
 */
export default async function PsfCardPage({ searchParams }: { searchParams: Promise<{ number?: string }> }) {
  const { number } = await searchParams;
  const res = number?.trim()
    ? await apiFetchParsed(PsfMemberCard, `/api/v1/psf/card?number=${encodeURIComponent(number.trim())}`)
    : null;
  const found = res?.status === "ok" ? res.data : null;
  const card = found?.card ?? null;
  const valid = found?.status === "valid";

  return (
    <div className="container py-12 lg:py-20">
      <div className="mx-auto flex max-w-narrow flex-col gap-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-text">Private Sector Federation</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Membership card</h1>
        </div>

        {card ? (
          <section className="relative overflow-hidden rounded-card border border-accent-brand/40 bg-card p-6 shadow-sm sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                {/* PSF's mark, as on the certificate. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/assets/partners/psf.png" alt="" className="h-12 w-auto" />
                <div>
                  <p className="text-sm font-semibold">Private Sector Federation</p>
                  <p className="text-xs text-muted-foreground">Membership card</p>
                </div>
              </div>
              <span
                className={[
                  "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
                  valid ? "bg-accent-brand/15 text-accent-text" : "bg-destructive/10 text-destructive",
                ].join(" ")}
              >
                {valid ? <BadgeCheck size={14} aria-hidden /> : <CircleAlert size={14} aria-hidden />}
                {valid ? "Valid member" : "Membership lapsed"}
              </span>
            </div>

            <p className="mt-8 text-2xl font-semibold tracking-tight sm:text-3xl">{card.businessName}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {[card.businessCode ? `Business code ${card.businessCode}` : null, card.districtName].filter(Boolean).join(" · ")}
            </p>

            <dl className="mt-6 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              {[
                ["Membership number", card.membershipNumber],
                ["Level", card.levelName],
                ["Valid from", day(card.startsOn)],
                ["Valid until", day(card.expiresOn)],
              ].map(([k, v]) => (
                <div key={k} className="rounded-card bg-secondary/50 p-3">
                  <dt className="text-xs text-muted-foreground">{k}</dt>
                  <dd className="mt-0.5 break-words font-mono font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
            {!valid ? (
              <p className="mt-5 text-sm text-muted-foreground">This membership is no longer current. The business renews it on its tracking page.</p>
            ) : null}
          </section>
        ) : (
          <section className="rounded-card border border-border bg-card p-6 sm:p-8">
            <p className="font-semibold">{number ? "No PSF membership on Injishi has this number." : "Scan the QR code on a PSF certificate to see its card."}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {res && res.status !== "ok" ? "We could not check it just now. Try again in a moment." : "Check the number on the certificate, or ask the business for its certificate."}
            </p>
          </section>
        )}

        <p className="text-sm text-muted-foreground">
          A member of the business? <Link href="/psf/track" className="font-medium text-accent-text hover:underline">Track your membership</Link>.
        </p>
      </div>
    </div>
  );
}
