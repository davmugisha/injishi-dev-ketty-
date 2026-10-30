import type { PropertyDetail } from "@injishi/contracts";

import { WEB_URL, propertyUrl } from "@/lib/web-url";

/**
 * The schema.org records the public pages hand to search engines, as JSON-LD.
 *
 * The site had none of any type until 2026-10-21, so a search result for a
 * stay could only ever be a blue link. Each builder here describes one page's
 * subject from data the page already shows, and nothing more: a record that
 * claims a rating, a price or a phone line the page does not show is the kind
 * search engines penalise, and the kind of claim this site stopped making.
 *
 * Kept deliberately out of it, until each is true and checked:
 *   - `sameAs` on the organisation: the social accounts in the footer have not
 *     been confirmed as Injishi's own.
 *   - `aggregateRating` and `review`: there are no reviews.
 *   - `priceRange` and `makesOffer` on a stay: `PropertyDetail` carries no
 *     price, and a stale one in a rich result is a promise.
 *   - `geo` on a stay whose host asked for an approximate location.
 *
 * Every URL is absolute on web's own origin (`lib/web-url.ts`), the same rule
 * the sitemap and the canonical link follow.
 */

type JsonLdRecord = Record<string, unknown>;

const absolute = (path: string) => `${WEB_URL}${path.startsWith("/") ? path : `/${path}`}`;

/** Injishi itself: who runs the site, and how to reach them. */
export function organizationJsonLd(): JsonLdRecord {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": absolute("/#organization"),
    name: "Injishi",
    url: absolute("/"),
    logo: absolute("/icons/icon-512.png"),
    parentOrganization: {
      "@type": "Organization",
      name: "Hangaa Softwares",
      url: "https://hangaasoftwares.com",
    },
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: "support@injishi.com",
      areaServed: "RW",
      availableLanguage: ["en"],
    },
  };
}

/** The site, with Explore's free-text search as its search box. */
export function websiteJsonLd(): JsonLdRecord {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": absolute("/#website"),
    name: "Injishi",
    url: absolute("/"),
    publisher: { "@id": absolute("/#organization") },
    inLanguage: "en",
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${absolute("/explore")}?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
}

/** A trail of named pages, the last one the page itself. */
export function breadcrumbJsonLd(trail: { name: string; path: string }[]): JsonLdRecord {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: absolute(crumb.path),
    })),
  };
}

/** A page of questions and their answers, exactly as the page prints them. */
export function faqPageJsonLd(entries: { question: string; answer: string }[]): JsonLdRecord {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: entries.map((entry) => ({
      "@type": "Question",
      name: entry.question,
      acceptedAnswer: { "@type": "Answer", text: entry.answer },
    })),
  };
}

/** One published property. */
export function lodgingJsonLd(property: PropertyDetail, slug: string): JsonLdRecord {
  const showsLocation =
    !property.locationPrivacy && property.latitude !== null && property.longitude !== null;
  return {
    "@context": "https://schema.org",
    "@type": "LodgingBusiness",
    "@id": `${propertyUrl(slug)}#lodging`,
    name: property.name,
    url: propertyUrl(slug),
    ...(property.description ? { description: property.description } : {}),
    ...(property.photos.length > 0 ? { image: property.photos.slice(0, 6) } : {}),
    address: {
      "@type": "PostalAddress",
      ...(property.districtName ? { addressRegion: property.districtName } : {}),
      addressCountry: "RW",
    },
    ...(showsLocation
      ? { geo: { "@type": "GeoCoordinates", latitude: property.latitude, longitude: property.longitude } }
      : {}),
    ...(property.checkInTime ? { checkinTime: property.checkInTime } : {}),
    ...(property.checkOutTime ? { checkoutTime: property.checkOutTime } : {}),
    ...(property.facilities.length > 0
      ? {
          amenityFeature: property.facilities.map((facility) => ({
            "@type": "LocationFeatureSpecification",
            name: facility.amenity?.label ?? facility.outlet?.name,
            value: true,
          })),
        }
      : {}),
  };
}

/** A guide, written by Injishi. */
export function articleJsonLd(article: {
  title: string;
  description: string;
  path: string;
  image: string;
  publishedAt: string;
}): JsonLdRecord {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.description,
    url: absolute(article.path),
    mainEntityOfPage: absolute(article.path),
    image: absolute(article.image),
    datePublished: article.publishedAt,
    author: { "@id": absolute("/#organization") },
    publisher: { "@id": absolute("/#organization") },
    inLanguage: "en",
  };
}

/** A list of stays, in the order the page shows them. */
export function stayListJsonLd(name: string, stays: { name: string; slug: string }[]): JsonLdRecord {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    numberOfItems: stays.length,
    itemListElement: stays.map((stay, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: propertyUrl(stay.slug),
      name: stay.name,
    })),
  };
}
