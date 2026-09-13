import type { Officer, OfficerKey, OversightData } from "../data/types";

export interface NavItem {
  key: string;
  label: string;
  icon: string;
  href: string;
  /** Count pill — omitted when zero so a quiet nav stays quiet. */
  count?: number | null;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

/** The URL segment each officer function owns. */
export const CONSOLE_SEGMENT: Record<OfficerKey, string> = {
  verifier: "verifier",
  approver: "approver",
};

/** Which officer a URL segment names, or null when it names none. */
export function officerKeyFromSegment(segment: string): OfficerKey | null {
  if (segment === "verifier") return "verifier";
  if (segment === "approver") return "approver";
  return null;
}

/**
 * Where the console is mounted inside pms (ADR-029).
 *
 * Every console url carries this prefix. It is NOT a bare `[console]` segment at
 * the app root, which is where these screens sat in their own app: pms already
 * owns the static root segments `/host`, `/landlord`, `/broker` and `/w`, and a
 * root dynamic segment beside them would swallow the next static one somebody
 * adds. One prefix, declared once, so a screen never builds an href by hand.
 */
export const CONSOLE_BASE = "/oversight";

/**
 * A government officer's console (moved from `apps/app/src/pms/lib/nav.ts` to
 * `apps/oversight` by ADR-018 move 2, and back into pms by ADR-029).
 *
 * The queue's label follows the function — a verifier verifies, an approver
 * approves — and the queue itself is bounded by the officer's district. Scope
 * is a boundary, not a filter: a file outside it is not dimmed, it is absent,
 * which is why the count below filters on `officer.scope` rather than styling
 * the rows differently.
 */
export function oversightNav(officer: Officer, O: OversightData): NavSection[] {
  // The live queue is already scoped by the API; counting by demo district
  // would zero out every real district that is not Gasabo.
  const inScope = O.orgs.length;
  const base = `${CONSOLE_BASE}/${CONSOLE_SEGMENT[officer.key]}`;
  return [
    {
      label: "Oversight",
      items: [
        { key: "overview", label: "District overview", icon: "chart-column", href: `${base}/overview` },
        {
          key: "queue",
          label: officer.fn === "business_field_verifier" ? "Verification queue" : "Approval queue",
          icon: "inbox",
          href: `${base}/queue`,
          count: inScope || null,
        },
        {
          key: "log",
          label: "Decision log",
          icon: "scroll-text",
          href: `${base}/log`,
          // No pill. The log is paged, so a count of the rows loaded would read
          // "25" to an officer with sixty decisions, and a record of what was
          // done is not work waiting on anyone (ADR-053).
          count: null,
        },
      ],
    },
  ];
}

/** Where a console lands when it opens. The queue is the job. */
export function consoleHome(officerKey: OfficerKey): string {
  return `${CONSOLE_BASE}/${CONSOLE_SEGMENT[officerKey]}/queue`;
}
