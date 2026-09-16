/**
 * Injishi PMS demo dataset — one org, two hospitality properties (a 36-room
 * hotel and an 8-room guesthouse, so the IA can be seen scaling up and down)
 * plus a 12-unit residence portfolio.
 *
 * Ported from the claude.ai/design handoff's `pms-data.js`. This is the Phase 1
 * source of truth; Phase 5 replaces `buildDb()` with an API adapter returning
 * the same shapes.
 */

import type { OrgRole, Permission } from "@injishi/contracts";

import type {
  Db,
  HospitalityProperty,
  Person,
  ResidenceProperty,
  Reservation,
  ResStatus,
  Room,
  WorkspaceRef,
} from "./types";

/**
 * Every workspace the switcher offers. Host and Landlord are org workspaces
 * with roles; Broker is solo. The two government consoles left for their own
 * app (ADR-018, move 2) and Personal left for the marketplace app (move 4), so
 * all three are
 * government grants scoped to a district rather than businesses at all.
 */
export const workspaces: WorkspaceRef[] = [
  { key: "host", name: "Amahoro Hospitality Group", role: "Host workspace", sq: "#e0a94e" },
  { key: "landlord", name: "Green Hills Properties", role: "Landlord workspace", sq: "#3a9d8a" },
  { key: "broker", name: "Samuel Kayitare", role: "Broker · Kigali region", sq: "#c4574e" },
];

export const people: Record<string, Person> = {
  owner: { name: "Yves Rutayisire", title: "Owner", ini: "YR" },
  manager: { name: "Solange Uwera", title: "General Manager", ini: "SU" },
  receptionist: { name: "Denise Iribagiza", title: "Front desk · Front Office", ini: "DI" },
  housekeeper: { name: "Beatha Mukeshimana", title: "Housekeeping", ini: "BM" },
};

export const peopleRes: Record<string, Person> = {
  owner: { name: "Josephine Uwimana", title: "Owner", ini: "JU" },
  manager: { name: "Samuel Kayitare", title: "Portfolio manager", ini: "SK" },
};

/**
 * What each demo role may do, as a plain array of permissions.
 *
 * This is FIXTURE DATA, not an authorization model. It is deliberately an
 * array rather than a role lookup, because the app must render capability from
 * an array and nothing else (ADR-012, AC-4) — a client that resolves a role
 * through a table is the exact bug this standard removes.
 *
 * It stands in only while the API has not answered: standalone demo, or a tab
 * that cannot reach the server. The moment a real grant arrives it is ignored,
 * and the seed script grows the server side twin of these rows (ADR-012, step
 * 3). Keep the two in step; where they disagree, the server is right.
 */
export const DEMO_PERMISSIONS: Readonly<Record<OrgRole, readonly Permission[]>> = {
  // Owner and manager run the property: everything operational, money, team.
  owner: [
    "reservation.approve",
    "reservation.assign",
    "stay.checkin",
    "stay.checkout",
    "folio.charge",
    "folio.payment",
    "housekeeping.set",
    "ticket.advance",
    "order.advance",
    "menu.manage",
    "team.manage",
    "money.view",
    "rent.record",
    "lease.advance",
    "deposit.return",
    "unit.manage",
    "listing.manage",
    "message.send",
    "task.assign",
    "amenity.manage",
  ],
  manager: [
    "reservation.approve",
    "reservation.assign",
    "stay.checkin",
    "stay.checkout",
    "folio.charge",
    "folio.payment",
    "housekeeping.set",
    "ticket.advance",
    "order.advance",
    "menu.manage",
    "team.manage",
    "money.view",
    "rent.record",
    "lease.advance",
    "deposit.return",
    "unit.manage",
    "listing.manage",
    "message.send",
    "task.assign",
    "amenity.manage",
  ],
  // The front desk and service orders. No money view, no team, no housekeeping
  // board, no menu editing.
  receptionist: [
    "reservation.approve",
    "reservation.assign",
    "stay.checkin",
    "stay.checkout",
    "folio.charge",
    "folio.payment",
    "order.advance",
    "message.send",
  ],
  // The phone: room status and maintenance tickets only.
  housekeeper: ["housekeeping.set", "ticket.advance"],
};

