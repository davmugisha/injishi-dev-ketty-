/**
 * The public site's marketing fixes of 2026-10-21, run against the REAL
 * modules through `ts-source-hook.mjs` (the way `search-directives.test.mjs`
 * runs robots and the sitemap).
 *
 * What each block pins, and the failure it was written against:
 *
 * - `stayCount`: production opened with nothing listed and the home page
 *   printed "0 stays" ten times. A zero is never printed.
 * - `longWeekendIn`: "When to go" opened on the current month and, from the
 *   10th on, searched a weekend a YEAR away under a label with no year.
 * - `supportIntent`: the contact form is prefilled from a closed set of slugs,
 *   never from free text in a URL someone else can craft.
 * - the JSON-LD builders: no claim the page does not show (no rating, no
 *   price, no location a host asked to keep approximate), and every URL
 *   absolute on the site's own origin.
 * - `readingMinutes`: a hand-typed "6 min read" sat over a page read in one.
 * - the destination pages: one per district the home page names, Huye and
 *   Kayonza included, each answering its questions from data it shows.
 *
 * Run: pnpm --filter @injishi/web test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

register("./ts-source-hook.mjs", import.meta.url);

process.env.NEXT_PUBLIC_WEB_URL = "https://www.example.rw/";

const { stayCount, OPENING_LINE } = await import("@/lib/stay-count");
const { longWeekendIn, formatWeekendDay } = await import("@/lib/long-weekend");
const { supportIntent, supportHref, SUPPORT_INTENTS } = await import("@/lib/support-intent");
const structured = await import("@/lib/structured-data");
const { GUIDES, readingMinutes } = await import("@/data/guides");
const destinations = await import("@/data/destination-pages");
const { DISTRICT_SLUGS } = await import("@/data/search-options");

describe("stayCount", () => {
  test("never prints a zero", () => {
    assert.equal(stayCount(0), null);
    assert.equal(stayCount(-1), null);
  });

  test("counts one stay and many", () => {
    assert.equal(stayCount(1), "1 stay");
    assert.equal(stayCount(12), "12 stays");
  });

  test("the line that stands in for a zero says no number", () => {
    assert.doesNotMatch(OPENING_LINE, /\d/);
  });
});

describe("longWeekendIn", () => {
  const isFriday = (iso) => new Date(`${iso}T00:00:00Z`).getUTCDay() === 5;

  test("the current month offers its next Friday, not one a year away", () => {
    // 21 October 2026: the old rule (first Friday on or after the 10th) had
    // passed, so it answered 15 October 2027.
    const { checkIn, checkOut } = longWeekendIn(9, "2026-10-21");
    assert.equal(checkIn, "2026-10-23");
    assert.equal(checkOut, "2026-10-26");
    assert.ok(isFriday(checkIn));
  });

  test("a later month this year offers the first Friday on or after the 10th", () => {
    assert.deepEqual(longWeekendIn(11, "2026-10-21"), { checkIn: "2026-12-11", checkOut: "2026-12-14" });
  });

  test("an earlier month is next year's", () => {
    assert.equal(longWeekendIn(6, "2026-10-21").checkIn.slice(0, 4), "2027");
  });

  test("when no Friday is left in the current month, it is next year's", () => {
    const { checkIn } = longWeekendIn(9, "2026-10-31");
    assert.equal(checkIn.slice(0, 7), "2027-10");
    assert.ok(isFriday(checkIn));
  });

  test("never starts on or before today, and always in the month asked for", () => {
    for (let month = 0; month < 12; month++) {
      for (const today of ["2026-01-01", "2026-06-15", "2026-10-21", "2026-12-31"]) {
        const { checkIn } = longWeekendIn(month, today);
        assert.ok(checkIn > today, `${month} on ${today}: ${checkIn}`);
        assert.equal(Number(checkIn.slice(5, 7)) - 1, month);
        assert.ok(isFriday(checkIn));
      }
    }
  });

  test("a date in another year says the year, and one this year does not", () => {
    assert.match(formatWeekendDay("2027-10-15", "2026-10-21"), /2027/);
    assert.doesNotMatch(formatWeekendDay("2026-10-23", "2026-10-21"), /2026/);
  });
});

describe("supportIntent", () => {
  test("accepts only the slugs it names", () => {
    assert.equal(supportIntent("opening"), "opening");
    assert.equal(supportIntent("hosting"), "hosting");
    for (const value of ["Opening", "toString", "__proto__", "", undefined, ["opening"], "please call me"]) {
      assert.equal(supportIntent(value), null, String(value));
    }
  });

  test("every intent maps to a topic the API accepts", () => {
    for (const intent of Object.values(SUPPORT_INTENTS)) {
      assert.ok(["booking", "payment", "listing", "other"].includes(intent.topic));
    }
  });

  test("links land on the form", () => {
    assert.equal(supportHref("hosting"), "/support?intent=hosting#contact");
  });
});

describe("structured data", () => {
  const property = {
    id: "00000000-0000-4000-8000-000000000001",
    slug: "amahoro-lodge",
    name: "Amahoro Lodge",
    description: "A lodge </script><script>alert(1)</script> by the lake.",
    districtName: "Musanze",
    latitude: -1.5,
    longitude: 29.6,
    locationPrivacy: true,
    checkInTime: "14:00",
    checkOutTime: "10:00",
    houseRules: null,
    photos: ["https://api.example.rw/api/v1/properties/photos/p1"],
    roomTypes: [],
    facilities: [{ key: "amenity:wifi", amenity: { code: "wifi", label: "Wi-Fi", category: null }, outlet: null }],
  };

  test("a stay claims no rating, no price, and no location its host keeps approximate", () => {
    const record = structured.lodgingJsonLd(property, "amahoro-lodge");
    assert.equal(record["@type"], "LodgingBusiness");
    assert.equal(record.url, "https://www.example.rw/property/amahoro-lodge");
    for (const key of ["aggregateRating", "review", "priceRange", "makesOffer", "geo"]) {
      assert.equal(record[key], undefined, key);
    }
    assert.deepEqual(record.amenityFeature.map((f) => f.name), ["Wi-Fi"]);
  });

  test("a stay that shows its location says where it is", () => {
    const record = structured.lodgingJsonLd({ ...property, locationPrivacy: false }, "amahoro-lodge");
    assert.deepEqual(record.geo, { "@type": "GeoCoordinates", latitude: -1.5, longitude: 29.6 });
  });

  test("the organisation names no social account until one is confirmed", () => {
    assert.equal(structured.organizationJsonLd().sameAs, undefined);
  });

  test("every URL is absolute on the site's own origin", () => {
    const records = [
      structured.organizationJsonLd(),
      structured.websiteJsonLd(),
      structured.breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Guides", path: "/guides" }]),
      structured.articleJsonLd({ title: "t", description: "d", path: "/guides/x", image: "/assets/x.jpg", publishedAt: "2026-02-01" }),
      structured.stayListJsonLd("Stays", [{ name: "A", slug: "a" }]),
    ];
    const urls = JSON.stringify(records).match(/"(?:url|item|@id|logo|image|mainEntityOfPage)":"[^"]*"/g) ?? [];
    assert.ok(urls.length > 0);
    for (const entry of urls) {
      const value = entry.split('":"')[1].slice(0, -1);
      if (value.startsWith("https://hangaasoftwares.com")) continue;
      assert.ok(value.startsWith("https://www.example.rw/"), entry);
    }
  });

  test("a FAQ record carries the page's own questions and answers", () => {
    const record = structured.faqPageJsonLd([{ question: "Q?", answer: "A." }]);
    assert.deepEqual(record.mainEntity, [
      { "@type": "Question", name: "Q?", acceptedAnswer: { "@type": "Answer", text: "A." } },
    ]);
  });
});

describe("readingMinutes", () => {
  test("is counted from the guide's own words", () => {
    for (const guide of GUIDES) {
      const words = [guide.title, guide.excerpt, ...guide.sections.flatMap((s) => [s.heading, s.body])]
        .join(" ")
        .split(/\s+/)
        .filter(Boolean).length;
      assert.equal(readingMinutes(guide), Math.max(1, Math.round(words / 200)), guide.slug);
    }
  });
});

describe("destination pages", () => {
  test("there is one page for every district the search knows", () => {
    assert.deepEqual(
      destinations.DESTINATIONS.map((place) => place.slug).sort(),
      [...DISTRICT_SLUGS].sort(),
    );
  });

  test("Huye and Kayonza are districts now, so their searches can match a stay", () => {
    assert.ok(DISTRICT_SLUGS.includes("huye"));
    assert.ok(DISTRICT_SLUGS.includes("kayonza"));
  });

  test("every guide a district names exists, and every district offers one", () => {
    const slugs = new Set(GUIDES.map((guide) => guide.slug));
    for (const place of destinations.DESTINATIONS) {
      const guides = destinations.guidesFor(place.slug);
      assert.ok(guides.length > 0, place.slug);
      for (const slug of guides) assert.ok(slugs.has(slug), `${place.slug} names ${slug}`);
    }
  });

  test("an empty district says so, and never prints a zero", () => {
    const place = destinations.findDestination("musanze");
    const [first] = destinations.destinationFaq(place, 0);
    assert.match(first.answer, /None is listed/);
    assert.doesNotMatch(first.answer, /\b0\b/);
  });

  test("a district with stays counts them", () => {
    const place = destinations.findDestination("kigali");
    const [first] = destinations.destinationFaq(place, 3);
    assert.match(first.answer, /^3 stays in Kigali/);
  });
});
