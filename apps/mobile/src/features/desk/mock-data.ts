// The front desk's sample data (proto-ui, mock mode): Ishyamba Forest Lodge on Tue 13 Oct, as the
// prototype draws it (e-mgrdesk.mjs, DESK). Imported only by `data.ts`. The state below is the
// lodge's day; the mutations at the end change it the way the desk would (a check-in, a walk-in, a
// MoMo prompt that MTN confirms, a check-out, the shift close) and every view is built fresh, so
// screens show the change once `useAction` invalidates their reads.

import { rwf } from "@/lib/money";
import type { ProtoImage } from "@/proto/images";
import type {
  ArrivalCheck,
  ArrivalRow,
  CheckoutRequest,
  DepartureRow,
  DeskArrival,
  DeskCheckout,
  DeskIdCheck,
  DeskLine,
  DeskMe,
  DeskMoney,
  DeskPaymentWait,
  DeskRack,
  DeskReceipt,
  DeskSettings,
  DeskTentStep,
  DeskToday,
  DeskWalkInForm,
  MoneyEntry,
  PayMethod,
  RackNight,
  RackTent,
  ShiftClose,
  TentKind,
  TentOption,
  WalkInRequest,
} from "./types";

// ------------------------------------------------------------------ people and words

type Pronoun = { subject: "he" | "she" | "they"; possessive: "his" | "her" | "their" };
const HE: Pronoun = { subject: "he", possessive: "his" };
const SHE: Pronoun = { subject: "she", possessive: "her" };
const THEY: Pronoun = { subject: "they", possessive: "their" };

const capital = (word: string) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`;
/** "he enters", "they enter". */
const verb = (p: Pronoun, word: string) => `${p.subject} ${p.subject === "they" ? word : `${word}s`}`;
const nightsWord = (n: number) => `${n} ${n === 1 ? "night" : "nights"}`;
/** "RWF 140k due" on a row's tag, the prototype's short form. */
const dueTag = (amount: number) => (amount % 1000 === 0 ? `RWF ${amount / 1000}k due` : `${rwf(amount)} due`);

const KIND = {
  forest: { name: "Forest Tent", plural: "Forest Tents", short: "Forest", capacity: 2, price: 95_000, icon: "House" },
  family: {
    name: "Family Tent",
    plural: "Family Tents",
    short: "Family",
    capacity: 4,
    price: 140_000,
    icon: "Persons",
  },
} as const satisfies Record<
  TentKind,
  { name: string; plural: string; short: string; capacity: number; price: number; icon: string }
>;

const PROVIDER = {
  mtn: { name: "MTN", wallet: "MoMo", method: "MTN MoMo" },
  airtel: { name: "Airtel", wallet: "Airtel Money", method: "Airtel Money" },
  cash: { name: "Cash", wallet: "cash", method: "Cash" },
} as const satisfies Record<PayMethod, { name: string; wallet: string; method: string }>;

/** The desk's own clock: each change happens a minute or two after the last, from 16:06. */
let clock = 16 * 60 + 6;
function tick(minutes = 1): string {
  clock += minutes;
  const h = Math.floor(clock / 60) % 24;
  const m = clock % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** The lodge's Tuesday, 13 October 2026, and the days after it: "Thu 15 Oct". */
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
function dayAfterToday(days: number): string {
  const date = new Date(Date.UTC(2026, 9, 13 + days));
  return `${DAYS[date.getUTCDay()]} ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
}
const MAX_NIGHTS = 14;

// ------------------------------------------------------------------ stays

type Stay = {
  id: string;
  name: string;
  first: string;
  /** What the tent rack shows on an occupied tent ("Wanjiru"). */
  surname: string;
  pronoun: Pronoun;
  ref: string;
  /** Shown masked. */
  phone: string;
  dial: string;
  /** Where a MoMo prompt goes. */
  momo: string;
  nationality: string;
  source: "Injishi booking" | "Walk-in";
  photo: ProtoImage;
  kind: TentKind;
  nights: number;
  dates: string;
  /** "11–13 Oct", on the check-out bar. */
  shortDates: string;
  guests: string;
  listDetail: string;
  eta: string;
  etaLabel: string;
  arrivingNow: boolean;
  phase: "expected" | "in-house" | "gone";
  /** Which list of Today the stay is on, if any. */
  listed: "arrival" | "departure" | null;
  inAt: string | null;
  outAt: string | null;
  tent: string | null;
  /** The tent housekeeping prepared, and what its cell says in the picker. */
  heldTent: string | null;
  heldNote: string | null;
  stayPrice: number;
  prepaid: number;
  /** After the amount on the arrival card: "deposit", "on Injishi". */
  prepaidNote: string;
  /** The line on the bill: "Paid on Injishi · 9 Oct". */
  prepaidLine: string;
  extras: { label: string; amount: number }[];
  request: string | null;
  prep: { title: string; subtitle: string } | null;
  idDoc: { kind: "passport" | "national ID"; nameOnId: string; number: string };
  idChecked: boolean;
  second: { name: string; added: boolean } | null;
  claimCode: string;
};

