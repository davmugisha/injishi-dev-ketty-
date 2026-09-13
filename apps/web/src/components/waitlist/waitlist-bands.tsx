import Image from "next/image";
import Link from "next/link";
import { ArrowUp, Check, MapPin } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Button,
} from "@injishi/ui";
import { WaitlistForm } from "@/components/waitlist/waitlist-form";
import { WaitlistImage } from "@/components/waitlist/waitlist-image";
import {
  WAITLIST_AUDIENCES,
  WAITLIST_AUDIENCES_BAND,
  WAITLIST_CLOSING,
  WAITLIST_DISTRICTS_BAND,
  WAITLIST_FAQ,
  WAITLIST_FAQ_BAND,
  WAITLIST_HERO,
} from "@/data/waitlist-content";

/**
 * The waitlist page's bands, in the 2026-09-13 redesign after
 * suspense.framer.website, drawn in this design system.
 *
 * WHAT CHANGED AND WHY. The owner asked for the same page with far fewer words
 * and better looking parts: a centred hero with the form as its one object, a
 * collage of the photographs instead of a single wide band, two audience cards
 * instead of two text bands, district tiles with the name on the picture, four
 * short questions and a closing band. The design canvas that settled it is the
 * "Injishi Waitlist Page" artifact.
 *
 * WHY THIS IS STILL A FULL PAGE AND NOT A BARE FORM. ADR-048 weighed that and
 * chose the fuller page for the search presence it builds while the product is
 * unlaunched. The redesign keeps every band; it only says less in each.
 *
 * EVERY COLOUR IS A ROLE, so the dark theme is the same markup. The one fixed
 * ground is the closing band's `bg-ink`, which re-pins the dark roles inside
 * itself (ADR-028) and reads as a band in light and as a raised panel in dark.
 */

export function WaitlistHero() {
  return (
    <section className="relative isolate overflow-hidden">
      {/* A faint accent wash behind the headline. It is the only atmosphere on
          the page, and it sits under the content rather than over it. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[40rem] bg-[radial-gradient(60%_100%_at_50%_0%,color-mix(in_oklch,var(--accent)_12%,transparent),transparent)]"
      />

      <div className="container flex max-w-page flex-col items-center pt-14 text-center md:pt-24">
        <p className="inline-flex h-8 animate-in items-center gap-2.5 rounded-full border border-border bg-secondary px-3.5 text-sm font-medium text-foreground fade-in-0 slide-in-from-bottom-2 duration-arrive ease-settle">
          <span className="relative flex size-2" aria-hidden>
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-accent" />
          </span>
          {WAITLIST_HERO.eyebrow}
        </p>

        <h1 className="mt-6 animate-in font-display text-display-md font-normal tracking-tight text-page-fg fill-mode-both fade-in-0 slide-in-from-bottom-3 duration-arrive ease-settle delay-75 md:text-display-lg">
          {WAITLIST_HERO.headline}
        </h1>
        <p className="mt-4 animate-in text-lg text-page-fg-70 fill-mode-both fade-in-0 slide-in-from-bottom-3 duration-arrive ease-settle delay-150">
          {WAITLIST_HERO.subhead}
        </p>

        {/* The form is the reason for the page, so it is the hero's one object.
            Nobody should have to scroll to join. `id="join"` is the closing
            band's target. */}
        <div
          id="join"
          className="mt-10 w-full max-w-read scroll-mt-24 animate-in fill-mode-both fade-in-0 slide-in-from-bottom-3 duration-arrive ease-settle delay-200"
        >
          <WaitlistForm />
        </div>

        <div className="mt-8 flex items-center gap-3">
          <div className="flex -space-x-2" aria-hidden>
            {WAITLIST_DISTRICTS_BAND.tiles.slice(0, 4).map((tile) => (
              <Image
                key={tile.name}
                src={tile.image}
                alt=""
                width={28}
                height={28}
                className="size-7 rounded-full object-cover ring-2 ring-background"
              />
            ))}
          </div>
          <span className="text-sm text-page-fg-70">{WAITLIST_HERO.proof}</span>
        </div>

        <Collage />
      </div>
    </section>
  );
}

