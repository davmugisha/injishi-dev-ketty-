import type { Metadata } from "next";
import { AdminOverviewView } from "@/features/admin/overview/admin-overview-view";
import { requirePersona } from "@/lib/session";
import { brokerSubscriptions } from "@/server/admin/brokers";
import { leaderCoverage } from "@/server/admin/leaders";
import { auditLog, people } from "@/server/admin/people";
import { psfSummary } from "@/server/admin/psf";
import { adminRegistrations } from "@/server/admin/registrations";

export const metadata: Metadata = { title: "Admin · Overview" };

/** A read this staffer's role may not make leaves its tiles out rather than failing the page. */
const maybe = <T,>(read: Promise<T>): Promise<T | null> => read.catch(() => null);

/**
 * The staff overview (2026-11-09): what is waiting on someone across Injishi, each figure opening the list
 * it counts, with the latest changes from the audit log. Real records only, read from the admin API.
 */
export default async function AdminHomePage() {
  await requirePersona("AdminHome");
  const [orgs, accounts, psf, coverage, brokers, recent] = await Promise.all([
    maybe(adminRegistrations({ page: 1 })),
    maybe(people({ page: 1 })),
    maybe(psfSummary()),
    maybe(leaderCoverage()),
    maybe(brokerSubscriptions({ pageSize: 1 })),
    maybe(auditLog({ pageSize: 8 })),
  ]);
  return (
    <AdminOverviewView
      orgs={orgs ? { total: orgs.meta.total, stages: orgs.stageCounts ?? {} } : null}
      accounts={accounts ? { total: accounts.meta.total, statuses: accounts.statusCounts ?? {} } : null}
      psf={psf}
      coverage={
        coverage
          ? {
              gaps: coverage.uncovered.length,
              waiting: coverage.uncovered.reduce((n, g) => n + g.waitingReports, 0),
            }
          : null
      }
      brokers={brokers ? (brokers.statusCounts ?? {}) : null}
      recent={recent?.items ?? null}
    />
  );
}

export const dynamic = "force-dynamic";
