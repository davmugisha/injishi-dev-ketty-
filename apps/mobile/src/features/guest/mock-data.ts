// The guest's sample data (proto-ui, mock mode): Sarah Kimani's lake weekend at Isangano Lakeside,
// the stays around Lake Kivu, her saved list, trips and rewards, all from the prototype's own words
// (`.design/mobile-prototype/proto/screens/b-guest.mjs`). Design filler: it lives here and nowhere
// else, and only `data.ts` reads it. The writes below change this module's state and every read
// returns new objects, so a heart, a payment or a booking shows at once on every screen.

import { protoImages } from "@/proto/images";
import { rwf } from "@/lib/money";
import {
  addDays,
  countdownWords,
  dayLong,
  dayMonth,
  dayWords,
  daysBetween,
  nightsWords,
  rangeWords,
  shortRange,
  weekday,
} from "./dates";
import type { ExploreIntent } from "./intent";
import type {
  BookedData,
  CheckoutData,
  DatesChoice,
  DatesData,
  ExploreData,
  GuestBadges,
  GuestHome,
  HomeCard,
  HomePhase,
  HomeTrip,
  MeData,
  PayMethod,
  PayMethodId,
  PaymentData,
  PlaceSuggestion,
  SavedData,
  SavedStay,
  StayCard,
  StayDetail,
  StayFact,
  TripsData,
} from "./types";

// ---------- The stays

interface RoomFixture {
  id: string;
  name: string;
  detail: string;
  priceRwf: number;
  left: number | null;
  photo: keyof typeof protoImages;
  soldOut: readonly string[];
  sleeps: number;
}

interface StayFixture {
  slug: string;
  name: string;
  /** The saved list's shorter name. */
  short: string;
  where: string;
  place: string;
  district: string;
  type: string;
  typeLabel: string;
  tags: readonly string[];
  rating: number;
  reviewCount: number;
  /** The explore card's price: the room the search's dates point at. */
  cardRoom: string;
  instant: boolean;
  replies: string | null;
  scarcity: string | null;
  pin: { x: number; y: number } | null;
  near: string;
  roomTotal: number;
  photos: readonly { name: keyof typeof protoImages; caption: string }[];
  facts: readonly StayFact[];
  rooms: readonly RoomFixture[];
  review: { stars: number; author: string; text: string } | null;
  checkInTime: string;
  /** "lake weekend": "Your lake weekend starts Wednesday". */
  tripWord: string;
  drive: string;
  extras: readonly Omit<HomeCard, "link">[];
  arrivalNote: string;
}

