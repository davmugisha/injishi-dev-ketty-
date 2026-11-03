// The prototype's sample stay (`.design/mobile-prototype/proto/screens/b-guest.mjs`): Sarah Kimani in room
// 204 at Isangano Lakeside, Thursday 15 Oct, 19:44, and her walk-in night at Ishyamba Forest Lodge.
// Design filler: names, rooms, prices and times live here only. Imported by `data.ts` alone. The writes
// below change this module's state and every read returns fresh copies, so the screens update.

import { kigaliTime } from "@/lib/kigali";
import { rwf } from "@/lib/money";
import { protoImages } from "@/proto/images";
import type {
  Bill,
  BillPayment,
  Booking,
  ChatItem,
  ChatThread,
  ClaimedStay,
  ClaimScan,
  DigitalKey,
  Extras,
  IdDocument,
  Inbox,
  InboxThread,
  Menu,
  PayMethodId,
  Prearrival,
  QuickRequestId,
  Requests,
  Review,
  RoomOrder,
  StayRequest,
  ThreadId,
} from "./types";

/** Plain data in, plain data out: a screen never holds a reference into the sample state. */
function copy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function now(): string {
  return kigaliTime(Date.now());
}

// ---------- Threads

const threads: Record<ThreadId, InboxThread> = {
  "front-desk": {
    id: "front-desk",
    name: "Front desk",
    lead: { kind: "photo", photo: protoImages["front-desk-lakeside"] },
    preview: "Your fresh towels are on the way.",
    time: "19:31",
    unread: 1,
    opens: "chat",
  },
  terrace: {
    id: "terrace",
    name: "Isangano Terrace",
    lead: { kind: "icon", icon: "Cup" },
    preview: "Done: a table for two at 20:00, by the water.",
    time: "Wed",
    unread: 0,
    opens: "chat",
  },
  reservations: {
    id: "reservations",
    name: "Reservations",
    lead: { kind: "icon", icon: "Calendar" },
    preview: "I've noted a high floor with a lake view.",
    time: "Mon",
    unread: 0,
    opens: "chat",
  },
  lodge: {
    id: "lodge",
    name: "Ishyamba front desk",
    lead: { kind: "icon", icon: "House" },
    preview: "Welcome to Ishyamba, Sarah. Your tent is T-07.",
    time: "17:06",
    unread: 0,
    opens: "chat",
  },
  support: {
    id: "support",
    name: "Support · HD-0931",
    lead: { kind: "icon", icon: "LifeRing" },
    preview: "Refunds reach MoMo within 3 working days.",
    time: "Oct 2",
    unread: 0,
    opens: "help",
  },
};

/** The walk-in lodge's thread appears once that stay is linked (G4). */
let lodgeLinked = false;
let updatesSeen = false;

const UPDATES: Inbox["updates"] = [
  {
    id: "up-order",
    icon: "Cup",
    tone: "accent",
    title: "Order RS-0214 is being prepared",
    detail: "Arriving about 20:27 · charged to room 204",
    time: "19:54",
    opens: "order",
  },
  {
    id: "up-key",
    icon: "Key",
    tone: "accent",
    title: "Your key is ready",
    detail: "Room 204 · works until Fri 16 Oct, 11:00",
    time: "Wed",
    opens: "key",
  },
  {
    id: "up-deposit",
    icon: "CircleCheck",
    tone: "success",
    title: "Deposit confirmed by MTN",
    detail: `${rwf(140000)} · MP261003.0914.K28417`,
    time: "Oct 3",
    opens: "bill",
  },
];

export function mockInbox(): Inbox {
  const stay: InboxThread[] = [threads["front-desk"], threads.terrace, threads.reservations];
  const groups: Inbox["groups"] = [{ title: "Isangano Lakeside · this stay", threads: stay }];
  if (lodgeLinked) groups.unshift({ title: "Ishyamba Forest Lodge · tonight", threads: [threads.lodge] });
  groups.push({ title: "Injishi", threads: [threads.support] });
  return copy({
    groups,
    updates: UPDATES,
    newUpdates: updatesSeen ? 0 : UPDATES.length,
    footnote: "Staff reply here themselves. No automated answers.",
  });
}

