"use client";

import type { DemoPersona, DemoSeat, DemoSurface } from "@injishi/contracts";
import { Badge } from "@injishi/ui";
import { formatMarketDateTime } from "@injishi/utils";

import { Icon } from "@/components/app/icon";
import { DEMO_OTP_CODE } from "@/lib/otp";

/**
 * The demo's sign in shortcut (ADR-043, AC-18 and AC-19).
 *
 * Rendered only where `GET /api/v1/platform` said demo, so production and
 * staging never show it. A pick FILLS the email field and nothing more: the
 * visitor still presses Continue, so the one sign in path is the one being
 * demonstrated, and the picker cannot become a second way in.
 *
 * The roster comes from `GET /api/v1/demo/personas`, never from a list in this
 * app, so the seats it promises are the seats the switcher will show. Each
 * persona reads with every seat it holds and the ROLE in each, because the demo
 * is where access control is presented: "Beatha, Amahoro" tells a room nothing,
 * "Housekeeper at Amahoro" tells it what signing in as her will prove. The role
 * words come from the API; this file only groups and paints them.
 */

type SectionKey = "oversight" | "business" | "staff" | "personal" | "broker";

/** Presentation order: who decides, who operates, who runs the platform, who books. */
const SECTIONS: readonly { key: SectionKey; title: string }[] = [
  { key: "oversight", title: "Government oversight" },
  { key: "business", title: "Business staff" },
  { key: "staff", title: "Platform staff" },
  { key: "personal", title: "Guests & tenants" },
  { key: "broker", title: "Brokers" },
];

const SECTION_OF: Readonly<Record<DemoSurface, SectionKey>> = {
  oversight: "oversight",
  host: "business",
  work: "business",
  landlord: "business",
  staff: "staff",
  personal: "personal",
  broker: "broker",
};

/** The badge paint per section: government stands out, the rest stay quiet. */
const SECTION_BADGE: Readonly<Record<SectionKey, "accent" | "default" | "outline" | "subtle">> = {
  oversight: "accent",
  business: "default",
  staff: "outline",
  personal: "subtle",
  broker: "subtle",
};

/** Within a section, the more authority a role carries the earlier it reads. */
const ROLE_ORDER: readonly string[] = [
  "business_approver",
  "business_field_verifier",
  "tax_compliance_officer",
  "owner",
  "manager",
  "receptionist",
  "housekeeper",
  "staff",
  "personal",
  "broker",
];

function sectionIndex(seat: DemoSeat): number {
  // A surface this build does not know (a newer API) reads as a guest seat
  // rather than dropping the persona.
  const key = SECTION_OF[seat.surface] ?? "personal";
  return SECTIONS.findIndex((s) => s.key === key);
}

function roleIndex(seat: DemoSeat): number {
  const i = ROLE_ORDER.indexOf(seat.roleKey);
  return i === -1 ? ROLE_ORDER.length : i;
}

/**
 * Each persona once, under its HIGHEST section: Samuel owns two businesses and
 * also books as a guest, so he reads under Business staff with every badge.
 */
function groupPersonas(personas: DemoPersona[]) {
  const buckets = SECTIONS.map((section) => ({ ...section, personas: [] as DemoPersona[] }));
  for (const persona of personas) {
    if (persona.seats.length === 0) continue;
    const top = Math.min(...persona.seats.map(sectionIndex));
    buckets[top]?.personas.push(persona);
  }
  for (const bucket of buckets) {
    bucket.personas.sort((a, b) => {
      const ra = Math.min(...a.seats.map(roleIndex));
      const rb = Math.min(...b.seats.map(roleIndex));
      return ra - rb || a.name.localeCompare(b.name);
    });
  }
  return buckets.filter((b) => b.personas.length > 0);
}

export default function DemoPersonaPicker({
  personas,
  seededAt,
  selected,
  onPick,
}: {
  personas: DemoPersona[];
  /** When the demo data was last reset, an ISO instant, or null if unknown. */
  seededAt: string | null;
  selected: string;
  onPick: (email: string) => void;
}) {
  const sections = groupPersonas(personas);

  return (
    <section
      aria-labelledby="demo-personas-title"
      className="rounded-card border border-border bg-field p-4"
      data-cy="demo-personas"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="demo-personas-title" className="text-sm font-semibold text-foreground">
          Explore the demo
        </h2>
        {seededAt ? (
          <p className="text-xs text-muted-foreground" data-cy="demo-reset">
            Data reset {formatMarketDateTime(new Date(seededAt))}
          </p>
        ) : null}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        <Icon name="info" className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />
        Pick someone to fill the email, then Continue. Every code is{" "}
        <span className="font-semibold tracking-wider text-foreground">{DEMO_OTP_CODE}</span>.
      </p>

      {sections.length > 0 ? (
        <div className="scrollbar mt-3 max-h-[70vh] overflow-y-auto sm:max-h-[32rem]">
          {sections.map((section) => (
            <div
              key={section.key}
              role="group"
              aria-labelledby={`demo-personas-${section.key}`}
              className="mt-3 first:mt-0"
              data-cy="demo-persona-section"
              data-section={section.key}
            >
              <h3
                id={`demo-personas-${section.key}`}
                className="sticky top-0 z-10 bg-field px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                {section.title}
              </h3>
              <ul className="flex flex-col gap-1">
                {section.personas.map((persona) => {
                  const picked = persona.email === selected;
                  const seats = [...persona.seats].sort(
                    (a, b) => sectionIndex(a) - sectionIndex(b) || roleIndex(a) - roleIndex(b),
                  );
                  return (
                    <li key={persona.email}>
                      <button
                        type="button"
                        onClick={() => onPick(persona.email)}
                        aria-pressed={picked}
                        aria-label={`${persona.name}: ${seats
                          .map((s) => `${s.role}, ${s.label}`)
                          .join("; ")}`}
                        className={`w-full rounded px-3 py-2 text-left hover:bg-surface-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                          picked ? "bg-surface-secondary" : ""
                        }`}
                        data-cy="demo-persona"
                        data-email={persona.email}
                      >
                        <span className="flex flex-wrap items-baseline justify-between gap-x-2">
                          <span className="text-sm font-medium text-foreground">{persona.name}</span>
                          <span className="truncate text-xs text-muted-foreground">{persona.email}</span>
                        </span>
                        <span className="mt-1 flex flex-col gap-1">
                          {seats.map((seat, i) => (
                            <span
                              key={`${seat.roleKey}-${seat.label}-${i}`}
                              className="flex flex-wrap items-center gap-x-2 gap-y-0.5"
                              data-cy="demo-persona-seat"
                            >
                              <Badge
                                size="sm"
                                variant={SECTION_BADGE[SECTION_OF[seat.surface] ?? "personal"]}
                                data-cy="demo-persona-role"
                                data-role={seat.roleKey}
                              >
                                {seat.role}
                              </Badge>
                              <span className="min-w-0 text-xs text-muted-foreground">
                                {seat.label}
                                {seat.detail ? ` · ${seat.detail}` : ""}
                              </span>
                            </span>
                          ))}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