const STAYS: readonly StayFixture[] = [
  {
    slug: "isangano-lakeside-hotel",
    name: "Isangano Lakeside Hotel",
    short: "Isangano Lakeside",
    where: "Gisenyi lakeshore · Hotel",
    place: "Gisenyi lakeshore, Rubavu",
    district: "Rubavu",
    type: "hotel",
    typeLabel: "Hotel",
    tags: ["lakeView", "breakfast"],
    rating: 4.6,
    reviewCount: 128,
    cardRoom: "deluxe",
    instant: true,
    replies: null,
    scarcity: "1 lake room left",
    pin: { x: 34, y: 42 },
    near: "Gisenyi lakeshore · on the water",
    roomTotal: 42,
    photos: [
      { name: "isangano-hotel-exterior", caption: "Pool and garden by the lake" },
      { name: "isangano-terrace", caption: "Isangano Terrace" },
      { name: "deluxe-lake-view-room", caption: "Deluxe Lake View" },
      { name: "lake-view-terrace-sunset", caption: "Sunset from the terrace" },
    ],
    facts: [
      { icon: "Sun", title: "On the lakeshore", detail: "Balconies over Lake Kivu" },
      { icon: "Cup", title: "Breakfast included", detail: "Every rate, from 06:30" },
      { icon: "Smartphone", title: "Mobile money", detail: "MTN MoMo or Airtel Money" },
      { icon: "Receipt", title: "Business-ready", detail: "Company invoices, EBM receipts" },
    ],
    rooms: [
      {
        id: "deluxe",
        name: "Deluxe Lake View",
        detail: "1 king bed · 32 m² · lake balcony",
        priceRwf: 140000,
        left: 1,
        photo: "deluxe-lake-view-room",
        soldOut: ["2026-10-30", "2026-10-31"],
        sleeps: 3,
      },
      {
        id: "standard",
        name: "Standard Queen",
        detail: "1 queen bed · 22 m² · garden side",
        priceRwf: 85000,
        left: 4,
        photo: "standard-queen-room",
        soldOut: [],
        sleeps: 2,
      },
    ],
    review: {
      stars: 5,
      author: "Thomas W. · Germany · Sep 2026",
      text: "“The balcony over the lake made the trip. Breakfast on the terrace was excellent and the desk arranged a boat trip the same evening.”",
    },
    checkInTime: "14:00",
    tripWord: "lake weekend",
    drive: "3 h 30 drive",
    extras: [
      {
        key: "boat",
        title: "Boat trip on Lake Kivu",
        detail: "Thu 07:00 · RWF 25,000 each",
        photo: protoImages["lake-kivu-shoreline"],
      },
      {
        key: "dinner",
        title: "Dinner by the water",
        detail: "Isangano Terrace · book a table",
        photo: protoImages["isangano-terrace"],
      },
    ],
    arrivalNote: "Early? Leave your bags at reception and we'll message you when 204 is ready.",
  },
  {
    slug: "rubona-peninsula-lodge",
    name: "Rubona Peninsula Lodge",
    short: "Rubona Peninsula",
    where: "Rubona · Lodge · pool",
    place: "Rubona peninsula, Rubavu",
    district: "Rubavu",
    type: "lodge",
    typeLabel: "Lodge",
    tags: ["lakeView", "breakfast"],
    rating: 4.7,
    reviewCount: 84,
    cardRoom: "cottage",
    instant: true,
    replies: null,
    scarcity: null,
    pin: { x: 46, y: 58 },
    near: "Rubona · 4 km from Gisenyi",
    roomTotal: 18,
    photos: [
      { name: "cottages-above-the-bay", caption: "Cottages above the bay" },
      { name: "private-pool-villa", caption: "The pool" },
      { name: "valley-view", caption: "View over the bay" },
      { name: "family-suite-lounge", caption: "Family Suite lounge" },
    ],
    facts: [
      { icon: "Sun", title: "Above the bay", detail: "Every cottage faces the lake" },
      { icon: "Droplet", title: "Pool with a view", detail: "Open 07:00 to 19:00" },
      { icon: "Cup", title: "Breakfast included", detail: "Served on your terrace" },
      { icon: "Smartphone", title: "Mobile money", detail: "MTN MoMo or Airtel Money" },
    ],
    rooms: [
      {
        id: "cottage",
        name: "Lake Cottage",
        detail: "1 king bed · 40 m² · terrace",
        priceRwf: 150000,
        left: 2,
        photo: "one-bedroom-suite",
        soldOut: ["2026-10-24"],
        sleeps: 2,
      },
      {
        id: "family",
        name: "Family Suite",
        detail: "2 bedrooms · sleeps 4 · garden",
        priceRwf: 210000,
        left: null,
        photo: "family-suite-lounge",
        soldOut: [],
        sleeps: 4,
      },
    ],
    review: {
      stars: 5,
      author: "Amina K. · Kenya · Aug 2026",
      text: "“Quiet cottages, a great pool and the best sunset on the peninsula. Ask for a cottage on the upper row.”",
    },
    checkInTime: "13:00",
    tripWord: "lake weekend",
    drive: "3 h 45 drive",
    extras: [],
    arrivalNote: "Early? Leave your bags at the lodge office; your cottage is ready by 13:00.",
  },
  {
    slug: "kivu-sunset-guest-house",
    name: "Kivu Sunset Guest House",
    short: "Kivu Sunset",
    where: "Gisenyi · Guest house",
    place: "Gisenyi, Rubavu",
    district: "Rubavu",
    type: "guest_house",
    typeLabel: "Guest house",
    tags: ["breakfast"],
    rating: 4.4,
    reviewCount: 61,
    cardRoom: "twin",
    instant: false,
    replies: "Replies in about 3 h",
    scarcity: null,
    pin: { x: 58, y: 32 },
    near: "Gisenyi · 10 min walk to the beach",
    roomTotal: 9,
    photos: [
      { name: "garden-rooms", caption: "Garden rooms" },
      { name: "twin-room", caption: "Garden Twin" },
      { name: "hotel-breakfast", caption: "Breakfast" },
    ],
    facts: [
      { icon: "Cup", title: "Breakfast included", detail: "Rwandan coffee from 07:00" },
      { icon: "MapPin", title: "Near the beach", detail: "10 minutes on foot" },
      { icon: "AntennaSignal", title: "Wi-Fi", detail: "In every room" },
      { icon: "Smartphone", title: "Mobile money", detail: "MTN MoMo" },
    ],
    rooms: [
      {
        id: "twin",
        name: "Garden Twin",
        detail: "2 single beds · 18 m² · garden",
        priceRwf: 45000,
        left: null,
        photo: "twin-room",
        soldOut: [],
        sleeps: 2,
      },
      {
        id: "double",
        name: "Double Room",
        detail: "1 double bed · 20 m² · garden",
        priceRwf: 55000,
        left: 2,
        photo: "standard-queen-room",
        soldOut: [],
        sleeps: 2,
      },
    ],
    review: {
      stars: 4,
      author: "Jean-Paul M. · Rwanda · Jul 2026",
      text: "“Simple rooms, very clean, and the owner's breakfast is worth the stay.”",
    },
    checkInTime: "12:00",
    tripWord: "stay",
    drive: "3 h 20 drive",
    extras: [],
    arrivalNote: "The owner meets you at the gate; message ahead with your arrival time.",
  },
  {
    slug: "nyamyumba-camp",
    name: "Nyamyumba Camp",
    short: "Nyamyumba Camp",
    where: "Nyamyumba · Tented camp",
    place: "Nyamyumba, Rubavu",
    district: "Rubavu",
    type: "tented_camp",
    typeLabel: "Tented camp",
    tags: ["lakeView"],
    rating: 4.5,
    reviewCount: 37,
    cardRoom: "tent",
    instant: true,
    replies: null,
    scarcity: null,
    pin: { x: 64, y: 72 },
    near: "Nyamyumba · 9 km from Gisenyi",
    roomTotal: 8,
    photos: [
      { name: "tents-on-the-shore", caption: "Tents on the shore" },
      { name: "lake-kivu-shoreline", caption: "The shoreline" },
    ],
    facts: [
      { icon: "Sun", title: "On the shore", detail: "Decks over the water" },
      { icon: "Flame", title: "Campfire dinners", detail: "Every evening at 19:00" },
      { icon: "Cup", title: "Breakfast included", detail: "From 07:00" },
      { icon: "Smartphone", title: "Mobile money", detail: "MTN MoMo or Airtel Money" },
    ],
    rooms: [
      {
        id: "tent",
        name: "Shore Tent",
        detail: "1 king bed · private deck",
        priceRwf: 120000,
        left: 3,
        photo: "tents-on-the-shore",
        soldOut: [],
        sleeps: 2,
      },
    ],
    review: null,
    checkInTime: "14:00",
    tripWord: "stay",
    drive: "3 h 50 drive",
    extras: [],
    arrivalNote: "The camp's boat meets you at the Nyamyumba jetty.",
  },
  {
    slug: "kivu-hills-villa",
    name: "Kivu Hills Villa",
    short: "Kivu Hills Villa",
    where: "Gisenyi hills · Villa · pool",
    place: "Gisenyi hills, Rubavu",
    district: "Rubavu",
    type: "villa",
    typeLabel: "Villa",
    tags: ["lakeView"],
    rating: 4.8,
    reviewCount: 22,
    cardRoom: "villa",
    instant: true,
    replies: null,
    scarcity: null,
    pin: { x: 76, y: 24 },
    near: "Gisenyi hills · 2 km above town",
    roomTotal: 1,
    photos: [
      { name: "private-pool-villa", caption: "Private pool" },
      { name: "one-bedroom-suite", caption: "Main bedroom" },
    ],
    facts: [
      { icon: "Droplet", title: "Private pool", detail: "Just for your party" },
      { icon: "Sun", title: "Lake view", detail: "From every room" },
      { icon: "Persons", title: "Sleeps 6", detail: "3 bedrooms" },
      { icon: "Smartphone", title: "Mobile money", detail: "MTN MoMo" },
    ],
    rooms: [
      {
        id: "villa",
        name: "The whole villa",
        detail: "3 bedrooms · sleeps 6 · pool",
        priceRwf: 260000,
        left: 1,
        photo: "private-pool-villa",
        soldOut: ["2026-10-17", "2026-10-18"],
        sleeps: 6,
      },
    ],
    review: null,
    checkInTime: "15:00",
    tripWord: "stay",
    drive: "3 h 30 drive",
    extras: [],
    arrivalNote: "The caretaker hands over the keys at the gate.",
  },
  {
    slug: "gisenyi-lake-loft",
    name: "Gisenyi Lake Loft",
    short: "Gisenyi Lake Loft",
    where: "Gisenyi town · Apartment",
    place: "Gisenyi town, Rubavu",
    district: "Rubavu",
    type: "apartment",
    typeLabel: "Apartment",
    tags: [],
    rating: 4.3,
    reviewCount: 45,
    cardRoom: "loft",
    instant: false,
    replies: "Replies in about 12 h",
    scarcity: null,
    pin: { x: 40, y: 50 },
    near: "Gisenyi town · by the market",
    roomTotal: 1,
    photos: [
      { name: "loft-studio", caption: "The loft" },
      { name: "lake-bar", caption: "The lake bar downstairs" },
    ],
    facts: [
      { icon: "House", title: "Whole apartment", detail: "Kitchen and lounge" },
      { icon: "AntennaSignal", title: "Fast Wi-Fi", detail: "Good for work" },
      { icon: "MapPin", title: "In town", detail: "By the market" },
      { icon: "Smartphone", title: "Mobile money", detail: "MTN MoMo" },
    ],
    rooms: [
      {
        id: "loft",
        name: "Loft studio",
        detail: "1 queen bed · 35 m² · kitchen",
        priceRwf: 70000,
        left: null,
        photo: "loft-studio",
        soldOut: [],
        sleeps: 2,
      },
    ],
    review: null,
    checkInTime: "14:00",
    tripWord: "stay",
    drive: "3 h 30 drive",
    extras: [],
    arrivalNote: "The host leaves the key in a lockbox; the code comes the day before.",
  },
  {
    slug: "ishyamba-forest-lodge",
    name: "Ishyamba Forest Lodge",
    short: "Ishyamba Forest Lodge",
    where: "Nyamagabe · Lodge",
    place: "Nyungwe edge, Nyamagabe",
    district: "Nyamagabe",
    type: "lodge",
    typeLabel: "Lodge",
    tags: ["breakfast"],
    rating: 4.6,
    reviewCount: 52,
    cardRoom: "forest",
    instant: true,
    replies: null,
    scarcity: null,
    pin: null,
    near: "Nyamagabe · edge of Nyungwe",
    roomTotal: 16,
    photos: [{ name: "forest-lodge", caption: "The lodge at night" }],
    facts: [
      { icon: "Sun", title: "In the forest", detail: "On the edge of Nyungwe" },
      { icon: "Cup", title: "Breakfast included", detail: "From 06:00, before the walks" },
      { icon: "Route", title: "Guided walks", detail: "Booked at the desk" },
      { icon: "Smartphone", title: "Mobile money", detail: "MTN MoMo or Airtel Money" },
    ],
    rooms: [
      {
        id: "forest",
        name: "Forest Room",
        detail: "1 king bed · 30 m² · forest deck",
        priceRwf: 180000,
        left: null,
        photo: "forest-lodge",
        soldOut: [],
        sleeps: 2,
      },
    ],
    review: null,
    checkInTime: "14:00",
    tripWord: "forest weekend",
    drive: "5 h drive",
    extras: [],
    arrivalNote: "Arrive before dark; the last stretch of road is unlit.",
  },
];