const stays: Stay[] = [
  {
    id: "kevin",
    name: "Kevin Otieno",
    first: "Kevin",
    surname: "Otieno",
    pronoun: HE,
    ref: "BK-20452",
    phone: "+254 7•• ••• 214",
    dial: "+254711000214",
    momo: "+254 7•• ••• 214",
    nationality: "Kenyan",
    source: "Injishi booking",
    photo: "forest-lodge",
    kind: "forest",
    nights: 1,
    dates: "Tue 13 – Wed 14 Oct",
    shortDates: "13–14 Oct",
    guests: "1 adult",
    listDetail: "Forest · 1 night",
    eta: "11:00",
    etaLabel: "ETA",
    arrivingNow: false,
    phase: "in-house",
    listed: "arrival",
    inAt: "11:20",
    outAt: null,
    tent: "T-05",
    heldTent: "T-05",
    heldNote: "Ready",
    stayPrice: 95_000,
    prepaid: 95_000,
    prepaidNote: "on Injishi",
    prepaidLine: "Paid on Injishi · 8 Oct",
    extras: [],
    request: null,
    prep: null,
    idDoc: { kind: "passport", nameOnId: "OTIENO, KEVIN", number: "BK7720•••" },
    idChecked: true,
    second: null,
    claimCode: "IFL-2K8D",
  },
  {
    id: "jean-bosco",
    name: "Jean Bosco Nkurunziza",
    first: "Jean Bosco",
    surname: "Nkurunziza",
    pronoun: HE,
    ref: "BK-20458",
    phone: "+250 78• ••• 330",
    dial: "+250788100330",
    momo: "+250 78• ••• 330",
    nationality: "Rwandan",
    source: "Injishi booking",
    photo: "forest-lodge",
    kind: "forest",
    nights: 2,
    dates: "Tue 13 – Thu 15 Oct",
    shortDates: "13–15 Oct",
    guests: "2 adults",
    listDetail: "Forest · 2 nights",
    eta: "14:00",
    etaLabel: "ETA",
    arrivingNow: false,
    phase: "expected",
    listed: "arrival",
    inAt: null,
    outAt: null,
    tent: null,
    heldTent: "T-06",
    heldNote: "Ready · held",
    stayPrice: 190_000,
    prepaid: 190_000,
    prepaidNote: "on Injishi",
    prepaidLine: "Paid on Injishi · 10 Oct",
    extras: [],
    request: null,
    prep: { title: "T-06 made up for two", subtitle: "Housekeeping, 12:10" },
    idDoc: { kind: "national ID", nameOnId: "NKURUNZIZA, JEAN BOSCO", number: "1 1987 8•••" },
    idChecked: false,
    second: { name: "Grace Uwera", added: false },
    claimCode: "IFL-5H2R",
  },
  {
    id: "amina",
    name: "Amina Wanjiru",
    first: "Amina",
    surname: "Wanjiru",
    pronoun: SHE,
    ref: "BK-20461",
    phone: "+254 7•• ••• 093",
    dial: "+254722000093",
    momo: "+250 78• ••• 093",
    nationality: "Kenyan",
    source: "Injishi booking",
    photo: "tents-on-the-shore",
    kind: "family",
    nights: 2,
    dates: "Tue 13 – Thu 15 Oct",
    shortDates: "13–15 Oct",
    guests: "2 adults · 2 children",
    listDetail: "Family · 2 + 2 kids",
    eta: "15:30",
    etaLabel: "ETA",
    arrivingNow: true,
    phase: "expected",
    listed: "arrival",
    inAt: null,
    outAt: null,
    tent: null,
    heldTent: "F-2",
    heldNote: "Ready · cot",
    stayPrice: 280_000,
    prepaid: 140_000,
    prepaidNote: "deposit",
    prepaidLine: "Deposit on Injishi · 2 Oct",
    extras: [],
    request: "A cot for our youngest, please. We arrive from Huye around 15:30.",
    prep: { title: "Cot set up in F-2", subtitle: "Housekeeping, 12:40" },
    idDoc: { kind: "passport", nameOnId: "WANJIRU, AMINA", number: "AK4410•••" },
    idChecked: false,
    second: { name: "Daniel Wanjiru", added: false },
    claimCode: "IFL-7Q4M",
  },
  {
    id: "dubois",
    name: "Pierre and Claire Dubois",
    first: "Pierre",
    surname: "Dubois",
    pronoun: THEY,
    ref: "BK-20463",
    phone: "+33 6 •• •• •• 41",
    dial: "+33611223341",
    momo: "+250 72• ••• 518",
    nationality: "French",
    source: "Injishi booking",
    photo: "forest-lodge",
    kind: "forest",
    nights: 3,
    dates: "Tue 13 – Fri 16 Oct",
    shortDates: "13–16 Oct",
    guests: "2 adults",
    listDetail: "Forest · 3 nights",
    eta: "17:00",
    etaLabel: "Bus",
    arrivingNow: false,
    phase: "expected",
    listed: "arrival",
    inAt: null,
    outAt: null,
    tent: null,
    heldTent: "T-10",
    heldNote: "Ready · held",
    stayPrice: 285_000,
    prepaid: 285_000,
    prepaidNote: "on Injishi",
    prepaidLine: "Paid on Injishi · 30 Sep",
    extras: [],
    request: null,
    prep: { title: "Shuttle booked from the bus stop", subtitle: "Desk, 09:15" },
    idDoc: { kind: "passport", nameOnId: "DUBOIS, PIERRE", number: "21FR8812•••" },
    idChecked: false,
    second: { name: "Claire Dubois", added: false },
    claimCode: "IFL-9V3C",
  },
  {
    id: "david",
    name: "David Chen",
    first: "David",
    surname: "Chen",
    pronoun: HE,
    ref: "BK-20437",
    phone: "+250 78• ••• 771",
    dial: "+250788200771",
    momo: "+250 78• ••• 771",
    nationality: "Singaporean",
    source: "Injishi booking",
    photo: "forest-lodge",
    kind: "forest",
    nights: 2,
    dates: "Sun 11 – Tue 13 Oct",
    shortDates: "11–13 Oct",
    guests: "1 adult",
    listDetail: "Bar and dinner",
    eta: "12:00",
    etaLabel: "ETA",
    arrivingNow: false,
    phase: "in-house",
    listed: "departure",
    inAt: "Sun 14:20",
    outAt: null,
    tent: "T-03",
    heldTent: "T-03",
    heldNote: null,
    stayPrice: 190_000,
    prepaid: 190_000,
    prepaidNote: "on Injishi",
    prepaidLine: "Paid on Injishi · 9 Oct",
    extras: [
      { label: "Bar · 3 tickets", amount: 18_000 },
      { label: "Dinner · 12 Oct", amount: 24_000 },
    ],
    request: null,
    prep: null,
    idDoc: { kind: "passport", nameOnId: "CHEN, DAVID", number: "K9031•••" },
    idChecked: true,
    second: null,
    claimCode: "IFL-4T6W",
  },
  {
    id: "samuel",
    name: "Samuel Okafor",
    first: "Samuel",
    surname: "Okafor",
    pronoun: HE,
    ref: "BK-20429",
    phone: "+234 80• ••• 562",
    dial: "+234802000562",
    momo: "+250 79• ••• 562",
    nationality: "Nigerian",
    source: "Injishi booking",
    photo: "forest-lodge",
    kind: "forest",
    nights: 3,
    dates: "Sat 10 – Tue 13 Oct",
    shortDates: "10–13 Oct",
    guests: "1 adult",
    listDetail: "Late out 13:00",
    eta: "13:00",
    etaLabel: "ETA",
    arrivingNow: false,
    phase: "in-house",
    listed: "departure",
    inAt: "Sat 13:40",
    outAt: null,
    tent: "T-11",
    heldTent: "T-11",
    heldNote: null,
    stayPrice: 285_000,
    prepaid: 285_000,
    prepaidNote: "on Injishi",
    prepaidLine: "Paid on Injishi · 6 Oct",
    extras: [],
    request: null,
    prep: null,
    idDoc: { kind: "passport", nameOnId: "OKAFOR, SAMUEL", number: "A0731•••" },
    idChecked: true,
    second: null,
    claimCode: "IFL-8N1J",
  },
  {
    id: "patrick",
    name: "Patrick Mugabo",
    first: "Patrick",
    surname: "Mugabo",
    pronoun: HE,
    ref: "WI-0412",
    phone: "078 845 2512",
    dial: "+250788452512",
    momo: "078 845 2512",
    nationality: "Rwandan",
    source: "Walk-in",
    photo: "forest-lodge",
    kind: "forest",
    nights: 2,
    dates: "Tue 13 – Thu 15 Oct",
    shortDates: "13–15 Oct",
    guests: "2 adults",
    listDetail: "T-09 · 2 nights",
    eta: "16:02",
    etaLabel: "In",
    arrivingNow: false,
    phase: "expected",
    listed: null,
    inAt: null,
    outAt: null,
    tent: "T-09",
    heldTent: "T-09",
    heldNote: "Ready",
    stayPrice: 190_000,
    prepaid: 0,
    prepaidNote: "at the desk",
    prepaidLine: "Paid at the desk",
    extras: [],
    request: null,
    prep: null,
    idDoc: { kind: "national ID", nameOnId: "MUGABO, PATRICK", number: "1 1991 8•••" },
    idChecked: true,
    second: null,
    claimCode: "IFL-3M7P",
  },
];

