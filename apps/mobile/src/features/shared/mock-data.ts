// The shared screens' sample data, from the prototype (`a-shared.mjs`, and the people of the other
// modules where a shared screen shows inside their app). Read only by `data.ts`; its mock actions
// change the state below and each read returns fresh objects, so the screens update.

import type { AppKey } from "@/proto/screens";
import type {
  AccountView,
  DeleteView,
  Faq,
  HelpView,
  Notif,
  NotifFilter,
  NotifsView,
  OutboxItem,
  OutboxView,
  Person,
  Place,
  SupportQuestion,
  SwitcherView,
  TestPayment,
} from "./types";

// ---------------------------------------------------------------- switcher

const TRIPS: Place = {
  id: "trips",
  app: "guest",
  group: "personal",
  title: "My trips",
  detail: "Book and manage your own stays",
  icon: "Suitcase",
};

const PLACES: Record<AppKey, Place[]> = {
  supervisor: [
    {
      id: "isangano-supervisor",
      app: "supervisor",
      group: "work",
      title: "Isangano Lakeside Hotel",
      detail: "Housekeeping supervisor · Rubavu",
      photo: "isangano-hotel-exterior",
    },
    {
      id: "ishyamba-supervisor",
      app: "supervisor",
      group: "work",
      title: "Ishyamba Forest Lodge",
      detail: "Covering supervisor · Nyamagabe",
      photo: "forest-lodge",
    },
    TRIPS,
  ],
  housekeeper: [
    {
      id: "isangano-housekeeper",
      app: "housekeeper",
      group: "work",
      title: "Isangano Lakeside Hotel",
      detail: "Housekeeper · Rubavu",
      photo: "isangano-hotel-exterior",
    },
    TRIPS,
  ],
  technician: [
    {
      id: "isangano-technician",
      app: "technician",
      group: "work",
      title: "Isangano Lakeside Hotel",
      detail: "Maintenance technician · Rubavu",
      photo: "isangano-hotel-exterior",
    },
    TRIPS,
  ],
  manager: [
    {
      id: "isangano-manager",
      app: "manager",
      group: "work",
      title: "Isangano Lakeside Hotel",
      detail: "General manager · Rubavu",
      photo: "isangano-hotel-exterior",
    },
    {
      id: "ishyamba-manager",
      app: "manager",
      group: "work",
      title: "Ishyamba Forest Lodge",
      detail: "General manager · Nyamagabe",
      photo: "forest-lodge",
    },
    TRIPS,
  ],
  desk: [
    {
      id: "ishyamba-desk",
      app: "desk",
      group: "work",
      title: "Ishyamba Forest Lodge",
      detail: "Front desk · Nyamagabe",
      photo: "forest-lodge",
    },
    {
      id: "isangano-desk",
      app: "desk",
      group: "work",
      title: "Isangano Lakeside Hotel",
      detail: "Front desk cover · Rubavu",
      photo: "isangano-hotel-exterior",
    },
    TRIPS,
  ],
  resident: [
    {
      id: "kacyiru-home",
      app: "resident",
      group: "personal",
      title: "Kacyiru Court B-07",
      detail: "My home · Amahoro Residences",
      icon: "House",
    },
    TRIPS,
  ],
  guest: [TRIPS],
};

/** The place in use, per app; the first of each list until one is chosen. */
const current: Partial<Record<AppKey, string>> = {};

export function mockSwitcher(app: AppKey): SwitcherView {
  const places = PLACES[app].map((place) => ({ ...place }));
  return { places, currentId: current[app] ?? places[0]?.id ?? TRIPS.id };
}

/** Choose a place: it becomes the one in use for its own app. */
export function choosePlace(input: { from: AppKey; placeId: string }): Place | null {
  const place = PLACES[input.from].find((p) => p.id === input.placeId);
  if (!place) return null;
  current[place.app] = place.id;
  return { ...place };
}

// ---------------------------------------------------------------- staff inbox

const NOTIF_FILTERS: Record<"housekeeper" | "supervisor" | "technician", NotifFilter[]> = {
  housekeeper: [
    { value: "all", label: "All" },
    { value: "rooms", label: "Rooms" },
    { value: "schedule", label: "Schedule" },
    { value: "pay", label: "Pay" },
  ],
  supervisor: [
    { value: "all", label: "All" },
    { value: "rooms", label: "Rooms" },
    { value: "team", label: "Team" },
    { value: "pay", label: "Pay" },
  ],
  technician: [
    { value: "all", label: "All" },
    { value: "jobs", label: "Jobs" },
    { value: "schedule", label: "Schedule" },
    { value: "pay", label: "Pay" },
  ],
};

