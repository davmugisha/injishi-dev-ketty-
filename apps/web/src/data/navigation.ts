/**
 * Site navigation.
 *
 * The prototype repeated these links as literal markup in the header, the
 * mobile drawer, and the footer of all eleven pages. They live here once.
 */
import { FEATURED_STAYS as FEATURED_PROPERTIES } from "@/data/featured-stays";

export interface NavLink {
  label: string;
  href: string;
}

export interface NavGroup {
  title: string;
  links: NavLink[];
}

/**
 * The three links in the middle of the site header.
 *
 * `/services` replaced `/support`, which is not orphaned — it is in
 * `FOOTER_LINKS` and in `MOBILE_NAV_GROUPS` under "COMPANY". Help is a thing
 * you go looking for; the bar's three slots name things you come here to do.
 *
 * **`/saved` IS GATED, and this is the one link here that is.** It is in
 * `PROTECTED_PREFIXES` in `middleware.ts`, so an anonymous visitor who presses
 * it lands on `/sign-in` rather than on a screen. That is a working flow — the
 * gate carries `?redirect=` straight back — but it means one of the three
 * always-visible links is a sign-in wall for everybody who has not signed in.
 * It is here on purpose; do not "fix" it by pointing it somewhere ungated, and
 * do not hide it for anonymous visitors either: the middle cluster would change
 * width the moment a session resolved, which is the jitter the header's own
 * `flex-1 basis-0` centring exists to prevent.
 */
export const PRIMARY_NAV: NavLink[] = [
  { label: "Explore", href: "/explore" },
  { label: "Saved", href: "/saved" },
  { label: "Services", href: "/services" },
];

/**
 * Footer stay links, derived from the featured properties.
 *
 * Written out by hand until now, which is how `virunga-view-lodge` and
 * `lake-kivu-breeze-hotel` came to sit in the footer of every page on the
 * site pointing at property records that did not exist.
 */
export const FEATURED_STAYS: NavLink[] = [
  ...FEATURED_PROPERTIES.slice(0, 4).map((stay) => ({
    label: `${stay.nameLead}${stay.nameRest ? ` ${stay.nameRest}` : ""}`,
    href: `/property/${stay.slug}`,
  })),
  { label: "Akagera", href: "/explore?district=nyagatare" },
];

export const POPULAR_DISTRICTS: NavLink[] = [
  { label: "Gasabo, Kigali", href: "/explore?district=kigali&sector=gasabo" },
  { label: "Kicukiro, Kigali", href: "/explore?district=kigali&sector=kicukiro" },
  { label: "Musanze", href: "/explore?district=musanze" },
  { label: "Rubavu", href: "/explore?district=rubavu" },
  { label: "Huye", href: "/explore?district=huye" },
];

export const PRODUCT_AND_COMPANY: NavLink[] = [
  { label: "About", href: "/about" },
  { label: "For hosts", href: "/explore" },
  { label: "How it works", href: "/services" },
  { label: "Blog", href: "/guides" },
  { label: "Reviews", href: "/explore" },
];

/** Footer columns, left to right. */
export const FOOTER_GROUPS: NavGroup[] = [
  { title: "FEATURED STAYS", links: FEATURED_STAYS },
  { title: "POPULAR DISTRICTS", links: POPULAR_DISTRICTS },
  { title: "PRODUCT & COMPANY", links: PRODUCT_AND_COMPANY },
];

/** The mobile drawer's two-column section grid. */
export const MOBILE_NAV_GROUPS: NavGroup[] = [
  { title: "FEATURED STAYS", links: FEATURED_STAYS },
  {
    title: "EXPLORE DISTRICTS",
    links: [
      { label: "Kigali", href: "/explore?district=kigali" },
      { label: "Musanze", href: "/explore?district=musanze" },
      { label: "Rubavu", href: "/explore?district=rubavu" },
    ],
  },
  {
    title: "HOW IT WORKS",
    links: [
      { label: "How it works", href: "/services" },
      { label: "Reviews", href: "/explore" },
    ],
  },
  {
    title: "COMPANY",
    links: [
      { label: "For hosts", href: "/explore" },
      { label: "About", href: "/about" },
      { label: "FAQ", href: "/support" },
    ],
  },
];

export const LEGAL_LINKS: NavLink[] = [
  { label: "Privacy Policy", href: "/legal/privacy" },
  { label: "Terms of Service", href: "/legal/terms" },
  { label: "Cookie Policy", href: "/legal/cookies" },
];

export const SOCIAL_LINKS = [
  {
    network: "facebook",
    href: "https://facebook.com/injishi",
    label: "Visit our facebook page",
  },
  {
    network: "instagram",
    href: "https://instagram.com/injishi",
    label: "Visit our instagram page",
  },
  {
    network: "twitter",
    href: "https://twitter.com/injishi",
    label: "Visit our twitter page",
  },
  {
    network: "linkedin",
    href: "https://linkedin.com/company/injishi",
    label: "Visit our linkedin page",
  },
  {
    network: "youtube",
    href: "https://youtube.com/@injishi",
    label: "Visit our youtube page",
  },
] as const;