/** Who the desk opens when nobody is named: the guest arriving now, the guest leaving with a bill. */
const DEFAULT_ARRIVAL = "amina";
const DEFAULT_DEPARTURE = "david";
const firstStay = stays[0] as Stay;

function stayOf(id: string | undefined, fallback: string): Stay {
  return stays.find((s) => s.id === id) ?? stays.find((s) => s.id === fallback) ?? firstStay;
}

const due = (s: Stay) => s.stayPrice + s.extras.reduce((sum, e) => sum + e.amount, 0) - s.prepaid;

// ------------------------------------------------------------------ the tent rack

type Cell = { id: string; kind: TentKind; status: RackTent["status"]; note: string; stay?: string };

const cell = (id: string, status: Cell["status"], note: string, stay?: string): Cell => ({
  id,
  kind: id.startsWith("F") ? "family" : "forest",
  status,
  note,
  stay,
});

/** Tonight as the prototype's rack at 16:10, and the two nights after it. */
const rack: Record<RackNight, Cell[]> = {
  tonight: [
    cell("T-01", "occupied", "Mukamana"),
    cell("T-02", "occupied", "Habimana"),
    cell("T-03", "dirty", "Leaving", "david"),
    cell("T-04", "ready", "Ready"),
    cell("T-05", "occupied", "Otieno"),
    cell("T-06", "arriving", "Nkurunziza", "jean-bosco"),
    cell("T-07", "cleaning", "Cleaning"),
    cell("T-08", "occupied", "Grant"),
    cell("T-09", "occupied", "Mugabo"),
    cell("T-10", "arriving", "Dubois", "dubois"),
    cell("T-11", "dirty", "Left 12:50"),
    cell("T-12", "ready", "Ready"),
    cell("T-13", "blocked", "Zip broken"),
    cell("T-14", "occupied", "Shah"),
    cell("F-1", "occupied", "Ingabire"),
    cell("F-2", "arriving", "Wanjiru", "amina"),
    cell("F-3", "occupied", "Kamau"),
    cell("F-4", "cleaning", "Cleaning"),
  ],
  tomorrow: [
    cell("T-01", "occupied", "Mukamana"),
    cell("T-02", "arriving", "Uwase"),
    cell("T-03", "ready", "Ready"),
    cell("T-04", "ready", "Ready"),
    cell("T-05", "ready", "Ready"),
    cell("T-06", "occupied", "Nkurunziza"),
    cell("T-07", "arriving", "Mensah"),
    cell("T-08", "occupied", "Grant"),
    cell("T-09", "occupied", "Mugabo"),
    cell("T-10", "occupied", "Dubois"),
    cell("T-11", "ready", "Ready"),
    cell("T-12", "arriving", "Keller"),
    cell("T-13", "blocked", "Zip broken"),
    cell("T-14", "ready", "Ready"),
    cell("F-1", "occupied", "Ingabire"),
    cell("F-2", "occupied", "Wanjiru"),
    cell("F-3", "ready", "Ready"),
    cell("F-4", "arriving", "Mutesi"),
  ],
  thu: [
    cell("T-01", "ready", "Ready"),
    cell("T-02", "occupied", "Uwase"),
    cell("T-03", "arriving", "Bizimana"),
    cell("T-04", "arriving", "Odhiambo"),
    cell("T-05", "ready", "Ready"),
    cell("T-06", "ready", "Ready"),
    cell("T-07", "occupied", "Mensah"),
    cell("T-08", "ready", "Ready"),
    cell("T-09", "ready", "Ready"),
    cell("T-10", "occupied", "Dubois"),
    cell("T-11", "arriving", "Laurent"),
    cell("T-12", "occupied", "Keller"),
    cell("T-13", "ready", "Zip fixed"),
    cell("T-14", "ready", "Ready"),
    cell("F-1", "ready", "Ready"),
    cell("F-2", "ready", "Ready"),
    cell("F-3", "occupied", "Kamau"),
    cell("F-4", "occupied", "Mutesi"),
  ],
};