const NOTIFS: Record<"housekeeper" | "supervisor" | "technician", Notif[]> = {
  housekeeper: [
    {
      id: "hk-rush-206",
      section: "today",
      category: "rooms",
      icon: "Thunderbolt",
      tone: "danger",
      title: "Rush: 206 arrival moved to 12:00",
      detail: "Beatrice · 10:12 · clean 206 next",
      unread: true,
      live: "danger",
      opens: "task",
      room: "206",
    },
    {
      id: "hk-ready-204",
      section: "today",
      category: "rooms",
      icon: "CheckDouble",
      tone: "success",
      title: "204 inspected · Ready to sell",
      detail: "Beatrice passed all 18 checks · 10:05",
      unread: true,
      live: "success",
      opens: "rooms",
    },
    {
      id: "hk-desk-211",
      section: "today",
      category: "rooms",
      icon: "Comments",
      tone: "accent",
      title: "Message from front desk",
      detail: "“211 guest left a charger, please bag it” · 09:48",
      unread: false,
      opens: "task",
      room: "211",
    },
    {
      id: "hk-leave",
      section: "earlier",
      category: "schedule",
      icon: "Calendar",
      tone: "default",
      title: "Leave approved · 3–4 Nov",
      detail: "Diane (HR) · Fri 9 Oct",
      unread: false,
      opens: "schedule",
    },
    {
      id: "hk-payslip",
      section: "earlier",
      category: "pay",
      icon: "FileText",
      tone: "default",
      title: "September payslip is ready",
      detail: "Locked with your PIN · Thu 8 Oct",
      unread: false,
      opens: "payslip",
    },
    {
      id: "hk-swap",
      section: "earlier",
      category: "schedule",
      icon: "ArrowRightArrowLeft",
      tone: "default",
      title: "Claudine accepted your shift swap",
      detail: "Sat 17 Oct · waiting for Beatrice",
      unread: false,
      opens: "schedule",
    },
  ],
  supervisor: [
    {
      id: "sup-rush-206",
      section: "today",
      category: "rooms",
      icon: "Thunderbolt",
      tone: "danger",
      title: "206 arrival moved to 12:00",
      detail: "Front desk · 10:12 · still DND until 11:00",
      unread: true,
      live: "danger",
      opens: "roomSheet",
      room: "206",
    },
    {
      id: "sup-clean-201",
      section: "today",
      category: "rooms",
      icon: "CheckDouble",
      tone: "success",
      title: "201 is clean · ready to inspect",
      detail: "Jeanne finished 10:08 · arrival at 13:00",
      unread: true,
      live: "success",
      opens: "inspect",
      room: "201",
    },
    {
      id: "sup-leak-207",
      section: "today",
      category: "rooms",
      icon: "Wrench",
      tone: "warning",
      title: "207 blocked · shower leak",
      detail: "Jean-Paul is on it · 09:40",
      unread: false,
      opens: "roomSheet",
      room: "207",
    },
    {
      id: "sup-swap",
      section: "earlier",
      category: "team",
      icon: "ArrowRightArrowLeft",
      tone: "default",
      title: "Claudine and Jeanne want to swap",
      detail: "Sat 17 Oct · waiting for you",
      unread: false,
      opens: "team",
    },
    {
      id: "sup-leave",
      section: "earlier",
      category: "team",
      icon: "Calendar",
      tone: "default",
      title: "Leave · Jeanne N. · 3–4 Nov",
      detail: "You approved · Aline has it next",
      unread: false,
      opens: "team",
    },
    {
      id: "sup-payslip",
      section: "earlier",
      category: "pay",
      icon: "FileText",
      tone: "default",
      title: "September payslip is ready",
      detail: "Locked with your PIN · Thu 8 Oct",
      unread: false,
      opens: "payslip",
    },
  ],
  technician: [
    {
      id: "tech-wo-318",
      section: "today",
      category: "jobs",
      icon: "Thunderbolt",
      tone: "danger",
      title: "Urgent: basin leak in room 112",
      detail: "WO-318 · from Jeanne · 10:45",
      unread: true,
      live: "danger",
      opens: "job",
    },
    {
      id: "tech-305",
      section: "today",
      category: "jobs",
      icon: "CheckDouble",
      tone: "success",
      title: "305 inspected · back on sale",
      detail: "Beatrice checked your AC fix · 10:40",
      unread: true,
      live: "success",
      opens: "jobs",
    },
    {
      id: "tech-parts",
      section: "today",
      category: "jobs",
      icon: "Box",
      tone: "accent",
      title: "Hinge set ready at the store",
      detail: "Patrick · for WO-324, room 302 · 09:30",
      unread: false,
      opens: "jobs",
    },
    {
      id: "tech-leave",
      section: "earlier",
      category: "schedule",
      icon: "Calendar",
      tone: "default",
      title: "Leave approved · 3–4 Nov",
      detail: "Diane (HR) · Fri 9 Oct",
      unread: false,
      opens: "schedule",
    },
    {
      id: "tech-payslip",
      section: "earlier",
      category: "pay",
      icon: "FileText",
      tone: "default",
      title: "September payslip is ready",
      detail: "Locked with your PIN · Thu 8 Oct",
      unread: false,
      opens: "payslip",
    },
  ],
};

