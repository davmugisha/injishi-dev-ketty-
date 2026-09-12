import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@injishi/ui";
import { PageHero } from "@/components/shared/page-hero";
import { WhyBook } from "@/components/home/why-book";

export const metadata: Metadata = {
  title: "About Us",
  description:
    "Injishi. Trusted stays in the heart of Rwanda: our story, our mission, and why hosts and guests use us.",
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
            <p>
              Payment is held in escrow until you check in. Check-in is by lockbox or
              code, so a delayed flight is not a locked door. Every booking issues a
              compliant receipt, which keeps hosts on the right side of the Rwanda Revenue
              Authority without the paperwork.
            </p>
            <p>
              We are based in Kigali, with listings across Gasabo, Kicukiro and
              Nyarugenge, and growing supply in Musanze, Rubavu, Huye and Nyagatare.
            </p>

            <Button asChild className="mt-2 w-max">
              <Link href="/explore">Start exploring</Link>
            </Button>
          </div>
        </div>
      </section>

      <div className="w-full">
        <WhyBook title="Why Book with us?" />
      </div>
    </div>
  );
}