export function mockEmptyInbox(): Inbox {
  return { groups: [], updates: [], newUpdates: 0, footnote: "" };
}

/** Opening a thread reads it; a link to a thread that does not exist changes nothing. */
export function markThreadRead(id: string): void {
  if (id in threads) threads[id as ThreadId].unread = 0;
}

export function markUpdatesSeen(): void {
  updatesSeen = true;
}

// ---------- Requests (they also show inside the chat, with their live status)

const requests: StayRequest[] = [
  {
    id: "req-towels",
    icon: "BroomMotion",
    title: "Fresh towels × 2",
    detail: "Acknowledged by Jeanne 19:31 · by 19:55",
    status: "on-the-way",
  },
  {
    id: "req-taxi",
    icon: "Car",
    title: "Taxi to Gisenyi market",
    detail: "Tomorrow 09:00 · fare confirmed within 10 min",
    status: "sent",
  },
  {
    id: "req-tap",
    icon: "Wrench",
    title: "Bathroom tap dripping",
    detail: "Fixed by Jean-Paul at 11:20",
    status: "done",
  },
];

const QUICK: Requests["quick"] = [
  { id: "towels", icon: "BroomMotion", label: "Fresh towels", caption: "housekeeping" },
  { id: "cleaning", icon: "Clock", label: "Cleaning time", caption: "pick a slot" },
  { id: "fix", icon: "Wrench", label: "Something broke", caption: "maintenance" },
  { id: "taxi", icon: "Car", label: "Book a taxi", caption: "desk confirms fare" },
  { id: "pillow", icon: "Moon", label: "Extra pillow", caption: "or blanket" },
  { id: "food", icon: "Cup", label: "Order food", caption: "to room 204" },
];

/** What a one tap request becomes, and the team that takes it. */
const NEW_REQUEST: Record<Exclude<QuickRequestId, "food">, { title: string; team: string }> = {
  towels: { title: "Fresh towels", team: "Housekeeping" },
  cleaning: { title: "Room cleaning", team: "Housekeeping" },
  fix: { title: "Something to fix", team: "Maintenance" },
  taxi: { title: "Taxi", team: "The desk" },
  pillow: { title: "Extra pillow", team: "Housekeeping" },
};

const DUTY_PHONE = "+250788300911";
const DESK_PHONE = "+250788300100";

export function mockRequests(): Requests {
  return copy({
    room: "204",
    quick: QUICK,
    urgent: {
      title: "Urgent: water, power, lock or safety",
      body: "Goes to the duty manager now. Usually within 15 min.",
      phone: DUTY_PHONE,
    },
    requests,
    notice: "Updates come here and by SMS.",
  });
}

export function mockEmptyRequests(): Requests {
  return { ...mockRequests(), requests: [] };
}

let requestSeq = 0;

/** A one tap request: sent now, the team confirms in the thread. Returns the team, for the toast. */
export function createRequest(kind: Exclude<QuickRequestId, "food">): string {
  const spec = NEW_REQUEST[kind];
  const quick = QUICK.find((q) => q.id === kind);
  requestSeq += 1;
  requests.unshift({
    id: `req-new-${requestSeq}`,
    icon: quick?.icon ?? "Bell",
    title: spec.title,
    detail: `Sent ${now()} · ${spec.team} confirms here`,
    status: "sent",
  });
  return spec.team;
}

// ---------- Chat

type ThreadBody = Omit<ChatThread, "items"> & { items: (ChatItem | { kind: "ref"; id: string; requestId: string })[] };

