import { GUIDES } from "@/data/guides";
/**
 * Site navigation.
 *
 * The prototype repeated these links as literal markup in the header, the
 * mobile drawer, and the footer of all eleven pages. They live here once.
 */
interface NavLink {
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
 * "How it works" points at `/how-it-works`. `/support` is not orphaned — it is in
 * `FOOTER_COLUMNS` under "Company". Help is a thing
 * you go looking for; the bar's three slots name things you come here to do.
 *
 * **`/saved` IS GATED, and this is the one link here that is.** It is in
 * `PROTECTED_PREFIXES` in `proxy.ts`, so an anonymous visitor who presses
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
  // Was "Services", a page of fictional hotels at invented prices, removed
  // 2026-10-29. How it works is the page a first visitor to an unfamiliar
  // marketplace actually needs.
  { label: "How it works", href: "/how-it-works" },
];

/**
 * Footer stay links: Explore, narrowed by the kind of stay.
 *
 * These used to name four featured properties from a fictional catalogue kept
 * in this app, removed on 2026-10-08. A filter cannot point at a stay that does
 * not exist, so the column now offers the kinds and lets Explore list whatever
 * the database holds.
 */
const BROWSE_STAYS: NavLink[] = [
  { label: "Hotels", href: "/explore?stay=hotels" },
  { label: "Homes and apartments", href: "/explore?stay=homes" },
  { label: "Lodges", href: "/explore?kind=lodge" },
  { label: "Guest houses", href: "/explore?kind=guest_house" },
  { label: "All stays", href: "/explore" },
];

/** The mobile drawer's two-column section grid. */
export const MOBILE_NAV_GROUPS: NavGroup[] = [
  { title: "BROWSE STAYS", links: BROWSE_STAYS },
  {
    title: "EXPLORE DISTRICTS",
    // The destination pages, not Explore filters: a page of its own says what
    // the district is and still lists its stays (`/stays/<district>`).
    links: [
      { label: "Kigali", href: "/stays/kigali" },
      { label: "Musanze", href: "/stays/musanze" },
      { label: "Rubavu", href: "/stays/rubavu" },
      { label: "All districts", href: "/stays" },
    ],
  },
  {
    title: "HOW IT WORKS",
    links: [
      { label: "How it works", href: "/how-it-works" },
    ],
  },
  {
    title: "COMPANY",
    links: [
      { label: "For hosts", href: "/host" },
      { label: "About", href: "/about" },
      // `/support` has no questions on it; the FAQ is on How it works.
      { label: "FAQ", href: "/how-it-works#faq" },
    ],
  },
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
  // YouTube is gone: youtube.com/@injishi answered 404 on 2026-10-21, so the
  // icon sent people to a page that does not exist. The four above answered
  // 200, which proves only that the network serves something at that address,
  // not that Injishi owns the account; the owner confirms each one.
] as const;

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
  // The PSF page opens on a tonal band, never a photograph: a business of any
  // sector has no place to show, so the dark variant would paint white on it.
  "/psf",
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
 * This is the grouped form the banded footer needs: a heading plus its links,
 * one column each.
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
      { label: "Where to stay", href: "/stays" },
      // The guides link returns with the first real article (`GUIDES`).
      ...(GUIDES.length > 0 ? [{ label: "Guides", href: "/guides" }] : []),
      { label: "How it works", href: "/how-it-works" },
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
