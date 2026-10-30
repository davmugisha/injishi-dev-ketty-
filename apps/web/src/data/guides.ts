/**
 * Editorial guides.
 *
 * Shared by the home page's "Latest from Blog" strip, the /guides index, and
 * /guides/[slug]. Titles and photography come from the guides capture.
 *
 * Empty until a content source exists; see `GUIDES`.
 */

export interface GuideSection {
  heading: string;
  body: string;
}

export interface Guide {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  publishedAt: string;
  image: { stem: string; alt: string };
  sections: GuideSection[];
}

/**
 * None yet (2026-10-29). The six articles that stood here were fixture text
 * with invented publish dates, standing in for a content API that does not
 * exist; the site showed them as a blog. The home strip, `/guides`, the
 * district pages and the sitemap all read this list, so they show nothing
 * until real articles come from a content source.
 */
export const GUIDES: Guide[] = [];

const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** "1 Feb 2026" — the form the cards and article header show. */
export function formatPublishedAt(isoDate: string): string {
  return DATE_FORMAT.format(new Date(`${isoDate}T00:00:00Z`));
}

export function findGuide(slug: string): Guide | undefined {
  return GUIDES.find((guide) => guide.slug === slug);
}

/** Words an adult reads in a minute, the usual figure for a read-time label. */
const WORDS_PER_MINUTE = 200;

/**
 * How long the guide takes to read, counted from its own words.
 *
 * Each guide used to carry a hand-typed `readingMinutes` (5 to 9) over 80 to
 * 200 words of text, so "6 min read" sat above a page read in under one. A
 * figure computed from the text cannot overstate it.
 */
export function readingMinutes(guide: Guide): number {
  const words = [guide.title, guide.excerpt, ...guide.sections.flatMap((s) => [s.heading, s.body])]
    .join(" ")
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}
