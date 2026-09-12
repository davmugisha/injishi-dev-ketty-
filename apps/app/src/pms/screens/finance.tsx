"use client";

/**
 * Finance: four screens that were four questions short of one (ADR-018, AC-12).
 *
 * A host got `bills`, `payouts`, `invoices` and `revenue` as four siblings, and
 * "why is this month short" crosses all four and is answered by none of them.
 * The USALI story needs the opposite shape: one folio, charges carrying a
 * department, revenue rolling up to GOP. Four flat leaves cannot roll up to
 * anything.
 *
 * The residence side gets its own three, because a landlord asks the same
 * question about rent rather than about rooms, and because the portfolio half of
 * the old `compliance` leaf belongs here (the per lease half is the `filing`
 * lens on the lease itself, move 3).
 */

import type { DepartmentCategory } from "@injishi/contracts";

import { LensPage, type LensLink } from "../components/lens-page";
import { Placeholder } from "../components/placeholder";
import { Bills } from "./bills";
import { Revenue } from "./revenue";
import { useCapability, useWorkspaceId } from "../data/capability";
import { workspaceBase } from "../lib/nav";
import { navContextOf } from "../lib/nav-context";
import { usePms } from "../store";

/** The USALI categories a revenue charge can post to (`ledger-posting.ts`). */
const REVENUE_CATEGORIES: readonly DepartmentCategory[] = [
  "rooms",
  "fnb",
  "spa_recreation",
  "other_operated",
  "misc_income",
];

export function Finance({ lens }: { lens: string }) {
  const pms = usePms();
  const { state } = pms;
  const workspaceId = useWorkspaceId();
  const { can } = useCapability();
  const base = `${workspaceBase(workspaceId)}/finance`;
  const landlord = state.ws === "landlord";
  /*
   * How many revenue centres this property runs, from the GRANT. This used to
   * count `host.departments` — the demo fixture's list — so a made up property
   * decided whether a real hotel got a Revenue lens at all.
   */
  const revenueCentres = navContextOf(pms, workspaceId).departments.filter((d) =>
    REVENUE_CATEGORIES.includes(d),
  ).length;

  const lenses: LensLink[] = landlord
    ? [
        { key: "rent-ledger", label: "Rent ledger", href: base },
        { key: "payouts", label: "Payouts", href: `${base}/payouts` },
        { key: "filings", label: "Filings", href: `${base}/filings` },
      ]
    : [
        { key: "bills", label: "Bills", href: base },
        { key: "payouts", label: "Payouts", href: `${base}/payouts` },
        { key: "invoices", label: "Tax invoices", href: `${base}/invoices` },
        // Departmental revenue only earns its place once there are departments
        // to compare. A roll up with nothing to compare is noise, and that rule
        // predates the merge. It is also `money.view` only, the permission the
        // read itself is gated on, so the lens never opens onto a refusal.
        ...(revenueCentres >= 2 && can("money.view")
          ? [{ key: "revenue", label: "Revenue", href: `${base}/revenue` }]
          : []),
      ];

  return (
    <LensPage lenses={lenses} active={lens}>
      <Body lens={lens} landlord={landlord} />
    </LensPage>
  );
}

function Body({ lens, landlord }: { lens: string; landlord: boolean }) {
  switch (lens) {
    case "payouts":
      return <Placeholder screenKey="payouts" />;
    case "invoices":
      return <Placeholder screenKey="invoices" />;
    case "filings":
      return <Placeholder screenKey="filings" />;
    case "revenue":
      return <Revenue />;
    default:
      // The default lens is the one you open Finance to look at: what is owed
      // right now. Bills for a hotel, the rent ledger for a portfolio.
      return landlord ? <Placeholder screenKey="rent-ledger" /> : <Bills />;
  }
}