const NIGHTS: { value: RackNight; label: string }[] = [
  { value: "tonight", label: "Tonight" },
  { value: "tomorrow", label: "Tomorrow" },
  { value: "thu", label: "Thu 15" },
];

/** A tent someone sleeps in, is about to, or that cannot be sold. */
const taken = (c: Cell) => c.status === "occupied" || c.status === "arriving" || c.status === "blocked" || !!c.stay;
const tonight = (id: string) => rack.tonight.find((c) => c.id === id);
const freeTonight = (kind?: TentKind) => rack.tonight.filter((c) => !taken(c) && (!kind || c.kind === kind)).length;

// ------------------------------------------------------------------ payments and the shift

type Payment = {
  id: string;
  stayId: string;
  purpose: "walkin" | "balance" | "bill";
  method: PayMethod;
  amount: number;
  to: string;
  sentAt: string;
  status: "waiting" | "paid";
  paidAt: string;
  confirmRef: string;
  smsSent: boolean;
  receiptNo: string;
  lines: { label: string; amount: number }[];
  checkout: { keyReturned: boolean; tellHousekeeping: boolean } | null;
};

const payments: Payment[] = [
  {
    id: "PI-77160",
    stayId: "patrick",
    purpose: "walkin",
    method: "mtn",
    amount: 190_000,
    to: "078 845 2512",
    sentAt: "16:03",
    status: "waiting",
    // What MTN sends back at 16:05; the receipt shows it once the prompt is approved.
    paidAt: "16:05",
    confirmRef: "MP261013.1605.A8812",
    smsSent: false,
    receiptNo: "SDC-0014 · 2271",
    lines: [{ label: "Forest Tent · 2 nights", amount: 190_000 }],
    checkout: null,
  },
  {
    id: "PI-77158",
    stayId: "amina",
    purpose: "balance",
    method: "mtn",
    amount: 140_000,
    to: "+250 78• ••• 093",
    sentAt: "15:40",
    status: "paid",
    paidAt: "15:41",
    confirmRef: "MP261013.1541.A8790",
    smsSent: true,
    receiptNo: "SDC-0014 · 2268",
    lines: [{ label: "Family Tent · balance", amount: 140_000 }],
    checkout: null,
  },
];
const DEFAULT_PAYMENT = "PI-77160";
let nextPayment = 77161;
let nextReceipt = 2272;
let nextWalkIn = 1;

type LedgerEntry = MoneyEntry & { time: string };

/** The shift's takings so far: 7 payments, three of them listed (the prototype at 21:28). */
const shift = {
  since: "07:00",
  count: 7,
  totals: { mtn: 432_000, airtel: 95_000, cash: 85_000 } as Record<PayMethod, number>,
  ledger: [
    {
      key: "walkin:patrick",
      name: "Patrick Mugabo",
      detail: "Walk-in T-09 · MTN · 16:05",
      amount: 190_000,
      method: "mtn",
      time: "16:05",
      opens: { to: "paid", payId: "PI-77160" },
    },
    {
      key: "balance:amina",
      name: "Amina Wanjiru",
      detail: "Balance F-2 · MTN · 15:41",
      amount: 140_000,
      method: "mtn",
      time: "15:41",
      opens: { to: "paid", payId: "PI-77158" },
    },
    {
      key: "bill:david",
      name: "David Chen",
      detail: "Bill T-03 · MTN · 11:44",
      amount: 42_000,
      method: "mtn",
      time: "11:44",
      opens: { to: "check-out", stayId: "david" },
    },
  ] as LedgerEntry[],
  closed: null as DeskMoney["closed"],
};

/** Today's counts that are not one list's length: the prototype's numbers, moved by the desk's actions. */
const counts = { leaving: 3, leftAlready: 2, inHouse: 11 };

const settings: DeskSettings = {
  receiptsBySms: true,
  receiptsInApp: true,
  notifyBookings: true,
  notifyArrivals: true,
  notifyMessages: true,
};

function paymentOf(id: string | undefined): Payment {
  return payments.find((p) => p.id === id) ?? (payments.find((p) => p.id === DEFAULT_PAYMENT) as Payment);
}

// ------------------------------------------------------------------ views: today

function arrivalRow(s: Stay): ArrivalRow {
  const inHouse = s.phase !== "expected";
  const owed = due(s);
  return {
    stayId: s.id,
    time: inHouse ? (s.inAt ?? s.eta) : s.eta,
    timeLabel: inHouse ? "In" : s.etaLabel,
    name: s.name,
    detail: inHouse ? `${s.tent ?? "Tent"} · ${nightsWord(s.nights)}` : s.listDetail,
    tag: inHouse
      ? { label: "Checked in", tone: "success" }
      : owed > 0
        ? { label: dueTag(owed), tone: "warning" }
        : { label: "Paid", tone: "success" },
    inHouse,
  };
}

function departureRow(s: Stay): DepartureRow {
  const owed = due(s);
  return {
    stayId: s.id,
    tent: s.tent ?? "",
    name: s.name,
    detail: s.phase === "gone" ? `Left ${s.outAt ?? ""}` : s.listDetail,
    tag:
      s.phase === "gone"
        ? { label: "Checked out", tone: "default" }
        : owed > 0
          ? { label: dueTag(owed), tone: "warning" }
          : { label: "Paid", tone: "success" },
  };
}

