/**
 * The officer's sidebar (P5), built per request from the seats the person holds (`GET /me/oversight`): a
 * local leader gets their guests (with how many they have not opened yet) and reports; a business
 * reviewer gets the review queues. Hiding an item is presentation only: the API still decides. No count
 * is typed in: the guests count is the API's.
 */
import { isLeaderRole, LEADER_ROLE_SHORT, OVERSIGHT_ROLE_LABEL, type OversightConsoleGrant } from "@injishi/contracts";
import { type NavGroup, navigationFor, type Persona } from "@injishi/data";
import { cache } from "react";
import { sampleCollectionsByBoard } from "@/lib/coverage.generated";
import { currentApi } from "@/lib/session";
import { ApiError } from "../api";
import { leaderSummary } from "./guests";

/** The seats this person holds, or an empty list when the API refuses. */
export const officerConsoles = cache(async (): Promise<OversightConsoleGrant[]> => {
  const api = await currentApi();
  try {
    return (await api.get<{ consoles: OversightConsoleGrant[] }>("/api/v1/me/oversight")).consoles;
  } catch (error) {
    if (error instanceof ApiError) return [];
    throw error;
  }
});

/** True when every seat the person holds is a local leader's: their home is the guest console. */
export function leaderOnly(consoles: readonly Pick<OversightConsoleGrant, "console">[]): boolean {
  return consoles.length > 0 && consoles.every((c) => c.console === "guests");
}

export async function officerNav(): Promise<NavGroup[]> {
  const consoles = await officerConsoles();
  const leader = consoles.some((c) => c.console === "guests");
  const groups: NavGroup[] = [];
  if (leader) {
    const summary = await leaderSummary().catch(() => null);
    const unseen = summary?.counts.unseen ?? 0;
    groups.push({
      label: leaderOnly(consoles) ? null : "Local guests",
      items: [
        {
          id: "guests",
          label: "Guests",
          icon: "PersonPlus",
          board: "LeaderGuests",
          ...(unseen > 0 ? { chip: String(unseen) } : {}),
        },
        { id: "reports", label: "Reports", icon: "ChartColumn", board: "LeaderReports" },
      ],
    });
  }
  if (!leaderOnly(consoles)) {
    // The review queues as the officer persona lists them, without the sample counts. Only screens that
    // read real records: sample-data screens (delegated datasets, bodies and officers) and the bare case
    // route (a case opens from its queue) are left out.
    for (const g of navigationFor("officer")) {
      const items = g.items
        .filter((i) => i.board !== "OfficerCase" && (sampleCollectionsByBoard[i.board] ?? 0) === 0)
        .map(({ chip: _chip, alert: _alert, ...item }) => item);
      if (items.length > 0) groups.push({ ...g, items });
    }
  }
  return groups;
}

/**
 * The officer's own seat in the sidebar header, from real records: the place their first seat covers
 * ("Amajyambere village"), its institution, and the role ("Village leader"). The persona's sample
 * district and title are never shown to a real person.
 */
export async function officerPersona(persona: Persona): Promise<Persona> {
  const consoles = await officerConsoles();
  const first = consoles.find((c) => c.console === "guests") ?? consoles[0];
  if (!first || !persona.workspace) return persona;
  const [place, ...rest] = first.scopeLabel.split(", ");
  const role = isLeaderRole(first.oversightRole)
    ? LEADER_ROLE_SHORT[first.oversightRole]
    : OVERSIGHT_ROLE_LABEL[first.oversightRole];
  const others = consoles.length > 1 ? ` and ${consoles.length - 1} more` : "";
  const name = place ?? first.scopeLabel;
  return {
    ...persona,
    role,
    workspace: {
      ...persona.workspace,
      ini: name
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() ?? "")
        .join(""),
      name,
      meta: rest.join(", ") || (first.bodyName ?? first.bodyCode),
      sub: `${first.title ?? role}${others}`,
      role,
    },
  };
}