/**
 * Three photographs, the middle one in front, the other two tilted behind it,
 * with one floating card that shows what the product is for.
 *
 * The side photographs are desktop only. At phone width a tilted card either
 * falls off the screen or shrinks to a thumbnail, and neither says anything the
 * middle photograph does not.
 */
function Collage() {
  const [traveller, owner] = WAITLIST_AUDIENCES;

  return (
    <div
      aria-hidden
      className="relative mt-14 h-80 w-full animate-in fill-mode-both fade-in-0 slide-in-from-bottom-6 duration-arrive ease-settle delay-300 md:mt-20 md:h-[30rem]"
    >
      <WaitlistImage
        src={traveller.image}
        alt=""
        sizes="25vw"
        className="absolute top-[18%] left-[5%] hidden h-[72%] w-1/4 -rotate-6 border border-border shadow-2xl shadow-foreground/10 md:block"
      />
      <WaitlistImage
        src={owner.image}
        alt=""
        sizes="25vw"
        className="absolute top-[18%] right-[5%] hidden h-[72%] w-1/4 rotate-6 border border-border shadow-2xl shadow-foreground/10 md:block"
      />
      <WaitlistImage
        src={WAITLIST_HERO.image}
        alt=""
        priority
        sizes="(min-width: 768px) 60vw, 100vw"
        className="absolute inset-x-0 top-0 h-[88%] border border-border shadow-2xl shadow-foreground/15 md:inset-x-[21%] md:h-[92%]"
      />

      <span className="absolute top-4 left-4 inline-flex h-7 items-center gap-1.5 rounded-full border border-white/20 bg-ink/45 px-3 text-xs font-medium text-white backdrop-blur-md md:top-5 md:left-[calc(21%+1.25rem)]">
        <MapPin className="size-3.5" />
        {WAITLIST_HERO.photoPlace}
      </span>

      <div className="absolute bottom-0 left-4 flex items-center gap-3 rounded-card border border-border bg-card py-3 pr-5 pl-3 text-left shadow-2xl shadow-foreground/15 md:bottom-[4%] md:left-[16%]">
        <span className="grid size-9 place-items-center rounded-full bg-accent/15 text-accent-text">
          <Check className="size-4" strokeWidth={2.5} />
        </span>
        <span className="flex flex-col">
          <span className="text-sm font-semibold text-card-foreground">
            {WAITLIST_HERO.preview.title}
          </span>
          <span className="text-xs text-muted-foreground">
            {WAITLIST_HERO.preview.detail}
          </span>
        </span>
      </div>
    </div>
  );
}

/** A heading on the left, a short aside on the right: every band opens so. */
function BandHeading({ heading, aside }: { heading: string; aside: string }) {
  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
      <h2 className="text-display-sm tracking-tight text-page-fg md:text-display-md">
        {heading}
      </h2>
      <p className="text-base text-page-fg-70">{aside}</p>
    </div>
  );
}

