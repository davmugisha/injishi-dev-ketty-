/**
 * EVERY PRICE, CAPACITY AND INCLUSION ON A SELLABLE SERVICE, IN ONE FILE.
 *
 * Read this before you trust anything it returns. `Services` on this site used
 * to mean the marketing pillars — escrow, self check-in, RRA compliance — which
 * now live at `/how-it-works`. It means something else here: a chargeable hotel
 * amenity sold on its own, without a room. A pool day pass, a conference hall
 * for a wedding, a marquee, a lawn, a parking bay.
 *
 * NONE OF IT IS REAL YET, IN TWO SEPARATE SENSES, AND BOTH MATTER.
 *
 * First, there is no Services module. Nothing in the API stores an amenity, no
 * table prices one, and no booking flow reserves one. Every figure below —
 * every `priceRwf`, every `capacity`, every line of `features` — was invented
 * for this fixture. The properties they hang off are FICTIONAL demo businesses
 * (`data/properties.ts`, renamed from real ones on 2026-09-14): the pool at the
 * Sept Sentiers, the convention wing at the Amberhill and the parking at
 * Paperbark Apartments exist only in this demo. What is fabricated is also the COMMERCE — the rate, the
 * inclusions and the head count. Those must not be quoted to a guest,
 * screenshotted for a pitch, or read as a price any of these businesses
 * charges. The rates are plausible for Kigali and the lake in 2026; that is all
 * they are.
 *
 * Second, the photography. There is no amenity photography in `public/assets/`
 * — no pool, no ballroom, no marquee, no car park. Rather than reference files
 * that do not exist, every gallery frame here reuses an existing stem and the
 * `alt` text describes THE PHOTOGRAPH, not the amenity. A frame captioned
 * "Kigali from the Nyarutarama hills" is a picture of Kigali from the
 * Nyarutarama hills, sitting beside a marquee listing, and says so. Writing
 * "the marquee on the hotel lawn" under a stock hillside would be the one lie a
 * demo notice cannot undo.
 *
 * WHEN THE REAL MODULE LANDS, DELETE THIS FILE and let the amenity rows come
 * from the property that owns them.
 *
 * Nothing here is derived from `Math.random()` or `Date.now()`. It is a static
 * table, so the server render and the client hydration cannot disagree.
 */

/** The five kinds the product brief names. Nothing else is sellable yet. */
export type ServiceKind = "pool" | "hall" | "tents" | "outdoor" | "parking";

export interface ServiceListing {
  slug: string;
  name: string;
  kind: ServiceKind;
  /** A real slug in `data/properties.ts`. The detail page links back to it. */
  propertySlug: string;
  propertyName: string;
  /** One line, for a card. */
  blurb: string;
  /** Full paragraphs, for the detail page. */
  about: string[];
  priceRwf: number;
  /** What the figure buys: "per person, per day", "per event", … */
  priceUnit: string;
  /** How many people, or how many bays. Prose, because the units differ. */
  capacity: string;
  /** Stems in `public/assets/`; `alt` describes the photograph, not the amenity. */
  gallery: { stem: string; alt: string }[];
  /** What the price includes. Rendered as the "What is included" list. */
  features: string[];
}

/**
 * The label each kind is shown under.
 *
 * Declared beside the union rather than in a component, so the index page, the
 * detail page and anything the property page grows later all word a pool the
 * same way. `Record<ServiceKind, …>` means adding a sixth kind to the union
 * fails the build here until it is named.
 */
export const SERVICE_KIND_LABEL: Record<ServiceKind, string> = {
  pool: "Swimming pools",
  hall: "Halls and conference rooms",
  tents: "Tents and marquees",
  outdoor: "Outdoor spaces",
  parking: "Parking",
};

/**
 * The short, singular form, for a tag on a card.
 *
 * Kept apart from `SERVICE_KIND_LABEL` rather than derived from it by trimming
 * an "s": "Halls and conference rooms" and "Parking" do not singularise the
 * same way, and a rule that gets four of five right prints "Parkin" on the
 * fifth.
 */
export const SERVICE_KIND_TAG: Record<ServiceKind, string> = {
  pool: "Pool",
  hall: "Hall",
  tents: "Tent",
  outdoor: "Outdoor",
  parking: "Parking",
};

