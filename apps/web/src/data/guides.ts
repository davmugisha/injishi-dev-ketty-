/**
 * Editorial guides.
 *
 * Shared by the home page's "Latest from Blog" strip, the /guides index, and
 * /guides/[slug]. Titles and photography come from the guides capture.
 *
 * Fixture data standing in for the content API.
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

export const GUIDES: Guide[] = [
  {
    slug: "discover-musanze-volcanoes-trails-twin-lakes",
    title: "Discover Musanze: Volcanoes, Trails, and Twin Lakes",
    excerpt:
      "Where to stay within reach of Volcanoes National Park, and how early you actually need to leave.",
    category: "Destinations",
    publishedAt: "2026-02-01",
    image: {
      stem: "rwanda-district-musanze",
      alt: "Mist over the Virunga volcanoes above the green valleys of Musanze",
    },
    sections: [
      {
        heading: "One with Nature: Rwanda's Most Rewarding Hiking Trails",
        body: "Musanze sits at the foot of the Virungas, and almost everything worth doing here starts before sunrise. Trailheads are a short drive from town, which is the argument for staying close rather than commuting from Kigali.",
      },
      {
        heading: "Volcanoes National Park, Musanze",
        body: "Gorilla trekking permits are booked months ahead and briefings start at 07:00 sharp. Lodges in Kinigi are fifteen minutes from the gate; from central Musanze allow forty.",
      },
      {
        heading: "Twin Lakes Trail, Burera & Ruhondo",
        body: "A half-day walk between the two lakes, mostly on farm tracks, with the volcanoes behind you the whole way. No permit needed.",
      },
      {
        heading: "Buhanga Eco-Park",
        body: "A small sacred forest on the edge of town, an hour end to end. The easiest thing to do on an afternoon you had written off.",
      },
      {
        heading: "Mount Bisoke, Volcanoes NP",
        body: "Six hours up and back to a crater lake at 3,711 m. Steep, wet underfoot, and worth it on a clear morning.",
      },
    ],
  },
  {
    slug: "lake-kivu-guide-beaches-boats-lakeside-calm",
    title: "Lake Kivu Guide: Beaches, Boats, and Lakeside Calm",
    excerpt: "Rubavu, Karongi and Rusizi compared: beaches, boats and quiet bays.",
    category: "Destinations",
    publishedAt: "2026-02-01",
    image: {
      stem: "rwanda-lake-kivu",
      alt: "Boats moored in a calm turquoise bay with a tree-covered rocky shore",
    },
    sections: [
      {
        heading: "Lake Kivu: The Art of Traveling Like a Local",
        body: "The lake is long enough that choosing the wrong town costs you a day of driving. Rubavu is the busiest and the easiest to reach; Karongi is quieter; Rusizi is where you go if you are continuing to Nyungwe.",
      },
      {
        heading: "Discover Real Village Life",
        body: "Fishing boats leave at dusk and sing to keep time. You can hear them from most of the shoreline guesthouses, which is a better reason to stay on the water than any beach.",
      },
      {
        heading: "Exploring the Lake by Boat",
        body: "Half-day hires run from the Rubavu jetty and take in Napoleon Island and the hot springs. Agree the price before you leave the dock.",
      },
    ],
  },
  {
    slug: "kigali-stays-explore-the-heart-of-rwanda",
    title: "Kigali Stays: Explore the Heart of Rwanda",
    excerpt:
      "Where to stay in Gasabo, Kicukiro and Nyarugenge, and what each hill is good for.",
    category: "Destinations",
    publishedAt: "2026-02-01",
    image: { stem: "rwanda-kigali-hero", alt: "Kigali skyline at sunset" },
    sections: [
      {
        heading: "Where the City Meets the Hills",
        body: "Kigali is built across a set of ridges, and the ridge you sleep on decides your week. Kimihurura and Kacyiru put you near the restaurants and the convention centre; Nyamirambo is louder, older, and better for walking.",
      },
      {
        heading: "Things to Do with Children in Kigali",
        body: "The Kigali Genocide Memorial is essential but heavy; pair it with an afternoon at the Nyandungu Eco-Park, which has flat paths and shade.",
      },
    ],
  },
  {
    slug: "rubavu-stays-discover-the-lake-kivu-shore",
    title: "Rubavu Stays: Discover the Lake Kivu Shore",
    excerpt: "Two nights on the shore, from Friday arrival to Sunday lunch.",
    category: "Destinations",
    publishedAt: "2026-02-01",
    image: { stem: "rwanda-lake-kivu", alt: "Lake Kivu landscape in Rwanda" },
    sections: [
      {
        heading: "A Weekend on the Shore",
        body: "Three hours from Kigali on good tarmac. Arrive Friday evening, spend Saturday on the water, and leave after lunch on Sunday to be home before dark.",
      },
    ],
  },
  {
    slug: "huye-stays-the-cultural-soul-of-the-south",
    title: "Huye Stays: The Cultural Soul of the South",
    excerpt: "The National Museum, the university town, and the road on to Nyungwe.",
    category: "Destinations",
    publishedAt: "2026-02-01",
    image: { stem: "rwanda-lake-kivu", alt: "Lake Kivu and surrounding Rwandan hills" },
    sections: [
      {
        heading: "The Southern Route",
        body: "Huye is the natural overnight between Kigali and Nyungwe. The National Museum is the best in the country and takes a full morning.",
      },
    ],
  },
  {
    slug: "rwanda-stays-your-complete-district-guide",
    title: "Rwanda Stays: Your Complete District Guide",
    excerpt: "Every district we list, what it is for, and how long you need there.",
    category: "Destinations",
    publishedAt: "2026-02-01",
    image: { stem: "rwanda-lake-kivu", alt: "Lake Kivu with Rwanda hills beyond" },
    sections: [
      {
        heading: "Planning a Route",
        body: "Rwanda is small enough to cross in a day and varied enough that you should not. A week gets you Kigali, Musanze and the lake without rushing.",
      },
    ],
  },
];

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
