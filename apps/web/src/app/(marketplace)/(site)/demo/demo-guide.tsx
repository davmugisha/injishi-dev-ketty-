import Link from "next/link";
import type { DemoPersona, DemoStoryStep } from "@injishi/contracts";
import { Badge, Button } from "@injishi/web-ui";
import { formatMarketDateTime } from "@injishi/utils";

import { ArtDirectedImage } from "@/components/shared/art-directed-image";
import {
  DemoSignInButton,
  type DemoSignInClasses,
} from "@/components/demo/demo-sign-in-button";
import {
  SECTION_BADGE,
  firstName,
  groupPersonas,
  orderedSeats,
  sectionOf,
} from "@/components/demo/persona-groups";
// `lib/otp-core`, not `lib/otp`: that module is "use client", and a server
// component importing a constant from it receives a client reference, which
// rendered as the text of a function where the code should have been.
import { DEMO_OTP_CODE } from "@/lib/otp-core";

/**
 * The `/demo` guide: what Injishi is, and who to sign in as to see it.
 *
 * A server component; the only client island is `DemoSignInButton`. The page
 * that renders this has already asked the API whether this is the demo and 404s
 * everywhere else, so nothing here re-checks.
 *
 * Every persona and every step comes from `GET /api/v1/demo/personas`. A
 * persona WITH a story gets a card with its steps; one without (the guide does
 * not narrate everybody) is still listed under its group with a sign in button,
 * so the roster on this page and on `/sign-in` is the same fifteen people.
 *
 * It lives beside its page rather than in `components/demo` because the public
 * stylesheet scans `app/(marketplace)` and not `components/demo`; a class
 * written there compiles to nothing on this page (see `demo-sign-in-button.tsx`).
 */

/** The one-press button on a story card. */
const CARD_SIGN_IN: DemoSignInClasses = {
  root: "flex flex-col gap-2",
  button: "w-full sm:w-auto sm:self-start",
  status: "sr-only",
  note: "text-left text-xs text-muted-foreground",
  error: "text-left text-xs font-medium text-destructive",
};

/** The one-press button on a compact row. */
const ROW_SIGN_IN: DemoSignInClasses = {
  root: "flex shrink-0 flex-col gap-2 sm:items-end",
  status: "sr-only",
  note: "text-left text-xs text-muted-foreground",
  error: "text-left text-xs font-medium text-destructive",
};

const HOW_IT_WORKS: readonly { title: string; body: string }[] = [
  {
    title: "Choose a person",
    body: "Everyone below is made up, and each holds a real role: a receptionist, a hotel owner, a government officer. What you see depends on who you are.",
  },
  {
    title: "Sign in with one press",
    body: `No inbox needed. Every sign-in code on the demo is ${DEMO_OTP_CODE}, and the button enters it for you.`,
  },
  {
    title: "Follow their steps",
    body: "Each story lists what to try, in order. To switch person, come back to this page and sign in as someone else.",
  },
];

function isExternal(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

function StepLink({ step }: { step: DemoStoryStep }) {
  if (!step.href) {
    return <span className="font-medium text-page-fg">{step.title}</span>;
  }
  return (
    <a
      href={step.href}
      className="font-medium text-page-fg underline underline-offset-4 hover:no-underline"
      data-cy="demo-step-link"
    >
      {step.title}
    </a>
  );
}

function SeatBadges({ persona }: { persona: DemoPersona }) {
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1" aria-label={`${persona.name}'s roles`}>
      {orderedSeats(persona).map((seat, i) => (
        <li key={`${seat.roleKey}-${seat.label}-${i}`} className="flex flex-wrap items-center gap-1.5">
          <Badge size="sm" variant={SECTION_BADGE[sectionOf(seat)]}>
            {seat.role}
          </Badge>
          <span className="text-xs text-muted-foreground">{seat.label}</span>
        </li>
      ))}
    </ul>
  );
}