/** The stays Explore lists for "Rubavu, Lake Kivu", in its order. */
const EXPLORE_ORDER = [
  "isangano-lakeside-hotel",
  "rubona-peninsula-lodge",
  "kivu-sunset-guest-house",
  "nyamyumba-camp",
  "kivu-hills-villa",
  "gisenyi-lake-loft",
];
/** A place the "Where" field suggests (`.design` places: the lake, Gisenyi, Kigali, Musanze, Nyungwe). */
interface PlaceFixture extends PlaceSuggestion {
  /** The stays a search for it lists, in order. */
  stays: readonly string[];
  /** "24 stays": more than the sample lists, as the prototype's count says. */
  total?: number;
}

const AREAS: readonly PlaceFixture[] = [
  {
    key: "district:33",
    kind: "district",
    label: "Rubavu, Lake Kivu",
    sub: "24 stays",
    ref: "district:33",
    stays: EXPLORE_ORDER,
    total: 24,
  },
  {
    key: "sector:3305",
    kind: "sector",
    label: "Gisenyi, Rubavu",
    sub: "4 stays",
    ref: "sector:3305",
    stays: ["isangano-lakeside-hotel", "kivu-sunset-guest-house", "kivu-hills-villa", "gisenyi-lake-loft"],
  },
  {
    key: "district:25",
    kind: "district",
    label: "Nyungwe, Nyamagabe",
    sub: "1 stay",
    ref: "district:25",
    stays: ["ishyamba-forest-lodge"],
  },
  { key: "district:11", kind: "district", label: "Kigali", sub: "No stays listed yet", ref: "district:11", stays: [] },
  {
    key: "district:43",
    kind: "district",
    label: "Musanze, Volcanoes",
    sub: "No stays listed yet",
    ref: "district:43",
    stays: [],
  },
];

