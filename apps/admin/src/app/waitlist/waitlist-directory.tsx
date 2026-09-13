"use client";

import {
  WAITLIST_PROPERTY_TYPE_LABEL,
  WAITLIST_SIZE_BAND_LABEL,
  type AdminWaitlistRow,
  type District,
  type WaitlistAudience,
} from "@injishi/contracts";
import { Badge, Button } from "@injishi/ui";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition, type ReactNode } from "react";

import { markInvited } from "@/lib/actions/waitlist";
import { count } from "@/lib/present/format";
import { useAdminUi } from "@/lib/store";

/** What the URL asked for, already cleaned by the page. */
export interface WaitlistView {
  audience?: WaitlistAudience;
  districtId?: number;
  page: number;
}

/**
 * The waitlist directory (ADR-048 AC-17).
 *
 * A CLIENT COMPONENT because the filters navigate and the invite button is
 * stateful. The rows are read on the server for exactly the view in the URL.
 *
 * THE FILTERS AND THE PAGE ARE THE URL. Changing a filter navigates to the new
 * query and starts again at page one; the server component reads it and the API
 * filters and pages the whole table. So the count under the table is the count
 * of everybody matching, never of whoever happened to be loaded.
 *
 * THE EXPORT IS A PLAIN LINK to the API, not a Server Action. A download has to
 * arrive as a response the browser can save, and an action returns a value to
 * React instead. A top-level navigation carries the session cookie, so the
 * staffer downloads it as themselves and `StaffGuard` refuses anybody else,
 * which is also what makes the log line on the API name the right person. It
 * carries both filters, so the file holds exactly the people the table is
 * filtered to, on every page at once.
 */
export function WaitlistDirectory({
  rows,
  total,
  view,
  pageSize,
  districts,
  apiBaseUrl,
}: {
  rows: AdminWaitlistRow[];
  total: number;
  view: WaitlistView;
  pageSize: number;
  districts: District[];
  apiBaseUrl: string;
}) {
  const router = useRouter();
  const [navigating, startNavigation] = useTransition();
  const [inviting, startInvite] = useTransition();
  const toast = useAdminUi((s) => s.toast);

  const filtered = view.audience !== undefined || view.districtId !== undefined;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (view.page - 1) * pageSize + 1;
  const last = Math.min(view.page * pageSize, total);
  const pastTheEnd = total > 0 && rows.length === 0;

  const districtOptions = sortedDistricts(districts, view.districtId);

  const exportQuery = queryString({ audience: view.audience, districtId: view.districtId });
  const exportHref = `${apiBaseUrl}/api/v1/admin/waitlist/export${exportQuery}`;

  function go(next: WaitlistView) {
    startNavigation(() => {
      router.push(`/waitlist${urlQuery(next)}`);
    });
  }

  function invite(row: AdminWaitlistRow) {
    startInvite(async () => {
      const out = await markInvited(row.id);
      toast(`${row.email}: ${out.message}`, out.tone);
    });
  }

  return (
    <section className="mt-8" aria-label="Waitlist" aria-busy={navigating}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Filter
            label="Audience"
            value={view.audience ?? "all"}
            disabled={navigating}
            onChange={(value) =>
              go({
                ...view,
                audience: value === "all" ? undefined : (value as WaitlistAudience),
                page: 1,
              })
            }
            options={[
              { value: "all", label: "Everyone" },
              { value: "traveller", label: "Travellers" },
              { value: "owner", label: "Property owners" },
            ]}
          />
          <Filter
            label="District"
            value={view.districtId === undefined ? "all" : String(view.districtId)}
            disabled={navigating}
            onChange={(value) =>
              go({ ...view, districtId: value === "all" ? undefined : Number(value), page: 1 })
            }
            options={[
              { value: "all", label: "Every district" },
              ...districtOptions.map((d) => ({ value: String(d.id), label: d.name })),
            ]}
          />
          {filtered ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={navigating}
              onClick={() => go({ page: 1 })}
            >
              Clear filters
            </Button>
          ) : null}
        </div>

        {/* Not a Server Action: see the header. `rel="noopener"` because this
            leaves the console's origin for the API's. */}
        <Button asChild variant="outline" size="sm">
          <a href={exportHref} rel="noopener">
            <Download className="size-4" aria-hidden />{" "}
            {filtered ? "CSV of this filter" : "CSV"}
          </a>
        </Button>
      </div>

      <div className="mt-3 overflow-x-auto rounded-card border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-field text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="p-4">Joined</th>
              <th className="p-4">Who</th>
              <th className="p-4">Contact</th>
              <th className="p-4">Property</th>
              <th className="p-4">District</th>
              <th className="p-4">State</th>
              <th className="p-4">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="p-4 text-muted-foreground">
                  {row.createdAt.slice(0, 10)}
                </td>
                <td className="p-4 font-semibold">{row.fullName}</td>
                <td className="p-4">
                  <span className="block">{row.email}</span>
                  {row.phone ? (
                    <span className="block text-xs text-muted-foreground">
                      {row.phone}
                    </span>
                  ) : null}
                </td>
                <td className="p-4">
                  {row.businessName ? (
                    <>
                      <span className="block">{row.businessName}</span>
                      <span className="block text-xs text-muted-foreground">
                        {row.propertyType
                          ? WAITLIST_PROPERTY_TYPE_LABEL[row.propertyType]
                          : null}
                        {row.sizeBand
                          ? ` · ${WAITLIST_SIZE_BAND_LABEL[row.sizeBand]} rooms`
                          : null}
                      </span>
                    </>
                  ) : (
                    <Badge variant="default">Traveller</Badge>
                  )}
                </td>
                <td className="p-4">{row.districtName ?? "—"}</td>
                <td className="p-4">
                  <State row={row} />
                </td>
                <td className="p-4 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={inviting || !!row.invitedAt || !!row.unsubscribedAt}
                    onClick={() => invite(row)}
                  >
                    {row.invitedAt ? "Invited" : "Mark invited"}
                  </Button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="p-6 text-center text-sm text-muted-foreground"
                >
                  <EmptyState
                    filtered={filtered}
                    pastTheEnd={pastTheEnd}
                    onFirstPage={() => go({ ...view, page: 1 })}
                    onClear={() => go({ page: 1 })}
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {total === 0
            ? filtered
              ? "Nobody matches this filter."
              : "Nobody has joined yet."
            : `Showing ${count(first)} to ${count(last)} of ${count(total)} ${
                filtered ? "matching " : ""
              }signups. Exporting writes a log line naming you, the action and the time.`}
        </p>

        {pages > 1 ? (
          <nav aria-label="Waitlist pages" className="flex items-center gap-2">
            <PageLink
              label="Previous page"
              disabled={view.page <= 1 || navigating}
              href={`/waitlist${urlQuery({ ...view, page: view.page - 1 })}`}
            >
              <ChevronLeft className="size-4" aria-hidden /> Previous
            </PageLink>
            <span className="text-xs text-muted-foreground">
              Page {count(Math.min(view.page, pages))} of {count(pages)}
            </span>
            <PageLink
              label="Next page"
              disabled={view.page >= pages || navigating}
              href={`/waitlist${urlQuery({ ...view, page: view.page + 1 })}`}
            >
              Next <ChevronRight className="size-4" aria-hidden />
            </PageLink>
          </nav>
        ) : null}
      </div>
    </section>
  );
}

