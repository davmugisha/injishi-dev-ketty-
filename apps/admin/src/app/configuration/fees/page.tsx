import { Receipt } from "lucide-react";

import { ConfigurationSubnav } from "@/components/configuration/configuration-subnav";
import { SectionFailure } from "@/components/failure/section-failure";
import { getFeeSchedule } from "@/lib/api/configuration";
import {
  presentPlacementFeeStats,
  presentRegistrationFeeRow,
  presentSubscriptionPlan,
} from "@/lib/present/configuration";
import { FeeSchedule } from "./fee-schedule";

export const metadata = { title: "Registration fees" };

/** The permission `GET /api/v1/admin/configuration/fees` declares. */
const PERMISSION = "admin.fee.edit";

/**
 * Configuration → Fee schedule (F-A07 / F-A10).
 *
 * A page of its own rather than a fourth block on the Configuration overview:
 * this is the money schedule and it sits behind `admin.fee.edit`, a different
 * permission from the `admin.config.edit` that opens the flags. Changing what a
 * registration costs is not the same power as flipping a flag, so the console
 * does not offer them together.
 *
 * IT IS PRICED BY BUSINESS TYPE, not by accommodation class. The screen this
 * replaces said otherwise and priced ten hotel-and-guest-house tiles, which is
 * the control F-A10 asks for and is NOT what `registration_fees` holds: the
 * table is keyed `host` / `landlord` / `broker`, and the contract sends exactly
 * that. Wording it the old way here would have made the console describe a
 * pricing model the platform cannot charge.
 *
 * It renders inside the console's one door. `app/layout.tsx` wraps every route
 * in `AdminShell`, itself wrapped in `StaffBoundary`, so this screen is behind
 * the same staff check as Finance and adds no second entrance of its own.
 */
export default async function Page() {
  const result = await getFeeSchedule();

  return (
    <div className="mx-auto max-w-page px-4 py-6 sm:px-6">
      <div className="mb-6">
        <ConfigurationSubnav />
      </div>

      {!result.ok ? (
        <SectionFailure
          eyebrow="Platform · Configuration"
          reason={result.reason}
          permission={PERMISSION}
        />
      ) : (
        <>
          <section className="rounded-card border border-border bg-field p-6 sm:p-7">
            <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Platform · Configuration
            </p>
            <div className="mt-3 flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-card bg-primary text-primary-foreground">
                <Receipt className="h-6 w-6" aria-hidden />
              </span>
              <h1 className="font-display text-3xl font-bold">Fee schedule</h1>
            </div>
            <p className="mt-3 max-w-read text-sm leading-6 text-muted-foreground">
              What the platform charges: the one-time fee a business pays to
              register, the subscription plans it can hold afterwards, and the
              placement fees brokers have earned. Amounts are effective-dated, so
              a superseded row stays beside the one that replaced it.
            </p>
          </section>

          <div className="mt-6">
            <FeeSchedule
              stats={presentPlacementFeeStats(result.data)}
              fees={result.data.registrationFees.map(presentRegistrationFeeRow)}
              plans={result.data.subscriptionPlans.map(presentSubscriptionPlan)}
            />
          </div>
        </>
      )}
    </div>
  );
}
