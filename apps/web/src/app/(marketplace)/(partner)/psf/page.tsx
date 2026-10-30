import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Briefcase, Factory, Plus, ShoppingBag, Sprout, Users, type LucideIcon } from "lucide-react";
import { Button } from "@injishi/web-ui";

import { PsfHero } from "@/components/psf/psf-hero";
import { PsfMemberships } from "@/components/psf/psf-memberships";
import {
  CertificateIllustration,
  FormIllustration,
  PayIllustration,
  ReviewIllustration,
} from "@/components/psf/step-illustrations";
import { TrackForm } from "@/components/psf/track-form";
import { PsfPhoto as Photo } from "@/components/psf/psf-photo";
import { SectionHeading } from "@/components/shared/section-heading";

export const metadata: Metadata = {
  title: "Register your business",
  description:
    "Register any business for the Private Sector Federation in one form, with no account. Pay once by mobile money, follow PSF's answer with your docID, and get your certificate the day PSF approves you.",
};

/**
 * The PSF page (the public PSF path, 2026-10-19).
 *
 * One promise, centred, with both doors under it, because a visitor here is
 * one of two people: a business about to register, or one coming back with
 * its docID. The four sectors sit under it as photographs (2026-10-20). Everything below answers the questions a business asks before
 * pressing Register: who it is for, what it costs, how it goes, and the
 * memberships (read live: admin edits them).
 */

const REGISTER_HREF = "/psf/register";

/**
 * The four sectors, each with a photograph of Rwanda at work, its icon, three
 * words for who is in it, and its place in the grid: agriculture tall, services
 * wide, so the four read as a set rather than a row of equal boxes.
 */
const CLUSTERS: { stem: string; name: string; examples: string; alt: string; icon: LucideIcon; crop?: string; span: string }[] = [
  { stem: "rwanda-tea-02", name: "Agriculture & Livestock", examples: "Farms · coffee · livestock", alt: "Tea terraces in the Rwandan highlands", icon: Sprout, crop: "object-bottom", span: "row-span-2" },
  { stem: "kigali-city-street-01", name: "Industry", examples: "Factories · building · crafts", alt: "A building going up beside a Kigali road", icon: Factory, span: "" },
  { stem: "kigali-cbd-buildings-01", name: "Trade", examples: "Shops · wholesale · export", alt: "Offices and shops in central Kigali", icon: ShoppingBag, span: "" },
  { stem: "mille-collines-02", name: "Services", examples: "Hotels · transport · finance · tourism", alt: "Guests dining on a hotel terrace in Kigali", icon: Briefcase, span: "col-span-2" },
];

const STEPS: { art: (p: { className?: string }) => React.ReactElement; title: string; body: string }[] = [
  { art: FormIllustration, title: "Fill in one form", body: "Ten minutes. No account." },
  { art: PayIllustration, title: "Pay by mobile money", body: "One payment. Your docID by text." },
  { art: ReviewIllustration, title: "PSF reviews it", body: "Your district office, within a week." },
  { art: CertificateIllustration, title: "Get your certificate", body: "Approved, you are a member that day." },
];

const FAQ: { q: string; a: string }[] = [
  { q: "Do I need an account?", a: "No. You get a docID, like PSF-7K3M-Q9XD, by text. It is all you need to follow your application and print your certificate." },
  { q: "Do I need a TIN?", a: "No. A TIN is checked with RRA if you have one. RCA cooperatives, RGB organisations and unregistered businesses can join too." },
  { q: "What does it cost?", a: "Your first year's membership, paid by mobile money when you send the form. There is no registration fee." },
  { q: "What if PSF declines me?", a: "PSF tells you why, and you can apply again. The membership fee is not refunded." },
  { q: "What if I lose my docID?", a: "It is in the text we sent you and on your receipt. Anyone with it sees your status, never your ID number or birth date." },
  { q: "Who sees my details?", a: "Only PSF's officers for your district and province, and PSF's national office." },
];

