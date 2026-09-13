import { Settings } from "lucide-react";

import { Badge } from "@injishi/ui";
import { ConfigurationSubnav } from "@/components/configuration/configuration-subnav";
import { SectionFailure } from "@/components/failure/section-failure";
import { getConfiguration } from "@/lib/api/configuration";
import {
  presentConfigEntry,
  presentFeatureFlag,
} from "@/lib/present/configuration";
import { count } from "@/lib/present/format";

export const metadata = { title: "Configuration" };

/** The permission `GET /api/v1/admin/configuration` declares. */
const PERMISSION = "admin.config.view";

/**
 * Configuration (F-A07) — versioned entries and feature flags, from the API.
 *
 * The subnav sits above the content rather than inside a shared layout: the
 * fees editor is one level deeper, the sidebar links only `/configuration`, and
 * without this row that screen would exist and be unreachable.
 *
 * A flag's `value` is NOT rendered, here or in `present/configuration.ts`. It
 * crosses as `unknown` because the contract does not pin its shape, and a flag
 * printed as `[object Object]` is worse than one showing only its key, scope
 * and version — which are the three things this response can prove.
 *
 * Both lists are read behind `admin.config.view` (ADR-053), which every staff
 * role holds; they used to borrow `admin.config.edit` because no view
 * permission existed, so only a Super Admin could look.
 */
export default async function Page() {
  const result = await getConfiguration();

  if (!result.ok) {
    return (
      <>
        <div className="mx-auto max-w-page px-4 pt-6 sm:px-6">
          <ConfigurationSubnav />
        </div>
        <div className="mx-auto max-w-page px-4 py-6 sm:px-6">
          <SectionFailure reason={result.reason} permission={PERMISSION} />
        </div>
      </>
    );
  }

  const data = result.data;
  const entries = data.entries.map(presentConfigEntry);
  const flags = data.flags.map(presentFeatureFlag);

  return (
    <>
      <div className="mx-auto max-w-page px-4 pt-6 sm:px-6">
        <ConfigurationSubnav />
      </div>

      <div className="mx-auto max-w-page px-4 py-6 sm:px-6">
        <section className="rounded-card border border-border bg-field p-6 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="max-w-wide">
              <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Platform
              </p>
              <div className="mt-3 flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-card bg-primary text-primary-foreground">
                  <Settings className="h-6 w-6" aria-hidden />
                </span>
                <h1 className="font-display text-3xl font-bold">
                  Configuration
                </h1>
              </div>
              <p className="mt-3 max-w-read text-sm leading-6 text-muted-foreground">
                Effective-dated platform settings and feature flags. Every entry
                is versioned rather than rewritten, so an amount already charged
                or a rule already applied stays visible after it is superseded.
              </p>
            </div>
            <div className="min-w-[16rem] rounded-card bg-card p-4 text-card-foreground">
              <p className="text-xs font-bold uppercase tracking-wider text-card-foreground/60">
                Config entries
              </p>
              <p className="figure mt-1 text-4xl font-bold">
                {count(data.entries.length)}
              </p>
              <p className="mt-2">
                <Badge variant="default">
                  {count(data.flags.length)} feature flags
                </Badge>
              </p>
            </div>
          </div>
        </section>

        <section className="mt-8" aria-label="Config entries">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Config entries
          </h2>
          {entries.length === 0 ? (
            <div className="mt-3 rounded-card border border-dashed border-border p-6">
              <p className="text-sm font-semibold">
                No config entry has been written yet
              </p>
              <p className="mt-1 max-w-read text-sm leading-6 text-muted-foreground">
                The platform is running on its built-in defaults. An entry
                appears here the first time somebody overrides one, and it is
                written as a new effective-dated version rather than replacing
                what is there.
              </p>
            </div>
          ) : (
            <div className="mt-3 scrollbar overflow-x-auto rounded-card border border-border bg-field">
              <table className="w-full min-w-[46rem] text-sm">
                <caption className="sr-only">
                  Versioned config entries and whether each can be changed back
                </caption>
                <thead>
                  <tr className="border-b border-border text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    <th className="p-4">Version</th>
                    <th className="p-4">Setting</th>
                    <th className="p-4">In force</th>
                    <th className="p-4">Reversibility</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {entries.map((row, index) => (
                    // Keyed by the source row's id: `ref` on the presentation
                    // shape is a version number, which repeats across settings.
                    <tr key={data.entries[index]!.id}>
                      <td className="money p-4 text-xs font-semibold">
                        {row.ref}
                      </td>
                      <td className="p-4">{row.subject}</td>
                      <td className="p-4 text-muted-foreground">
                        {row.context}
                      </td>
                      <td className="p-4">
                        <Badge variant={row.intent}>{row.state}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="mt-8" aria-label="Feature flags">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Feature flags
          </h2>
          {flags.length === 0 ? (
            <div className="mt-3 rounded-card border border-dashed border-border p-6">
              <p className="text-sm font-semibold">No feature flag is set</p>
              <p className="mt-1 max-w-read text-sm leading-6 text-muted-foreground">
                Every district is running the same software. A flag appears here
                only once one has been created, so an empty list is the simplest
                state this screen can report rather than a missing answer.
              </p>
            </div>
          ) : (
            <div className="mt-3 scrollbar overflow-x-auto rounded-card border border-border bg-field">
              <table className="w-full min-w-[46rem] text-sm">
                <caption className="sr-only">
                  Feature flags, where each applies and from when
                </caption>
                <thead>
                  <tr className="border-b border-border text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    <th className="p-4">Version</th>
                    <th className="p-4">Flag</th>
                    <th className="p-4">Applies</th>
                    <th className="p-4">Scope</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {flags.map((row, index) => (
                    <tr key={data.flags[index]!.id}>
                      <td className="money p-4 text-xs font-semibold">
                        {row.ref}
                      </td>
                      <td className="money p-4">{row.subject}</td>
                      <td className="p-4 text-muted-foreground">
                        {row.context}
                      </td>
                      <td className="p-4">
                        <Badge variant={row.intent}>{row.state}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
