/**
 * The help desk and the things lent to staff, as the API answers them (`@injishi/contracts`
 * hr-desk), and the words every screen shows for them: Staff services, People home, Me and the phone.
 */
import { dayMonth } from "./format";

export interface ApiTicket {
  id: string;
  reference: string;
  employee: { employeeId: string; displayName: string; jobPositionTitle: string | null };
  topic: "pay" | "leave" | "documents" | "uniform" | "it" | "other";
  subject: string;
  status: "open" | "answered" | "closed";
  messages: { id: string; fromStaff: boolean; authorName: string | null; body: string; createdAt: string }[];
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
}

export interface ApiLoan {
  id: string;
  employee: { employeeId: string; displayName: string; jobPositionTitle: string | null };
  employeeActive: boolean;
  kind: "key" | "uniform" | "phone" | "laptop" | "tool" | "other";
  name: string;
  tag: string | null;
  issuedOn: string;
  dueBackOn: string | null;
  returnedOn: string | null;
  note: string | null;
  issuedByName: string | null;
  createdAt: string;
}

export const TOPIC: Record<ApiTicket["topic"], { label: string; icon: string }> = {
  pay: { label: "Pay", icon: "Sack" },
  leave: { label: "Leave", icon: "Calendar" },
  documents: { label: "Documents", icon: "FileText" },
  uniform: { label: "Uniform", icon: "TShirt" },
  it: { label: "Phone or app", icon: "Smartphone" },
  other: { label: "Other", icon: "Comment" },
};

export const ASSET: Record<ApiLoan["kind"], { label: string; icon: string; highRisk: boolean }> = {
  key: { label: "Key", icon: "Key", highRisk: true },
  uniform: { label: "Uniform", icon: "TShirt", highRisk: false },
  phone: { label: "Phone", icon: "Smartphone", highRisk: true },
  laptop: { label: "Laptop", icon: "Display", highRisk: true },
  tool: { label: "Tool", icon: "Wrench", highRisk: false },
  other: { label: "Other", icon: "Box", highRisk: false },
};

/**
 * The words a return is recorded with. The API keeps no outcome of its own: closing a loan writes this
 * note on it, and every screen reads the outcome back from the note.
 */
export const RETURN_NOTE = { damaged: "Came back damaged", lost: "Reported lost" } as const;

/** How a loan came back; null while it is still out. */
export function loanOutcome(l: Pick<ApiLoan, "returnedOn" | "note">): "good" | "damaged" | "lost" | null {
  if (!l.returnedOn) return null;
  if (l.note === RETURN_NOTE.lost) return "lost";
  if (l.note === RETURN_NOTE.damaged) return "damaged";
  return "good";
}

/** How long ago: "just now", "45 min", "3 h", "2 days". */
export function ageOf(iso: string, now = Date.now()): string {
  const min = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  if (min < 2) return "just now";
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "1 day" : `${d} days`;
}

/** "just now", or "45 min ago". */
export const agoOf = (iso: string, now = Date.now()) => {
  const age = ageOf(iso, now);
  return age === "just now" ? age : `${age} ago`;
};

/** Where a ticket stands, in words and a tone. */
export function ticketState(t: ApiTicket): { label: string; tone: "warning" | "accent" | "success" } {
  if (t.status === "closed") return { label: "Resolved", tone: "success" };
  if (t.status === "answered") return { label: "Answered", tone: "accent" };
  return { label: "Waiting for HR", tone: "warning" };
}

/** Where a loan stands: out, due back (or late), back, lost, or held by someone who left. */
export function loanState(
  l: ApiLoan,
  today: string,
): { label: string; tone: "default" | "warning" | "danger" | "success"; due: boolean } {
  if (l.returnedOn) {
    const outcome = loanOutcome(l);
    if (outcome === "lost") return { label: `Lost ${dayMonth(l.returnedOn)}`, tone: "danger", due: false };
    return {
      label: `Back ${dayMonth(l.returnedOn)}`,
      tone: outcome === "damaged" ? "warning" : "success",
      due: false,
    };
  }
  if (!l.employeeActive) return { label: "With a leaver", tone: "danger", due: true };
  if (l.dueBackOn && l.dueBackOn < today)
    return { label: `Late · due ${dayMonth(l.dueBackOn)}`, tone: "danger", due: true };
  if (l.dueBackOn && l.dueBackOn === today) return { label: "Due back today", tone: "warning", due: true };
  if (l.dueBackOn) return { label: `Due back ${dayMonth(l.dueBackOn)}`, tone: "default", due: false };
  return { label: "With them", tone: "default", due: false };
}

// ── What HR shares with a person, on Me and the phone ────────────────────────────────────────────

export interface ApiMyAnnouncement {
  id: string;
  title: string;
  body: string;
  postedAt: string;
  expiresOn: string | null;
}

export interface ApiMyReview {
  id: string;
  cycleName: string;
  startsOn: string;
  endsOn: string;
  cycleOpen: boolean;
  selfDone: boolean;
  managerDone: boolean;
  rating: number | null;
  note: string | null;
}

/** An announcement as a person reads it: "6 Nov · until 20 Nov". */
export function announcementWords(a: ApiMyAnnouncement): { id: string; title: string; body: string; meta: string } {
  return {
    id: a.id,
    title: a.title,
    body: a.body,
    meta: a.expiresOn ? `${dayMonth(a.postedAt)} · until ${dayMonth(a.expiresOn)}` : dayMonth(a.postedAt),
  };
}

/** A person's own review: where it stands, and whether their part can still be written. */
export function reviewWords(r: ApiMyReview): {
  id: string;
  title: string;
  meta: string;
  chip: string;
  tone: "accent" | "success" | "warning" | "default";
  note: string | null;
  canWrite: boolean;
} {
  const state: { chip: string; tone: "accent" | "success" | "warning" | "default" } =
    r.rating !== null
      ? { chip: `Rated ${r.rating} of 5`, tone: "success" }
      : r.selfDone
        ? { chip: r.managerDone ? "With HR" : "With your manager", tone: "accent" }
        : r.cycleOpen
          ? { chip: "Your turn", tone: "warning" }
          : { chip: "Not sent", tone: "default" };
  return {
    id: r.id,
    title: r.cycleName,
    meta: `${dayMonth(r.startsOn)} – ${dayMonth(r.endsOn)}`,
    ...state,
    note: r.note,
    canWrite: r.cycleOpen && r.rating === null,
  };
}
