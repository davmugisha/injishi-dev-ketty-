import type { DepartmentCategory, OrgRole, Permission } from "@injishi/contracts";

import type { WorkspaceKey } from "../data/types";
import { allowedSegments, navFor, opensOnPhoneSurface, workspaceBase, type NavContext, type NavSection } from "./nav";

/**
 * Which screen a person opens on: a home for each role (ADR-069 D-f).
 *
 * THE ROLE CHOOSES WHICH DOOR IS SHOWN FIRST, AND NOTHING ELSE. The doors
 * themselves are the grant's (`navFor`), so the home is always one of them: an
 * accountant opens on Finance, an HR officer on People, the owner, the manager
 * and the desk on the Dashboard. Choosing the first screen by role is
 * presentation, ruled so by ADR-069 D-f rule 1 and the scope it gives ADR-053
 * AC-A1 ("nothing that decides what a person may open or see reads a role
 * name. Which of the doors they may open is shown first may").
 *
 * Rule 2 is the reason this resolves through the nav rather than returning the
 * table below as it stands: a business may shut a role's home under ADR-055
 * (an owner withdrew `money.view` from `finance`, say). The person then lands
 * on the first door their grant opens, in nav order, never on a refusal.
 */

/** The least of a grant this needs: the fields `/me/workspaces` carries. */
export interface HomeGrant {
  key: WorkspaceKey;
  workspaceId: string | null;
  /** Null in a broker workspace, which carries no org role. */
  role: OrgRole | null;
  permissions: readonly Permission[];
  departments: readonly DepartmentCategory[];
  psfCanManage?: boolean;
  /** The person's own staff file here, which opens My work (ADR-058). */
  employeeId?: string | null;
}

/**
 * The screen each role is shown first, per workspace kind (ADR-069 D-f and its
 * rule 5 for a residence business). `default` is everyone the row does not
 * name, and the role an older API might send that this build does not know.
 */
const HOME_SCREEN: Readonly<Record<WorkspaceKey, Partial<Record<OrgRole, string>> & { default: string }>> = {
  host: {
    owner: "/dashboard",
    manager: "/dashboard",
    receptionist: "/dashboard",
    finance: "/finance",
    hr: "/people",
    // The phone surface renders wherever it lands; Housekeeping is the
    // destination the Sidebar board puts first for this role.
    housekeeper: "/housekeeping",
    default: "/dashboard",
  },
  // A residence business: the rent ledger for the accountant, People for HR,
  // and every other role keeps the Rent roll.
  landlord: { finance: "/finance", hr: "/people", default: "/rent-roll" },
  broker: { default: "/directory" },
  // A PSF business (legacy: none is created since 2026-10-19) has one screen,
  // its PSF portal, for everyone who holds it.
  enterprise: { default: "/psf-membership" },
};

/** The nav this grant reaches, built the way the shell builds it. */
function sectionsOf(grant: HomeGrant): NavSection[] {
  const ctx: NavContext = {
    ws: grant.key,
    workspaceId: grant.workspaceId,
    permissions: grant.permissions,
    departments: grant.departments,
    psfManage: grant.psfCanManage === true,
    workFile: (grant.employeeId ?? null) !== null,
  };
  return navFor(ctx);
}

/** The screen segment of an address inside a workspace. */
function segmentIn(path: string): string | undefined {
  return path.split("/").filter(Boolean)[2];
}

/**
 * The address a grant opens on, inside its own workspace.
 *
 * `"/"` when the grant has no workspace id: that is not an address, and the
 * root resolver asks the API again rather than guessing.
 */
export function homeFor(grant: HomeGrant): string {
  const base = workspaceBase(grant.workspaceId);
  if (!base) return "/";

  const table = HOME_SCREEN[grant.key];
  const preferred = `${base}${(grant.role ? table[grant.role] : undefined) ?? table.default}`;

  // The phone surface replaces the shell on every route and has no route guard
  // of its own, so its home is simply the preferred address (rule 4).
  if (opensOnPhoneSurface({ ws: grant.key, permissions: grant.permissions })) {
    return `${base}${table.housekeeper ?? table.default}`;
  }

  const sections = sectionsOf(grant);
  const allowed = allowedSegments(sections);
  const segment = segmentIn(preferred);
  if (segment && allowed.has(segment)) return preferred;

  // Rule 2: the first door the grant opens, in the order the nav lists them,
  // the body before the footer.
  const ordered = [
    ...sections.filter((s) => s.placement !== "footer"),
    ...sections.filter((s) => s.placement === "footer"),
  ];
  const first = ordered.flatMap((s) => s.items)[0];
  // A grant that opens nothing at all still gets an address in its own
  // workspace; the shell says plainly that the screen is not theirs.
  return first?.href ?? preferred;
}

/**
 * The nav entry key of the home, for the sidebar, which lists it first (the
 * Sidebar board: "a role's sidebar: its home item first, then the rest in
 * group order"). Null when the home is not an entry of this nav.
 */
export function homeEntryKey(grant: HomeGrant, sections: NavSection[]): string | null {
  const home = homeFor(grant);
  for (const section of sections) {
    for (const item of section.items) {
      if (item.href === home) return item.key;
      if ((item.lenses ?? []).some((lens) => lens.href === home)) return item.key;
    }
  }
  return null;
}
