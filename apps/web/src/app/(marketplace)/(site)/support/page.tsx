import type { Metadata } from "next";
import Image from "next/image";
import { ContactForm } from "@/components/support/contact-form";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { SectionHeading } from "@/components/shared/section-heading";
import { CONTACT } from "@/data/navigation";
import { supportIntent } from "@/lib/support-intent";

export const metadata: Metadata = {
  title: "Support",
  description:
    "Talk to the Injishi support team by phone, WhatsApp or email, or write to us directly.",
  alternates: { canonical: "/support" },
};

// `name` was `country`, and the Kigali office was titled "Rwanda" while the
// other was titled "Musanze": a city and a country side by side as peers.
const OFFICES = [
  {
    name: "Kigali",
    city: "Kigali, Rwanda",
    address: "KG 7 Ave, Kacyiru, Kigali",
    flag: "/assets/rw.svg",
  },
  {
    name: "Musanze",
    city: "Musanze, Rwanda",
    address: "Kinigi Road, Musanze",
    flag: "/assets/rw.svg",
  },
];

export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const intent = supportIntent((await searchParams).intent);
  return (
    <div className="page-y">
      <div className="container">
        <Breadcrumbs trail={[{ label: "Home", href: "/" }, { label: "Support" }]} />

        {/* The hairline takes its colour from the base layer's `border-border`
            so it follows the theme; it had been a hardcoded translucent navy
            that all but vanished in dark. */}
        <section className="mb-8 flex flex-col border-b pb-8">
          <SectionHeading
            as="h1"
            lead="Contact Our"
            emphasis=" Support Team"
            className="mb-5"
            headingClassName="max-w-form"
          />

          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            <div className="flex flex-col gap-4">
              <span className="text-xs uppercase tracking-widest text-page-fg-70">
                Offices
              </span>
              {OFFICES.map((office) => (
                <div key={office.name} className="flex items-start gap-3">
                  <Image
                    src={office.flag}
                    alt="Rwanda flag"
                    width={20}
                    height={20}
                    className="mt-1 size-5 shrink-0 rounded-full"
                  />
                  <div className="flex flex-col">
                    <b className="text-page-fg">{office.name}</b>
                    <span className="text-sm text-page-fg-70">{office.address}</span>
                    <span className="text-sm text-page-fg-70">{office.city}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-4">
              <ContactRow
                icon="/assets/icon-phone.svg"
                label="Call Customer Service"
                href={CONTACT.phoneHref}
                value={CONTACT.phone}
              />
              <ContactRow
                icon="/assets/icon-whatsapp.svg"
                label="Whatsapp Customer Service"
                href={CONTACT.whatsappHref}
                value="Click and send"
                external
              />
              <ContactRow
                icon="/assets/icon-help-compass.svg"
                label="Email us"
                href="mailto:support@injishi.com"
                value="support[at]injishi.com"
              />
            </div>
          </div>
        </section>

        {/* `#contact` is where `supportHref()` lands a visitor sent from another page. */}
        <section id="contact" className="scroll-mt-24">
          <SectionHeading lead="Contact us" className="mb-6" />
          <ContactForm intent={intent} />
        </section>
      </div>
    </div>
  );
}

function ContactRow({
  icon,
  label,
  href,
  value,
  external = false,
}: {
  icon: string;
  label: string;
  href: string;
  value: string;
  external?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <Image src={icon} alt="" width={40} height={40} className="size-10 shrink-0" />
      <div className="flex flex-col">
        <span className="text-xs text-page-fg-70">{label}</span>
        <a
          href={href}
          rel="noopener noreferrer"
          target={external ? "_blank" : undefined}
          className="text-page-fg transition-colors duration-300 hover:underline"
        >
          {value}
        </a>
      </div>
    </div>
  );
}