/**
 * The footer's single link row, left to right.
 *
 * The footer used to carry three open columns, a help panel and two contact
 * rows. It is one centered row now, so the set is picked rather than derived:
 * the four pages a reader is most likely to want next, the three social
 * accounts, then the company and legal pages. The order is deliberate and
 * groups without printing group headings.
 *
 * Every href is a route that exists under `(marketplace)/(site)` or an
 * account in `SOCIAL_LINKS`. `FOOTER_GROUPS` above is what the old columns
 * read and is kept for the mobile drawer's sibling shape.
 */
export const FOOTER_LINKS: NavLink[] = [
  { label: "Explore", href: "/explore" },
  { label: "Guides", href: "/guides" },
  { label: "How it works", href: "/services" },
  { label: "Hosting", href: "/host" },
  { label: "Instagram", href: "https://instagram.com/injishi" },
  { label: "X", href: "https://twitter.com/injishi" },
  { label: "LinkedIn", href: "https://linkedin.com/company/injishi" },
  { label: "About", href: "/about" },
  { label: "Support", href: "/support" },
  { label: "Terms", href: "/legal/terms" },
  { label: "Privacy", href: "/legal/privacy" },
  { label: "Cookies", href: "/legal/cookies" },
];

export const CONTACT = {
  phone: "+250 784 530 000",
  phoneHref: "tel:+250784530000",
  whatsappHref: "https://api.whatsapp.com/send?phone=250784530000",
} as const;

/**
 * Header colour variant per route, matching the captures.
 *
 * Routes whose hero is photography carry the dark header (white content over
 * the image); routes that open on a white page carry the ink header. /explore
 * and /book appear in neither list — they ship their own chrome, so they live
 * outside the (site) route group entirely.
 *
 * The placeholder routes below open on the bare page background, with no hero
 * behind the bar. They were taking the dark variant, which paints the wordmark
 * and the nav white — invisible until 24px of scroll brought the navy bar in.
 * They belong with the other white-page routes.
 *
 * `/host` was on that list while it was a placeholder. It now opens on a
 * photographic hero, so it belongs with the dark-header routes — leaving it
 * here would reserve 124px of white above the image and paint ink content over
 * the photograph. `/host/start` is still a white page and stays, listed
 * explicitly: the matcher below treats a route as a prefix, so naming the child
 * rather than the parent is what splits them.
 */
const WHITE_HEADER_ROUTES = [
  "/saved",
  // `/explore` wore its own header on a navy band until the site was cut down
  // to ONE menu. It opens on a breadcrumb and the search strip, never on a
  // photograph, so it belongs with the white-page routes: the bar reserves its
  // own height rather than floating, and paints ink rather than white.
  "/explore",
  "/guides",
  "/support",
  "/host/start",
  "/sign-in",
  "/trips",
  "/legal",
  // The property page opened with a full-bleed photographic hero and so took
  // the dark variant. It now opens with the title above a photo mosaic on a
  // white ground, which left the header's white content invisible.
  "/property",
  // ADR-049's training pages and the public certificate check open on a white
  // ground with no photograph, so the dark variant painted white ink on white.
  "/training",
  "/verify",
];

export function headerVariantFor(pathname: string): "dark" | "white" {
  return WHITE_HEADER_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  )
    ? "white"
    : "dark";
}

/**
 * The footer's three link columns, left to right.
 *
 * `FOOTER_LINKS` above is the flat row the previous footer rendered and is kept
 * because the mobile drawer reads the same shape. This is the grouped form the
 * banded footer needs: a heading plus its links, one column each.
 *
 * The grouping is a build-time assumption, not a product decision — ADR-023
 * records it and owes ratification. Every href is a route that exists under
 * `(marketplace)`; none is a placeholder. The social accounts are deliberately
 * NOT a fourth column: they render as the icon rail from `SOCIAL_LINKS`, so a
 * network is named once rather than twice.
 */
export const FOOTER_COLUMNS: NavGroup[] = [
  {
    title: "Explore",
    links: [
      { label: "All stays", href: "/explore" },
      { label: "Guides", href: "/guides" },
      { label: "How it works", href: "/services" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Hosting", href: "/host" },
      { label: "Become a host", href: "/host/start" },
      // ADR-049, and the answer to ADR-044's open question 2. `/training`
      // existed for months with nothing in the product linking to it, which is
      // most of why that ADR had to ask whether it shipped at all. It ships, so
      // it gets a way in.
      { label: "Training", href: "/training" },
      { label: "Support", href: "/support" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Terms", href: "/legal/terms" },
      { label: "Privacy", href: "/legal/privacy" },
      { label: "Cookies", href: "/legal/cookies" },
      { label: "Photo credits", href: "/legal/photo-credits" },
    ],
  },
];
