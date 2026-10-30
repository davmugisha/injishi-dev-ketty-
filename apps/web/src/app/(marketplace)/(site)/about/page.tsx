import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@injishi/web-ui";
import { PageHero } from "@/components/shared/page-hero";
import { WhyBook } from "@/components/home/why-book";
import { shareMetadata } from "@/lib/share-metadata";

const DESCRIPTION =
  "Injishi. Trusted stays in the heart of Rwanda: our story, our mission, and why hosts and guests use us.";

export const metadata: Metadata = {
  title: "About Us",
  description: DESCRIPTION,
  alternates: { canonical: "/about" },
  ...shareMetadata({ title: "About Injishi", description: DESCRIPTION, path: "/about" }),
};

export default function AboutPage() {
  return (
    <div className="flex flex-col items-center bg-background">
      <PageHero
        title="About Us"
        trail={[{ label: "Home", href: "/" }, { label: "About Us" }]}
        image={{ stem: "rwanda-lake-kivu", alt: "Calm water on Lake Kivu" }}
        lede="Injishi: Trusted Stays in the Heart of Rwanda"
      />

      <section className="section-y container">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_1.2fr] lg:gap-16">
          <div className="flex flex-col gap-3">
            <span className="text-xs uppercase tracking-widest text-page-fg-70">
              Our Story and Mission
            </span>
            <h2 className="text-2xl text-page-fg lg:text-display-sm">
              About <span className="font-bold">Injishi</span>
            </h2>
          </div>

          <div className="flex flex-col gap-5 text-page-fg-70">
            <p>
              Injishi exists because booking a place to stay in Rwanda used to mean a
              phone call, a promise, and a transfer to someone you had never met. We do
              not list every accommodation, only the ones we have verified, photographed,
              and
              can stand behind.
            </p>
            {/* Rewritten 2026-10-21. It promised lockbox check-in (unbuilt,
                F-B09), a "compliant receipt" (EBM is not yet certified with the
                RRA) and listings across the three Kigali districts on a
                catalogue that opened empty. */}
            <p>
              You pay by mobile money, and the payment is held in escrow rather than
              sent straight to the host. Every booking comes with a receipt, and we are
              connecting Injishi to the Rwanda Revenue Authority&apos;s electronic billing
              so hosts can declare each sale without the paperwork.
            </p>
            <p>
              Injishi is built in Kigali by Hangaa Softwares. We are opening district by
              district, Kigali first, and a place appears here only once it has passed
              verification: an RRA TIN check, then an officer's online review of its documents.
            </p>

            <div className="mt-2 flex flex-wrap gap-3">
              <Button asChild className="w-max">
                <Link href="/explore">Start exploring</Link>
              </Button>
              <Button asChild variant="outline" className="w-max">
                <Link href="/host">List your place</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <div className="w-full">
        <WhyBook title="Why Book with us?" />
      </div>
    </div>
  );
}