export function WaitlistAudiences() {
  return (
    <section className="section-y container max-w-page">
      <BandHeading
        heading={WAITLIST_AUDIENCES_BAND.heading}
        aside={WAITLIST_AUDIENCES_BAND.aside}
      />

      <div className="mt-10 grid gap-6 md:grid-cols-2">
        {WAITLIST_AUDIENCES.map((audience) => (
          <article
            key={audience.tag}
            className="flex flex-col overflow-hidden rounded-card border border-border bg-card"
          >
            <div className="relative">
              <WaitlistImage
                src={audience.image}
                alt=""
                sizes="(min-width: 768px) 50vw, 100vw"
                className="h-56 md:h-72"
              />
              <span className="absolute top-4 left-4 inline-flex h-7 items-center rounded-full border border-white/20 bg-ink/45 px-3 text-xs font-medium text-white backdrop-blur-md">
                {audience.tag}
              </span>
            </div>
            <div className="flex flex-col gap-5 p-6 md:p-7">
              <h3 className="text-display-sm text-card-foreground">
                {audience.title}
              </h3>
              <ul className="flex flex-col gap-2.5">
                {audience.points.map((point) => (
                  <li key={point} className="flex items-center gap-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded bg-accent/15 text-accent-text">
                      <Check className="size-4" strokeWidth={2.5} aria-hidden />
                    </span>
                    <span className="text-base font-medium text-card-foreground">
                      {point}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

/**
 * The districts teaser.
 *
 * Six tiles, each a name and a picture and nothing else. No counts and no
 * numbers: a tile reading "12 properties" is wrong the moment the thirteenth
 * signs up, and on a page that may sit unattended for weeks a stale number is
 * the likeliest thing on it to become a lie.
 *
 * The name is text laid over the photograph on a caption scrim, not baked into
 * it, so a screen reader reads it and it is still there when the photograph is
 * not. At phone width the row scrolls sideways rather than stacking six squares.
 */
export function WaitlistDistricts() {
  return (
    <section className="section-y container max-w-page">
      <BandHeading
        heading={WAITLIST_DISTRICTS_BAND.heading}
        aside={WAITLIST_DISTRICTS_BAND.aside}
      />

      <ul className="-mx-4 mt-10 flex snap-x gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-6 md:overflow-visible md:px-0 md:pb-0">
        {WAITLIST_DISTRICTS_BAND.tiles.map((tile) => (
          <li key={tile.name} className="w-40 shrink-0 snap-start md:w-auto">
            <div className="relative">
              <WaitlistImage
                src={tile.image}
                alt=""
                sizes="(min-width: 768px) 16vw, 40vw"
                className="aspect-[3/4] w-full"
              />
              <p className="absolute inset-x-0 bottom-0 rounded-b-card scrim-caption-fade px-3.5 pt-8 pb-3 text-base font-medium text-white">
                {tile.name}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function WaitlistFaq() {
  return (
    <section className="section-y container grid max-w-page gap-8 md:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] md:gap-20">
      <div className="flex flex-col gap-2">
        <h2 className="text-display-sm tracking-tight text-page-fg md:text-display-md">
          {WAITLIST_FAQ_BAND.heading}
        </h2>
        <p className="text-base text-page-fg-70">{WAITLIST_FAQ_BAND.aside}</p>
      </div>

      <Accordion
        type="single"
        collapsible
        defaultValue="faq-0"
        className="w-full"
      >
        {WAITLIST_FAQ.map((entry, index) => (
          <AccordionItem key={entry.question} value={`faq-${index}`}>
            <AccordionTrigger marker="circle">{entry.question}</AccordionTrigger>
            <AccordionContent>{entry.answer}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}

/**
 * The closing band. One heading, one line, and the page's one action again.
 *
 * `bg-ink` is a FIXED ground and re-pins the dark roles inside itself
 * (ADR-028), so the text here is written in roles and still reads right in
 * both themes. In dark it would vanish into the page, which is also ink, so the
 * border is what lifts it.
 */
export function WaitlistClosing() {
  return (
    <section className="section-y container max-w-page">
      <div className="relative isolate flex flex-col items-center gap-3 overflow-hidden rounded-card border border-border bg-ink px-6 py-14 text-center md:py-20">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(50%_80%_at_50%_0%,color-mix(in_oklch,var(--accent)_24%,transparent),transparent)]"
        />
        <h2 className="text-display-sm tracking-tight text-foreground md:text-display-md">
          {WAITLIST_CLOSING.heading}
        </h2>
        <p className="text-base text-muted-foreground">{WAITLIST_CLOSING.body}</p>
        <Button asChild size="lg" className="mt-5">
          <Link href="#join">
            {WAITLIST_CLOSING.button}
            <ArrowUp className="size-4" aria-hidden />
          </Link>
        </Button>
      </div>
    </section>
  );
}