type StaffApp = keyof typeof NOTIFS;

/** The staff app whose inbox a surface shows: anything that is not staff reads the housekeeper's. */
function staffApp(app: AppKey): StaffApp {
  return app === "supervisor" || app === "technician" ? app : "housekeeper";
}

export function mockNotifs(app: AppKey): NotifsView {
  const which = staffApp(app);
  return {
    filters: NOTIF_FILTERS[which].map((f) => ({ ...f })),
    items: NOTIFS[which].map((n) => ({ ...n })),
  };
}

export function emptyNotifs(app: AppKey): NotifsView {
  return { filters: NOTIF_FILTERS[staffApp(app)].map((f) => ({ ...f })), items: [] };
}

/** Mark one row read, or every row when no id is given. */
export function markNotifsRead(input: { app: AppKey; id?: string }): void {
  for (const n of NOTIFS[staffApp(input.app)]) {
    if (!input.id || n.id === input.id) n.unread = false;
  }
}

// ---------------------------------------------------------------- outbox

let outbox: OutboxView = {
  signedIn: true,
  waiting: [
    {
      id: "ob-204-checks",
      icon: "ListCheck",
      title: "Room 204 · 12 checks ticked",
      detail: "Saved 10:02 · front desk still sees Dirty",
      state: "waiting",
    },
    {
      id: "ob-corridor",
      icon: "Camera",
      title: "Problem: floor 2 corridor",
      detail: "1 photo, made smaller: 180 KB · saved 10:09",
      state: "waiting",
    },
  ],
  refused: [],
  sent: [
    { id: "ob-203-clean", icon: "CircleCheck", title: "Room 203 marked clean", detail: "Sent 09:05", state: "sent" },
    {
      id: "ob-203-minibar",
      icon: "CircleCheck",
      title: "Minibar count · 203",
      detail: "Nothing used · sent 09:06",
      state: "sent",
    },
    {
      id: "ob-clock-in",
      icon: "CircleCheck",
      title: "Clocked in",
      detail: "07:02 · Isangano staff entrance",
      state: "sent",
    },
  ],
};

function copyOutbox(view: OutboxView): OutboxView {
  const copy = (items: OutboxItem[]) => items.map((item) => ({ ...item }));
  return { signedIn: view.signedIn, waiting: copy(view.waiting), refused: copy(view.refused), sent: copy(view.sent) };
}

export function mockOutbox(): OutboxView {
  return copyOutbox(outbox);
}

export function emptyOutbox(): OutboxView {
  return { signedIn: true, waiting: [], refused: [], sent: [] };
}

/** "Try sending now": the signal is back, so everything waiting goes, newest at the top of Sent today. */
export function sendOutboxNow(at: string): void {
  const sent = outbox.waiting.map<OutboxItem>((item) => ({
    ...item,
    icon: "CircleCheck",
    detail: `Sent ${at}`,
    state: "sent",
  }));
  outbox = { ...outbox, waiting: [], sent: [...sent, ...outbox.sent] };
}

export function dismissOutboxItem(id: string): void {
  outbox = { ...outbox, refused: outbox.refused.filter((item) => item.id !== id) };
}

// ---------------------------------------------------------------- account

