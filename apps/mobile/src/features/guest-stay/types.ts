// What the guest stay screens read (proto-ui, PLAN.md "Data seam"): the guest's app during and after a
// stay, from the inbox to the bill. Built by `data.ts`; the screens never see where it came from.

import type { ImageRequireSource } from "react-native";
import type { IconName, TimelineStep, Tone } from "@/components/ui";

// ---------- Inbox and chat

/** Every conversation the guest has: the desks of the hotel, the lodge of a walk-in stay, Injishi support. */
export type ThreadId = "front-desk" | "terrace" | "reservations" | "lodge" | "support";

/** A thread's mark in the inbox: the desk's photo, or an icon on a soft disc. */
export type ThreadLead = { kind: "photo"; photo: ImageRequireSource } | { kind: "icon"; icon: IconName };

export type InboxThread = {
  id: ThreadId;
  name: string;
  lead: ThreadLead;
  /** The last message, one line. */
  preview: string;
  time: string;
  unread: number;
  /** A desk's thread opens the chat; Injishi support opens Help. */
  opens: "chat" | "help";
};

/** A place's threads under its name ("Isangano Lakeside · this stay", "Injishi"). */
export type InboxGroup = { title: string; threads: InboxThread[] };

/** An update the app posts itself (key ready, payment confirmed): the Updates tab. */
export type InboxUpdate = {
  id: string;
  icon: IconName;
  tone: Tone;
  title: string;
  detail: string;
  time: string;
  /** Where tapping it goes. */
  opens: "key" | "bill" | "order";
};

export type Inbox = {
  groups: InboxGroup[];
  updates: InboxUpdate[];
  /** Updates not looked at yet: the count on the Updates segment. */
  newUpdates: number;
  footnote: string;
};

/** A request's state, always shown as a word as well as a colour. */
export type RequestStatus = "sent" | "on-the-way" | "done";

export type ChatItem =
  | { kind: "message"; id: string; from: "me" | "them"; text: string; meta: string }
  /** A message that became a request: its live status, inside the conversation. */
  | { kind: "request"; id: string; icon: IconName; title: string; detail: string; status: RequestStatus };

export type ChatThread = {
  id: ThreadId;
  name: string;
  subtitle: string;
  /** The desk's number for the call button; null where there is no line to call. */
  phone: string | null;
  /** The day the messages are from ("Today"). */
  day: string;
  items: ChatItem[];
  composerHint: string;
};

// ---------- Requests

export type QuickRequestId = "towels" | "cleaning" | "fix" | "taxi" | "pillow" | "food";

export type QuickRequest = { id: QuickRequestId; icon: IconName; label: string; caption: string };

export type StayRequest = { id: string; icon: IconName; title: string; detail: string; status: RequestStatus };

export type Requests = {
  room: string;
  quick: QuickRequest[];
  urgent: { title: string; body: string; phone: string };
  requests: StayRequest[];
  notice: string;
};

// ---------- Pre-arrival check-in

export type IdDocument = "passport" | "national-id";

/** The stand-in picture of a document: its heading and its two machine readable lines, half hidden. */
export type IdCardFace = { heading: string; mrz: readonly [string, string] };

export type ArrivalWindow = { value: string; label: string; detail: string };

export type Prearrival = {
  booking: string;
  title: string;
  body: string;
  document: IdDocument;
  faces: Record<IdDocument, IdCardFace>;
  uploaded: boolean;
  /** Who sees the ID and how long it is kept, asked before the ID is. */
  who: string;
  kept: string;
  arrival: { title: string; body: string; windows: ArrivalWindow[]; chosen: string };
  /** When the ID and arrival time went to the desk; null until then. */
  sentAt: string | null;
};

// ---------- Digital key

export type DigitalKey = {
  room: string;
  detail: string;
  validUntil: string;
  hint: string;
  alsoOpens: { icon: IconName; title: string; detail: string }[];
  fallback: string;
  about: string;
  /** The lock's confirmations, newest first ("19:42", "Wed 15:20"). */
  activity: string[];
  relock: string;
};

// ---------- Room service

export type MenuCategory = "popular" | "mains" | "drinks" | "desserts";

export type MenuItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  photo: ImageRequireSource | null;
  categories: MenuCategory[];
  soldOut: boolean;
};

export type Menu = {
  outlet: string;
  room: string;
  categories: { value: MenuCategory; label: string }[];
  items: MenuItem[];
  /** What the guest had picked last time: item id to quantity. */
  cart: Record<string, number>;
  delivery: string;
  note: string;
};

export type RoomOrder = {
  ref: string;
  room: string;
  eta: string;
  stage: string;
  /** How far along, 0 to 100, for the ring. */
  progress: number;
  steps: TimelineStep[];
  lines: { label: string; amount: number }[];
  total: number;
  cancelNote: string;
};

// ---------- Bill

export type BillLine = {
  id: string;
  icon: IconName;
  tone: Tone;
  title: string;
  detail: string;
  /** Negative for a payment. */
  amount: number;
};

export type Bill = {
  place: string;
  folio: string;
  due: number;
  posted: number;
  paidSoFar: number;
  /** What the paid figure is ("deposit paid", then "paid" once the stay's bill is paid into). */
  paidNote: string;
  lines: BillLine[];
  pending: { title: string; body: string } | null;
  receipt: string;
  invoice: { company: string; tin: string } | null;
};

export type PayMethodId = "mtn" | "airtel" | "card";

export type PayMethod = {
  id: PayMethodId;
  title: string;
  detail: string;
  icon: IconName;
  tone: Tone;
  /** Card is shown, honestly, as desk only. */
  available: boolean;
  provider: string;
};

export type BillPayment = { due: number; methods: PayMethod[]; minimumPart: number };

// ---------- Review

export type Review = {
  guest: string;
  place: string;
  dates: string;
  overall: number;
  categories: { id: string; label: string; rating: number }[];
  text: string;
  hint: string;
  /** Design copy only: no points service exists yet, so the card hides when this is null. */
  rewards: { program: string; pending: string; progress: number; line: string } | null;
  note: string;
  submitted: boolean;
};

// ---------- Walk-in stay (G4)

export type ClaimScan = {
  instruction: string;
  qrSeed: string;
  photo: ImageRequireSource;
  status: string;
  note: string;
  codeExample: string;
};

export type ClaimedStay = {
  place: string;
  desk: string;
  photo: ImageRequireSource;
  unit: string;
  key: string;
  bill: string;
  message: string;
};

// ---------- Extras (G5)

export type LateCheckoutOption = { time: string; note: string; price: number };

export type Experience = {
  id: string;
  photo: ImageRequireSource;
  title: string;
  detail: string;
  price: string;
  cta: string;
  added: boolean;
};

export type Extras = {
  room: string;
  offer: { title: string; detail: string; used: boolean };
  late: { label: string; options: LateCheckoutOption[]; chosen: string; requested: string | null };
  experiences: Experience[];
  note: string;
};

// ---------- Change or cancel (G6)

export type Booking = {
  ref: string;
  dates: string;
  deposit: number;
  total: number;
  /** What comes back if cancelled now. */
  back: number;
  /** When cancelling gets dearer ("today 14:00"). */
  changesAt: string;
  tiers: TimelineStep[];
  change: { title: string; body: string };
  payer: string;
  note: string;
  cancelledAt: string | null;
};