export default function PsfPage() {
  return (
    <div className="flex flex-col overflow-x-hidden">
      <PsfHero registerHref={REGISTER_HREF} />

      {/* ── Every sector belongs: the four, as photographs ─────────────── */}
      <section className="border-b border-border">
        <div className="container grid grid-cols-1 gap-8 py-12 lg:grid-cols-12 lg:gap-10 lg:py-16">
          <div className="lg:col-span-4 lg:pt-2">
            <SectionHeading lead="Every sector " emphasis="belongs" />
            <p className="mt-3 text-page-fg-70">Pick yours on the form, then your association.</p>
            <p className="mt-6 text-xs font-semibold uppercase tracking-widest text-page-fg-70">Owned by</p>
            <ul className="mt-2 flex list-none flex-wrap gap-2 p-0">
              {["Women", "Young people", "People with disabilities"].map((g) => (
                <li key={g} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-sm text-page-fg">
                  <Users size={14} aria-hidden className="text-accent-text" />
                  {g}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-sm text-page-fg-70">Say so on the form: PSF&rsquo;s Specialized cluster supports you.</p>
          </div>

          <ul className="grid list-none auto-rows-[11rem] grid-cols-2 gap-3 p-0 sm:auto-rows-[13rem] lg:col-span-8 lg:grid-cols-3">
            {CLUSTERS.map((c) => (
              <li key={c.name} className={`group relative overflow-hidden rounded-card border border-border ${c.span}`}>
                <Photo
                  stem={c.stem}
                  alt={c.alt}
                  imgClassName={c.crop}
                  className="absolute inset-0 transition-transform duration-arrive group-hover:scale-105"
                />
                <span className="absolute left-3 top-3 flex size-9 items-center justify-center rounded-full bg-card text-accent-text">
                  <c.icon size={18} aria-hidden />
                </span>
                <div className="absolute inset-x-3 bottom-3 rounded-card bg-card/95 px-3 py-2.5 backdrop-blur-sm">
                  <h2 className="text-sm font-semibold leading-tight text-page-fg sm:text-base">{c.name}</h2>
                  <p className="mt-0.5 text-xs text-page-fg-70">{c.examples}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────── */}
      <section id="how" className="section-y container scroll-mt-20">
        <SectionHeading lead="How it " emphasis="works" className="mb-8" />
        <ol className="grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex flex-row overflow-hidden rounded-card border border-border bg-card sm:flex-col">
              <div className="flex w-28 shrink-0 items-center justify-center border-r border-border bg-secondary/60 p-3 text-page-fg sm:w-auto sm:border-b sm:border-r-0 sm:px-6 sm:py-5">
                <step.art className="h-16 w-auto sm:h-24" />
              </div>
              <div className="flex items-start gap-3 p-4 sm:p-5">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-brand text-xs font-semibold text-accent-brand-foreground">
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-semibold text-page-fg">{step.title}</h3>
                  <p className="mt-0.5 text-sm text-page-fg-70">{step.body}</p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* ── The certificate: what you get ─────────────────────────────── */}
      <section className="section-y container border-t border-border">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
          <div>
            <SectionHeading lead="Approved? " emphasis="Your certificate, that day" />
            <ul className="mt-6 flex list-none flex-col gap-3 p-0 text-page-fg">
              {["Download it as a PDF", "Get it by email", "Anyone can check it by its QR code"].map((t) => (
                <li key={t} className="inline-flex items-center gap-2.5">
                  <span className="flex size-6 items-center justify-center rounded-full bg-accent-brand/15 text-accent-text">
                    <BadgeCheck size={14} aria-hidden />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <CertificatePreview />
        </div>
      </section>

      {/* ── Memberships ──────────────────────────────────────────────── */}
      <section id="memberships" className="section-y container scroll-mt-20 border-t border-border">
        <SectionHeading
          lead="Choose what "
          emphasis="you can afford"
          lede="Pick the band that fits. PSF sets the price in your district."
          className="mb-8"
        />
        <PsfMemberships />
      </section>

      {/* ── Questions ────────────────────────────────────────────────── */}
      <section className="section-y container border-t border-border">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-4">
            <SectionHeading lead="Before you " emphasis="register" />
            <p className="mt-3 text-page-fg-70">The short answers. Anything else, PSF&rsquo;s district office can help.</p>
            <Link href="/psf/track" className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-accent-text underline-offset-4 hover:underline">
              Already applied? Track it <ArrowRight size={15} aria-hidden />
            </Link>
          </div>
          <div className="divide-y divide-border overflow-hidden rounded-card border border-border bg-card lg:col-span-8">
            {FAQ.map((f, i) => (
              <details key={f.q} className="group" open={i === 0}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-base font-medium text-page-fg hover:bg-secondary/60 [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <Plus size={18} aria-hidden className="shrink-0 text-page-fg-70 transition-transform group-open:rotate-45" />
                </summary>
                <p className="px-5 pb-5 text-page-fg-70">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── Closing: Kigali, and one button ─────────────────────────── */}
      <section className="section-y container border-t border-border">
        <div className="relative overflow-hidden rounded-card border border-border">
          <Photo stem="kigali-night-panorama-02" alt="Kigali at night" className="absolute inset-0" />
          <div className="relative flex flex-col items-start gap-5 bg-ink/60 p-8 text-white sm:p-12 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-3xl font-medium">Ready to join?</h2>
              <p className="mt-2 text-white/80">Ten minutes, and PSF has your application.</p>
            </div>
            <Button asChild size="lg" variant="primary">
              <Link href={REGISTER_HREF}>
                Register your business <ArrowRight size={18} aria-hidden />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

/** The certificate as it looks, small and tilted: what a member gets. */
function CertificatePreview() {
  return (
    <div className="relative mx-auto w-full max-w-narrow">
      <div className="absolute inset-0 translate-x-3 translate-y-3 rotate-2 rounded-card border border-border bg-secondary" aria-hidden />
      <div className="relative -rotate-1 overflow-hidden rounded-card border border-accent-brand/40 bg-card p-6">
        <div className="flex items-center gap-2">
          <img src="/assets/partners/psf.png" alt="" className="h-9 w-auto" />
          <p className="text-xs font-semibold leading-tight text-accent-text">
            Private Sector
            <br />
            Federation
          </p>
        </div>
        <p className="mt-5 text-center text-2xs uppercase tracking-[0.3em] text-accent-text">Private Sector Federation</p>
        <p className="mt-1 text-center font-serif text-2xl font-bold text-accent-text">Certificate of Membership</p>
        <p className="mt-3 text-center text-2xs uppercase tracking-[0.25em] text-page-fg-70">This certifies that</p>
        <p className="mt-1 text-center font-serif text-xl font-bold text-page-fg">Your business</p>
        <span className="mx-auto mt-2 block h-px w-2/3 bg-accent-brand/40" />
        <p className="mt-3 text-center text-sm font-semibold text-accent-text">Indatwa</p>
        <div className="mt-4 grid grid-cols-3 divide-x divide-border text-center">
          {[
            ["Number", "PSF/GAS/…"],
            ["From", "Today"],
            ["Until", "In a year"],
          ].map(([k, v]) => (
            <div key={k} className="px-2">
              <p className="text-2xs uppercase tracking-widest text-page-fg-70">{k}</p>
              <p className="mt-0.5 text-xs font-medium text-page-fg">{v}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