const chats: Record<Exclude<ThreadId, "support">, ThreadBody> = {
  "front-desk": {
    id: "front-desk",
    name: "Front desk",
    subtitle: "Isangano · open 24 h · replies in about 15 min",
    phone: DESK_PHONE,
    day: "Today",
    composerHint: "Message the front desk",
    items: [
      { kind: "message", id: "m1", from: "me", text: "The bathroom tap drips a little. Not urgent!", meta: "08:40 · read" },
      {
        kind: "message",
        id: "m2",
        from: "them",
        text: "Sorry about that, Sarah. I've sent it to maintenance as a request so you can follow it.",
        meta: "Eric · 08:44",
      },
      { kind: "ref", id: "c1", requestId: "req-tap" },
      { kind: "message", id: "m3", from: "me", text: "Could we have two more bath towels please?", meta: "19:28 · read" },
      { kind: "message", id: "m4", from: "them", text: "Your fresh towels are on the way.", meta: "Eric · 19:31" },
      { kind: "ref", id: "c2", requestId: "req-towels" },
    ],
  },
  terrace: {
    id: "terrace",
    name: "Isangano Terrace",
    subtitle: "Restaurant · open 07:00–22:00",
    phone: DESK_PHONE,
    day: "Wednesday",
    composerHint: "Message Isangano Terrace",
    items: [
      {
        kind: "message",
        id: "t1",
        from: "me",
        text: "Could we have a table for two tonight, by the water?",
        meta: "18:02 · read",
      },
      { kind: "message", id: "t2", from: "them", text: "Done: a table for two at 20:00, by the water.", meta: "Aline · 18:10" },
    ],
  },
  reservations: {
    id: "reservations",
    name: "Reservations",
    subtitle: "Isangano · replies in office hours",
    phone: DESK_PHONE,
    day: "Monday",
    composerHint: "Message reservations",
    items: [
      { kind: "message", id: "r1", from: "me", text: "We'd love a high floor if possible.", meta: "09:12 · read" },
      { kind: "message", id: "r2", from: "them", text: "I've noted a high floor with a lake view.", meta: "Claudine · 09:40" },
    ],
  },
  lodge: {
    id: "lodge",
    name: "Ishyamba front desk",
    subtitle: "Ishyamba Forest Lodge · open 24 h",
    phone: DESK_PHONE,
    day: "Today",
    composerHint: "Message the lodge",
    items: [
      {
        kind: "message",
        id: "l1",
        from: "them",
        text: "Welcome to Ishyamba, Sarah. Your tent is T-07, and its key is at the desk.",
        meta: "Grace · 17:06",
      },
    ],
  },
};

/** Support lives in Help; a stray link to it opens the front desk instead. */
function chatOf(id: string): ThreadBody {
  return id in chats ? chats[id as keyof typeof chats] : chats["front-desk"];
}

export function mockChat(id: string): ChatThread {
  const body = chatOf(id);
  const items: ChatItem[] = body.items.flatMap((item): ChatItem[] => {
    if (item.kind !== "ref") return [item];
    const request = requests.find((r) => r.id === item.requestId);
    if (!request) return [];
    // The card in the thread is the request itself, so its status here is always the live one.
    const short = item.requestId === "req-tap" ? "Bathroom tap" : request.title;
    const detail = item.requestId === "req-towels" ? "Jeanne · expected by 19:55" : request.detail;
    return [{ kind: "request", id: item.id, icon: request.icon, title: short, detail, status: request.status }];
  });
  return copy({ ...body, items });
}

export function mockEmptyChat(id: string): ChatThread {
  return { ...mockChat(id), items: [] };
}

let messageSeq = 0;

export function sendMessage(input: { thread: string; text: string }): void {
  const body = chatOf(input.thread);
  const time = now();
  messageSeq += 1;
  body.items.push({ kind: "message", id: `sent-${messageSeq}`, from: "me", text: input.text, meta: `${time} · sent` });
  const thread = threads[body.id];
  thread.preview = `You: ${input.text}`;
  thread.time = time;
}

// ---------- Pre-arrival check-in

