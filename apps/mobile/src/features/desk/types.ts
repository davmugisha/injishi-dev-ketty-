// The front desk's view models (prototype e-mgrdesk.mjs, DESK): what each desk screen reads through
// `data.ts`. Names, tents, prices and times are design filler and live in `mock-data.ts` only.

import type { IconName, RoomStatus, Tone } from "@/components/ui";
import type { ProtoImage } from "@/proto/images";

/** A word on a soft tint: a stay's money or check-in state ("Paid", "RWF 140k due", "Checked in"). */
export type DeskTag = { label: string; tone: Tone };

/** A label and its value on a bill or a stay card; `tone` colours a paid or a due figure. */
export type DeskLine = { key: string; label: string; value: string; tone?: "success" | "warning"; icon?: IconName };

/** The two kinds of tent the lodge sells. */
export type TentKind = "forest" | "family";

/** How a guest pays at the desk. */
export type PayMethod = "mtn" | "airtel" | "cash";

// ------------------------------------------------------------------ today

/** One of the four counts at the top of Today (`.mx-sum`). */
export type DeskCount = { value: number; detail: string };

export type ArrivalRow = {
  stayId: string;
  /** "14:00", or the check-in time once in. */
  time: string;
  /** Under the time: "ETA", "Bus", "In". */
  timeLabel: string;
  name: string;
  /** "Family · 2 + 2 kids", "T-05 · 1 night". */
  detail: string;
  tag: DeskTag;
  /** Checked in: the row opens the tent rack instead of the arrival. */
  inHouse: boolean;
};

export type DepartureRow = {
  stayId: string;
  tent: string;
  name: string;
  detail: string;
  tag: DeskTag;
};

export type DeskToday = {
  /** "Tue 13 Oct · Eric on desk". */
  dateLine: string;
  place: string;
  placePhoto: ProtoImage;
  /** The bell's dot: a guest asked for something in the app. */
  hasNews: boolean;
  /** The guest the bell opens: the next one through the door. */
  nextArrival: string | null;
  /** The bill "Leaving" opens: the first guest still to check out. */
  nextDeparture: string | null;
  arriving: DeskCount;
  leaving: DeskCount;
  inHouse: DeskCount;
  free: DeskCount;
  arrivals: ArrivalRow[];
  departures: DepartureRow[];
};

// ------------------------------------------------------------------ arrival and check-in

/** What is done, or still missing, before the guest gets a key. */
export type ArrivalCheck = { key: string; icon: IconName; tone: Tone; title: string; subtitle: string };

export type DeskArrival = {
  stayId: string;
  name: string;
  photo: ProtoImage;
  /** "Arriving now", "Injishi booking". */
  tags: DeskTag[];
  /** "BK-20461 · +254 7•• ••• 093 · Kenyan". */
  meta: string;
  /** The number the call button dials. */
  dial: string;
  lines: DeskLine[];
  /** The guest's own words from the app. */
  request: { title: string; body: string } | null;
  checks: ArrivalCheck[];
  inHouse: boolean;
  /** The tent once assigned. */
  tent: string | null;
};

export type DeskIdCheck = {
  stayId: string;
  name: string;
  /** "Passport read · sharp". */
  readLabel: string;
  lines: DeskLine[];
  /** Another adult staying, whose ID is registered too. */
  secondAdult: { name: string; added: boolean } | null;
};

/** A tent in the check-in picker (`.mx-tent`): pickable, or dimmed with its state. */
export type TentOption = { id: string; note: string; available: boolean };

export type DeskTentStep = {
  stayId: string;
  name: string;
  /** "Family Tent". */
  kindLabel: string;
  options: TentOption[];
  /** The tent picked to start with: the one housekeeping prepared. */
  suggested: string;
  /** "1 ready of 4". */
  readyLine: string;
  /** "Ask Amina to scan this". */
  scanTitle: string;
  scanBody: string;
  /** "Or she types code", then the code, then "· valid until checkout". */
  codeLead: string;
  code: string;
  codeTail: string;
  /** The guest QR's seed, before the tent: `${qrSeed}-F2`. */
  qrSeed: string;
  /** Still to pay at the desk, or null when the stay is paid. */
  balance: { amount: number; note: string } | null;
  /** When paid: "Paid in full on Injishi". */
  paidNote: string;
  inHouse: boolean;
};

