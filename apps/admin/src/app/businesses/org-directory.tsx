"use client";

import { Input } from "@heroui/react";
import { Badge, Button } from "@injishi/ui";
import { Download } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { useStubAction } from "@/lib/store";
import type { OrgRow } from "@/lib/types";

import { orgHref } from "./lenses";

/**
 * One directory row: the presented view plus the id it lives at.
 *
 * The id rides ALONGSIDE the view type rather than inside it. `OrgRow` is a
 * presentation shape and an address is not a presentation decision; keeping
 * them apart is also what let the link stop being a slug of the legal name,
 * which quietly opened the wrong record whenever two businesses shared one.
 */
export interface OrgDirectoryRow {
  id: string;
  row: OrgRow;
}

/**
 * Org directory.
 *
 * THE SEARCH IS OVER THE LOADED PAGE, not the platform. `GET /admin/orgs`
 * accepts a `q` and filters server side; wiring this box to the URL so it does
 * is its own change. Until then the count line says how many of the total are
 * on screen, so nobody reads an empty filter result as "no such business".
 *
 * THE CLASSIFICATION COLUMN IS GONE. It rendered a second label table for the
 * accommodation and residence classes, kept in this file, beside a Type column
 * already carrying the same words from `presentOrgRow`. Two wordings of one
 * enum is a fact with two owners, and the two drift; `lib/present/orgs.ts` is
 * the owner.
 */
export function OrgDirectory({
  rows,
  total,
}: {
  rows: OrgDirectoryRow[];
  total: number;
}) {
  const [query, setQuery] = useState("");
  const stubAction = useStubAction();
  const q = query.trim().toLowerCase();
  const visible = q
    ? rows.filter(({ row }) =>
        [row.name, row.tin, row.district, row.type].some((v) =>
          v.toLowerCase().includes(q),
        ),
      )
    : rows;

  return (
    <section className="mt-8" aria-label="Org directory">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Org directory
        </h2>
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="org-search">
            Search orgs
          </label>
          <Input
            id="org-search"
            className="w-full !w-64"
            placeholder="Search name, TIN, district…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={stubAction(
              "CSV export — export of personal data is a logged, reason-gated event (F-A08)",
            )}
          >
            <Download className="h-4 w-4" aria-hidden /> CSV
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="mt-3 rounded-card border border-dashed border-border px-5 py-4 text-sm text-muted-foreground">
          No business has registered yet. The directory fills in as registrations
          arrive — this is an empty platform, not a failed read.
        </div>
      ) : (
        <>
          <div className="mt-3 scrollbar overflow-x-auto rounded-card border border-border bg-field">
            <table className="w-full min-w-[52rem] text-sm">
              <caption className="sr-only">All Property Orgs with verification state</caption>
              <thead>
                <tr className="border-b border-border text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <th className="p-4">Org</th>
                  <th className="p-4">Type</th>
                  <th className="p-4">TIN</th>
                  <th className="p-4">District</th>
                  <th className="p-4">Domain</th>
                  <th className="p-4">State</th>
                  <th className="p-4">Subscription</th>
                  <th className="p-4">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visible.map(({ id, row }) => (
                  <tr key={id}>
                    <td className="p-4 font-semibold">
                      {/* The directory is an index INTO the org, not the only
                          place it can be seen (ADR-018, move 3). */}
                      <Link href={orgHref(id)} className="hover:underline">
                        {row.name}
                      </Link>{" "}
                      {row.obo && <Badge variant="default">OBO</Badge>}
                    </td>
                    <td className="p-4 text-muted-foreground">{row.type}</td>
                    <td className="money p-4 text-xs">{row.tin}</td>
                    <td className="p-4">{row.district}</td>
                    <td className="p-4">
                      <Badge variant="accent">{row.domain}</Badge>
                    </td>
                    <td className="p-4">
                      <Badge variant={row.state.intent}>{row.state.text}</Badge>
                    </td>
                    <td className="p-4">
                      <Badge variant={row.subscription.intent}>{row.subscription.text}</Badge>
                    </td>
                    <td className="p-4 text-right">
                      <Button variant="ghost" size="sm" onClick={stubAction(row.action.stub)}>
                        {row.action.label}
                      </Button>
                    </td>
                  </tr>
                ))}
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-sm text-muted-foreground">
                      No business on this page matches “{query}”. The search covers
                      the {rows.length} rows loaded, not all {total}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Showing {visible.length} of {total} businesses.
          </p>
        </>
      )}
    </section>
  );
}
