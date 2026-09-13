import { Landmark } from "lucide-react";

import { ConfigurationSubnav } from "@/components/configuration/configuration-subnav";
import { SectionFailure } from "@/components/failure/section-failure";
import { listGovernmentBodies } from "@/lib/api/government-bodies";

import { BodyCatalogue } from "./body-catalogue";

export const metadata = { title: "Government bodies" };

/** The permission `GET /api/v1/admin/government-bodies` declares. */
const PERMISSION = "admin.config.view";

/**
 * Configuration → Government bodies (ADR-049, AC-G4, E5).
 *
 * The institutions an officer is appointed from (MINALOC, PSF, RRA and whatever
 * the platform adds). Before this screen the catalogue could only be changed over
 * HTTP, so adding a body meant a developer with a session cookie.
 *
 * READ by every staff role (`admin.config.view`), CHANGED only with
 * `admin.config.edit`, which `super_admin` alone holds; the write controls are
 * shown only to a staffer whose permissions from the server include it. A body is
 * retired rather than deleted, because appointments and officer decisions already
 * taken keep naming it.
 */
export default async function Page() {
  const result = await listGovernmentBodies();

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
            <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Platform · Configuration
            </p>
            <div className="mt-3 flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-card bg-primary text-primary-foreground">
                <Landmark className="h-6 w-6" aria-hidden />
              </span>
              <h1 className="font-display text-3xl font-bold">Government bodies</h1>
            </div>
            <p className="mt-3 max-w-read text-sm leading-6 text-muted-foreground">
              The institutions government officers are appointed from. A retired body is no
              longer offered for a new appointment; every appointment and decision that already
              names it keeps doing so. The code is permanent, the names can change.
            </p>
          </section>

          <div className="mt-6">
            <BodyCatalogue bodies={result.data} />
          </div>
        </>
      )}
    </div>
  );
}
