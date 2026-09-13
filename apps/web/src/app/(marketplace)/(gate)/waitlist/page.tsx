import type { Metadata } from "next";
import {
  WaitlistAudiences,
  WaitlistClosing,
  WaitlistDistricts,
  WaitlistFaq,
  WaitlistHero,
} from "@/components/waitlist/waitlist-bands";
import { WAITLIST_META } from "@/data/waitlist-content";

/**
 * `/waitlist` — what `www.injishi.com` serves before launch (ADR-048).
 *
 * The page is PUBLIC and stays public on every host. The middleware gate sends
 * strangers here on the two production hosts; on a laptop, on staging and on
 * the demo host it is simply a page you can visit, which is the only way this
 * feature is developable at all given the gate itself never runs there.
 *
 * `robots.ts` allows this path and disallows everything else while the gate is
 * up, and `sitemap.ts` names this path and nothing else. Both are net new to
 * this app, and both are REPLACED at launch rather than deleted: removing the
 * files would start launch day with no search presence at all.
 */
export const metadata: Metadata = {
  // `absolute`, because copy.md fixes the whole title and the site layout's
  // template would otherwise append "| Injishi" to a title that already leads
  // with the name.
  title: { absolute: WAITLIST_META.title },
  description: WAITLIST_META.description,
  alternates: { canonical: "/waitlist" },
  // The card is the committed `public/waitlist/og.jpg` (copy.md §11), a 1200
  // by 630 crop of the hero photograph. A typed stand-in route used to draw it
  // while no photograph existed; that route is gone, so the two paths below
  // are the only Open Graph image this page has. Relative, resolved against
  // the marketplace layout's `metadataBase`.
  openGraph: {
    title: WAITLIST_META.ogTitle,
    description: WAITLIST_META.ogDescription,
    url: "/waitlist",
    type: "website",
    images: [
      {
        url: "/waitlist/og.jpg",
        width: 1200,
        height: 630,
        alt: WAITLIST_META.ogTitle,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: WAITLIST_META.ogTitle,
    description: WAITLIST_META.ogDescription,
    images: ["/waitlist/og.jpg"],
  },
};

export default function WaitlistPage() {
  return (
    <>
      <WaitlistHero />
      <WaitlistAudiences />
      <WaitlistDistricts />
      <WaitlistFaq />
      <WaitlistClosing />
    </>
  );
}
