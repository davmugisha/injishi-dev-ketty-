import { BadgeCheck } from "lucide-react";

import { ConfigurationSubnav } from "@/components/configuration/configuration-subnav";
import { SectionFailure } from "@/components/failure/section-failure";
import { getPsfTiers } from "@/lib/api/configuration";
import { TierCatalogue } from "./tier-catalogue";

export const metadata = { title: "PSF membership tiers" };

const PERMISSION = "admin.config.view";

/**
 * The PSF membership tiers the apply form offers (ADR-056 AC-19): their
 * names, prices and benefits. PSF invoices the business itself; these are
 * what the form shows, and what an officer confirms against.
 */
export default async function Page() {
  const result = await getPsfTiers();

  return (
    <div className="mx-auto max-w-page px-4 py-6 sm:px-6">
      <div className="mb-6">
        <ConfigurationSubnav />
      </div>

      {!result.ok ? (
        <SectionFailure eyebrow="Platform · Configuration" reason={result.reason} permission={PERMISSION} />
      ) : (
        <>
          <section className="rounded-card border border-border bg-field p-6 sm:p-7">
            <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Platform · Configuration</p>
            <div className="mt-3 flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-card bg-primary text-primary-foreground">
                <BadgeCheck className="h-6 w-6" aria-hidden />
              </span>
              <h1 className="font-display text-3xl font-bold">PSF membership tiers</h1>
            </div>
            <p className="mt-3 max-w-read text-sm leading-6 text-muted-foreground">
              What a business can apply for when it joins the Private Sector Federation through Injishi. PSF
              invoices the business directly; these prices are what the form shows. An application already sent
              keeps the price it was shown, and a retired tier stays on every application and membership that
              names it.
            </p>
          </section>

          <div className="mt-6">
            <TierCatalogue tiers={result.data} />
          </div>
        </>
      )}
    </div>
  );
}