export function todayView(): DeskToday {
  const arrivals = stays.filter((s) => s.listed === "arrival");
  const expected = arrivals.filter((s) => s.phase === "expected");
  const next = expected.find((s) => s.arrivingNow) ?? expected[0];
  const departures = stays.filter((s) => s.listed === "departure");
  const leaving =
    departures.find((s) => s.phase !== "gone" && due(s) > 0) ?? departures.find((s) => s.phase !== "gone");
  return {
    dateLine: "Tue 13 Oct · Eric on desk",
    place: "Ishyamba Forest Lodge",
    placePhoto: "forest-lodge",
    hasNews: expected.some((s) => s.request !== null),
    nextArrival: next?.id ?? null,
    nextDeparture: leaving?.id ?? null,
    arriving: { value: arrivals.length, detail: `${arrivals.length - expected.length} in` },
    leaving: { value: counts.leaving, detail: `${counts.leftAlready} out` },
    inHouse: { value: counts.inHouse, detail: "tents" },
    free: { value: freeTonight(), detail: "tonight" },
    arrivals: arrivals.map(arrivalRow).sort((a, b) => a.time.localeCompare(b.time)),
    departures: departures.map(departureRow),
  };
}

/** `?proto=empty`: a quiet day, nobody due in or out. */
export function emptyTodayView(): DeskToday {
  return {
    ...todayView(),
    hasNews: false,
    nextArrival: null,
    nextDeparture: null,
    arriving: { value: 0, detail: "0 in" },
    leaving: { value: 0, detail: "0 out" },
    arrivals: [],
    departures: [],
  };
}

// ------------------------------------------------------------------ views: arrival and check-in

export function arrivalView(id: string | undefined): DeskArrival {
  const s = stayOf(id, DEFAULT_ARRIVAL);
  const owed = due(s);
  const inHouse = s.phase !== "expected";
  const checks: ArrivalCheck[] = [
    s.idChecked
      ? {
          key: "id",
          icon: "ShieldCheck",
          tone: "success",
          title: "ID checked",
          subtitle:
            s.second && !s.second.added ? `${s.second.name}'s ID still to add` : "Every adult staying is registered",
        }
      : {
          key: "id",
          icon: "ShieldCheck",
          tone: "warning",
          title: "ID not checked yet",
          subtitle: "Every adult staying is registered",
        },
  ];
  if (s.prep) checks.push({ key: "prep", icon: "CircleCheck", tone: "success", ...s.prep });
  return {
    stayId: s.id,
    name: s.name,
    photo: s.photo,
    tags: [
      inHouse
        ? { label: "Checked in", tone: "success" }
        : s.arrivingNow
          ? { label: "Arriving now", tone: "accent" }
          : { label: `${s.etaLabel === "Bus" ? "Bus" : "ETA"} ${s.eta}`, tone: "info" },
      { label: s.source, tone: "default" },
    ],
    meta: `${s.ref} · ${s.phone} · ${s.nationality}`,
    dial: s.dial,
    lines: [
      { key: "stay", label: "Stay", value: `${s.dates} · ${nightsWord(s.nights)}` },
      { key: "tent", label: "Tent", value: `${KIND[s.kind].name} · ${s.tent ?? "not assigned"}` },
      { key: "guests", label: "Guests", value: s.guests },
      {
        key: "paid",
        label: "Paid",
        value: s.prepaid > 0 ? `${rwf(s.prepaid)} ${s.prepaidNote}` : "Nothing yet",
        tone: s.prepaid > 0 ? "success" : undefined,
      },
      {
        key: "balance",
        label: "Balance",
        value: owed > 0 ? rwf(owed) : "Nothing to pay",
        tone: owed > 0 ? "warning" : "success",
      },
    ],
    request: s.request ? { title: "Asked in the app", body: `"${s.request}"` } : null,
    checks,
    inHouse,
    tent: s.tent,
  };
}

export function idCheckView(id: string | undefined): DeskIdCheck {
  const s = stayOf(id, DEFAULT_ARRIVAL);
  const doc = s.idDoc.kind;
  return {
    stayId: s.id,
    name: s.name,
    readLabel: `${capital(doc)} read · sharp`,
    lines: [
      { key: "name", label: `Name on ${doc}`, value: s.idDoc.nameOnId },
      { key: "number", label: "Number", value: s.idDoc.number },
      { key: "match", label: "Matches booking", value: "Yes", tone: "success", icon: "CircleCheck" },
    ],
    secondAdult: s.second ? { ...s.second } : null,
  };
}

function tentOptions(s: Stay): TentOption[] {
  const ofKind = rack.tonight.filter((c) => c.kind === s.kind);
  const mine = (c: Cell) => c.id === s.tent || c.id === s.heldTent;
  // A small kind is shown whole; a large one shows the guest's tent and the free ones near it.
  const near = (c: Cell) => mine(c) || (!taken(c) && (c.status === "ready" || c.status === "cleaning"));
  const shown = ofKind.length <= 4 ? ofKind : ofKind.filter(near).slice(0, 4);
  return shown.map((c) => {
    const available = mine(c) || (!taken(c) && c.status === "ready");
    const note = mine(c)
      ? s.phase === "expected"
        ? (s.heldNote ?? "Ready")
        : "Checked in"
      : c.status === "occupied"
        ? "In house"
        : c.status === "arriving"
          ? "Held"
          : c.note;
    return { id: c.id, note, available };
  });
}

export function tentStepView(id: string | undefined): DeskTentStep {
  const s = stayOf(id, DEFAULT_ARRIVAL);
  const options = tentOptions(s);
  const owed = due(s);
  const ready = options.filter((o) => o.available).length;
  const p = s.pronoun;
  return {
    stayId: s.id,
    name: s.name,
    kindLabel: KIND[s.kind].name,
    options,
    suggested: s.tent ?? s.heldTent ?? options.find((o) => o.available)?.id ?? "",
    readyLine: `${ready} ready of ${options.length}`,
    scanTitle: `Ask ${s.first} to scan this`,
    scanBody: `In the Injishi app: ${p.possessive} stay, bill, Wi-Fi and menu appear on ${p.possessive} phone.`,
    codeLead: `Or ${verb(p, "type")} code`,
    code: s.claimCode,
    codeTail: "· valid until checkout",
    qrSeed: `ishyamba-${s.ref}`,
    balance: owed > 0 ? { amount: owed, note: "Take it now or at checkout" } : null,
    paidNote: "Paid in full · nothing to take at the desk",
    inHouse: s.phase !== "expected",
  };
}

