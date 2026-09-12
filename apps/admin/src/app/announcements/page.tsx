import { Megaphone } from "lucide-react";

import { Badge } from "@injishi/ui";
import { SectionFailure } from "@/components/failure/section-failure";
import { listAnnouncements } from "@/lib/api/announcements";
import {
  presentAnnouncement,
  presentAnnouncementSummary,
} from "@/lib/present/announcements";
import { count } from "@/lib/present/format";

export const metadata = { title: "Announcements" };

/** The permission `GET /api/v1/admin/announcements` declares. */
const PERMISSION = "admin.announcement.publish";

/**
 * Announcements (F-A13) — drafts and published notices, from the API.
 *
 * Drafts and published notices arrive in ONE list separated by `state`, and
 * they are rendered in one table for the same reason the contract sends them
 * that way: two screens is how the same notice gets published twice.
 *
 * `audience` is not rendered anywhere on this page. It crosses as `unknown` —
 * a stored targeting expression whose shape the contract deliberately does not
 * pin down — and printing an object nobody can read beside the words "this is
 * who will receive it" would be worse than printing nothing.
 */
export default async function Page() {
  const result = await listAnnouncements();

  if (!result.ok) {
    return (
      <div className="mx-auto max-w-page px-4 py-6 sm:px-6">
        <SectionFailure reason={result.reason} permission={PERMISSION} />
      </div>
    );
  }

  const { items, meta } = result.data;
  const rows = items.map(presentAnnouncement);

  return (
    <div className="mx-auto max-w-page px-4 py-6 sm:px-6">
      <section className="rounded-card border border-border bg-field p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-wide">
            <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Platform
            </p>
            <div className="mt-3 flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-card bg-primary text-primary-foreground">
                <Megaphone className="h-6 w-6" aria-hidden />
              </span>
              <h1 className="font-display text-3xl font-bold">Announcements</h1>
            </div>
            <p className="mt-3 max-w-read text-sm leading-6 text-muted-foreground">
              Role, workspace and district-targeted notices, in English and
              Kinyarwanda. A notice that exists in one language only is half the
              country not being told, so the list says which half is missing.
            </p>
          </div>
          <div className="min-w-[16rem] rounded-card bg-card p-4 text-card-foreground">
            <p className="text-xs font-bold uppercase tracking-wider text-card-foreground/60">
              Notices
            </p>
            <p className="figure mt-1 text-4xl font-bold">{count(meta.total)}</p>
            <p className="mt-2">
              <Badge variant="default">
                {items.length === 0
                  ? "none written yet"
                  : presentAnnouncementSummary(items)}
              </Badge>
            </p>
          </div>
        </div>
      </section>

      <section className="mt-8" aria-label="Announcements">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Drafts and published notices
        </h2>
        {rows.length === 0 ? (
          <div className="mt-3 rounded-card border border-dashed border-border p-6">
            <p className="text-sm font-semibold">
              No announcement has been written yet
            </p>
            <p className="mt-1 max-w-read text-sm leading-6 text-muted-foreground">
              Nothing has been drafted or published on this platform. An empty
              list here means nobody has had anything to say, not that the list
              failed to load.
            </p>
          </div>
        ) : (
          <div className="mt-3 scrollbar overflow-x-auto rounded-card border border-border bg-field">
            <table className="w-full min-w-[46rem] text-sm">
              <caption className="sr-only">
                Every announcement, draft and published, with the language it is
                missing
              </caption>
              <thead>
                <tr className="border-b border-border text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <th className="p-4">Created</th>
                  <th className="p-4">Notice</th>
                  <th className="p-4">Publishing</th>
                  <th className="p-4">State</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row, index) => (
                  // Keyed by the source row's id rather than anything on the
                  // presentation shape: `ref` there is a created date, and two
                  // notices written on one day are not one notice.
                  <tr key={items[index]!.id}>
                    <td className="money p-4 text-xs font-semibold">
                      {row.ref}
                    </td>
                    <td className="p-4">{row.subject}</td>
                    <td className="p-4 text-muted-foreground">{row.context}</td>
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
  );
}
