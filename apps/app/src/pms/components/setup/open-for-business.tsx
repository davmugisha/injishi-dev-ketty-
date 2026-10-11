"use client";

/**
 * "You are open for business": the four things that make a newly live
 * property's first week go smoothly (Onboarding board).
 *
 * EACH TICK IS READ, NEVER PRESSED. The board's prototype ticks a task when its
 * button is pressed; here a task is done when the database says so: a staff
 * member or a standing invitation, an EBM account the provider reports as
 * connected, the owner's identity check, a booking on the desk. Where this
 * deployment cannot do the thing at all (EBM in mock mode), or the app has no
 * screen for it yet (identity verification), the row says that instead of
 * offering a button that leads nowhere.
 *
 * Every read here is gated by the permission its route declares, so a caller
 * without it is told why rather than sent a 403 that would invalidate the grant.
 */

import { Button } from "@injishi/ui";
import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { useCapability } from "../../data/capability";
import { useEbmConnection } from "../../data/ebm";
import { useLeases } from "../../data/ops";
import { useReservations } from "../../data/reservations";
import { useOwnIdentity } from "../../data/setup";

const COUNT_WORD: Readonly<Record<number, string>> = { 2: "Two", 3: "Three", 4: "Four" };

export interface FirstWeekTask {
  key: "team" | "ebm" | "identity" | "first";
  title: string;
  body: string;
  done: boolean;
  /** The screen that does it, when this app has one and the caller may use it. */
  action: { label: string; href: string } | null;
  /** Why there is no action, or what the read answered, in a short line. */
  note: string | null;
}

/**
 * The first-week list, from live reads. Asked only once the listing is live
 * (`enabled`): before that there is no first week to count.
 */
export function useFirstWeek({
  workspaceId,
  base,
  residence,
  staffCount,
  staffHref,
  enabled,
}: {
  workspaceId: string | null;
  base: string;
  residence: boolean;
  /** `PropertySetupCounts.staff`: active members and standing invitations. */
  staffCount: number;
  staffHref: string;
  enabled: boolean;
}): FirstWeekTask[] {
  const { can, reasonFor } = useCapability();
  const ws = enabled ? workspaceId : null;
  const mayEbm = can("ebm.manage");
  const ebm = useEbmConnection(ws, enabled && mayEbm && !residence);
  const identity = useOwnIdentity(ws, enabled);
  const reservations = useReservations(residence ? null : ws);
  const leases = useLeases(residence ? ws : null);

  const tasks: FirstWeekTask[] = [
    {
      key: "team",
      title: "Invite your team",
      body: residence
        ? "A property manager lands on the rent roll, with the role that decides what they can do."
        : "Each person lands on the home for their role: the front desk on today's arrivals, housekeeping on the rooms to clean.",
      done: staffCount > 0,
      action: can("team.manage") ? { label: "Invite", href: staffHref } : null,
      note: can("team.manage") ? null : (reasonFor("team.manage") ?? null),
    },
  ];

  if (!residence) {
    const conn = ebm.data;
    const live = conn?.mode === "live";
    tasks.push({
      key: "ebm",
      title: "Connect your EBM account",
      body: "Every sale is declared to RRA when a bill closes. Connect once, and the receipts are certified as folios close.",
      done: Boolean(conn && live && conn.status === "connected"),
      action:
        mayEbm && conn && live && conn.status !== "connected"
          ? { label: "Connect EBM", href: `${base}/settings/integrations` }
          : null,
      note: !mayEbm
        ? (reasonFor("ebm.manage") ?? null)
        : ebm.isError
          ? "We couldn't check the EBM connection just now."
          : !conn
            ? "Checking the EBM connection."
            : !live
              ? "This environment does not certify sales with RRA, so there is no account to connect here."
              : conn.status === "connected"
                ? `Connected${conn.accountName ? ` as ${conn.accountName}` : ""}.`
                : null,
    });
  }

  const kyc = identity.data?.kycStatus;
  tasks.push({
    key: "identity",
    title: "Verify your identity for payouts",
    body: "Injishi pays marketplace bookings to your bank once your national ID is verified.",
    done: kyc === "verified",
    action: null,
    note: identity.isError
      ? "We couldn't check your identity just now."
      : kyc === undefined
        ? "Checking your identity."
        : kyc === "verified"
          ? "Your identity is verified."
          : kyc === "pending"
            ? "Your national ID is being checked."
            : kyc === "rejected"
              ? "Your identity check was not accepted. Verifying again is not available from this app yet."
              : "Not verified yet. Verifying is not available from this app yet.",
  });

  if (residence) {
    const count = leases.data?.leases.length;
    tasks.push({
      key: "first",
      title: "Sign your first lease",
      body: "Add a tenant's lease, or wait for the first enquiry from the marketplace.",
      done: (count ?? 0) > 0,
      action: { label: "Open leases", href: `${base}/leases` },
      note: null,
    });
  } else {
    const count = reservations.data?.reservations.length;
    tasks.push({
      key: "first",
      title: "Take your first booking",
      body: "Add a phone or walk-in booking, or wait for the first one from the marketplace.",
      done: (count ?? 0) > 0,
      action: can("reservation.approve") ? { label: "Open reservations", href: `${base}/reservations` } : null,
      note: null,
    });
  }

  return tasks;
}

export function OpenForBusiness({
  name,
  residence,
  tasks,
  homeHref,
}: {
  name: string;
  residence: boolean;
  tasks: readonly FirstWeekTask[];
  homeHref: string;
}) {
  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-2.5 rounded-card border border-panel-bd bg-card p-6">
        <span className="self-start rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-semibold text-success-soft-foreground">
          Live on Injishi
        </span>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">You are open for business</h2>
        <p className="text-base text-muted-foreground">
          {name} is {residence ? "listed for tenants and brokers" : "bookable"} now.{" "}
          {COUNT_WORD[tasks.length] ?? String(tasks.length)} things make the first week go
          smoothly.
        </p>
      </section>

      <ol className="m-0 list-none overflow-hidden rounded-card border border-panel-bd bg-card p-0" aria-label="Your first week">
        {tasks.map((t, i) => (
          <li
            key={t.key}
            data-first-week={t.key}
            data-done={t.done ? "true" : "false"}
            className={cn("flex flex-wrap items-center gap-x-4 gap-y-2.5 px-5 py-4", i > 0 && "border-t border-line")}
          >
            <span
              aria-hidden="true"
              className={cn(
                "pms-num flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                t.done ? "bg-primary text-primary-foreground" : "bg-default text-muted-foreground",
              )}
            >
              {t.done ? <Check className="size-4" strokeWidth={3} /> : i + 1}
            </span>
            <div className="flex min-w-0 flex-1 basis-64 flex-col gap-0.5">
              <span className="text-base font-semibold text-foreground">
                {t.title}
                {t.done && <span className="sr-only"> (done)</span>}
              </span>
              <span className="text-sm text-muted-foreground">{t.body}</span>
              {t.note && <span className="text-xs font-medium text-muted-foreground">{t.note}</span>}
            </div>
            {!t.done && t.action && (
              <Button asChild variant="primary" size="sm">
                <Link href={t.action.href}>{t.action.label}</Link>
              </Button>
            )}
          </li>
        ))}
      </ol>

      <Button asChild variant="primary" className="self-start gap-1.5">
        <Link href={homeHref}>
          Go to your dashboard
          <ArrowRight aria-hidden="true" className="size-4" strokeWidth={2} />
        </Link>
      </Button>
    </div>
  );
}