/** The areas, then each stay by name. */
function placeFixtures(): PlaceFixture[] {
  return [
    ...AREAS,
    ...STAYS.map((stay) => ({
      key: `property:${stay.slug}`,
      kind: "property" as const,
      label: stay.name,
      sub: stay.place,
      ref: `property:${stay.slug}`,
      stays: [stay.slug],
    })),
  ];
}

/** Saved's ideas, while not saved. */
const IDEAS: Readonly<Record<string, string>> = {
  "nyamyumba-camp": "Tented camp · 4.5",
  "ishyamba-forest-lodge": "Nyamagabe · stayed Aug",
};

function stayOf(slug: string): StayFixture | undefined {
  return STAYS.find((s) => s.slug === slug);
}

/** A stay the state names; Isangano if the name is unknown (the state only names fixtures). */
function stayIn(slug: string): StayFixture {
  return stayOf(slug) ?? STAYS[0];
}

function roomOf(stay: StayFixture, roomId: string | null): RoomFixture {
  return stay.rooms.find((r) => r.id === roomId) ?? stay.rooms[0];
}

function photo(name: keyof typeof protoImages) {
  return protoImages[name];
}

// ---------- The state the screens change

/** The day the prototype's browsing happens on (Explore is Sat 3 Oct), and the one Home's trip counts from. */
const TODAY = "2026-10-03";
const HOME_TODAY = "2026-10-12";
const GUEST = { name: "Sarah Kimani", email: "sarah.kimani@gmail.com", momo: "078 ••• 2097" };

interface Booking {
  reference: string;
  slug: string;
  roomId: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  deposit: number;
  providerRef: string;
  calendarAdded: boolean;
}

const state = {
  saved: ["isangano-lakeside-hotel", "rubona-peninsula-lodge"] as string[],
  search: { checkIn: "2026-10-14", checkOut: "2026-10-16", adults: 2, children: 0 },
  draft: {
    slug: "isangano-lakeside-hotel",
    roomId: "deluxe",
    checkIn: "2026-10-14",
    checkOut: "2026-10-16",
    adults: 2,
    children: 0,
  },
  payment: {
    id: "PI-77104",
    method: "mtn" as PayMethodId,
    amount: 140000,
    sentAt: "09:12",
    checkedAt: "09:12:40",
    heldUntil: "09:42",
    slug: "isangano-lakeside-hotel",
    roomId: "deluxe",
    prompts: 1,
  },
  bookings: [
    {
      reference: "BK-20431",
      slug: "isangano-lakeside-hotel",
      roomId: "deluxe",
      checkIn: "2026-10-14",
      checkOut: "2026-10-16",
      adults: 2,
      children: 0,
      deposit: 140000,
      providerRef: "MP261003.0914.K28417",
      calendarAdded: false,
    },
  ] as Booking[],
  lastBooked: "BK-20431",
  inboxUnread: 1,
};