function StoryCard({ persona }: { persona: DemoPersona }) {
  const story = persona.story;
  if (!story) return null;
  const first = firstName(persona);
  const headingId = `persona-${persona.email.split("@")[0]}`;
  const external = story.tryThis.some((s) => s.href && isExternal(s.href));
  return (
    <article
      className="flex flex-col gap-4 rounded-card border border-border bg-card p-5 text-card-foreground"
      data-cy="demo-guide-persona"
      data-email={persona.email}
      aria-labelledby={headingId}
    >
      <header className="flex flex-col gap-2">
        <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
          {persona.name}
        </p>
        <h3 id={headingId} className="text-lg font-semibold leading-snug text-foreground">
          {story.headline}
        </h3>
        <SeatBadges persona={persona} />
      </header>

      <p className="text-sm text-muted-foreground">{story.summary}</p>

      {story.tryThis.length > 0 ? (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            What to try as {first}
          </h4>
          <ol className="mt-2 flex list-decimal flex-col gap-2 pl-5 text-sm text-muted-foreground">
            {story.tryThis.map((step, i) => (
              <li key={`${i}-${step.title}`} data-cy="demo-guide-step">
                <StepLink step={step} />
                {step.href && isExternal(step.href) ? (
                  <span className="text-xs"> (admin console)</span>
                ) : null}
                {step.detail ? <span className="block">{step.detail}</span> : null}
              </li>
            ))}
          </ol>
          {external ? (
            <p className="mt-2 text-xs text-muted-foreground">
              The admin console only opens from approved networks. If it does not
              load for you, the other steps still work.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-auto flex flex-col gap-1 pt-1">
        <DemoSignInButton email={persona.email} firstName={first} classes={CARD_SIGN_IN} />
        <p className="text-xs text-muted-foreground">
          Step links open the right screen once you are signed in as {first}.
        </p>
      </div>
    </article>
  );
}

function PersonaRow({ persona }: { persona: DemoPersona }) {
  const first = firstName(persona);
  return (
    <li
      className="flex flex-col gap-3 rounded-card border border-border bg-card p-4 text-card-foreground sm:flex-row sm:items-center sm:justify-between"
      data-cy="demo-guide-other"
      data-email={persona.email}
    >
      <div className="flex min-w-0 flex-col gap-1.5">
        <p className="text-sm font-semibold text-foreground">{persona.name}</p>
        <SeatBadges persona={persona} />
      </div>
      <DemoSignInButton
        email={persona.email}
        firstName={first}
        variant="outline"
        size="sm"
        classes={ROW_SIGN_IN}
      />
    </li>
  );
}

export function DemoGuide({
  personas,
  seededAt,
}: {
  personas: DemoPersona[];
  seededAt: string | null;
}) {
  const sections = groupPersonas(personas);

  return (
    <div className="flex flex-col">
      <section className="relative w-full overflow-hidden" data-cy="demo-guide-hero">
        <ArtDirectedImage
          stem="rwanda-kigali-hero"
          alt=""
          sizes="100vw"
          width={1920}
          height={640}
          priority
          className="absolute inset-0 h-full w-full"
        />
        <div aria-hidden className="scrim-hero pointer-events-none absolute inset-0" />
        <div className="container relative z-[2] flex flex-col gap-4 pb-12 pt-32 lg:pb-16 lg:pt-40">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/80">
            The Injishi demo
          </p>
          <h1 className="max-w-wide text-3xl font-bold text-white md:text-display-md">
            See Injishi through the eyes of everyone who uses it
          </h1>
          <p className="max-w-read text-base text-white/85">
            Injishi is one platform for accommodation in Rwanda. Hotels and guest
            houses run their front desk and housekeeping on it, landlords manage
            homes and tenants, guests book and pay, government officers register and
            approve businesses, and our own staff look after all of it. This demo is
            filled with made-up businesses and people. Sign in as any of them to see
            what they see.
          </p>
          {seededAt ? (
            <p className="text-sm text-white/80" data-cy="demo-guide-reset">
              Demo data last reset {formatMarketDateTime(new Date(seededAt))}. Dates
              are kept current every day, so bookings and arrivals read as this week.
            </p>
          ) : (
            <p className="text-sm text-white/80">Dates are kept current every day.</p>
          )}
          <div className="mt-2 flex flex-wrap gap-3">
            <Button asChild variant="inverse">
              {/* Straight to the first group (Business staff), not the heading above
                the group links: the room is here for the hotel and its staff. */}
              <a href={sections[0] ? `#group-${sections[0].key}` : "#people"} data-cy="demo-guide-choose">
                Choose who to be
              </a>
            </Button>
            <Button asChild variant="outline-light">
              <Link href="/sign-in">Go to the sign-in screen</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="section-y container" aria-labelledby="demo-how">
        <h2 id="demo-how" className="text-2xl text-page-fg lg:text-display-sm">
          How the demo works
        </h2>
        <ol className="mt-block grid grid-cols-1 gap-block md:grid-cols-3">
          {HOW_IT_WORKS.map((item, i) => (
            <li
              key={item.title}
              className="flex flex-col gap-2 rounded-card border border-border bg-card p-5 text-card-foreground"
            >
              <span className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                Step {i + 1}
              </span>
              <span className="text-base font-semibold text-foreground">{item.title}</span>
              <span className="text-sm text-muted-foreground">{item.body}</span>
            </li>
          ))}
        </ol>
        <p className="mt-block max-w-read text-sm text-page-fg-70">
          No real money moves here and nothing is sent to the tax authority. Change
          whatever you like: it is sample data.
        </p>
      </section>

      <section
        id="people"
        className="container scroll-mt-32 pb-band"
        aria-labelledby="demo-people"
      >
        <h2 id="demo-people" className="text-2xl text-page-fg lg:text-display-sm">
          Who to sign in as
        </h2>
        {sections.length === 0 ? (
          <p className="mt-block text-page-fg-70" data-cy="demo-guide-empty">
            The list of people could not be loaded just now. Reload this page in a
            moment, or open the{" "}
            <Link href="/sign-in" className="underline underline-offset-4">
              sign-in screen
            </Link>
            .
          </p>
        ) : null}

        <nav aria-label="Stakeholder groups" className="mt-block flex flex-wrap gap-2">
          {sections.map((section) => (
            <a
              key={section.key}
              href={`#group-${section.key}`}
              className="rounded-full border border-border px-4 py-2 text-sm text-page-fg hover:bg-surface-secondary"
            >
              {section.title}
            </a>
          ))}
        </nav>

        <div className="mt-band flex flex-col gap-band">
          {sections.map((section) => {
            const narrated = section.personas.filter((p) => p.story);
            const others = section.personas.filter((p) => !p.story);
            return (
              <section
                key={section.key}
                id={`group-${section.key}`}
                className="scroll-mt-32"
                aria-labelledby={`group-${section.key}-title`}
                data-cy="demo-guide-section"
                data-section={section.key}
              >
                <h3
                  id={`group-${section.key}-title`}
                  className="text-xl font-semibold text-page-fg"
                >
                  {section.title}
                </h3>
                <p className="mt-1 max-w-read text-sm text-page-fg-70">{section.about}</p>

                {narrated.length > 0 ? (
                  <div className="mt-block grid grid-cols-1 gap-block lg:grid-cols-2">
                    {narrated.map((persona) => (
                      <StoryCard key={persona.email} persona={persona} />
                    ))}
                  </div>
                ) : null}

                {others.length > 0 ? (
                  <div className="mt-block">
                    {narrated.length > 0 ? (
                      <p className="text-xs font-semibold uppercase tracking-wider text-page-fg-70">
                        Also in this group
                      </p>
                    ) : null}
                    <ul className="mt-2 grid grid-cols-1 gap-2 lg:grid-cols-2">
                      {others.map((persona) => (
                        <PersonaRow key={persona.email} persona={persona} />
                      ))}
                    </ul>
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      </section>
    </div>
  );
}
