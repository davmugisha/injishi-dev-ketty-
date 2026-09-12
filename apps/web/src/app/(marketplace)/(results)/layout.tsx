import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

/**
 * The results chrome, which is now the SAME chrome every other marketplace
 * page wears: `SiteHeader` over `SiteFooter`.
 *
 * It used to be its own thing — `ExploreHeader` on a full-height navy field,
 * with the results arriving on a white sheet whose top corners tucked under
 * the band. That gave the site two menus. They carried different controls (the
 * navy one had a language switcher and a moon/sun button the site header
 * deliberately does not), sat at different heights (84px against 64px), and
 * drifted, which is the failure a second copy of anything always ends in. One
 * header now, so a guest crossing from `/` to `/explore` to `/property/[slug]`
 * sees one bar the whole way.
 *
 * `/explore` is registered in `WHITE_HEADER_ROUTES` (`data/navigation.ts`),
 * because this route opens on the breadcrumb and the search strip rather than
 * on a photographic hero: the white variant reserves the bar's height instead
 * of floating over it, and paints its content in ink rather than white.
 */
export default function ResultsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
    </>
  );
}