// ------------------------------------------------------------------ views: walk-in, payment, receipt

export function walkInFormView(): DeskWalkInForm {
  return {
    tents: (["forest", "family"] as const).map((kind) => ({
      kind,
      name: KIND[kind].name,
      icon: KIND[kind].icon,
      capacity: KIND[kind].capacity,
      price: KIND[kind].price,
      free: freeTonight(kind),
    })),
    checkouts: Array.from({ length: MAX_NIGHTS }, (_, i) => dayAfterToday(i + 1)),
    checkoutTime: "11:00",
    defaults: { nights: 2, kind: "forest", adults: 2, name: "Patrick Mugabo", phone: "078 845 2512" },
  };
}

export function paymentWaitView(id: string | undefined): DeskPaymentWait {
  const pay = paymentOf(id);
  const s = stayOf(pay.stayId, DEFAULT_ARRIVAL);
  const provider = PROVIDER[pay.method];
  const paid = pay.status === "paid";
  const p = s.pronoun;
  return {
    id: pay.id,
    paid,
    title: paid ? `${s.first}'s payment is confirmed` : `${s.first} approves on ${p.possessive} phone`,
    body: paid
      ? `${provider.name} confirmed it at ${pay.paidAt} · ref ${pay.confirmRef}.`
      : `${provider.name} sent a prompt to ${pay.to}. ${capital(verb(p, "enter"))} ${p.possessive} ${provider.wallet} PIN to pay.`,
    amount: pay.amount,
    steps: [
      { key: "sent", title: "Prompt sent", detail: `${pay.sentAt} · ref ${pay.id}`, state: "done" },
      {
        key: "pin",
        title: "Guest enters PIN",
        detail: paid ? "Done on the guest's phone" : "Usually under a minute",
        state: paid ? "done" : "now",
        icon: "Hourglass",
      },
      {
        key: "confirm",
        title: `${provider.name} confirms`,
        detail: paid ? `${pay.paidAt} · ${pay.confirmRef}` : "Only then is it paid",
        state: paid ? "done" : "todo",
        icon: "ShieldCheck",
      },
    ],
    hold:
      pay.purpose === "bill"
        ? {
            title: `Wait for ${provider.name} before the guest leaves`,
            body: "A screenshot from the guest is not proof of payment.",
          }
        : {
            title: `Hold the key until ${provider.name} confirms`,
            body: "A screenshot from the guest is not proof of payment.",
          },
    resentLine: `${provider.name} sent the prompt again to ${pay.to}`,
  };
}

export function receiptView(id: string | undefined): DeskReceipt {
  const pay = paymentOf(id);
  const s = stayOf(pay.stayId, DEFAULT_ARRIVAL);
  const tent = s.tent ?? s.heldTent ?? "";
  const vat = Math.round((pay.amount * 18) / 118);
  const lines: DeskLine[] = pay.lines.map((l, i) => ({ key: `line-${i}`, label: l.label, value: rwf(l.amount) }));
  lines.push({ key: "vat", label: "VAT 18% included", value: rwf(vat) });
  lines.push({ key: "number", label: "Receipt number", value: pay.receiptNo });
  return {
    id: pay.id,
    amount: pay.amount,
    confirmLine:
      pay.method === "cash"
        ? `Cash taken at ${pay.paidAt} · counted in your shift close`
        : `Confirmed by ${PROVIDER[pay.method].name} at ${pay.paidAt} · ref ${pay.confirmRef}`,
    heading: `${s.name} · ${tent}`,
    qrSeed: `ebm-ishyamba-${pay.confirmRef.slice(-5)}`,
    lines,
    smsSent: pay.smsSent,
    smsTo: pay.to,
    stayId: s.id,
    done:
      pay.purpose === "walkin"
        ? { label: `Done · give key for ${tent}`, to: "today" }
        : pay.purpose === "bill"
          ? { label: `Done · ${tent} checked out`, to: "today" }
          : s.phase === "expected"
            ? { label: "Back to check-in", to: "check-in" }
            : { label: "Done", to: "today" },
  };
}

// ------------------------------------------------------------------ views: rack, check-out, money, me

export function rackView(night: RackNight): DeskRack {
  const cells = rack[night];
  const label = NIGHTS.find((n) => n.value === night)?.label ?? "Tonight";
  const toTent = (c: Cell): RackTent => ({
    id: c.id,
    status: c.status,
    note: c.note,
    flag: c.status === "blocked" ? "Wrench" : undefined,
    flagLabel: c.status === "blocked" ? "repair needed" : undefined,
    opens:
      night === "tonight" && c.stay
        ? c.status === "arriving"
          ? { to: "arrival", stayId: c.stay }
          : { to: "check-out", stayId: c.stay }
        : undefined,
  });
  return {
    nights: NIGHTS.map((n) => ({ ...n })),
    subtitle: `${label} · ${cells.filter(taken).length} of ${cells.length} taken`,
    groups: (["forest", "family"] as const).map((kind) => {
      const tents = cells.filter((c) => c.kind === kind);
      return { key: kind, title: `${KIND[kind].plural} · ${tents.length}`, tents: tents.map(toTent) };
    }),
  };
}