/** Reservation factory — ids stay stable per property prefix. */
function mkR(prefix: string) {
  let i = 0;
  return (
    guest: string,
    room: string | null,
    start: number,
    nights: number,
    status: ResStatus,
    extra?: Partial<Reservation>,
  ): Reservation => ({
    id: prefix + String(60 + i++),
    guest,
    room,
    start,
    nights,
    status,
    ...extra,
  });
}

function hotel(): HospitalityProperty {
  const types: Record<string, [string, number]> = {
    S: ["Standard Twin", 85000],
    D: ["Deluxe King", 120000],
    F: ["Family Room", 150000],
    G: ["Garden Suite", 220000],
  };
  const rooms: Room[] = [];
  for (let f = 1; f <= 3; f++) {
    for (let n = 1; n <= 12; n++) {
      const num = String(f * 100 + n);
      const t = n <= 6 ? "S" : n <= 10 ? "D" : n === 11 ? "F" : "G";
      rooms.push({ id: num, type: types[t][0], rate: types[t][1], hk: "ready" });
    }
  }
  const hk: Record<string, Room["hk"]> = {
    "104": "needs",
    "205": "needs",
    "303": "needs",
    "307": "cleaning",
    "310": "cleaning",
    "201": "inspected",
    "203": "inspected",
  };
  rooms.forEach((r) => {
    if (hk[r.id]) r.hk = hk[r.id];
  });

  const R = mkR("BKG-44");
  const res: Reservation[] = [
    R("Josiane Mukamana", null, 3, 2, "pending", { rep: "4.8 ★ · 6 stays" }),
    R("Thierry Maniraho", null, 5, 4, "pending", { rep: "New guest" }),
    R("Lena Vogel", null, 1, 2, "pending", { rep: "4.9 ★ · 11 stays" }),
    R("Grace Kwizera", null, 0, 2, "confirmed", { time: "13:00" }),
    R("Eric Ishimwe", null, 1, 2, "confirmed"),
    R("Diane Umutoni", null, 2, 6, "confirmed"),
    R("Marco Rossi", null, 4, 3, "confirmed"),
    R("Aline Uwase", "207", 0, 3, "confirmed", { time: "14:00" }),
    R("Jean-Bosco Habimana", "103", 0, 2, "confirmed", { time: "15:30" }),
    R("Chantal Mutoni", "212", 0, 5, "confirmed", { time: "16:00" }),
    R("David Niyonzima", "311", 0, 2, "confirmed", { time: "18:00" }),
    R("Patrick Nsengimana", null, 0, 1, "confirmed", { walkin: true, time: "20:15" }),
    R("Amara Okafor", "312", -4, 6, "inhouse"),
    R("Priya Sharma", "208", -1, 3, "inhouse"),
    R("Tom Whelan", "209", -2, 4, "inhouse"),
    R("Sofia Andersson", "210", -3, 5, "inhouse"),
    R("James Chen", "101", -1, 2, "inhouse"),
    R("Fatima Al-Sayed", "102", -2, 3, "inhouse"),
    R("Robert Mwangi", "211", -5, 7, "inhouse"),
    R("Nadia Petrova", "302", -1, 4, "inhouse"),
    R("Kevin Mugisha", "111", -2, 3, "inhouse"),
    R("Immaculée Nyirahabimana", "105", -1, 2, "inhouse"),
    R("Aisha Bello", "108", -2, 4, "inhouse"),
    R("Carlos Mendes", "308", -3, 5, "inhouse"),
    R("Ingrid Nilsen", "110", -1, 3, "inhouse"),
    R("Omar Haddad", "202", -2, 5, "inhouse"),
    R("Zanele Dube", "306", -4, 6, "inhouse"),
    R("Olivier Rwema", "204", -3, 3, "inhouse", { time: "11:00" }),
    R("Sandrine Keza", "106", -2, 2, "inhouse", { time: "10:30" }),
    R("Claudine Ineza", "301", -4, 4, "inhouse", { time: "12:00" }),
    R("Fabrice Nkusi", "204", 1, 3, "confirmed"),
    R("Hugo Fernández", "207", 4, 2, "confirmed"),
    R("Mia Johansson", "103", 3, 2, "confirmed"),
    R("Yusuf Diallo", "210", 6, 3, "confirmed"),
    R("Elena Georgiou", "312", 3, 4, "confirmed"),
    R("Samuel Bright", "101", 2, 2, "confirmed"),
    R("Akiko Tanaka", "302", 5, 2, "confirmed"),
    R("Louis Moreau", "205", 2, 3, "confirmed"),
    R("Peter Okello", "205", -4, 3, "out"),
    R("Hannah Weber", "104", -3, 2, "out"),
    R("George Otieno", "210", -6, 3, "out"),
  ];

  return {
    key: "hotel",
    name: "Kivu Crest Hotel",
    loc: "Rubavu · Lake Kivu",
    sq: "#4f86c6",
    departments: ["Front Office", "Housekeeping", "Food & Beverage", "Spa & Recreation", "Maintenance"],
    rooms,
    // A room type is what the guest gets; a rate is the terms it sells on. The
    // same rooms sell several ways at once, and a "follows" rate moves with its
    // parent rather than being maintained twice.
    roomTypes: [
      {
        key: "S", name: "Standard Twin", size: 22, occ: { max: 2, adults: 2, children: 0 }, st: "published",
        amen: ["wifi", "tv", "net", "desk", "hotwater", "shower", "towels"],
        bedrooms: [{ name: "Bedroom", configs: [{ def: true, beds: [["twin", 2]] }, { def: false, beds: [["double", 1]] }] }],
        plans: [
          { id: "S1", name: "Flexible", price: 85000, baseOcc: 2, cancel: "flex", mode: "instant", minN: 1 },
          { id: "S2", name: "Non-refundable", price: 76500, baseOcc: 2, cancel: "nr", mode: "instant", minN: 1, follows: { parent: "Flexible", pct: -10 } },
          { id: "S3", name: "Bed & breakfast", price: 99000, baseOcc: 2, cancel: "flex", mode: "instant", minN: 1 },
        ],
      },
      {
        key: "D", name: "Deluxe King", size: 28, occ: { max: 3, adults: 2, children: 1 }, st: "published",
        amen: ["wifi", "tv", "net", "ac", "desk", "kettle", "safe", "smoke", "hotwater", "shower", "towels", "hairdry"],
        bedrooms: [{ name: "Bedroom", configs: [{ def: true, beds: [["king", 1]] }] }],
        plans: [
          { id: "D1", name: "Flexible", price: 120000, baseOcc: 2, cancel: "flex", mode: "instant", minN: 1 },
          { id: "D2", name: "Non-refundable", price: 108000, baseOcc: 2, cancel: "nr", mode: "instant", minN: 1, follows: { parent: "Flexible", pct: -10 } },
          { id: "D3", name: "Bed & breakfast", price: 134000, baseOcc: 2, cancel: "flex", mode: "instant", minN: 1 },
        ],
      },
      {
        key: "F", name: "Family Room", size: 34, occ: { max: 4, adults: 2, children: 2 }, st: "published",
        amen: ["wifi", "tv", "net", "fridge", "kettle", "wardrobe", "hotwater", "shower", "towels"],
        bedrooms: [{ name: "Bedroom", configs: [{ def: true, beds: [["double", 1], ["single", 2]] }] }],
        plans: [
          { id: "F1", name: "Flexible", price: 150000, baseOcc: 3, cancel: "flex", mode: "instant", minN: 1 },
          { id: "F2", name: "Non-refundable", price: 135000, baseOcc: 3, cancel: "nr", mode: "instant", minN: 1, follows: { parent: "Flexible", pct: -10 } },
        ],
      },
      {
        key: "G", name: "Garden Suite", size: 42, occ: { max: 3, adults: 2, children: 1 }, st: "published",
        amen: ["wifi", "tv", "ac", "net", "desk", "kettle", "fridge", "safe", "smoke", "view", "wardrobe", "hotwater", "shower", "towels", "hairdry"],
        bedrooms: [
          { name: "Bedroom", configs: [{ def: true, beds: [["king", 1]] }] },
          { name: "Living room", configs: [{ def: true, beds: [["sofa", 1]] }] },
        ],
        plans: [
          { id: "G1", name: "Flexible", price: 220000, baseOcc: 2, cancel: "flex", mode: "instant", minN: 1 },
          { id: "G2", name: "Long stay · 3+ nights", price: 198000, baseOcc: 2, cancel: "mod", mode: "instant", minN: 3 },
        ],
      },
    ],
    propAmen: ["restaurant", "breakfast", "pool", "parking", "garden", "laundry", "shuttle", "front24", "housekeeping", "guard", "generator", "momo", "firstaid"],
    shared: ["Shared lounge", "Garden", "Pool area"],
    res,
    extras: {
      "Amara Okafor": {
        lines: [
          ["Food & Beverage", "Room service · breakfast", -3, 8500],
          ["Food & Beverage", "Restaurant · dinner", -2, 24000],
          ["Spa & Recreation", "Deep tissue massage · 60 min", -2, 35000],
          ["Food & Beverage", "Minibar", -1, 6000],
          ["Housekeeping", "Laundry · 8 items", -1, 12000],
        ],
        pay: [["Mobile money · deposit", -4, 300000]],
      },
      "Tom Whelan": {
        lines: [["Food & Beverage", "Restaurant · dinner", -1, 18500]],
        pay: [["Card · deposit", -2, 150000]],
      },
      "Sofia Andersson": {
        lines: [["Spa & Recreation", "Sauna · day pass", -1, 15000]],
        pay: [],
      },
      "Robert Mwangi": {
        lines: [
          ["Food & Beverage", "Room service · dinner", -2, 21000],
          ["Housekeeping", "Laundry · 4 items", -3, 7000],
        ],
        pay: [["Mobile money · deposit", -5, 250000]],
      },
      "Olivier Rwema": {
        lines: [["Food & Beverage", "Room service · breakfast", -1, 8500]],
        pay: [["Mobile money · deposit", -3, 200000]],
      },
    },
    // Two unassigned rooms from *yesterday* are deliberate: the board has to
    // make an ageing task obvious.
    tasks: [
      { room: "303", kind: "Checkout clean", ts: "Today 08:40", who: null },
      { room: "310", kind: "Checkout clean", ts: "Today 09:30", who: "Beatha M.", started: true },
      { room: "307", kind: "Stay-over refresh", ts: "Today 09:15", who: "Claudine M.", started: true },
      { room: "104", kind: "Checkout clean", ts: "Yesterday 11:20", who: null },
      { room: "205", kind: "Checkout clean", ts: "Yesterday 12:05", who: null },
      { room: "306", kind: "Stay-over refresh", ts: "Today 10:00", who: "Beatha M." },
    ],
    tickets: [
      { id: "T-118", room: "207", fault: "Plumbing", title: "Shower drain blocked", by: "Beatha M.", age: "2 h", st: "open", ph: "shower drain photo" },
      { id: "T-117", room: "305", fault: "Electrical", title: "Bedside lamp flickers", by: "Front desk", age: "5 h", st: "open", ph: "bedside lamp photo" },
      { id: "T-116", room: "112", fault: "Furniture", title: "Wardrobe door off its hinge", by: "Beatha M.", age: "1 d", st: "assigned", to: "Claude N.", ph: "wardrobe door photo" },
      { id: "T-114", room: "Pool", fault: "Other", title: "Pump pressure low", by: "Solange U.", age: "1 d", st: "progress", to: "Claude N.", ph: "pool pump photo" },
      { id: "T-112", room: "204", fault: "Plumbing", title: "Sink tap dripping", by: "Housekeeping", age: "3 d", st: "resolved", to: "Claude N.", ph: "sink tap photo" },
      { id: "T-111", room: "Lobby", fault: "Electrical", title: "Entrance light dead", by: "Front desk", age: "4 d", st: "resolved", to: "Claude N.", ph: "entrance light photo" },
    ],
    orders: [
      { id: "O-231", room: "312", guest: "Amara Okafor", dept: "Food & Beverage", items: ["Club sandwich × 1", "Fresh passion juice × 2"], total: 15500, age: "3 min", st: "new" },
      { id: "O-232", room: "111", guest: "Kevin Mugisha", dept: "Food & Beverage", items: ["Chicken brochette × 2"], total: 19000, age: "6 min", st: "new" },
      { id: "O-230", room: "208", guest: "Priya Sharma", dept: "Food & Beverage", items: ["Chicken brochette × 1", "Fanta citron × 1"], total: 11500, age: "11 min", st: "prep" },
      { id: "O-229", room: "210", guest: "Sofia Andersson", dept: "Spa & Recreation", items: ["Swedish massage · 60 min"], total: 35000, age: "14 min", st: "prep" },
      { id: "O-228", room: "209", guest: "Tom Whelan", dept: "Food & Beverage", items: ["Continental breakfast × 1"], total: 8500, age: "24 min", st: "way" },
      { id: "O-226", room: "202", guest: "Omar Haddad", dept: "Food & Beverage", items: ["Espresso × 2"], total: 5000, age: "48 min", st: "done" },
    ],
    menu: {
      "Food & Beverage": [
        ["Continental breakfast", 8500, true],
        ["Club sandwich", 9500, true],
        ["Chicken brochette", 9500, true],
        ["Fresh passion juice", 3000, true],
        ["Fanta citron", 2000, true],
        ["Espresso", 2500, true],
        ["House red wine · glass", 6000, false],
      ],
      "Spa & Recreation": [
        ["Swedish massage · 60 min", 35000, true],
        ["Deep tissue massage · 60 min", 35000, true],
        ["Sauna · day pass", 15000, true],
        ["Pool cabana · half day", 20000, false],
      ],
      Housekeeping: [
        ["Laundry · per item", 1500, true],
        ["Extra bed", 10000, true],
      ],
    },
    staff: [
      ["Whole property", [["Yves Rutayisire", "Owner", "Owner"], ["Solange Uwera", "General Manager", "Manager"]]],
      ["Front Office", [["Denise Iribagiza", "Receptionist · day", "Receptionist"], ["Eric Habumugisha", "Night auditor", "Receptionist"]]],
      ["Housekeeping", [["Beatha Mukeshimana", "Room attendant", "Housekeeper"], ["Claudine Mukandayisenga", "Room attendant", "Housekeeper"]]],
      ["Food & Beverage", [["Jean-Claude Bizimana", "Chef", "Staff"], ["Aline Mukarurangwa", "Server", "Staff"]]],
      ["Spa & Recreation", [["Grace Umuhoza", "Therapist", "Staff"]]],
      ["Maintenance", [["Claude Nsabimana", "Technician", "Staff"]]],
    ],
    rev: {
      month: "July 2026 · month to date",
      depts: [
        ["Rooms", 8420000, 1250000],
        ["Food & Beverage", 2180000, 940000],
        ["Spa & Recreation", 1240000, 410000],
      ],
      undistributed: [
        ["Administration & general", 620000],
        ["Utilities", 480000],
        ["Property maintenance", 350000],
      ],
    },
    // M1 ends on an unanswered question, M2 has to reach the folio, M3 pairs a
    // reply with an approve/decline, and M4 exists to prove a quiet thread
    // looks quiet.
    threads: [
      {
        id: "M1", with: "Grace Kwizera", ref: "BKG-4463", kind: "Arriving today · 13:00", unread: true,
        msgs: [
          { from: "guest", text: "Muraho! We land at 11:40 — is early check-in around 13:00 possible?", ts: "09:12" },
          { from: "host", text: "Muraho Grace! 13:00 works — your room will be ready. Safe flight!", ts: "09:20" },
          { from: "guest", text: "Murakoze! One more thing — do you run an airport shuttle, or should we take a taxi?", ts: "09:41" },
        ],
      },
      {
        id: "M2", with: "Amara Okafor", ref: "BKG-4472", kind: "In-house · Room 312", unread: true,
        msgs: [
          { from: "guest", text: "Hi — could I book a deep tissue massage tomorrow around 16:00? Add it to my bill please.", ts: "10:02" },
        ],
      },
      {
        id: "M3", with: "Thierry Maniraho", ref: "BKG-4461", kind: "Booking request · 4 nights", unread: true,
        msgs: [
          { from: "guest", text: "Hello! Before you approve — is the Family Room OK for 2 adults and 2 kids (6 and 9)? And do you have a crib?", ts: "08:15" },
        ],
      },
      {
        id: "M4", with: "Tom Whelan", ref: "BKG-4474", kind: "In-house · Room 209", unread: false,
        msgs: [
          { from: "guest", text: "What time does breakfast start?", ts: "Yesterday 21:04" },
          { from: "host", text: "From 06:30 to 10:00 in the garden restaurant — coffee is out from 06:00.", ts: "Yesterday 21:10" },
          { from: "guest", text: "Perfect, thanks!", ts: "Yesterday 21:12" },
        ],
      },
    ],
    invSeq: 341,
    msgs: 3,
  };
}

