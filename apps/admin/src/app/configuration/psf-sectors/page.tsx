import { Shapes } from "lucide-react";

import { ConfigurationSubnav } from "@/components/configuration/configuration-subnav";
import { SectionFailure } from "@/components/failure/section-failure";
import { getPsfCatalogue } from "@/lib/api/configuration";
import { SectorCatalogue } from "./sector-catalogue";

export const metadata = { title: "PSF sectors" };

const PERMISSION = "admin.config.view";

/**
 * PSF's sector catalogue (the PSF path): the clusters, and the associations a
 * business of any sector names when it registers to join PSF. PSF's officers
 * filter their register by these, so the list is PSF's own, kept here.
 */
export default async function Page() {
  const result = await getPsfCatalogue();

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
                <Shapes className="h-6 w-6" aria-hidden />
              </span>
              <h1 className="font-display text-3xl font-bold">PSF sectors</h1>
            </div>
            <p className="mt-3 max-w-read text-sm leading-6 text-muted-foreground">
              The clusters PSF groups its members in, and the associations inside them. A business registering
              through the PSF tile picks one, and PSF&apos;s officers filter their register by it. Women, youth and
              disability (PSF&apos;s Specialized cluster) are not here: a business marks those as who owns it, in any
              sector.
            </p>
          </section>

          <div className="mt-6">
            <SectorCatalogue catalogue={result.data} />
          </div>
        </>
      )}
    </div>
  );
}