const PEOPLE: Record<AppKey, Person> = {
  guest: { name: "Sarah Kimani", initials: "SK", email: "sarah.kimani@gmail.com", lines: ["+254 7•• ••• 418"] },
  resident: {
    name: "Olivier Habineza",
    initials: "OH",
    email: "olivier.habineza@gmail.com",
    lines: ["+250 78• ••• 731"],
  },
  manager: {
    name: "Aline Uwase",
    initials: "AU",
    email: "aline.uwase@amahoro.rw",
    lines: ["General manager · Amahoro Hospitality Ltd"],
  },
  desk: {
    name: "Eric Habimana",
    initials: "EH",
    email: "eric.habimana@amahoro.rw",
    lines: ["Front desk · Ishyamba Forest Lodge"],
  },
  housekeeper: {
    name: "Jeanne Nyiraneza",
    initials: "JN",
    email: "jeanne.nyiraneza@amahoro.rw",
    lines: ["Housekeeper · Isangano Lakeside"],
  },
  supervisor: {
    name: "Beatrice Uwimana",
    initials: "BU",
    email: "beatrice.uwimana@amahoro.rw",
    lines: ["Housekeeping supervisor · Isangano Lakeside"],
  },
  technician: {
    name: "Jean-Paul Nshimiyimana",
    initials: "JP",
    email: "jeanpaul.n@amahoro.rw",
    lines: ["Maintenance · Isangano Lakeside"],
  },
};

const NATIONALITY: Partial<Record<AppKey, string>> = { guest: "Kenyan" };

const PAYMENT: Partial<Record<AppKey, string>> = {
  guest: "MTN MoMo 078 ••• 2097",
  resident: "MTN MoMo 078 ••• 731",
};

const account = {
  notifications: { push: true, email: true },
  laptopSignedIn: true,
};

export function mockAccount(app: AppKey): AccountView {
  const person = PEOPLE[app];
  const phone = app === "guest" || app === "resident" ? person.lines[0] : "+250 78• ••• 102";
  return {
    person: { ...person, lines: [...person.lines] },
    details: [
      { label: "Name as on ID", value: person.name },
      { label: "Phone", value: phone ?? "" },
      { label: "Nationality", value: NATIONALITY[app] ?? "Rwandan" },
    ],
    savedId: app === "guest" ? "Passport · encrypted · used for check-in" : null,
    payment: PAYMENT[app] ?? "MTN MoMo 078 ••• 102",
    language: "English",
    notifications: { ...account.notifications },
    devices: [
      { id: "this-phone", name: "This Pixel 9", detail: "Rubavu · now", current: true },
      ...(account.laptopSignedIn
        ? [{ id: "laptop", name: "A laptop browser", detail: "Chrome · Kigali · 2 days ago", current: false }]
        : []),
    ],
    version: "Injishi 1.0 (beta) · test money",
  };
}

export function setAccountNotifications(input: { push?: boolean; email?: boolean }): void {
  account.notifications = { ...account.notifications, ...input };
}

export function signOutDevice(id: string): void {
  if (id === "laptop") account.laptopSignedIn = false;
}

// ---------------------------------------------------------------- delete account

export function mockDelete(app: AppKey): DeleteView {
  return {
    email: PEOPLE[app].email,
    items: [
      {
        icon: "Xmark",
        tone: "danger",
        title: "Deleted now",
        detail: "Profile, saved ID photos, saved stays, payment numbers, messages",
      },
      {
        icon: "FileText",
        tone: "default",
        title: "Kept by the hotels",
        detail: "Fiscal receipts and booking records they must keep by law",
      },
      {
        icon: "Suitcase",
        tone: "warning",
        title: "Upcoming trip",
        detail: "Isangano · 14 Oct stays booked; manage it first",
      },
    ],
  };
}

/** The emailed code on sample data: any six digits. */
export function confirmDelete(code: string): boolean {
  return /^\d{6}$/.test(code);
}

// ---------------------------------------------------------------- help

const MOMO: Faq = {
  id: "momo",
  question: "When is my MoMo payment confirmed?",
  answer:
    "As soon as you approve the prompt on your phone, usually within a minute. If MTN is slow, the payment shows as waiting and nothing is charged twice.",
};