function guesthouse(): HospitalityProperty {
  const rooms: Room[] = [];
  for (let n = 1; n <= 8; n++) {
    rooms.push({
      id: String(n),
      type: n <= 5 ? "Double" : "Twin",
      rate: n <= 5 ? 45000 : 55000,
      hk: "ready",
    });
  }
  rooms[6].hk = "needs";

  const R = mkR("BKG-91");
  const res: Reservation[] = [
    R("Alice Mukandori", "1", 0, 2, "confirmed", { time: "15:00" }),
    R("Marie Ingabire", "3", -1, 3, "inhouse"),
    R("Paul Rukundo", "6", -3, 4, "inhouse"),
    R("Jean Mugenzi", "5", -2, 2, "inhouse", { time: "10:00" }),
    R("Emma Scott", "2", 4, 2, "confirmed"),
    R("Noah Kim", "4", 2, 3, "confirmed"),
    R("David Barnes", "7", -4, 2, "out"),
  ];

  return {
    key: "guesthouse",
    name: "Umucyo Guesthouse",
    loc: "Kacyiru · Kigali",
    sq: "#3a9d8a",
    departments: ["Front Office", "Housekeeping"],
    rooms,
    // Both plans sell on `request`, not instant: a small guesthouse approves its
    // own bookings. The Garden Annex is the incomplete-listing case — a draft
    // with no size, no amenities and no plans.
    roomTypes: [
      {
        key: "D", name: "Double", size: 16, occ: { max: 2, adults: 2, children: 0 }, st: "published",
        amen: ["wifi", "net", "hotwater", "towels", "wardrobe"],
        bedrooms: [{ name: "Bedroom", configs: [{ def: true, beds: [["double", 1]] }] }],
        plans: [{ id: "GD1", name: "Standard rate", price: 45000, baseOcc: 2, cancel: "flex", mode: "request", minN: 1 }],
      },
      {
        key: "T", name: "Twin", size: 18, occ: { max: 2, adults: 2, children: 0 }, st: "published",
        amen: ["wifi", "net", "desk", "hotwater", "towels", "wardrobe"],
        bedrooms: [{ name: "Bedroom", configs: [{ def: true, beds: [["twin", 2]] }] }],
        plans: [{ id: "GT1", name: "Standard rate", price: 55000, baseOcc: 2, cancel: "flex", mode: "request", minN: 1 }],
      },
      { key: "A", name: "Garden Annex", size: null, occ: { max: 2, adults: 2, children: 0 }, st: "draft", amen: [], bedrooms: [], plans: [] },
    ],
    propAmen: ["breakfast", "garden", "parking", "laundry", "momo", "guard"],
    shared: ["Shared kitchen", "Garden", "Rooftop terrace"],
    res,
    extras: {
      "Marie Ingabire": { lines: [["Front Office", "Breakfast", -1, 5000]], pay: [] },
      "Jean Mugenzi": { lines: [], pay: [["Cash · deposit", -2, 45000]] },
    },
    tasks: [{ room: "7", kind: "Checkout clean", ts: "Yesterday 13:00", who: null }],
    tickets: [],
    orders: [],
    menu: {},
    staff: [
      ["Whole property", [["Josephine Uwimana", "Owner-operator", "Owner"]]],
      ["Front Office", [["Chantal Uwamahoro", "Receptionist", "Receptionist"]]],
      ["Housekeeping", [["Vestine Nyiramana", "Room attendant", "Housekeeper"]]],
    ],
    rev: {
      month: "July 2026 · month to date",
      depts: [["Rooms", 1240000, 180000]],
      undistributed: [
        ["Utilities", 96000],
        ["Administration & general", 74000],
      ],
    },
    threads: [
      {
        id: "M1", with: "Alice Mukandori", ref: "BKG-9160", kind: "Arriving today · 15:00", unread: true,
        msgs: [
          { from: "guest", text: "Muraho! I arrive from Nairobi this afternoon — what is the easiest way to reach you from town? And is dinner possible?", ts: "11:32" },
        ],
      },
    ],
    invSeq: 58,
    msgs: 1,
  };
}