// ---------- Reads

export function mockBadges(): GuestBadges {
  return state.inboxUnread > 0 ? { inbox: state.inboxUnread } : {};
}

function guestsWords(adults: number, children: number): string {
  const a = adults === 1 ? "1 adult" : `${adults} adults`;
  if (children === 0) return a;
  return `${a}, ${children === 1 ? "1 child" : `${children} children`}`;
}

function tripOf(booking: Booking): HomeTrip {
  const stay = stayIn(booking.slug);
  return {
    reference: booking.reference,
    slug: stay.slug,
    hotel: stay.name,
    place: `${stay.short} · ${stay.district}`,
    photo: photo(stay.photos[0]?.name ?? "isangano-hotel-exterior"),
  };
}

const SEED_TRIP: HomeTrip = {
  reference: "BK-20431",
  slug: "isangano-lakeside-hotel",
  hotel: "Isangano Lakeside Hotel",
  place: "Isangano Lakeside · Rubavu",
  photo: photo("isangano-hotel-exterior"),
};

export function mockHome(phase: HomePhase): GuestHome {
  if (phase === "before") return homeBefore();
  if (phase === "after") return homeAfter();
  return homeStay();
}

function homeBefore(): GuestHome {
  const booking = state.bookings[0];
  const stay = stayIn(booking.slug);
  const nights = daysBetween(booking.checkIn, booking.checkOut);
  return {
    phase: "before",
    trip: tripOf(booking),
    countdown: countdownWords(HOME_TODAY, booking.checkIn),
    title: `Your ${stay.tripWord}
starts ${weekday(booking.checkIn, true)}`,
    line: `${rangeWords(booking.checkIn, booking.checkOut)} · ${nightsWords(nights)} · ${booking.reference}`,
    checkIn: {
      done: 1,
      total: 3,
      steps: [
        {
          title: "Booking confirmed",
          detail: `Deposit ${rwf(booking.deposit)} paid · held by Injishi until check-in`,
          state: "done",
        },
        {
          title: "Send your ID and arrival time",
          detail: "2 minutes · the desk only compares it on arrival",
          state: "now",
          icon: "ShieldCheck",
        },
        {
          title: "Key on your phone",
          detail: `Ready on ${weekday(booking.checkIn, true)}, after the ID check`,
          state: "todo",
          icon: "Key",
        },
      ],
    },
    shortcuts: { drive: stay.drive, replies: "replies 15 min", extra: stay.extras.length ? "boat trip" : "add-ons" },
    arrival: { title: `Check-in from ${stay.checkInTime}`, body: stay.arrivalNote },
    extras: stay.extras.map((e) => ({ ...e, link: "extras" })),
  };
}

function homeStay(): GuestHome {
  return {
    phase: "stay",
    trip: SEED_TRIP,
    photo: photo("deluxe-lake-view-balcony"),
    title: "Good evening,\nSarah",
    line: "Night 2 of 2 · Deluxe Lake View",
    newInInbox: state.inboxUnread > 0,
    key: { room: "Room 204", status: "Key ready on this phone" },
    wifi: { network: "Isangano-Guest", password: "kivu-lake-204" },
    bill: { due: "47,500 due", unseen: true },
    desk: "desk · 24 h",
    request: { title: "Fresh towels × 2", detail: "Jeanne · expected by 19:55", status: "On the way" },
    checkout: { weekday: "Fri", day: "16", title: "Checkout by 11:00", detail: "Late checkout from RWF 20,000" },
    tonightTitle: "Tonight at Isangano",
    tonight: [
      {
        key: "intore",
        title: "Intore dance · on now",
        detail: "Garden Terrace · until 20:30 · free",
        photo: photo("garden-terrace-dusk"),
        link: null,
      },
      {
        key: "room-service",
        title: "Room service",
        detail: "Kitchen until 22:00",
        photo: photo("grilled-tilapia"),
        link: "order",
      },
    ],
  };
}

function homeAfter(): GuestHome {
  return {
    phase: "after",
    trip: SEED_TRIP,
    date: dayLong("2026-10-17"),
    title: "Thanks for staying,\nSarah",
    stayLine: "Wed 14 – Fri 16 Oct · room 204",
    review: { until: "Until Fri 30 Oct", note: "Your review and the hotel's review of your stay publish together." },
    receipt: { detail: `Paid in full · ${rwf(333500)} · signed by RRA` },
    points: { title: "649 Amahoro Rewards points", detail: "Pending until the bill is closed" },
    lostFound: { detail: "Tell the desk; housekeeping checks room 204" },
    bookAgain: [
      {
        key: "weekend",
        title: "Lake Kivu Weekend",
        detail: `Isangano · boat trip + dinner · ${rwf(115000)}`,
        photo: photo("lake-view-terrace-sunset"),
        link: "property",
        slug: "isangano-lakeside-hotel",
      },
      {
        key: "rubona",
        title: "Rubona Peninsula Lodge",
        detail: `4.7 · from ${rwf(150000)}`,
        photo: photo("cottages-above-the-bay"),
        link: "property",
        slug: "rubona-peninsula-lodge",
      },
    ],
  };
}

