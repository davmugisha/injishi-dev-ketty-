import type { AdminAnnouncement } from "@injishi/contracts";

import type { SectionRow } from "@/lib/types";

import { EMPTY, date, detail } from "./format";

/**
 * Announcements (F-A13).
 *
 * Two facts drive the colour and they are not the same one: whether it is
 * PUBLISHED, and whether it is SCHEDULED. A draft with a publish date in the
 * future is amber — it is going out, and nobody has to do anything, but
 * everybody should know it is coming. A draft with no date at all is neutral:
 * it is a note, and it will never reach anyone until somebody acts.
 *
 * `audience` crosses as `unknown` and is not rendered. The contract does not
 * pin its shape, and printing an object nobody can read next to "this is who
 * will receive it" would be worse than printing nothing.
 *
 * `bodyEn` and `bodyRw` are both shown when both exist, and the row says when
 * one is missing. An announcement that only exists in English is one half of
 * the country not being told.
 */
export function presentAnnouncement(item: AdminAnnouncement): SectionRow {
  const scheduled =
    item.state === "draft" &&
    item.publishAt !== null &&
    new Date(item.publishAt).getTime() > Date.now();

  return {
    ref: date(item.createdAt),
    subject: item.bodyEn ?? item.bodyRw ?? "empty announcement",
    context: detail(
      item.publishAt ? `publish ${date(item.publishAt)}` : "no publish date",
      !item.bodyRw && "no Kinyarwanda text",
      !item.bodyEn && "no English text",
    ),
    state: scheduled ? "scheduled" : item.state,
    intent:
      item.state === "published"
        ? "success"
        : scheduled
          ? "warning"
          : "default",
  };
}

/** How many are waiting to go out, for the section header. */
export function presentAnnouncementSummary(items: AdminAnnouncement[]): string {
  const drafts = items.filter((i) => i.state === "draft").length;
  const published = items.filter((i) => i.state === "published").length;
  if (items.length === 0) return EMPTY;
  return `${published} published · ${drafts} draft`;
}