const FAQS: Record<AppKey, Faq[]> = {
  guest: [
    MOMO,
    {
      id: "change",
      question: "How do I change or cancel a booking?",
      answer: "Open the trip and choose Change or cancel; the refund your policy allows is shown before you confirm.",
      opens: "refund",
    },
    {
      id: "key",
      question: "My key doesn't open the door",
      answer:
        "Hold the phone flat against the lock for two seconds. If it still stays shut, the key screen calls the desk.",
      opens: "key",
    },
    {
      id: "tin",
      question: "Getting a receipt with my company TIN",
      answer: "Add your company's TIN on the bill before you pay; the fiscal receipt carries it.",
      opens: "bill",
    },
  ],
  resident: [
    {
      id: "rent",
      question: "When is my rent payment confirmed?",
      answer: "When MTN confirms the prompt, usually within a minute. Your receipt shows in Payments straight after.",
    },
    {
      id: "emergency",
      question: "What counts as an emergency repair?",
      answer: "Water, power, a lock or anything unsafe. Call the caretaker first, then report it so it is on record.",
    },
    {
      id: "fiscal",
      question: "Who issues my fiscal receipt?",
      answer: "Your landlord does. Injishi's receipt is proof you paid, not a tax invoice.",
    },
  ],
  manager: [
    MOMO,
    {
      id: "owner",
      question: "Why is a request waiting on the owner?",
      answer:
        "It is above your limit. It stays under Waiting on others until Didier decides, so nothing is silently stuck.",
    },
    {
      id: "confirm",
      question: "How do I confirm an approval?",
      answer: "With your fingerprint, or your PIN as a backup. You can change it in Me, under Confirm approvals with.",
    },
  ],
  desk: [
    MOMO,
    {
      id: "expired",
      question: "The guest's MoMo prompt expired",
      answer: "Send a new prompt from the payment screen, or take cash and record it. The booking holds meanwhile.",
    },
    {
      id: "offline",
      question: "Can I check a guest in with weak signal?",
      answer: "Yes. Check-ins save on the phone and send when signal returns; only payments need a connection.",
    },
  ],
  housekeeper: [
    {
      id: "ticks",
      question: "What happens to my ticks with no signal?",
      answer: "They are saved on this phone and sent by themselves when signal returns. Closing the app loses nothing.",
    },
    {
      id: "payslip",
      question: "When is my payslip ready?",
      answer: "On the 8th of each month, locked with your payslip PIN.",
    },
  ],
  supervisor: [
    {
      id: "ticks",
      question: "What happens to inspections with no signal?",
      answer: "They are saved on this phone and sent by themselves when signal returns. Closing the app loses nothing.",
    },
    {
      id: "payslip",
      question: "When is my payslip ready?",
      answer: "On the 8th of each month, locked with your payslip PIN.",
    },
  ],
  technician: [
    {
      id: "parts",
      question: "How do I ask the store for a part?",
      answer: "Open the work order and choose Waiting for parts; Patrick sees the request at once.",
    },
    {
      id: "payslip",
      question: "When is my payslip ready?",
      answer: "On the 8th of each month, locked with your payslip PIN.",
    },
  ],
};

const questions: SupportQuestion[] = [
  { id: "HD-0931", title: "HD-0931 · Refund timing", detail: "Answered yesterday", state: "answered" },
];

let nextTicket = 942;

export function mockHelp(app: AppKey): HelpView {
  return {
    faqs: FAQS[app].map((faq) => ({ ...faq })),
    questions: questions.map((q) => ({ ...q })),
  };
}

/** "Message support": the question goes to Injishi support and shows under Your questions. */
export function askSupport(text: string): SupportQuestion {
  const words = text.trim().replace(/\s+/g, " ");
  const topic = words.length > 32 ? `${words.slice(0, 31)}…` : words;
  const question: SupportQuestion = {
    id: `HD-0${nextTicket}`,
    title: `HD-0${nextTicket} · ${topic}`,
    detail: "Sent just now · usually answered within a few hours",
    state: "sent",
  };
  nextTicket += 1;
  questions.unshift(question);
  return { ...question };
}

// ---------------------------------------------------------------- test money

const testPayment: TestPayment = { title: "Pay your bill", amount: 47500, from: "MTN MoMo 078 ••• 2097", sent: 0 };

export function mockTestPayment(): TestPayment {
  return { ...testPayment };
}

export function sendTestPayment(): TestPayment {
  testPayment.sent += 1;
  return { ...testPayment };
}