export function checkoutView(id: string | undefined): DeskCheckout {
  const s = stayOf(id, DEFAULT_DEPARTURE);
  const p = s.pronoun;
  const tent = s.tent ?? s.heldTent ?? "The tent";
  const lines: DeskLine[] = [
    { key: "stay", label: `${KIND[s.kind].name} · ${nightsWord(s.nights)}`, value: rwf(s.stayPrice) },
  ];
  if (s.prepaid > 0)
    lines.push({ key: "prepaid", label: s.prepaidLine, value: `− ${rwf(s.prepaid)}`, tone: "success" });
  s.extras.forEach((e, i) => {
    lines.push({ key: `extra-${i}`, label: e.label, value: rwf(e.amount) });
  });
  return {
    stayId: s.id,
    tent,
    name: s.name,
    subtitle: `${s.name} · ${s.shortDates}`,
    lines,
    due: Math.max(0, due(s)),
    ask: `How ${p.subject === "they" ? "are they" : `is ${p.subject}`} paying?`,
    methods: [
      { value: "mtn", title: "MTN MoMo", subtitle: `Prompt to ${s.momo} (from the booking)` },
      { value: "airtel", title: "Airtel Money" },
      { value: "cash", title: "Cash", subtitle: "Counted in your shift close" },
    ],
    housekeepingLine: `${tent} becomes Dirty when ${verb(p, "leave")}`,
    receiptNote: `The fiscal receipt goes by SMS and to ${p.possessive} Injishi app.`,
    gone: s.phase === "gone",
  };
}

const METHOD_ORDER: PayMethod[] = ["mtn", "airtel", "cash"];

export function moneyView(): DeskMoney {
  const total = METHOD_ORDER.reduce((sum, m) => sum + shift.totals[m], 0);
  return {
    subtitle: `Today · Eric's shift since ${shift.since}`,
    total,
    countLine: `${shift.count} ${shift.count === 1 ? "payment" : "payments"} · all confirmed`,
    methods: METHOD_ORDER.map((m) => ({
      key: m,
      label: PROVIDER[m].method,
      amount: shift.totals[m],
      share: total > 0 ? Math.round((shift.totals[m] / total) * 100) : 0,
    })),
    entries: shift.ledger.map(({ time: _time, ...entry }) => ({ ...entry, opens: { ...entry.opens } })),
    drawer: shift.totals.cash,
    closed: shift.closed ? { ...shift.closed } : null,
  };
}

/** `?proto=empty`: the shift just started, nothing taken yet. */
export function emptyMoneyView(): DeskMoney {
  return {
    ...moneyView(),
    total: 0,
    countLine: "No payments yet",
    methods: METHOD_ORDER.map((m) => ({ key: m, label: PROVIDER[m].method, amount: 0, share: 0 })),
    entries: [],
    drawer: 0,
    closed: null,
  };
}

export function meView(): DeskMe {
  return {
    name: "Eric Habimana",
    role: "Front desk · Ishyamba Forest Lodge",
    places: "Ishyamba · Isangano",
    settings: { ...settings },
  };
}

// ------------------------------------------------------------------ changes

/** Step 1 of check-in: the ID matched the booking. */
export function confirmId(stayId: string): void {
  stayOf(stayId, DEFAULT_ARRIVAL).idChecked = true;
}

export function addSecondId(stayId: string): void {
  const s = stayOf(stayId, DEFAULT_ARRIVAL);
  if (s.second) s.second.added = true;
}

/** Step 2: the guest is in the tent picked; a tent held for them and not used is free again. */
export function finishCheckIn({ stayId, tent }: { stayId: string; tent: string }): void {
  const s = stayOf(stayId, DEFAULT_ARRIVAL);
  if (s.phase !== "expected") return;
  const held = s.heldTent ? tonight(s.heldTent) : undefined;
  if (held && held.id !== tent && held.stay === s.id)
    Object.assign(held, { status: "ready", note: "Ready", stay: undefined });
  const chosen = tonight(tent);
  if (chosen) Object.assign(chosen, { status: "occupied", note: s.surname, stay: undefined });
  Object.assign(s, { phase: "in-house", tent, idChecked: true, inAt: tick(), arrivingNow: false });
  counts.inHouse += 1;
}

function newPayment(
  s: Stay,
  input: Pick<Payment, "purpose" | "method" | "amount" | "to" | "lines" | "checkout">,
): Payment {
  const pay: Payment = {
    ...input,
    id: `PI-${nextPayment++}`,
    stayId: s.id,
    sentAt: tick(),
    status: "waiting",
    paidAt: "",
    confirmRef: "",
    smsSent: false,
    receiptNo: `SDC-0014 · ${nextReceipt++}`,
  };
  payments.unshift(pay);
  return pay;
}

/** "Take now" on check-in: a MoMo prompt for what is still owed. Returns the payment's id. */
export function requestBalance(stayId: string): string {
  const s = stayOf(stayId, DEFAULT_ARRIVAL);
  const amount = Math.max(0, due(s));
  return newPayment(s, {
    purpose: "balance",
    method: "mtn",
    amount,
    to: s.momo,
    lines: [{ label: `${KIND[s.kind].name} · balance`, amount }],
    checkout: null,
  }).id;
}

/** "078…" and "079…" are MTN, "072…" and "073…" Airtel (Rwanda's prefixes). */
function methodForPhone(phone: string): PayMethod {
  const digits = phone.replace(/\D/g, "").replace(/^250/, "0");
  return /^07[23]/.test(digits) ? "airtel" : "mtn";
}

/**
 * A walk-in: holds the first free tent of the kind (ready before cleaning before dirty) and sends
 * the prompt for the whole stay. Returns the payment's id.
 */