const prearrival: Prearrival = {
  booking: "BK-20431",
  title: "Add your ID",
  body: "The hotel registers everyone who stays. Send it now and the desk only compares it with the original.",
  document: "passport",
  faces: {
    passport: {
      heading: "PASSPORT · REPUBLIC OF KENYA",
      mrz: ["P<KENKIMANI<<SARAH<<<<<<<<<<<<", "AK••••••<4KEN••••••F••••••<<<<"],
    },
    "national-id": {
      heading: "NATIONAL ID · REPUBLIC OF KENYA",
      mrz: ["IDKEN2••••••<<<<<<<<<<<<<<<<<<", "KIMANI<<SARAH<<<<<<<<<<<<<<<<<"],
    },
  },
  uploaded: true,
  who: "Front desk and duty managers at Isangano. Never on your bill.",
  kept: "12 months after checkout, then deleted",
  arrival: {
    title: "When do you arrive?",
    body: "The desk has your room and key ready for then. You can change it until Wednesday.",
    windows: [
      { value: "12-14", label: "12:00 – 14:00", detail: "Early: the room may still be cleaned" },
      { value: "14-16", label: "14:00 – 16:00", detail: "Check-in opens at 14:00" },
      { value: "16-18", label: "16:00 – 18:00", detail: "Most guests arrive then" },
      { value: "18+", label: "After 18:00", detail: "The desk is open 24 h" },
    ],
    chosen: "14-16",
  },
  sentAt: null,
};

export function mockPrearrival(): Prearrival {
  return copy(prearrival);
}

export function submitPrearrival(input: { document: IdDocument; arrival: string; idAtDesk: boolean }): void {
  prearrival.document = input.document;
  prearrival.arrival.chosen = input.arrival;
  prearrival.uploaded = !input.idAtDesk;
  prearrival.sentAt = now();
}

// ---------- Digital key

const digitalKey: DigitalKey = {
  room: "Room 204",
  detail: "Deluxe Lake View · 2nd floor",
  validUntil: "Works until Fri 16 Oct, 11:00",
  hint: "Hold your phone within 10 cm of the lock with Bluetooth on.",
  alsoOpens: [
    { icon: "House", title: "Main entrance", detail: "After 23:00, when the front doors lock" },
    { icon: "Droplet", title: "Pool gate", detail: "07:00–19:00" },
  ],
  fallback: "Key not working? The desk gives you a key card straight away.",
  about:
    "Your phone talks to the lock over Bluetooth, so it works without signal. The door opens only when the lock confirms it.",
  activity: ["19:42", "08:02", "Wed 15:20"],
  relock: "It locks again after 5 seconds.",
};

export function mockKey(): DigitalKey {
  return copy(digitalKey);
}

/** The lock confirmed: the opening goes to the top of the activity. */
export function unlockDoor(): string {
  const time = now();
  digitalKey.activity = [time, ...digitalKey.activity].slice(0, 6);
  return time;
}

// ---------- Room service

const menu: Menu = {
  outlet: "Isangano Terrace · until 22:00 · about 35 min",
  room: "204",
  categories: [
    { value: "popular", label: "Popular" },
    { value: "mains", label: "Mains" },
    { value: "drinks", label: "Drinks" },
    { value: "desserts", label: "Desserts" },
  ],
  items: [
    {
      id: "tilapia",
      name: "Grilled tilapia",
      description: "Whole Kivu tilapia · plantain, medium spice",
      price: 14000,
      photo: protoImages["grilled-tilapia"],
      categories: ["popular", "mains"],
      soldOut: false,
    },
    {
      id: "brochettes",
      name: "Beef brochettes with chips",
      description: "Two skewers, kachumbari",
      price: 12000,
      photo: null,
      categories: ["popular", "mains"],
      soldOut: false,
    },
    {
      id: "isombe",
      name: "Isombe with rice",
      description: "Cassava leaves, slow cooked",
      price: 9000,
      photo: null,
      categories: ["popular", "mains"],
      soldOut: false,
    },
    {
      id: "tea",
      name: "Rwandan tea",
      description: "Pot for one",
      price: 2000,
      photo: protoImages["hotel-breakfast"],
      categories: ["popular", "drinks"],
      soldOut: false,
    },
    {
      id: "perch",
      name: "Nile perch fillet",
      description: "Pan fried, lemon butter",
      price: 16000,
      photo: null,
      categories: ["popular", "mains"],
      soldOut: true,
    },
    {
      id: "passion",
      name: "Fresh passion juice",
      description: "Pressed this morning",
      price: 3000,
      photo: null,
      categories: ["drinks"],
      soldOut: false,
    },
    {
      id: "water",
      name: "Mineral water",
      description: "Still, 1 litre",
      price: 1500,
      photo: null,
      categories: ["drinks"],
      soldOut: false,
    },
    {
      id: "fritters",
      name: "Banana fritters",
      description: "With honey and lime",
      price: 5000,
      photo: null,
      categories: ["desserts"],
      soldOut: false,
    },
    {
      id: "fruit",
      name: "Fruit plate",
      description: "Pineapple, mango, tree tomato",
      price: 4500,
      photo: null,
      categories: ["desserts"],
      soldOut: false,
    },
  ],
  cart: { tilapia: 1, tea: 1 },
  delivery: "free delivery · VAT included",
  note: "Coffee from Ikawa Corner can't go on your room bill: it's a separate business. Pay at the café, 07:00–19:00.",
};