// ------------------------------------------------------------------ walk-in and payments

export type WalkInTent = {
  kind: TentKind;
  name: string;
  icon: IconName;
  capacity: number;
  price: number;
  /** Tents of this kind still free tonight. */
  free: number;
};

export type DeskWalkInForm = {
  tents: WalkInTent[];
  /** The check-out day for 1, 2, 3... nights: index `nights - 1`. */
  checkouts: string[];
  checkoutTime: string;
  defaults: { nights: number; kind: TentKind; adults: number; name: string; phone: string };
};

export type WalkInRequest = { nights: number; kind: TentKind; adults: number; name: string; phone: string };

export type PaymentStep = {
  key: string;
  title: string;
  detail: string;
  state: "done" | "now" | "todo";
  icon?: IconName;
};

export type DeskPaymentWait = {
  id: string;
  paid: boolean;
  /** "Patrick approves on his phone". */
  title: string;
  /** "MTN sent a prompt to 078 845 2512. He enters his MoMo PIN to pay." */
  body: string;
  amount: number;
  steps: PaymentStep[];
  hold: { title: string; body: string };
  /** "Prompt sent again to 078 845 2512". */
  resentLine: string;
};

export type DeskReceipt = {
  id: string;
  amount: number;
  /** "Confirmed by MTN at 16:05 · ref MP261013.1605.A8812". */
  confirmLine: string;
  /** "Patrick Mugabo · T-09". */
  heading: string;
  qrSeed: string;
  lines: DeskLine[];
  smsSent: boolean;
  smsTo: string;
  /** The stay whose guest QR "Show app QR" opens. */
  stayId: string;
  done: { label: string; to: "today" | "check-in" };
};

// ------------------------------------------------------------------ tents, check-out, money, me

export type RackNight = "tonight" | "tomorrow" | "thu";

export type RackTent = {
  id: string;
  status: RoomStatus;
  note: string;
  flag?: IconName;
  flagLabel?: string;
  /** What pressing the tent opens: its arriving guest, or the bill of a guest leaving. */
  opens?: { to: "arrival" | "check-out"; stayId: string };
};

export type DeskRack = {
  nights: { value: RackNight; label: string }[];
  /** "Tonight · 13 of 18 taken". */
  subtitle: string;
  groups: { key: TentKind; title: string; tents: RackTent[] }[];
};

export type DeskCheckout = {
  stayId: string;
  tent: string;
  name: string;
  /** "David Chen · 11–13 Oct". */
  subtitle: string;
  lines: DeskLine[];
  due: number;
  /** "How is he paying?". */
  ask: string;
  methods: { value: PayMethod; title: string; subtitle?: string }[];
  /** "T-03 becomes Dirty when he leaves". */
  housekeepingLine: string;
  /** "The fiscal receipt goes by SMS and to his Injishi app." */
  receiptNote: string;
  gone: boolean;
};

export type CheckoutRequest = {
  stayId: string;
  method: PayMethod;
  keyReturned: boolean;
  tellHousekeeping: boolean;
};

export type MoneyEntry = {
  key: string;
  name: string;
  /** "Walk-in T-09 · MTN · 16:05". */
  detail: string;
  amount: number;
  method: PayMethod;
  opens: { to: "paid"; payId: string } | { to: "check-out"; stayId: string };
};

export type DeskMoney = {
  /** "Today · Eric's shift since 07:00". */
  subtitle: string;
  total: number;
  /** "7 payments · all confirmed". */
  countLine: string;
  methods: { key: PayMethod; label: string; amount: number; share: number }[];
  entries: MoneyEntry[];
  /** The cash the drawer should hold. */
  drawer: number;
  closed: { at: string; counted: number; note: string } | null;
};

export type ShiftClose = { counted: number; note: string };

export type DeskSettings = {
  receiptsBySms: boolean;
  receiptsInApp: boolean;
  notifyBookings: boolean;
  notifyArrivals: boolean;
  notifyMessages: boolean;
};

export type DeskMe = {
  name: string;
  role: string;
  places: string;
  settings: DeskSettings;
};