export function requestWalkIn(req: WalkInRequest): string {
  const free = rack.tonight.filter((c) => c.kind === req.kind && !taken(c));
  const rank = (c: Cell) => (c.status === "ready" ? 0 : c.status === "cleaning" ? 1 : 2);
  const pick = [...free].sort((a, b) => rank(a) - rank(b))[0];
  if (!pick) throw new Error(`No ${KIND[req.kind].name} is free tonight`);
  const words = req.name.trim().split(/\s+/);
  const nights = Math.max(1, Math.min(MAX_NIGHTS, req.nights));
  const s: Stay = {
    ...firstStay,
    id: `walk-in-${nextWalkIn}`,
    name: req.name.trim(),
    first: words[0] ?? req.name,
    surname: words[words.length - 1] ?? req.name,
    pronoun: words[0] === "Patrick" ? HE : THEY,
    ref: `WI-${412 + nextWalkIn++}`,
    phone: req.phone,
    dial: `+250${req.phone.replace(/\D/g, "").replace(/^0/, "")}`,
    momo: req.phone,
    nationality: "Walk-in",
    source: "Walk-in",
    kind: req.kind,
    nights,
    dates: `Tue 13 – ${dayAfterToday(nights)}`,
    shortDates: `13–${dayAfterToday(nights).split(" ")[1]} Oct`,
    guests: `${req.adults} ${req.adults === 1 ? "adult" : "adults"}`,
    listDetail: `${pick.id} · ${nightsWord(nights)}`,
    eta: tick(0),
    etaLabel: "In",
    arrivingNow: false,
    phase: "expected",
    listed: null,
    inAt: null,
    outAt: null,
    tent: pick.id,
    heldTent: pick.id,
    heldNote: "Ready",
    stayPrice: KIND[req.kind].price * nights,
    prepaid: 0,
    prepaidNote: "at the desk",
    prepaidLine: "Paid at the desk",
    extras: [],
    request: null,
    prep: null,
    idDoc: { kind: "national ID", nameOnId: req.name.trim().toUpperCase(), number: "Not scanned" },
    idChecked: true,
    second: null,
    claimCode: `IFL-${(nextPayment % 9000).toString(36).toUpperCase()}W`,
  };
  stays.push(s);
  Object.assign(pick, { status: "arriving", note: s.surname, stay: s.id });
  return newPayment(s, {
    purpose: "walkin",
    method: methodForPhone(req.phone),
    amount: s.stayPrice,
    to: req.phone,
    lines: [{ label: `${KIND[req.kind].name} · ${nightsWord(nights)}`, amount: s.stayPrice }],
    checkout: null,
  }).id;
}

function checkOut(s: Stay, tellHousekeeping: boolean): void {
  if (s.phase === "gone") return;
  const at = tick();
  const tentCell = s.tent ? tonight(s.tent) : undefined;
  if (tentCell)
    Object.assign(tentCell, { status: tellHousekeeping ? "dirty" : "vacant", note: `Left ${at}`, stay: undefined });
  Object.assign(s, { phase: "gone", outAt: at });
  counts.leftAlready = Math.min(counts.leaving, counts.leftAlready + 1);
  counts.inHouse = Math.max(0, counts.inHouse - 1);
}

/**
 * Check-out's one action. Nothing owed: the guest is out. Cash: taken now. MoMo or Airtel: a prompt
 * to wait for. Returns what to open next.
 */
export function requestCheckout(req: CheckoutRequest): { next: "today" } | { next: "paid" | "wait"; payId: string } {
  const s = stayOf(req.stayId, DEFAULT_DEPARTURE);
  const amount = Math.max(0, due(s));
  if (amount === 0) {
    checkOut(s, req.tellHousekeeping);
    return { next: "today" };
  }
  const pay = newPayment(s, {
    purpose: "bill",
    method: req.method,
    amount,
    to: s.momo,
    lines: s.extras.map((e) => ({ ...e })),
    checkout: { keyReturned: req.keyReturned, tellHousekeeping: req.tellHousekeeping },
  });
  if (req.method === "cash") {
    confirmPayment({ payId: pay.id, method: "cash" });
    return { next: "paid", payId: pay.id };
  }
  return { next: "wait", payId: pay.id };
}

/** The guest approved and MTN (or Airtel) confirmed; or the desk took cash instead. */
export function confirmPayment({ payId, method }: { payId: string; method?: PayMethod }): string {
  const pay = paymentOf(payId);
  if (pay.status === "paid") return pay.id;
  if (method) pay.method = method;
  const at = tick();
  Object.assign(pay, {
    status: "paid",
    paidAt: pay.paidAt || at,
    confirmRef:
      pay.confirmRef ||
      (pay.method === "cash"
        ? `CASH-${at.replace(":", "")}`
        : `MP261013.${at.replace(":", "")}.A${8812 + nextReceipt - 2271}`),
  });
  const s = stayOf(pay.stayId, DEFAULT_ARRIVAL);
  s.prepaid += pay.amount;
  if (pay.purpose === "walkin" && s.phase === "expected") {
    const tentCell = s.tent ? tonight(s.tent) : undefined;
    if (tentCell) Object.assign(tentCell, { status: "occupied", note: s.surname, stay: undefined });
    Object.assign(s, { phase: "in-house", listed: "arrival", inAt: pay.paidAt });
    counts.inHouse += 1;
  }
  if (pay.purpose === "bill") checkOut(s, pay.checkout?.tellHousekeeping ?? true);
  record(pay, s);
  return pay.id;
}

/** Into the shift's takings; a payment the prototype already lists is updated, not counted twice. */
function record(pay: Payment, s: Stay): void {
  const key = `${pay.purpose}:${s.id}`;
  const word = pay.purpose === "walkin" ? "Walk-in" : pay.purpose === "bill" ? "Bill" : "Balance";
  const entry: LedgerEntry = {
    key,
    name: s.name,
    detail: `${word} ${s.tent ?? s.heldTent ?? ""} · ${PROVIDER[pay.method].name} · ${pay.paidAt}`,
    amount: pay.amount,
    method: pay.method,
    time: pay.paidAt,
    opens: { to: "paid", payId: pay.id },
  };
  const at = shift.ledger.findIndex((e) => e.key === key);
  // Newest first: an entry the prototype already lists moves up with its new time.
  if (at >= 0) {
    shift.ledger.splice(at, 1);
    shift.ledger.unshift(entry);
    return;
  }
  shift.ledger.unshift(entry);
  shift.totals[pay.method] += pay.amount;
  shift.count += 1;
}

export function resendPrompt(payId: string): void {
  paymentOf(payId).sentAt = tick();
}

export function sendReceipt(payId: string): void {
  paymentOf(payId).smsSent = true;
}

export function closeShift({ counted, note }: ShiftClose): void {
  shift.closed = { at: tick(), counted, note: note.trim() };
}

export function saveSettings(next: Partial<DeskSettings>): void {
  Object.assign(settings, next);
}
