import type { OversightConsoleGrant } from "@injishi/contracts";

import type { Officer, OfficerKey } from "./types";

/**
 * An officer, built from the grant the SERVER returned (ADR-049, AC-G5).
 *
 * ## What this replaced
 *
 * `OFFICERS` in `data/oversight.ts`: a two entry table of invented officers —
 * "Jean-Bosco Nkurunziza" at PSF in Gasabo, "Claudine Mukamana" at MINALOC in
 * Gasabo — complete with names, bodies, titles and districts. Whoever was
 * actually reviewing real businesses saw somebody else's posting over their own
 * decisions, and `console-shell.tsx` recorded the other half of the problem: it
 * would not print the district at all, because "a district read off a fixture is
 * worse than none". The server tells the console its scope now, so it can.
 *
 * ## The one thing still defined here, and why that is not a fixture
 *
 * The VOCABULARY each function speaks: what its queue is called, what the verb on
 * its primary button is, which stage it acts on, and its seal colour. None of
 * that is identity, and none of it varies by officer — it follows from the
 * function, which the server decided. ADR-049 names this layer explicitly: the
 * enum value stays the database's name, the console renders a stable label, and
 * the officer's own title comes from their institution. This is the middle one.
 */
const FUNCTION_VOCABULARY = {
  verifier: {
    fn: "business_field_verifier",
    fnLabel: "Field Verifier",
    act: "Field-verify this business",
    actsOn: "tin_verified",
    seal: "#036A8E",
  },
  approver: {
    fn: "business_approver",
    fnLabel: "Approver",
    act: "Approve to go live",
    actsOn: "field_verified",
    seal: "#8A5300",
  },
} as const satisfies Record<OfficerKey, Omit<Officer, "key" | "name" | "ini" | "body" | "bodyName" | "title" | "scopeLevel" | "scope">>;

/** Which console an oversight function opens. `tax` has no surface here yet. */
export function officerKeyForConsole(
  console: OversightConsoleGrant["console"],
): OfficerKey | null {
  if (console === "verification") return "verifier";
  if (console === "approval") return "approver";
  return null;
}

/**
 * The officer this console is rendering.
 *
 * `name` and `ini` are deliberately ABSENT from what this builds: the shell reads
 * the signed-in person from `usePms().me`, which is the same profile the operator
 * sidebar shows. An officer's identity is whoever is signed in, never a row in a
 * table here, and the empty strings below say that rather than inventing a name.
 */
export function officerFromGrant(grant: OversightConsoleGrant): Officer | null {
  const key = officerKeyForConsole(grant.console);
  if (key === null) return null;

  return {
    key,
    // The shell prints `me.name` and `me.ini` instead. Kept on the shape because
    // `Officer` is shared with screens that have not needed to care yet.
    name: "",
    ini: "",
    ...FUNCTION_VOCABULARY[key],
    body: grant.bodyCode,
    // Null when a grant somehow outlives its body's display name. The code is a
    // worse label than the name and a better one than nothing.
    bodyName: grant.bodyName ?? grant.bodyCode,
    // Null when nobody recorded a title. Naming the function is honest; inventing
    // a job title for a government officer is not.
    title: grant.title ?? FUNCTION_VOCABULARY[key].fnLabel,
    scopeLevel: grant.scopeLevel,
    scope: grant.scopeLabel,
  };
}
