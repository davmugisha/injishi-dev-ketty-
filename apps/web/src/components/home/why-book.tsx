import Image from "next/image";
import Link from "next/link";
import { ArtDirectedImage } from "@/components/shared/art-directed-image";
import { SectionHeading } from "@/components/shared/section-heading";

/**
 * "Why book on Injishi" — three photo cards, each a promise.
 *
 * Two corrections to the capture are carried forward here, both of which the
 * prototype patched at runtime:
 *
 *   1. The scrim. The captured `before:` used an arbitrary Tailwind value with
 *      spaces inside `rgba(...)`, so it never compiled and the white copy sat
 *      on bare photography. `card-scrims.js` injected the working gradient;
 *      it is written out below.
 *   2. The radius. `round-cards.js` gave listing-type cards 24px, up from the
 *      captures' 10–14px. That decision now lives in `globals.css` as
 *      `--radius-card`, which every photographic card reaches for by role; the
 *      value is unchanged, it is simply no longer restated per component.
 */

interface Promise {
  icon: string;
  lead: string;
  rest: string;
  href: string;
  image: { stem: string; alt: string; objectPosition: string };
}

const PROMISES: Promise[] = [
  {
    icon: "/assets/01KGDE5AV6Q0RPMMNVPY1912SF.svg",
    lead: "Escrow-backed ",
    rest: "booking",
    href: "/how-it-works#escrow",
    image: {
      stem: "rwanda-kigali-hero",
      alt: "Kigali, Rwanda skyline",
      objectPosition: "50% 45%",
    },
  },
  {
    icon: "/assets/01KDKH0VE3BG5GZEH2JZG79825.svg",
    lead: "Self ",
    rest: "check-in",
    href: "/how-it-works#self-check-in",
    image: {
      stem: "rwanda-apartment-interior",
      alt: "Serviced apartment interior in Rwanda",
      objectPosition: "50% 50%",
    },
  },
  {
    icon: "/assets/01KDKH0VFDGCSF97G7N4F0PN4V.svg",
    /* "Tax included", was "RRA compliance" (ADR-022 AC-4): the same promise
       said in the guest's words rather than the regulator's. The link still
       lands on the RRA compliance section, which is where the tax story
       lives. */
    lead: "Tax ",
    rest: "included",
    href: "/how-it-works#rra-compliance",
    image: {
      stem: "rwanda-lake-kivu",
      alt: "Lake Kivu, Rwanda",
      objectPosition: "50% 50%",
    },
  },
];

export function WhyBook({ title = "Why book on Injishi" }: { title?: string }) {
  return (
    <section className="section-y container-left-padding container-right-padding">
      <SectionHeading lead={title} className="mb-8" />

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {PROMISES.map((promise) => (
          <Link
            key={promise.rest}
            href={promise.href}
            className="relative block overflow-hidden rounded-card"
          >
            <ArtDirectedImage
              stem={promise.image.stem}
              alt={promise.image.alt}
              sizes="(max-width: 768px) 35vw, (max-width: 1280px) 50vw, 33vw"
              width={1024}
              height={572}
              className="w-full lg:h-[230px]"
              style={{ objectPosition: promise.image.objectPosition }}
            />

            {/* Shared caption scrim — see `scrim-caption` in globals.css. */}
            <div className="scrim-caption photo-caption absolute inset-x-0 bottom-0 z-[1] flex flex-col justify-end rounded-b-[inherit] p-6">
              <div
                aria-hidden
                className="scrim-caption-fade pointer-events-none absolute inset-x-0 bottom-full h-16"
              />

              <div className="flex flex-col gap-1">
                <Image src={promise.icon} alt="" width={30} height={30} />
                <h3 className="flex flex-col text-xl font-medium leading-[1.2] text-white md:text-3xl">
                  {promise.lead}
                  <span className="font-light text-white">{promise.rest}</span>
                </h3>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
