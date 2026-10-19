import type { Metadata } from "next";
import Link from "next/link";
import {
  BadgeCheck,
  Briefcase,
  ClipboardCheck,
  Factory,
  Hash,
  ShoppingBag,
  Sprout,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@injishi/ui";

import { PsfMemberships } from "@/components/psf/psf-memberships";
import { SectionHeading } from "@/components/shared/section-heading";

export const metadata: Metadata = {
  title: "Join PSF through Injishi",
  description:
    "Register any business on Injishi, get your business code, and join the Private Sector Federation at the level you can afford.",
};

/**
 * The PSF page (the PSF path, agreed with the owner on 2026-10-15).
 *
 * Where the PSF tile on "List your accommodation" lands. A business of any
 * sector, which has no place to list, reads here what joining the Private
 * Sector Federation through Injishi is: register once for 5,000, get a code
 * from its district, apply at the membership it can afford, and pay that by
 * mobile money once PSF approves. The button registers; everything else on
 * the page answers the questions a business asks before pressing it.
 *
 * The membership prices are read live (`PsfMemberships`), because admin edits
 * them; the 5,000 is said in words because it is the PSF path's fee row and the
 * register step quotes the live figure before anything is charged.
 */

const REGISTER_HREF = "/register?kind=psf";

const CLUSTERS: { icon: LucideIcon; name: string; examples: string }[] = [
  { icon: Sprout, name: "Agriculture & Livestock", examples: "Farms, cooperatives, poultry, coffee, livestock and the processors close to them." },
  { icon: Factory, name: "Industry", examples: "Factories, workshops, mining, energy, construction, printing, tailoring and crafts." },
  { icon: ShoppingBag, name: "Trade", examples: "Shops, wholesalers, importers and exporters, pharmacies, dealers and cross-border traders." },
  { icon: Briefcase, name: "Services", examples: "Transport, finance, health, garages, tourism, ICT and professional services." },
];

const STEPS: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: ClipboardCheck,
    title: "Register your business",
    body: "Your ID, your business, its sector and where it is. A TIN is optional. About ten minutes, and RWF 5,000 once.",
  },
  {
    icon: Hash,
    title: "Get your business code",
    body: "Your district gives it, like KIC0001 in Kicukiro. PSF finds you by it, so keep it.",
  },
  {
    icon: BadgeCheck,
    title: "Apply for membership",
    body: "Pick the membership you can afford and the amount you will pay a year. A PSF officer for your district reviews it.",
  },
  {
    icon: Wallet,
    title: "Pay and join",
    body: "Once PSF approves you, pay by mobile money in your portal. Your membership starts that day, for a year.",
  },
];

const FAQ: { q: string; a: string }[] = [
  {
    q: "Do I need a TIN?",
    a: "No. Give your RRA TIN if you have one and we check it with RRA. A cooperative registered with RCA, an NGO registered with RGB, or a business registered nowhere yet can register too. PSF’s officer sees how you are registered.",
  },
  {
    q: "What does it cost?",
    a: "RWF 5,000 to register, once. Your PSF membership is separate and paid yearly: you choose the band you can afford, and pay it only once PSF approves your application. The membership fee goes to PSF; Injishi keeps none of it.",
  },
  {
    q: "What is the business code?",
    a: "Three letters from your district and a number, for example KIC0001 in Kicukiro or GAS0042 in Gasabo. It is given the moment your registration fee is paid and never changes, even if you move.",
  },
  {
    q: "Who sees my details?",
    a: "The PSF membership officers for your district and PSF’s national office, to find your business and decide your membership. You agree to that when you register and again when you apply.",
  },
  {
    q: "I run a hotel or a guest house. Is this for me?",
    a: "Register it through List your accommodation instead: it gets listed and verified, and it can apply for PSF membership from its own workspace the same way.",
  },
];

