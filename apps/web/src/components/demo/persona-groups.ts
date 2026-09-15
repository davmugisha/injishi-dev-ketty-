import type { DemoPersona, DemoSeat, DemoSurface } from "@injishi/contracts";

/**
 * How the demo roster is grouped and ordered, once, for every web surface that
 * lists it: the sign in picker and the `/demo` guide.
 *
 * It moved here out of `auth/demo-persona-picker.tsx` when the guide became the
 * second reader. Two copies of "which section does a seat belong to" would
 * list a persona under Business staff on one page and Guests on the other the
 * first time a seat changed, which is exactly the drift a demo cannot afford on
 * stage. The role words and the seats still come from the API; this file only
 * groups and orders them.
 */

export type SectionKey = "oversight" | "business" | "staff" | "personal" | "broker";

/**
 * Presentation order, chosen for the room the demo is shown to: the people who
 * run a hotel or rent out homes first, then the guests and tenants they serve,
 * then the government that licenses them, then Injishi's own staff.
 */
export const SECTIONS: readonly {
  key: SectionKey;
  title: string;
  /** One plain sentence for the `/demo` guide: who these people are to Injishi. */
  about: string;
}[] = [
  {
    key: "business",
    title: "Business staff",
    about:
      "The people who run a hotel, a guest house or a set of rental homes: owners, managers, the front desk and housekeeping. Each one sees only what their role allows.",
  },
  {
    key: "personal",
    title: "Guests & tenants",
    about: "People who book a stay or rent a home.",
  },
  {
    key: "oversight",
    title: "Government oversight",
    about:
      "Officers who check and approve a business before it may list rooms or homes. Nothing goes on sale until they have signed it off.",
  },
  {
    key: "staff",
    title: "Platform staff",
    about:
      "Injishi's own team, who look after businesses, reviews and support from the admin console.",
  },
  {
    key: "broker",
    title: "Brokers",
    about: "Agents who place guests and tenants with businesses.",
  },
];

export const SECTION_OF: Readonly<Record<DemoSurface, SectionKey>> = {
  oversight: "oversight",
  host: "business",
  work: "business",
  landlord: "business",
  staff: "staff",
  personal: "personal",
  broker: "broker",
};

/** The badge paint per section: government stands out, the rest stay quiet. */
export const SECTION_BADGE: Readonly<
  Record<SectionKey, "accent" | "default" | "outline" | "subtle">
> = {
  oversight: "accent",
  business: "default",
  staff: "outline",
  personal: "subtle",
  broker: "subtle",
};

/**
 * Within a section, the order a seat reads in. A hotel seat (`host`, `work`)
 * before a rental one (`landlord`), and in each, the more authority a role
 * carries the earlier it reads: owner, manager, front desk, housekeeping.
 * Keyed `surface:roleKey`, with a bare `roleKey` as the fallback, so a seat
 * this list does not name still sorts beside its role.
 */
const SEAT_ORDER: readonly string[] = [
  "host:owner",
  "work:owner",
  "host:manager",
  "work:manager",
  "host:receptionist",
  "work:receptionist",
  "host:housekeeper",
  "work:housekeeper",
  "landlord:owner",
  "landlord:manager",
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

/**
 * The demo's own tiebreak, by the local part of the seeded email. It decides
 * only between personas whose seats rank the same (three field verifiers, three
 * guests), never over the seat order above, so a persona added later lands by
 * its role and then after everyone named here.
 */
const DEMO_TIEBREAK: readonly string[] = [
  "yves",
  "solange",
  "denise",
  "beatha",
  "josephine",
  "samuel",
  "rayan",
  "grace",
  "theoneste",
  "claudine",
  "jeanbosco",
  "alice",
  "yvette",
  "fidele",
  "ops",
];

/**
 * Personas the roster cannot place by seat. Fidele is the government story whose
 * assignment was REVOKED, so the API rightly lists no oversight seat for him and
 * his seats alone would file him with the guests. He reads last under
 * Government oversight, which is where his story is told.
 */
const SECTION_OVERRIDE: Readonly<Record<string, SectionKey>> = {
  fidele: "oversight",
};

function localPart(email: string): string {
  return email.split("@")[0] ?? email;
}

export function sectionOf(seat: DemoSeat): SectionKey {
  // A surface this build does not know (a newer API) reads as a guest seat
  // rather than dropping the persona.
  return SECTION_OF[seat.surface] ?? "personal";
}

export function sectionIndex(seat: DemoSeat): number {
  return SECTIONS.findIndex((s) => s.key === sectionOf(seat));
}

export function roleIndex(seat: DemoSeat): number {
  const exact = SEAT_ORDER.indexOf(`${seat.surface}:${seat.roleKey}`);
  if (exact !== -1) return exact;
  const bare = SEAT_ORDER.indexOf(seat.roleKey);
  return bare === -1 ? SEAT_ORDER.length : bare;
}

function tiebreak(persona: DemoPersona): number {
  const i = DEMO_TIEBREAK.indexOf(localPart(persona.email));
  return i === -1 ? DEMO_TIEBREAK.length : i;
}

/** A persona's seats, highest section and role first. */
export function orderedSeats(persona: DemoPersona): DemoSeat[] {
  return [...persona.seats].sort(
    (a, b) => sectionIndex(a) - sectionIndex(b) || roleIndex(a) - roleIndex(b),
  );
}

/** "Denise" from "Denise Iribagiza"; "Jean-Bosco" stays whole. */
export function firstName(persona: Pick<DemoPersona, "name" | "email">): string {
  return persona.name.trim().split(/\s+/)[0] || persona.email.split("@")[0] || persona.email;
}

export interface PersonaSection {
  key: SectionKey;
  title: string;
  about: string;
  personas: DemoPersona[];
}

/**
 * Each persona once, under its HIGHEST section: Samuel owns two businesses and
 * also books as a guest, so he reads under Business staff with every badge.
 * Empty sections are dropped.
 *
 * Inside a section: a persona holding one seat before one holding several (the
 * multi-seat tour makes sense once the single roles have been seen), then by
 * their best seat, then the demo tiebreak, then the name.
 */
export function groupPersonas(personas: DemoPersona[]): PersonaSection[] {
  const buckets = SECTIONS.map((section) => ({ ...section, personas: [] as DemoPersona[] }));
  for (const persona of personas) {
    if (persona.seats.length === 0) continue;
    const override = SECTION_OVERRIDE[localPart(persona.email)];
    const top = override
      ? SECTIONS.findIndex((s) => s.key === override)
      : Math.min(...persona.seats.map(sectionIndex));
    buckets[top]?.personas.push(persona);
  }
  for (const bucket of buckets) {
    bucket.personas.sort((a, b) => {
      const ma = a.seats.length > 1 ? 1 : 0;
      const mb = b.seats.length > 1 ? 1 : 0;
      const ra = Math.min(...a.seats.map(roleIndex));
      const rb = Math.min(...b.seats.map(roleIndex));
      return ma - mb || ra - rb || tiebreak(a) - tiebreak(b) || a.name.localeCompare(b.name);
    });
  }
  return buckets.filter((b) => b.personas.length > 0);
}