export function mockMenu(): Menu {
  return copy(menu);
}

export function mockEmptyMenu(): Menu {
  return { ...mockMenu(), items: [], cart: {} };
}

let order: RoomOrder = {
  ref: "RS-0214",
  room: "To room 204",
  eta: "20:27",
  stage: "The kitchen is preparing it",
  progress: 45,
  steps: [
    { title: "Order placed", detail: "19:52 · charged to room 204", state: "done" },
    { title: "Kitchen accepted", detail: "19:54 · allergies shown to the chef", state: "done" },
    { title: "Preparing", detail: "About 25 minutes", state: "now", icon: "Cup" },
    { title: "On its way", detail: "A waiter brings it to 204", state: "todo", icon: "ArrowRight" },
  ],
  lines: [
    { label: "Grilled tilapia · plantain · medium", amount: 14000 },
    { label: "Rwandan tea", amount: 2000 },
  ],
  total: 16000,
  cancelNote: "Cancelling closed when the kitchen started.",
};

export function mockOrder(): RoomOrder {
  return copy(order);
}

let orderSeq = 214;

/** The terrace's usual time to a room: the menu's "about 35 min". */
const DELIVERY_MS = 35 * 60_000;

/** Charges the room: a new order the kitchen takes, and a line on the bill. */
export function placeOrder(cart: Record<string, number>): string {
  const lines = menu.items
    .filter((item) => (cart[item.id] ?? 0) > 0 && !item.soldOut)
    .map((item) => {
      const qty = cart[item.id] ?? 0;
      return { label: qty > 1 ? `${item.name} × ${qty}` : item.name, amount: item.price * qty };
    });
  const total = lines.reduce((sum, line) => sum + line.amount, 0);
  const time = now();
  orderSeq += 1;
  const ref = `RS-0${orderSeq}`;
  // Ordered: the next visit starts from an empty tray, so nothing is ordered twice by accident.
  menu.cart = {};
  order = {
    ref,
    room: `To room ${menu.room}`,
    eta: kigaliTime(Date.now() + DELIVERY_MS),
    stage: "Waiting for the kitchen to accept",
    progress: 10,
    steps: [
      { title: "Order placed", detail: `${time} · charged to room ${menu.room}`, state: "done" },
      { title: "Kitchen accepted", detail: "Usually within 2 minutes", state: "now", icon: "Clock" },
      { title: "Preparing", detail: "About 25 minutes", state: "todo", icon: "Cup" },
      { title: "On its way", detail: `A waiter brings it to ${menu.room}`, state: "todo", icon: "ArrowRight" },
    ],
    lines,
    total,
    cancelNote: "You can cancel until the kitchen starts.",
  };
  bill.lines.splice(bill.lines.length - 1, 0, {
    id: `order-${ref}`,
    icon: "Cup",
    tone: "default",
    title: `Room service · ${lines.length} ${lines.length === 1 ? "item" : "items"}`,
    detail: `Today ${time} · order ${ref}`,
    amount: total,
  });
  bill.posted += total;
  bill.due += total;
  return ref;
}

// ---------- Bill