function cardOf(stay: StayFixture): StayCard {
  const room = roomOf(stay, stay.cardRoom);
  return {
    slug: stay.slug,
    name: stay.name,
    where: stay.where,
    type: stay.type,
    tags: stay.tags,
    rating: stay.rating,
    reviewCount: stay.reviewCount,
    priceRwf: room.priceRwf,
    priceNote: "night",
    photos: stay.photos.map((p) => photo(p.name)),
    booking: stay.instant
      ? { instant: true, label: "Instant booking" }
      : { instant: false, label: stay.replies ?? "Request to book" },
    scarcity: stay.scarcity,
    saved: state.saved.includes(stay.slug),
    pin: stay.pin,
    near: stay.near,
  };
}

function searchSubtitle(): string {
  const s = state.search;
  return `${rangeWords(s.checkIn, s.checkOut)} · ${guestsWords(s.adults, s.children)}`;
}

/** What Explore searched for: a picked place, or typed words; neither is the lake, as the prototype opens. */
export type MockSearch = Pick<ExploreIntent, "place" | "placeLabel" | "q">;

const LAKE: MockSearch = { place: null, placeLabel: null, q: "" };

function matchesWords(stay: StayFixture, words: string): boolean {
  const q = words.toLowerCase();
  return [stay.name, stay.where, stay.place].some((text) => text.toLowerCase().includes(q));
}

/**
 * Explore's stays for the search: the lake's six by default (the prototype's screen), a picked place's
 * own, or the stays whose name or place has the typed words.
 */
export function mockExplore(search: MockSearch = LAKE): ExploreData {
  const area = search.place ? placeFixtures().find((p) => p.ref === search.place) : undefined;
  const words = search.q.trim();
  const slugs = search.place
    ? (area?.stays ?? [])
    : words
      ? STAYS.filter((stay) => matchesWords(stay, words)).map((stay) => stay.slug)
      : EXPLORE_ORDER;
  const stays = slugs.map((slug) => cardOf(stayIn(slug)));
  const narrowed = Boolean(search.place || words);
  return {
    search: {
      title: narrowed ? (search.placeLabel ?? area?.label ?? words) : "Rubavu, Lake Kivu",
      subtitle: searchSubtitle(),
    },
    total: narrowed ? (area?.total ?? stays.length) : 24,
    stays,
    focus: stays.find((s) => s.slug === "rubona-peninsula-lodge")?.slug ?? stays.find((s) => s.pin)?.slug ?? null,
    next: null,
  };
}

export function mockExploreEmpty(search: MockSearch = LAKE): ExploreData {
  return { ...mockExplore(search), total: 0, stays: [], focus: null };
}

/** Suggestions for two letters or more: areas by name, then stays by name or place, at most eight (as the API). */
export function mockPlaces(text: string): PlaceSuggestion[] {
  const q = text.trim().toLowerCase();
  return placeFixtures()
    .filter((p) => p.label.toLowerCase().includes(q) || (p.kind === "property" && p.sub.toLowerCase().includes(q)))
    .slice(0, 8)
    .map(({ key, kind, label, sub, ref }) => ({ key, kind, label, sub, ref }));
}

function cancelNote(checkIn: string): string {
  return `free cancel to ${dayMonth(addDays(checkIn, -7))}`;
}

export function mockStay(slug: string): StayDetail | null {
  const stay = stayOf(slug);
  if (!stay) return null;
  const draftHere = state.draft.slug === slug;
  const room = roomOf(stay, draftHere ? state.draft.roomId : stay.cardRoom);
  const { checkIn, checkOut } = draftHere ? state.draft : state.search;
  const nights = daysBetween(checkIn, checkOut);
  return {
    slug: stay.slug,
    name: stay.name,
    eyebrow: `Verified business · ${stay.typeLabel} · ${stay.roomTotal} ${stay.roomTotal === 1 ? "room" : "rooms"}`,
    verified: true,
    rating: stay.rating,
    reviewCount: stay.reviewCount,
    where: stay.place,
    photos: stay.photos.map((p) => ({ source: photo(p.name), caption: p.caption })),
    facts: [...stay.facts],
    roomsTitle: `Rooms for ${shortRange(checkIn, checkOut)}`,
    rooms: stay.rooms.map((r) => ({
      id: r.id,
      name: r.name,
      detail: r.detail,
      priceRwf: r.priceRwf,
      priceNote: "night",
      left: r.left,
      photo: photo(r.photo),
    })),
    roomId: room.id,
    review: stay.review,
    about: null,
    saved: state.saved.includes(stay.slug),
    shareUrl: `https://www.injishi.com/stays/${stay.slug}`,
    dock: {
      price: rwf(room.priceRwf * nights),
      note: `${nightsWords(nights)} · ${shortRange(checkIn, checkOut)} · ${cancelNote(checkIn)}`,
    },
  };
}