function residence(): ResidenceProperty {
  const types = ["2 bedroom", "1 bedroom", "Studio"];
  const rents = [250000, 180000, 120000];
  const units = [];
  for (let n = 1; n <= 12; n++) {
    const t = n <= 4 ? 0 : n <= 9 ? 1 : 2;
    units.push({ id: "GH-" + String(n).padStart(2, "0"), type: types[t], rent: rents[t] });
  }

  return {
    key: "residence",
    name: "Green Hills Apartments",
    loc: "Kacyiru · Kigali",
    sq: "#3a9d8a",
    fixer: "Emmanuel K.",
    units,
    leases: [
      { id: "L-201", tenant: "Claudine Uwase", unit: "GH-01", rent: 250000, start: "01 Feb 2026", end: "31 Jan 2027", st: "active", pay: "paid", payLine: "Paid 02 Jul" },
      { id: "L-202", tenant: "Innocent Bizimungu", unit: "GH-02", rent: 250000, start: "01 Apr 2026", end: "31 Mar 2027", st: "active", pay: "due", payLine: "Due 20 Jul" },
      { id: "L-204", tenant: "Pacifique Niyonsenga", unit: "GH-04", rent: 250000, start: "01 Nov 2025", end: "31 Oct 2026", st: "active", pay: "overdue", payLine: "Overdue · 9 days" },
      { id: "L-205", tenant: "Didier Nshuti", unit: "GH-05", rent: 180000, start: "01 Jan 2026", end: "31 Dec 2026", st: "active", pay: "paid", payLine: "Paid 01 Jul" },
      { id: "L-207", tenant: "Solide Umutesi", unit: "GH-07", rent: 180000, start: "01 Mar 2026", end: "28 Feb 2027", st: "active", pay: "overdue", payLine: "Overdue · 4 days" },
      { id: "L-208", tenant: "Sylvie Mukashema", unit: "GH-08", rent: 120000, start: "01 Jun 2026", end: "31 May 2027", st: "active", pay: "paid", payLine: "Paid 03 Jul" },
      { id: "L-209", tenant: "Angel Ishimwe", unit: "GH-09", rent: 120000, start: "01 May 2026", end: "30 Apr 2027", st: "active", pay: "due", payLine: "Due 20 Jul" },
      { id: "L-211", tenant: "Frank Mugabo", unit: "GH-11", rent: 180000, start: "01 Dec 2025", end: "30 Nov 2026", st: "active", pay: "paid", payLine: "Paid 05 Jul" },
      { id: "L-203", tenant: "Marthe Uwineza", unit: "GH-03", rent: 180000, start: "01 Aug 2025", end: "31 Jul 2026", st: "ending", pay: "paid", payLine: "Paid 01 Jul" },
      { id: "L-206", tenant: "Robert Ndayambaje", unit: "GH-06", rent: 180000, start: "01 Aug 2026", end: "31 Jul 2027", st: "awaiting" },
      { id: "L-212", tenant: "Kevin Rwigamba", unit: "GH-12", rent: 120000, start: "15 Aug 2026", end: "14 Aug 2027", st: "draft" },
      { id: "L-210", tenant: "Jeanette Mukandanga", unit: "GH-10", rent: 120000, start: "01 Jul 2025", end: "30 Jun 2026", st: "ended", depReturned: true },
    ],
    tickets: [
      { id: "T-64", room: "GH-03", fault: "Plumbing", title: "Water heater not heating", by: "Marthe U.", age: "4 h", st: "open", ph: "water heater photo" },
      { id: "T-63", room: "GH-07", fault: "Electrical", title: "Kitchen socket sparks", by: "Solide U.", age: "1 d", st: "assigned", to: "Emmanuel K.", ph: "kitchen socket photo" },
      { id: "T-61", room: "Compound", fault: "Other", title: "Gate hinge grinding", by: "Emmanuel K.", age: "2 d", st: "progress", to: "Emmanuel K.", ph: "gate hinge photo" },
      { id: "T-58", room: "GH-09", fault: "Plumbing", title: "Bathroom leak under sink", by: "Angel I.", age: "6 d", st: "resolved", to: "Emmanuel K.", ph: "sink leak photo" },
    ],
    staff: [
      ["Whole portfolio", [["Josephine Uwimana", "Owner", "Owner"], ["Samuel Kayitare", "Portfolio manager", "Manager"]]],
      ["Caretakers", [["Emmanuel Karangwa", "Caretaker · Green Hills", "Staff"], ["Devota Mukamana", "Cleaner", "Staff"]]],
    ],
    // M1 is the same arrears the rent roll shows, from the tenant's side; M2 is
    // the move-out screen's central question asked in the tenant's own words.
    threads: [
      {
        id: "M1", with: "Pacifique Niyonsenga", ref: "L-204", kind: "GH-04 · rent overdue 9 days", unread: true,
        msgs: [
          { from: "tenant", text: "Muraho — I am sorry for the delay. My salary lands on the 25th; can I pay July rent then, with the late days added?", ts: "08:12" },
        ],
      },
      {
        id: "M2", with: "Marthe Uwineza", ref: "L-203", kind: "GH-03 · moving out 31 Jul", unread: true,
        msgs: [
          { from: "tenant", text: "For the move-out review — should I repaint the bedroom wall myself, or would you deduct it from the deposit?", ts: "Yesterday 17:40" },
        ],
      },
      {
        id: "M3", with: "Angel Ishimwe", ref: "L-209", kind: "GH-09 · maintenance", unread: false,
        msgs: [
          { from: "tenant", text: "The sink leak is fixed — thank you for sending Emmanuel so fast!", ts: "Mon 09:30" },
          { from: "host", text: "Good to hear! I have closed the ticket.", ts: "Mon 10:02" },
        ],
      },
    ],
    // GH-10 is vacant since Jeanette moved out — the one unit brokers can see.
    dirListed: ["GH-10"],
    reveals: 3,
    // A lease never produces a tax invoice; this summary is what filing needs.
    // The step up in March is GH-07's lease starting.
    filing: {
      due: "31 Jan 2027",
      months: [
        ["January", 1530000],
        ["February", 1530000],
        ["March", 1710000],
        ["April", 1710000],
        ["May", 1710000],
        ["June", 1710000],
        ["July — so far", 910000],
      ],
    },
    msgs: 2,
  };
}

/**
 * Build the fixture database the screens not yet on the API read.
 *
 * There used to be two, a demo one and a trimmed "production" one, picked by
 * the topbar's Production/Demo pill. The pill is gone (ADR-043): whether this
 * deployment is the demo is the API's answer, not a fixture set.
 */
export function buildDb(): Db {
  return {
    hotel: hotel(),
    guesthouse: guesthouse(),
    residence: residence(),
  };
}