const bill: Bill = {
  place: "Isangano · room 204",
  folio: "F-5531",
  due: 47500,
  posted: 187500,
  paidSoFar: 140000,
  paidNote: "deposit paid",
  lines: [
    { id: "night-1", icon: "House", tone: "default", title: "Room night · Wed 14 Oct", detail: "Deluxe Lake View", amount: 140000 },
    {
      id: "dinner",
      icon: "Cup",
      tone: "default",
      title: "Dinner for 2 · Isangano Terrace",
      detail: "Wed 20:40 · order T-2291",
      amount: 38500,
    },
    { id: "laundry", icon: "TShirt", tone: "default", title: "Laundry · 3 items", detail: "Thu 10:15", amount: 9000 },
    {
      id: "deposit",
      icon: "Check",
      tone: "success",
      title: "Deposit · MTN MoMo",
      detail: "Sat 3 Oct · MP261003.0914.K28417",
      amount: -140000,
    },
  ],
  pending: { title: "Not posted yet", body: `Tonight's room night, ${rwf(140000)}, posts at night audit around 02:00.` },
  receipt: "Issued at checkout, signed by RRA",
  invoice: null,
};

export function mockBill(): Bill {
  return copy(bill);
}

export function mockEmptyBill(): Bill {
  return { ...mockBill(), due: 0, posted: 0, paidSoFar: 0, lines: [], pending: null };
}

export function saveInvoice(input: { company: string; tin: string }): void {
  bill.invoice = { company: input.company, tin: input.tin };
}

const PAY_METHODS: BillPayment["methods"] = [
  {
    id: "mtn",
    title: "MTN MoMo",
    detail: "078 ••• 2097 · used for your deposit",
    icon: "Smartphone",
    tone: "warning",
    available: true,
    provider: "MTN",
  },
  {
    id: "airtel",
    title: "Airtel Money",
    detail: "Enter your Airtel number",
    icon: "Smartphone",
    tone: "danger",
    available: true,
    provider: "Airtel",
  },
  {
    id: "card",
    title: "Card",
    detail: "At the front desk only",
    icon: "CreditCard",
    tone: "default",
    available: false,
    provider: "the bank",
  },
];

export function mockBillPayment(): BillPayment {
  return copy({ due: bill.due, methods: PAY_METHODS, minimumPart: 5000 });
}

let paymentSeq = 0;

/** The provider confirmed (the wait screen stands for that): the payment goes on the bill. */
export function payBill(input: { amount: number; method: PayMethodId }): void {
  const method = PAY_METHODS.find((m) => m.id === input.method) ?? PAY_METHODS[0];
  const amount = Math.min(input.amount, bill.due);
  if (!method || amount <= 0) return;
  paymentSeq += 1;
  bill.lines.push({
    id: `pay-${paymentSeq}`,
    icon: "Check",
    tone: "success",
    title: `Payment · ${method.title}`,
    detail: `Today ${now()} · confirmed by ${method.provider}`,
    amount: -amount,
  });
  bill.due -= amount;
  bill.paidSoFar += amount;
  bill.paidNote = "paid";
}

// ---------- Review

const review: Review = {
  guest: "Sarah",
  place: "Isangano Lakeside",
  dates: "14–16 Oct",
  overall: 4,
  categories: [
    { id: "clean", label: "Cleanliness", rating: 5 },
    { id: "staff", label: "Staff", rating: 5 },
    { id: "location", label: "Location", rating: 4 },
    { id: "value", label: "Value for money", rating: 0 },
  ],
  text: "Lovely room right above the lake and a very kind front desk team: Eric sorted our dinner table within minutes. The dripping tap was fixed the next morning.",
  hint: "Category ratings and photos are optional. Edit until it publishes.",
  rewards: {
    program: "Amahoro Rewards",
    pending: "649 pending",
    progress: 62,
    line: "1,240 of 2,000 points for a free late checkout",
  },
  note: "Both reviews publish together after a moderation check, usually within 24 h.",
  submitted: false,
};

export function mockReview(): Review {
  return copy(review);
}