export function mockDates(input: { explore: boolean; slug: string | null; roomId: string | null }): DatesData {
  const search = state.search;
  if (input.explore) {
    return {
      slug: null,
      stayName: null,
      today: TODAY,
      checkIn: search.checkIn,
      checkOut: search.checkOut,
      adults: search.adults,
      children: search.children,
      maxAdults: 8,
      rooms: [],
      roomId: null,
    };
  }
  const stay = stayIn(input.slug ?? state.draft.slug);
  const draftHere = state.draft.slug === stay.slug;
  const from = draftHere ? state.draft : search;
  const room = roomOf(stay, input.roomId ?? (draftHere ? state.draft.roomId : stay.cardRoom));
  return {
    slug: stay.slug,
    stayName: stay.name,
    today: TODAY,
    checkIn: from.checkIn,
    checkOut: from.checkOut,
    adults: from.adults,
    children: from.children,
    maxAdults: Math.max(...stay.rooms.map((r) => r.sleeps)),
    rooms: stay.rooms.map((r) => ({
      id: r.id,
      name: r.name,
      detail: r.detail,
      priceRwf: r.priceRwf,
      soldOut: r.soldOut,
    })),
    roomId: room.id,
  };
}

function methods(): PayMethod[] {
  return [
    { id: "mtn", name: "MTN MoMo", detail: GUEST.momo, ready: true, offered: true },
    { id: "airtel", name: "Airtel Money", detail: "Add a number", ready: false, offered: true },
    { id: "card", name: "Card", detail: "Not in the app yet. Pay by card at the desk.", ready: false, offered: false },
  ];
}

export function mockCheckout(): CheckoutData {
  const d = state.draft;
  const stay = stayIn(d.slug);
  const room = roomOf(stay, d.roomId);
  const nights = daysBetween(d.checkIn, d.checkOut);
  const total = room.priceRwf * nights;
  const deposit = Math.round(total / 2);
  return {
    slug: stay.slug,
    stayName: stay.name,
    roomName: room.name,
    photo: photo(room.photo),
    roomLine: `${room.name} · ${guestsWords(d.adults, d.children)}`,
    datesLine: `${rangeWords(d.checkIn, d.checkOut)} · ${nightsWords(nights)}`,
    confirmNote: stay.instant ? "Instant confirmation" : (stay.replies ?? "Request to book"),
    lines: [
      { label: `${nightsWords(nights)} × ${rwf(room.priceRwf)}`, value: rwf(total) },
      { label: stay.tags.includes("breakfast") ? "Breakfast, VAT" : "VAT", value: "Included" },
    ],
    total,
    deposit,
    depositNote: "The deposit. The rest and any extras at the hotel.",
    methods: methods(),
    tiers: [
      {
        key: "free",
        tone: "success",
        weight: 4,
        title: "Free cancellation",
        when: `until ${dayWords(addDays(d.checkIn, -7))}`,
      },
      {
        key: "deposit",
        tone: "warning",
        weight: 5,
        title: "Deposit kept",
        when: `until ${dayWords(addDays(d.checkIn, -2))}, 14:00`,
      },
      { key: "full", tone: "danger", weight: 2, title: "Full stay charged", when: "after that, or no-show" },
    ],
  };
}

export function mockPayment(): PaymentData {
  const p = state.payment;
  const stay = stayIn(p.slug);
  const airtel = p.method === "airtel";
  return {
    id: p.id,
    provider: airtel ? "Airtel" : "MTN",
    wallet: airtel ? "Airtel Money" : "MoMo",
    phone: GUEST.momo,
    amount: p.amount,
    sentAt: p.sentAt,
    checkedAt: p.checkedAt,
    heldUntil: p.heldUntil,
    roomName: roomOf(stay, p.roomId).name,
    prompts: p.prompts,
  };
}

export function mockBooked(): BookedData {
  const booking = state.bookings.find((b) => b.reference === state.lastBooked) ?? state.bookings[0];
  const stay = stayIn(booking.slug);
  const room = roomOf(stay, booking.roomId);
  return {
    reference: booking.reference,
    instant: stay.instant,
    stayName: stay.name,
    line: `${rangeWords(booking.checkIn, booking.checkOut)} · ${room.name}`,
    rows: [
      { label: "Booking", value: booking.reference },
      { label: "Deposit paid", value: rwf(booking.deposit) },
      { label: "MTN reference", value: booking.providerRef },
      { label: "Pay at the hotel", value: `${rwf(booking.deposit)} + extras` },
    ],
    email: GUEST.email,
    calendarAdded: booking.calendarAdded,
  };
}

export function mockTrips(): TripsData {
  return {
    upcoming: state.bookings.map((b) => {
      const stay = stayIn(b.slug);
      return {
        reference: b.reference,
        slug: stay.slug,
        hotel: stay.name,
        line: `${rangeWords(b.checkIn, b.checkOut)} · ${b.reference}`,
        photo: photo(stay.photos[0]?.name ?? "isangano-hotel-exterior"),
        countdown: countdownWords(HOME_TODAY, b.checkIn),
        confirmed: stay.instant,
        checkIn: {
          title: "Check-in is 1 of 3 done",
          detail: `Send your ID before ${weekday(b.checkIn, true)}.`,
        },
      };
    }),
    past: [
      {
        reference: "BK-17702",
        slug: "ishyamba-forest-lodge",
        hotel: "Ishyamba Forest Lodge",
        detail: "Nyamagabe · 2–4 Aug 2026 · 540 points",
        photo: photo("forest-lodge"),
        reviewed: true,
      },
      {
        reference: "BK-15218",
        slug: "isangano-lakeside-hotel",
        hotel: "Isangano Lakeside Hotel",
        detail: "Rubavu · 9–10 May 2026 · 230 points",
        photo: photo("isangano-hotel-exterior"),
        reviewed: false,
      },
    ],
  };
}