/**
 * Why the table is empty, said plainly, with the one action that helps.
 */
function EmptyState({
  filtered,
  pastTheEnd,
  onFirstPage,
  onClear,
}: {
  filtered: boolean;
  pastTheEnd: boolean;
  onFirstPage: () => void;
  onClear: () => void;
}) {
  if (pastTheEnd) {
    return (
      <span>
        This page is past the end of the list.{" "}
        <Button variant="link" size="sm" onClick={onFirstPage}>
          Go to the first page
        </Button>
      </span>
    );
  }
  if (filtered) {
    return (
      <span>
        Nobody on the waitlist matches this filter.{" "}
        <Button variant="link" size="sm" onClick={onClear}>
          Clear filters
        </Button>
      </span>
    );
  }
  return <span>Nobody has joined the waitlist yet.</span>;
}

/**
 * Somebody who has unsubscribed is shown as such and is NOT shown as invitable,
 * because inviting them would mean mailing somebody who asked not to be mailed.
 */
function State({ row }: { row: AdminWaitlistRow }) {
  if (row.unsubscribedAt) return <Badge variant="danger">Unsubscribed</Badge>;
  if (row.invitedAt) return <Badge variant="success">Invited</Badge>;
  return <Badge variant="default">Joined</Badge>;
}

function Filter({
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      {label}
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="rounded border border-border bg-field px-2 py-1 text-sm text-foreground"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * A page link that stays in the tab order as a disabled button at either end,
 * so keyboard and screen reader users hear that there is no further page rather
 * than the control silently vanishing.
 */
function PageLink({
  href,
  label,
  disabled,
  children,
}: {
  href: string;
  label: string;
  disabled: boolean;
  children: ReactNode;
}) {
  if (disabled) {
    return (
      <Button variant="outline" size="sm" disabled aria-label={label}>
        {children}
      </Button>
    );
  }
  return (
    <Button asChild variant="outline" size="sm">
      <Link href={href} aria-label={label}>
        {children}
      </Link>
    </Button>
  );
}

/**
 * Every district by name, plus the one in the URL if the geography read did not
 * answer, so an active filter never renders as "Every district".
 */
function sortedDistricts(districts: District[], selected: number | undefined): { id: number; name: string }[] {
  const list = [...districts].sort((a, b) => a.name.localeCompare(b.name));
  if (selected !== undefined && !list.some((d) => d.id === selected)) {
    list.unshift({ id: selected, name: `District ${selected}`, provinceId: 0 });
  }
  return list;
}

/** The console URL for a view. Page one is left out so the plain URL stays plain. */
function urlQuery(view: WaitlistView): string {
  const params = new URLSearchParams();
  if (view.audience) params.set("audience", view.audience);
  if (view.districtId !== undefined) params.set("district", String(view.districtId));
  if (view.page > 1) params.set("page", String(view.page));
  const query = params.toString();
  return query ? `?${query}` : "";
}

/** The API query for the export: the same filter, spelled the way the API reads it. */
function queryString(filter: { audience?: WaitlistAudience; districtId?: number }): string {
  const params = new URLSearchParams();
  if (filter.audience) params.set("audience", filter.audience);
  if (filter.districtId !== undefined) params.set("districtId", String(filter.districtId));
  const query = params.toString();
  return query ? `?${query}` : "";
}