export function submitReview(input: { overall: number; categories: Record<string, number>; text: string }): void {
  review.overall = input.overall;
  review.categories = review.categories.map((c) => ({ ...c, rating: input.categories[c.id] ?? c.rating }));
  review.text = input.text;
  review.submitted = true;
}

// ---------- Walk-in stay (G4)

export function mockClaimScan(): ClaimScan {
  return copy({
    instruction: "The desk shows a QR code on their phone or screen. It links this stay to your account.",
    qrSeed: "ishyamba-walkin-ST-7531",
    photo: protoImages["front-desk-lakeside"],
    status: "Hold steady…",
    note: "The code only links the stay. The desk still checks your ID.",
    codeExample: "ST-7531",
  });
}

/** A stay code as the desk reads it out: ST and four digits. */
const STAY_CODE = /^ST-?\d{4}$/i;

/** Links the walk-in stay; false when the code is not one. */
export function claimStay(code: string): boolean {
  if (!STAY_CODE.test(code.trim())) return false;
  lodgeLinked = true;
  return true;
}

export function mockClaimedStay(): ClaimedStay {
  return copy({
    place: "Ishyamba Forest Lodge",
    desk: "Checked in by the desk at Ishyamba Forest Lodge.",
    photo: protoImages["forest-lodge"],
    unit: "Forest Tent T-07 · Sat 17 – Sun 18 Oct · 1 night",
    key: "Tents use a key from the desk, not your phone",
    bill: `${rwf(95000)} · pay any time before checkout`,
    message: "Front desk · open 24 h",
  });
}

// ---------- Extras (G5)

const extras: Extras = {
  room: "Charged to room 204",
  offer: { title: "10% off dinner tonight", detail: "An offer from Isangano Terrace · until 22:00", used: false },
  late: {
    label: "Late checkout · Fri 16 Oct",
    options: [
      { time: "13:00", note: "often possible", price: 20000 },
      { time: "15:00", note: "depends on arrivals", price: 45000 },
      { time: "18:00", note: "half the nightly rate", price: 70000 },
    ],
    chosen: "15:00",
    requested: null,
  },
  experiences: [
    {
      id: "boat",
      photo: protoImages["lake-kivu-shoreline"],
      title: "Boat trip on Lake Kivu",
      detail: "Tomorrow 07:00 · 2 hours · from the hotel jetty",
      price: `${rwf(25000)} each`,
      cta: "Add",
      added: false,
    },
    {
      id: "table",
      photo: protoImages["isangano-terrace"],
      title: "Table by the water",
      detail: "Isangano Terrace · tonight",
      price: "Free to book",
      cta: "Book",
      added: false,
    },
  ],
  note: "A request, not a promise: the desk confirms. Your key is extended only after approval.",
};

export function mockExtras(): Extras {
  return copy(extras);
}

export function redeemOffer(): void {
  extras.offer.used = true;
}

export function addExperience(id: string): void {
  const experience = extras.experiences.find((e) => e.id === id);
  if (experience) experience.added = true;
}

export function requestLateCheckout(time: string): void {
  extras.late.chosen = time;
  extras.late.requested = time;
}

// ---------- Change or cancel (G6)

const booking: Booking = {
  ref: "BK-20431",
  dates: "Wed 14 – Fri 16 Oct",
  deposit: 140000,
  total: 280000,
  back: 0,
  changesAt: "today 14:00",
  tiers: [
    { title: "Free cancellation", detail: "More than 7 days before · ended Wed 7 Oct", state: "done" },
    { title: "Deposit kept", detail: "Now, until today 14:00", state: "now", icon: "Clock" },
    { title: "Full stay charged", detail: "Under 48 hours, or no-show", state: "todo", icon: "TriangleExclamation" },
  ],
  change: { title: "Change dates instead?", body: "Ask the hotel. They can move your deposit to new dates." },
  payer: "MTN MoMo · 078 ••• 2097",
  note: "Cancelling is final. Any refund goes back to the MoMo number you paid with.",
  cancelledAt: null,
};

export function mockBooking(): Booking {
  return copy(booking);
}

export function cancelBooking(): void {
  booking.cancelledAt = now();
}