export function mockTripsEmpty(): TripsData {
  return { upcoming: [], past: [] };
}

function savedStay(stay: StayFixture, note: string | null): SavedStay {
  return {
    slug: stay.slug,
    name: stay.short,
    photo: photo(stay.photos[0]?.name ?? "isangano-hotel-exterior"),
    rating: stay.rating,
    reviewCount: stay.reviewCount,
    fromRwf: Math.min(...stay.rooms.map((r) => r.priceRwf)),
    note,
    saved: state.saved.includes(stay.slug),
  };
}

export function mockSaved(): SavedData {
  return {
    list: {
      title: "Lake Kivu weekend",
      stays: state.saved.flatMap((slug) => {
        const stay = stayOf(slug);
        return stay ? [savedStay(stay, null)] : [];
      }),
    },
    ideas: Object.entries(IDEAS).flatMap(([slug, note]) => {
      const stay = stayOf(slug);
      return stay && !state.saved.includes(slug) ? [savedStay(stay, note)] : [];
    }),
  };
}

export function mockSavedEmpty(): SavedData {
  return { list: { title: "Lake Kivu weekend", stays: [] }, ideas: [] };
}

export function mockMe(): MeData {
  const count = state.saved.length;
  return {
    name: GUEST.name,
    since: "Guest since Aug 2026 · 3 stays",
    email: GUEST.email,
    rewards: {
      name: "Amahoro Rewards",
      points: 1240,
      progress: 62,
      note: "760 more for a free late checkout · 649 pending from Isangano",
    },
    saved: `Lake Kivu weekend · ${count === 1 ? "1 stay" : `${count} stays`}`,
    payment: `MTN MoMo ${GUEST.momo}`,
    savedId: "Passport · encrypted",
    reach: "In the app and SMS",
    signOut: false,
  };
}

// ---------- Writes

/** The heart: saved, or not any more. Returns whether it is saved now. */
export function toggleSaved(slug: string): boolean {
  const on = state.saved.includes(slug);
  state.saved = on ? state.saved.filter((s) => s !== slug) : [...state.saved, slug];
  return !on;
}

/** Dates and guests for the search on Explore. */
export function setSearch(choice: DatesChoice): void {
  state.search = {
    checkIn: choice.checkIn,
    checkOut: choice.checkOut,
    adults: choice.adults,
    children: choice.children,
  };
}

/** A stay, a room and dates chosen on the sheet: the booking about to be paid. */
export function chooseStay(choice: DatesChoice): void {
  const slug = choice.slug ?? state.draft.slug;
  const stay = stayIn(slug);
  state.draft = {
    slug: stay.slug,
    roomId: roomOf(stay, choice.roomId).id,
    checkIn: choice.checkIn,
    checkOut: choice.checkOut,
    adults: choice.adults,
    children: choice.children,
  };
  state.search = {
    checkIn: choice.checkIn,
    checkOut: choice.checkOut,
    adults: choice.adults,
    children: choice.children,
  };
}

/** Pay: the prompt goes to the wallet, and the room is held for 30 minutes. */
export function startPayment(method: PayMethodId): PaymentData {
  const checkout = mockCheckout();
  const n = Number(state.payment.id.slice(3)) + (state.payment.slug === state.draft.slug ? 0 : 1);
  state.payment = {
    id: `PI-${n}`,
    method,
    amount: checkout.deposit,
    sentAt: "09:12",
    checkedAt: "09:12:40",
    heldUntil: "09:42",
    slug: state.draft.slug,
    roomId: state.draft.roomId,
    prompts: 1,
  };
  return mockPayment();
}

/** "Send it again": a second prompt to the same number. */
export function resendPrompt(): PaymentData {
  state.payment = { ...state.payment, prompts: state.payment.prompts + 1, checkedAt: "09:13:05" };
  return mockPayment();
}

/**
 * "I've approved, check now": the provider confirms and the room is booked. Paying again for a stay
 * already booked on the same dates returns that booking: the prototype's "don't pay twice".
 */
export function confirmPayment(): BookedData {
  const d = state.draft;
  const same = state.bookings.find(
    (b) => b.slug === d.slug && b.roomId === d.roomId && b.checkIn === d.checkIn && b.checkOut === d.checkOut,
  );
  if (same) {
    state.lastBooked = same.reference;
    return mockBooked();
  }
  const n = state.bookings.length;
  const booking: Booking = {
    reference: `BK-${20431 + n}`,
    slug: d.slug,
    roomId: d.roomId,
    checkIn: d.checkIn,
    checkOut: d.checkOut,
    adults: d.adults,
    children: d.children,
    deposit: state.payment.amount,
    providerRef: `MP261003.0914.K${28417 + n}`,
    calendarAdded: false,
  };
  state.bookings = [booking, ...state.bookings];
  state.lastBooked = booking.reference;
  return mockBooked();
}

export function addToCalendar(): BookedData {
  state.bookings = state.bookings.map((b) => (b.reference === state.lastBooked ? { ...b, calendarAdded: true } : b));
  return mockBooked();
}