export default function PsfPage() {
  return (
    <div className="flex flex-col overflow-x-hidden">
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="border-b border-border bg-secondary">
        <div className="container grid grid-cols-1 gap-10 py-16 lg:grid-cols-12 lg:items-center lg:gap-8 lg:py-24">
          <div className="lg:col-span-7">
            <p className="text-xs font-medium uppercase tracking-widest text-page-fg-70">Private Sector Federation · on Injishi</p>
            <h1 className="mt-4 text-display-sm font-medium text-page-fg lg:text-display-md">
              Join PSF<span className="font-bold">, whatever your business</span>
            </h1>
            <p className="mt-5 max-w-[46ch] text-lg text-page-fg-70">
              Register in ten minutes, get your business code, and join the Private Sector Federation at the level you can
              afford. You pay your membership by mobile money once PSF approves you.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" variant="primary">
                <Link href={REGISTER_HREF}>Register your business</Link>
              </Button>
              <Button asChild size="lg" variant="ghost">
                <a href="#memberships">See the memberships</a>
              </Button>
            </div>
          </div>

          <aside aria-label="What it costs" className="rounded-card border border-border bg-card p-6 lg:col-span-5">
            <p className="text-xs font-medium uppercase tracking-widest text-page-fg-70">What it costs</p>
            <dl className="mt-4 flex flex-col divide-y divide-border">
              <div className="flex items-baseline justify-between gap-4 pb-4">
                <dt className="text-page-fg-70">To register, once</dt>
                <dd className="text-2xl font-semibold tabular-nums text-page-fg">RWF 5,000</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 py-4">
                <dt className="text-page-fg-70">PSF membership, a year</dt>
                <dd className="text-right font-medium text-page-fg">The band you choose</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 pt-4">
                <dt className="text-page-fg-70">Taken by Injishi from your membership</dt>
                <dd className="text-2xl font-semibold tabular-nums text-page-fg">0%</dd>
              </div>
            </dl>
          </aside>
        </div>
      </section>

      {/* ── Who can join ─────────────────────────────────────────────── */}
      <section className="section-y container">
        <SectionHeading
          lead="Every sector "
          emphasis="belongs in PSF"
          lede="Pick your sector and the association you belong to when you register. PSF groups its members this way."
          className="mb-8"
        />
        <ul className="grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-4">
          {CLUSTERS.map((c) => (
            <li key={c.name} className="flex flex-col gap-3 rounded-card border border-border p-5">
              <span className="flex size-10 items-center justify-center rounded-full border border-border text-page-fg">
                <c.icon size={22} strokeWidth={1.2} aria-hidden />
              </span>
              <h3 className="text-base font-medium text-page-fg">{c.name}</h3>
              <p className="text-sm text-page-fg-70">{c.examples}</p>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-col gap-3 rounded-card border border-border bg-secondary p-5 sm:flex-row sm:items-center">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border text-page-fg">
            <Users size={22} strokeWidth={1.2} aria-hidden />
          </span>
          <p className="text-sm text-page-fg-70">
            <span className="font-medium text-page-fg">Owned by a woman, a young person or a person with a disability?</span>{" "}
            Say so when you register, in any sector. PSF’s Specialized cluster supports these businesses.
          </p>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────── */}
      <section className="section-y container border-t border-border">
        <SectionHeading lead="From registering " emphasis="to membership" className="mb-8" />
        <ol className="grid list-none grid-cols-1 gap-6 p-0 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex flex-col gap-3">
              <span className="flex size-10 items-center justify-center rounded-full border border-border text-page-fg">
                <step.icon size={22} strokeWidth={1} aria-hidden />
              </span>
              <p className="text-xs font-medium uppercase tracking-widest text-page-fg-70">Step {i + 1}</p>
              <h3 className="text-base font-medium text-page-fg">{step.title}</h3>
              <p className="text-base text-page-fg-70">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ── Memberships ──────────────────────────────────────────────── */}
      <section id="memberships" className="section-y container scroll-mt-20 border-t border-border">
        <SectionHeading
          lead="Choose what "
          emphasis="you can afford"
          lede="Three memberships. Inside each, you choose the amount you will pay a year, and PSF approves it."
          className="mb-8"
        />
        <PsfMemberships />
      </section>

      {/* ── Questions ────────────────────────────────────────────────── */}
      <section className="section-y container border-t border-border">
        <SectionHeading lead="Before you " emphasis="register" className="mb-6" />
        <div className="grid grid-cols-1 gap-x-10 gap-y-6 lg:grid-cols-2">
          {FAQ.map((f) => (
            <div key={f.q} className="flex flex-col gap-2 border-t border-border pt-5">
              <h3 className="text-base font-medium text-page-fg">{f.q}</h3>
              <p className="text-base text-page-fg-70">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Closing ──────────────────────────────────────────────────── */}
      <section className="section-y container border-t border-border">
        <div className="flex flex-col items-start gap-5 rounded-card border border-border bg-card p-8 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl font-medium text-page-fg">Ready to join?</h2>
            <p className="mt-2 max-w-[52ch] text-page-fg-70">
              Register your business now. You can apply for membership the moment you have your code.
            </p>
          </div>
          <Button asChild size="lg" variant="primary">
            <Link href={REGISTER_HREF}>Register your business</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
