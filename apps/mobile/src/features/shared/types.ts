// View models the shared screens read (prototype `a-shared.mjs`): the place switcher, the staff inbox,
// the outbox, account and privacy, account deletion, help, and the test money sheet. Several of them
// mount inside more than one app, so most reads take the app (`AppKey`) they are drawn in.

import type { IconName, Tone } from "@/components/ui";
import type { ProtoImage } from "@/proto/images";
import type { AppKey } from "@/proto/screens";

/** One place or role in the switcher: a hotel the person works at, their home, or their own trips. */
export interface Place {
  id: string;
  /** The app it opens. */
  app: AppKey;
  group: "work" | "personal";
  title: string;
  /** "Housekeeping supervisor · Rubavu". */
  detail: string;
  /** A photo of the place, else `icon` on a soft tile. */
  photo?: ProtoImage;
  icon?: IconName;
}

export interface SwitcherView {
  places: Place[];
  /** The place in use for this app. */
  currentId: string;
}

/** What a staff inbox row opens, per app (the screen maps it to a route). */
export type NotifTarget = "task" | "rooms" | "schedule" | "payslip" | "roomSheet" | "inspect" | "team" | "job" | "jobs";

export interface Notif {
  id: string;
  section: "today" | "earlier";
  /** The filter it belongs to ("rooms", "schedule", "pay", "team", "jobs"). */
  category: string;
  icon: IconName;
  tone: Tone;
  title: string;
  detail: string;
  /** New since the person last looked. */
  unread: boolean;
  /** The live dot an unread row wears: danger for a rush, success for good news. */
  live?: "danger" | "success" | "warning";
  opens: NotifTarget;
  /** The room it is about, for `task` and `roomSheet`. */
  room?: string;
}

export interface NotifFilter {
  value: string;
  label: string;
}

export interface NotifsView {
  filters: NotifFilter[];
  items: Notif[];
}

export type OutboxItemState = "waiting" | "sending" | "trying" | "refused" | "sent";

/** One thing saved on this phone: waiting to send, refused, or sent today. */
export interface OutboxItem {
  id: string;
  icon: IconName;
  title: string;
  /** "Saved 10:02 · front desk still sees Dirty". */
  detail: string;
  state: OutboxItemState;
}

export interface OutboxView {
  /** Api mode: someone is signed in, so these are their rows. Always true on sample data. */
  signedIn: boolean;
  waiting: OutboxItem[];
  refused: OutboxItem[];
  sent: OutboxItem[];
}

export interface Device {
  id: string;
  name: string;
  detail: string;
  /** This phone: it cannot sign itself out from here. */
  current: boolean;
}

export interface Person {
  name: string;
  initials: string;
  email: string;
  /** A masked phone number, or a role line for staff. */
  lines: string[];
}

export interface AccountView {
  person: Person;
  /** "Name as on ID, phone, nationality" and the values behind it. */
  details: { label: string; value: string }[];
  /** A saved ID document; guests only. */
  savedId: string | null;
  payment: string;
  language: string;
  notifications: { push: boolean; email: boolean };
  devices: Device[];
  /** "Injishi 1.0 (beta) · test money". */
  version: string;
}

export interface DeleteItem {
  icon: IconName;
  tone: Tone;
  title: string;
  detail: string;
}

export interface DeleteView {
  email: string;
  items: DeleteItem[];
}

/** A help question: it opens a guest screen (`opens`), or its answer shows in place. */
export interface Faq {
  id: string;
  question: string;
  answer: string;
  /** A guest screen that answers it better than words; only drawn in the guest app. */
  opens?: "refund" | "key" | "bill";
}

export interface SupportQuestion {
  id: string;
  title: string;
  detail: string;
  state: "answered" | "sent";
}

export interface HelpView {
  faqs: Faq[];
  questions: SupportQuestion[];
}

export interface TestPayment {
  title: string;
  amount: number;
  from: string;
  /** How many test payments this phone has sent. */
  sent: number;
}