/** One line under each group heading on the index. */
export const SERVICE_KIND_BLURB: Record<ServiceKind, string> = {
  pool: "Day passes for people who are not staying the night.",
  hall: "Weddings, conferences and launches, priced per day or per event.",
  tents: "Marquees for a function, and safari tents pitched on a camp site.",
  outdoor: "Lawns, terraces and gardens hired whole.",
  parking: "A bay by the night, at hotels with more of them than they need.",
};

/**
 * The order the kinds are shown in, on every surface.
 *
 * Not `Object.keys(SERVICE_KIND_LABEL)` — that would tie the reading order of
 * the page to the declaration order of a lookup table, and the next person to
 * alphabetise the table would silently reorder the marketplace. This is the
 * running order: the two impulse buys first, the three considered ones after.
 */
export const SERVICE_KIND_ORDER: ServiceKind[] = [
  "pool",
  "hall",
  "outdoor",
  "tents",
  "parking",
];

export const SERVICE_LISTINGS: ServiceListing[] = [
  // ---------------------------------------------------------------- pools
  {
    slug: "swimming-pool",
    name: "Swimming Pool Day Pass",
    kind: "pool",
    propertySlug: "hotel-des-sept-sentiers",
    propertyName: "Hôtel des Sept Sentiers",
    blurb:
      "The Kiyovu pool, open to non-residents from seven in the morning until dusk.",
    about: [
      "The best-known pool in Kigali sits in the courtyard at the Sept Sentiers, ringed by loungers and shaded on the western side by the hotel's own terrace. A day pass buys the water, a lounger and a towel from opening at 07:00 until the deck closes at 18:30.",
      "It is a working hotel pool rather than a leisure centre, so it is quietest before ten and after four. Weekends fill from midday, and the hotel caps the deck rather than let it get uncomfortable — book the day before if you are coming as a group.",
      "Children under twelve swim free with a paying adult. There is no lifeguard on the deck outside 09:00 to 17:00, and children must be with an adult at all times.",
    ],
    priceRwf: 15000,
    priceUnit: "per person, per day",
    capacity: "Up to 80 on the deck at once; children under 12 free with an adult",
    gallery: [
      {
        stem: "mille-collines-01",
        alt: "Hôtel des Sept Sentiers seen from its garden side",
      },
      {
        stem: "mille-collines-02",
        alt: "The Sept Sentiers building above the Kiyovu treeline",
      },
      {
        stem: "kigali-hills-view-01",
        alt: "Kigali's hills in the afternoon, the view from the Kiyovu ridge",
      },
    ],
    features: [
      "Full day access, 07:00 to 18:30",
      "One sun lounger and a towel per guest",
      "Changing rooms, showers and a locker",
      "Poolside food and drink ordered to the lounger, charged separately",
      "Free parking in the hotel yard for the day",
    ],
  },
  {
    slug: "lake-kivu-pool-day-pass",
    name: "Lakeside Pool Day Pass",
    kind: "pool",
    propertySlug: "sunbird-bay-hotel",
    propertyName: "Sunbird Bay Hotel",
    blurb: "Swim, then walk twenty metres onto the Gisenyi beach.",
    about: [
      "The pool at the Sunbird Bay sits between the palm gardens and the private beach, so a day pass is really two things: the pool deck, and the stretch of sand the hotel keeps raked in front of it.",
      "Gisenyi is warm all year and the lake never gets cold, which is why this is the one day pass on Injishi that sells better on a Tuesday than a Saturday — the Kigali crowd arrives at the weekend, the town uses it during the week.",
      "The rate covers the deck and the beach. Kayaks and the boat jetty are the hotel's watersports desk, booked and paid for separately at the desk.",
    ],
    priceRwf: 12000,
    priceUnit: "per person, per day",
    capacity: "Up to 120 across the pool deck and the beach loungers",
    gallery: [
      { stem: "lake-kivu-01", alt: "Lake Kivu from the Gisenyi shore" },
      { stem: "lake-kivu-02", alt: "The Kivu shoreline under afternoon cloud" },
      { stem: "rwanda-lake-kivu", alt: "Lake Kivu's islands at the end of the day" },
    ],
    features: [
      "Pool deck and the hotel's private beach, 08:00 to 19:00",
      "A lounger, a parasol and a towel",
      "Changing rooms and outdoor showers",
      "Beach volleyball court, first come first served",
      "Watersports and boat hire arranged at the desk, charged separately",
    ],
  },
  {
    slug: "amberhill-pool-and-health-club",
    name: "Pool and Health Club Day Pass",
    kind: "pool",
    propertySlug: "amberhill-convention-hotel",
    propertyName: "Amberhill Convention Hotel",
    blurb:
      "Heated outdoor pool, gym and steam room on the Kimihurura convention campus.",
    about: [
      "The Amberhill's pool is heated and open year round, which in Kigali matters mostly in the wet months when the evenings turn cold. The day pass bundles it with the health club — the gym floor, the sauna and the steam room — rather than selling the water on its own.",
      "It is the pass business travellers buy between meetings, so it is busiest at lunchtime and again after six. The hotel holds a quota back for people who are not staying, which is what makes a same-day booking usually possible.",
      "A towel, a locker and a bottle of water are included. The spa treatment rooms are a separate business and are booked with the spa directly.",
    ],
    priceRwf: 20000,
    priceUnit: "per person, per day",
    capacity: "Up to 60 in the health club at once; pool deck seats 90",
    gallery: [
      {
        stem: "kigali-convention-centre-02",
        alt: "The Amberhill convention wing dome lit at night, next door to the hotel",
      },
      {
        stem: "kigali-cbd-buildings-01",
        alt: "Office towers in central Kigali",
      },
      {
        stem: "kigali-night-panorama-02",
        alt: "Kigali after dark, seen from the Kimihurura ridge",
      },
    ],
    features: [
      "Heated outdoor pool, 06:00 to 21:00",
      "Gym floor, sauna and steam room",
      "Towel, locker and a bottle of water",
      "Basement parking for the day",
      "Spa treatments booked separately with the spa",
    ],
  },

  // ---------------------------------------------------------------- halls
  {
    slug: "amberhill-convention-hall",
    name: "Amberhill Convention Hall",
    kind: "hall",
    propertySlug: "amberhill-convention-hotel",
    propertyName: "Amberhill Convention Hotel",
    blurb: "The 2,600-seat auditorium, hired by the day with the crew that runs it.",
    about: [
      "This is the room Rwanda holds its summits in: a tiered auditorium under the dome at Kimihurura, seating 2,600 theatre-style, with simultaneous interpretation booths, a full stage and a control room behind the back row.",
      "The day rate is for the hall and its technical crew — sound, lighting, projection and a stage manager. Interpreters, catering and the breakout rooms along the concourse are quoted on top, because almost no two events use the same combination.",
      "Load-in is the evening before at no extra charge, which is what makes a same-day set-up possible. The hotel needs the room specification fourteen days ahead for anything involving rigging.",
    ],
    priceRwf: 3200000,
    priceUnit: "per day",
    capacity: "2,600 seated theatre-style; 1,400 in banquet rounds",
    gallery: [
      {
        stem: "kigali-convention-centre-02",
        alt: "The Amberhill convention wing dome lit at night",
      },
      {
        stem: "kigali-parliament-aerial-01",
        alt: "Kigali from the air, the convention district in the middle distance",
      },
      { stem: "kigali-skyline-01", alt: "The Kigali skyline from the east" },
    ],
    features: [
      "Twelve-hour hire, 07:00 to 19:00, with load-in the evening before",
      "House sound, lighting, projection and a stage manager",
      "Six interpretation booths, interpreters not included",
      "Registration desks and cloakroom on the concourse",
      "Breakout rooms and catering quoted separately",
    ],
  },
  {
    slug: "lanternhouse-banquet-hall",
    name: "Lanternhouse Banquet Hall",
    kind: "hall",
    propertySlug: "lanternhouse-hotel-kiyovu",
    propertyName: "Lanternhouse Hotel Kiyovu",
    blurb: "The Kiyovu ballroom, the room Kigali holds its weddings in.",
    about: [
      "A pillarless ballroom off the Lanternhouse's main lobby, dressed for weddings most Saturdays and for launches and awards the rest of the week. It divides into two with an acoustic wall, so a 200-guest dinner does not have to sit in a room built for 450.",
      "The event rate covers eight hours in the room, the tables, the chairs, linen, a staged head table and the house sound. Catering is the hotel's own kitchen and is quoted per head; outside caterers are not permitted.",
      "Kigali's wedding season runs June to September and the Saturdays go a year ahead. Weekday events are usually available inside a month.",
    ],
    priceRwf: 1400000,
    priceUnit: "per event, up to 8 hours",
    capacity: "450 seated in banquet rounds; 700 standing; divides into two rooms",
    gallery: [
      { stem: "kigali-hills-view-01", alt: "Kigali's hills from the Kiyovu ridge" },
      { stem: "kigali-city-street-01", alt: "A street in central Kigali" },
      { stem: "kigali-skyline-01", alt: "The Kigali skyline from the east" },
    ],
    features: [
      "Eight hours in the room, plus two hours to dress it",
      "Round tables, banquet chairs, linen and a staged head table",
      "House sound, two radio microphones and a lectern",
      "A dressing room for the wedding party",
      "Catering by the hotel kitchen, quoted per head",
    ],
  },
  {
    slug: "lake-kivu-conference-hall",
    name: "Lake Kivu Conference Hall",
    kind: "hall",
    propertySlug: "sunbird-bay-hotel",
    propertyName: "Sunbird Bay Hotel",
    blurb: "A lakeside conference room for a retreat that does not want Kigali.",
    about: [
      "The conference centre at the Sunbird Bay is a single room with the lake on one long side, which is the whole reason organisations bring a retreat to Gisenyi rather than book a hall in town.",
      "The day rate is the room, the projector and screen, the flip charts and unlimited tea and coffee through the day. Lunch on the terrace is quoted per head and is what most bookings add.",
      "The room takes 180 theatre-style, 90 in a U-shape and 60 around a boardroom table. The hotel resets it between configurations at no charge if it has the night to do it.",
    ],
    priceRwf: 750000,
    priceUnit: "per day",
    capacity: "180 theatre-style; 90 in a U-shape; 60 boardroom",
    gallery: [
      { stem: "lake-kivu-03", alt: "Lake Kivu in flat morning light" },
      { stem: "lake-kivu-01", alt: "Lake Kivu from the Gisenyi shore" },
      { stem: "karongi-01", alt: "The hills above the Kivu shore at Karongi" },
    ],
    features: [
      "Nine hours in the room, 08:00 to 17:00",
      "Projector, screen, flip charts and a PA with two microphones",
      "Unlimited tea, coffee and still water",
      "Two configuration resets, if given the night to do them",
      "Lunch on the lake terrace, quoted per head",
    ],
  },

  // ------------------------------------------------------------- outdoor
  {
    slug: "poolside-lawn",
    name: "Poolside Lawn",
    kind: "outdoor",
    propertySlug: "bluefinch-hotel-remera",
    propertyName: "Bluefinch Hotel Remera",
    blurb: "The Remera lawn beside the pool, hired whole for an evening.",
    about: [
      "A flat, walled lawn between the Bluefinch's pool and its spa wing, hired as an empty space for the events that do not belong indoors: engagement parties, product launches, staff parties, the Sunday end of a wedding weekend.",
      "It comes empty on purpose. The hotel supplies power, lighting and the bar; furniture, staging and a marquee are hired on top, and the marquee listings on this page will pitch on it.",
      "Kigali's rain arrives in the afternoon in March and April and again in November. The hotel holds an indoor room in reserve for lawn bookings in those months, released back if the evening is dry.",
    ],
    priceRwf: 650000,
    priceUnit: "per event, up to 6 hours",
    capacity: "Up to 300 standing; 200 seated with furniture hired in",
    gallery: [
      { stem: "kigali-city-street-01", alt: "A street in Remera, eastern Kigali" },
      { stem: "kigali-hills-view-01", alt: "Kigali's hills in the afternoon" },
      { stem: "rwanda-tea-01", alt: "Tea terraces in the Rwandan highlands" },
    ],
    features: [
      "The whole lawn for six hours, exclusive use",
      "Three-phase power, festoon lighting and a lit path from the car park",
      "A staffed outdoor bar, drinks charged on consumption",
      "Security and a cloakroom at the gate",
      "A wet-weather room held in reserve, March to April and November",
    ],
  },
  {
    slug: "volcano-view-terrace",
    name: "Volcano View Terrace",
    kind: "outdoor",
    propertySlug: "seven-craters-boutique-hotel",
    propertyName: "Seven Craters Boutique Hotel",
    blurb: "A lava-stone terrace in Musanze facing the Virunga chain.",
    about: [
      "The terrace runs the length of the restaurant on the north side of the hotel, looking straight at the volcanoes. On a clear morning you can pick out Sabyinyo and Gahinga from a table; by six the light goes and the terrace turns into the best-placed drinks reception in Musanze.",
      "It is hired for briefings the night before a trek, for small dinners, and for the reception half of weddings that are staying in the north. Ninety standing is comfortable; more than that and the view stops being the point.",
      "Musanze is a thousand metres higher than Kigali and the evenings are genuinely cold. The rate includes the patio heaters and the blankets, which is not a detail anyone regrets paying for.",
    ],
    priceRwf: 380000,
    priceUnit: "per event, up to 6 hours",
    capacity: "Up to 90 standing; 55 seated at long tables",
    gallery: [
      {
        stem: "volcanoes-np-02",
        alt: "The Virunga volcanoes above the Musanze farmland",
      },
      { stem: "volcanoes-np-03", alt: "Cloud on the Virunga chain at dawn" },
      { stem: "rwanda-tea-02", alt: "Tea fields on the road north from Musanze" },
    ],
    features: [
      "The full terrace for six hours, exclusive use",
      "Patio heaters and blankets, included",
      "Ambient lighting and a portable PA",
      "A staffed bar on the terrace, drinks on consumption",
      "Canapés and dinner from the hotel kitchen, quoted per head",
    ],
  },

  // --------------------------------------------------------------- tents
  {
    slug: "garden-marquee-tent",
    name: "Garden Marquee",
    kind: "tents",
    propertySlug: "fairway-crest-hotel",
    propertyName: "Fairway Crest Hotel",
    blurb: "A 10 by 20 metre marquee, delivered, pitched and struck.",
    about: [
      "A clear-span marquee the hotel keeps for its own lawn and hires out with it. Ten metres by twenty, no internal poles, walls that come off panel by panel so the sides can be opened as the day warms up.",
      "The rate is the marquee, the crew that pitches it and the crew that takes it down. It goes up the day before and comes down the morning after, so a Saturday event is a three-day booking for the crew and a one-day charge for you.",
      "Furniture is not included and is the thing most bookings underestimate: two hundred people seated needs twenty round tables, and the hotel hires those separately.",
    ],
    priceRwf: 180000,
    priceUnit: "per tent, per day",
    capacity: "10m x 20m clear span; 120 seated at rounds, 200 standing",
    gallery: [
      {
        stem: "kigali-hills-view-01",
        alt: "Kigali from the Nyarutarama hills, above the golf course",
      },
      { stem: "kigali-city-street-01", alt: "A street in northern Kigali" },
      {
        stem: "kigali-skyline-01",
        alt: "The Kigali skyline seen from the north of the city",
      },
    ],
    features: [
      "10m x 20m clear-span frame, no internal poles",
      "Removable side walls and two sets of double doors",
      "Pitched the day before and struck the morning after",
      "Lighting rig and a distribution board inside the tent",
      "Tables, chairs and linen hired separately",
    ],
  },
  {
    slug: "akagera-safari-tent",
    name: "Akagera Safari Tent",
    kind: "tents",
    propertySlug: "acacia-horizon-game-lodge",
    propertyName: "Acacia Horizon Game Lodge",
    blurb: "A pitched twin tent on the lodge camp site, inside the park gate.",
    about: [
      "A canvas safari tent, already pitched on a cleared and fenced camp site below the lodge, with the escarpment on one side and Lake Ihema in the distance on the other. Two camp beds, real mattresses, a groundsheet and a storm fly.",
      "It is the cheapest legitimate way to sleep inside Akagera. The camp site shares the lodge's ablution block and its restaurant, and the night guard who walks the fence is the lodge's own, not a private hire.",
      "Buffalo and hippo use the shoreline below the fence at night and the noise takes some getting used to. The lodge briefs every arrival on the camp rules before dark, and they are not optional.",
    ],
    priceRwf: 95000,
    priceUnit: "per tent, per night",
    capacity: "Sleeps two on twin camp beds; eight tents on the site",
    gallery: [
      {
        stem: "akagera-np-01",
        alt: "Akagera National Park's savannah under a high sky",
      },
      { stem: "akagera-np-02", alt: "Wetland and papyrus in Akagera" },
      { stem: "akagera-np-03", alt: "The Akagera escarpment above the lakes" },
    ],
    features: [
      "Tent pitched, made up and struck for you",
      "Two camp beds with mattresses, bedding and a mosquito net",
      "Shared hot showers and toilets in the lodge ablution block",
      "Fenced site with an overnight guard",
      "Breakfast at the lodge restaurant, included",
    ],
  },

  // ------------------------------------------------------------- parking
  {
    slug: "secure-parking-nyarutarama",
    name: "Secure Parking, Nyarutarama",
    kind: "parking",
    propertySlug: "orchard-row-suites",
    propertyName: "Orchard Row Suites",
    blurb: "A guarded bay in Nyarutarama by the night, whether you stay or not.",
    about: [
      "Orchard Row Suites has more parking than its own guests use, and Nyarutarama has almost no street parking anyone would leave a car on overnight. The bays are sold by the night to whoever wants them.",
      "The yard is inside the property gate, lit, and watched by the same guard who covers the building. Four of the thirty-six bays are under cover, which is worth having in the wet months and is allocated first come, first served.",
      "It is booked most often by people flying out of Kigali for a week and by upcountry visitors who would rather leave the car and take a moto into town.",
    ],
    priceRwf: 3000,
    priceUnit: "per vehicle, per night",
    capacity: "36 bays, 4 of them under cover; vehicles up to 5.5m",
    gallery: [
      {
        stem: "rwanda-apartment-interior",
        alt: "A serviced apartment interior at Orchard Row Suites",
      },
      { stem: "kigali-hills-view-01", alt: "Kigali from the Nyarutarama hills" },
      {
        stem: "kigali-city-street-01",
        alt: "A residential street in northern Kigali",
      },
    ],
    features: [
      "Inside the property gate, behind a manned barrier",
      "Lit all night and covered by the building's guard",
      "24-hour access with a code at the gate",
      "Four covered bays, first come first served",
      "Long stays of a week or more arranged at the desk",
    ],
  },
  {
    slug: "covered-parking-kacyiru",
    name: "Covered Parking, Kacyiru",
    kind: "parking",
    propertySlug: "paperbark-apartments",
    propertyName: "Paperbark Apartments",
    blurb: "Eighteen covered bays a short walk from the Kacyiru ministries.",
    about: [
      "Paperbark Apartments sits among the ministries and embassies in Kacyiru, where daytime parking is the constraint and overnight parking is the one people pay for. All eighteen bays here are under a roof.",
      "The rate is per vehicle per night, and a bay booked for a night is yours for the whole twenty-four hours rather than until check-out. Monthly rates are agreed at the desk and are meaningfully cheaper.",
      "One bay is marked accessible and sits beside the lift lobby. It is held back rather than sold on rotation, so it is worth asking for it rather than assuming it has gone.",
    ],
    priceRwf: 4500,
    priceUnit: "per vehicle, per night",
    capacity: "18 covered bays, one of them accessible; vehicles up to 2.1m high",
    gallery: [
      {
        stem: "rwanda-apartment-interior",
        alt: "An apartment interior at Paperbark Apartments",
      },
      {
        stem: "kigali-parliament-aerial-01",
        alt: "Kacyiru from the air, the ministry district below",
      },
      { stem: "kigali-city-street-01", alt: "A street in central Kigali" },
    ],
    features: [
      "All bays under a roof, 2.1m clearance",
      "Held for the full 24 hours, not until check-out",
      "Lit lobby and a lift straight into the building",
      "One accessible bay beside the lift, reserved on request",
      "Monthly rates agreed at the desk",
    ],
  },
];

/** One service by slug, or `undefined`. The detail route calls `notFound()`. */
export function findServiceListing(slug: string): ServiceListing | undefined {
  return SERVICE_LISTINGS.find((service) => service.slug === slug);
}

/**
 * Every service a property sells.
 *
 * The property page is written by a different feature and cannot reach into
 * this array itself, so the filter lives here — one definition of "the services
 * this hotel offers", used by the property page, by the detail page's "more at
 * this property" rail, and by anything that grows later.
 */
export function servicesForProperty(propertySlug: string): ServiceListing[] {
  return SERVICE_LISTINGS.filter((service) => service.propertySlug === propertySlug);
}

/** Every service of one kind, in declaration order. */
export function servicesOfKind(kind: ServiceKind): ServiceListing[] {
  return SERVICE_LISTINGS.filter((service) => service.kind === kind);
}
