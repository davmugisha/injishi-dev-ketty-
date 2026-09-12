/**
 * The Work · Housekeeping fixtures — frames W1 to W8.
 *
 * **Transcribed from `design/mobile-prototype/interactive-state-machine.js`**,
 * which the session prompt names as the behaviour spec: `SEED_TASKS`,
 * `SEED_ROOMS`, `ROOM_TYPE` and the state vocabulary are that file's, value for
 * value. Where the still frames and the interactive twin disagree the twin
 * wins, because it is the one that had to actually run — frame W4 draws 305 out
 * of order on ticket T-117, the twin seeds every room clean so that FILING a
 * fault (W6) is what turns one out of order. The twin's seed is the one that
 * makes the demo loop work, so it is the one here.
 *
 * Shapes follow F-P04 and F-P05 rather than the drawing: `task_type` and the
 * `pending → in_progress → done → inspected` / `blocked` state set are the
 * feature's own (F-P04 §6, §8), and `TicketStatus` is F-P05's widened status
 * narrowed to the three a housekeeper's phone can actually see.
 *
 * **What is a string here and what is a `t()` key.** Chrome is a key; CONTENT
 * is data. A room type ("Garden Suite") is the property's own name for it, and
 * a desk note is a sentence a receptionist typed — translating either in the
 * catalogue would be claiming the app authored words a person wrote. Same
 * treatment `src/data/rentals.ts` gives a tenant name and a property name.
 * Everything the APP says goes through `src/i18n/messages/work.ts`.
 */

/* --------------------------------------------------------------- vocabulary */

/** F-P04 §8: `pending → in_progress → done → inspected`; any → `blocked` → pending. */
export type TaskStatus = 'pending' | 'in_progress' | 'done' | 'inspected' | 'blocked';

/** F-P04 §6: the housekeeping axis, orthogonal to inventory status. */
export type HkStatus = 'clean' | 'dirty' | 'in_progress' | 'inspected' | 'out_of_order';

/** F-P05 §8, narrowed: a housekeeper sees open, assigned and resolved. */
export type TicketStatus = 'open' | 'assigned' | 'resolved';

/** F-P04 §6 `task_type`. `inspection` is the supervisor's, and never queued here. */
export type TaskKind = 'checkout_clean' | 'stayover_clean' | 'turndown' | 'deep_clean';

/** Frame W6's "HOW BAD". F-P05 calls it `priority`. */
export type Severity = 'low' | 'normal' | 'high' | 'urgent';

/** Frame W6's "WHAT IS WRONG". F-P05 calls it `category`. */
export type FaultCategory = 'electrical' | 'plumbing' | 'furniture' | 'other';

/** Frame W5's "WHAT FAILED". */
export type FailReason = 'bathroom' | 'linen' | 'dusting' | 'bin';

export interface WorkTask {
  /** The room number. It is the task's identity on this surface, as in the twin. */
  id: string;
  /** The property's own room-type name. Data, not chrome — see the file note. */
  type: string;
  floor: number;
  kind: TaskKind;
  status: TaskStatus;
  /** A checkout clean races an arrival. `arrival` is when the next guest lands. */
  arrival?: string;
  /** A turndown is scheduled rather than raced. */
  at?: string;
  /** Frame W1's "High priority" chip. */
  priority?: 'high';
  /** What the desk wrote. A person's sentence, in the language they wrote it. */
  note?: string;
  /** Who wrote it and when. Frame W3: "Denise L. · Front desk · 14:58". */
  noteBy?: string;
  /** The ticket holding it, once a fault has blocked it (F-P04 §9). */
  blockedBy?: string;
  /** Frame W1's live arrival: drawn with the accent border until it is opened. */
  isNew?: boolean;
  /** Epoch ms the arrival landed, for the banner's "4s ago". */
  arrivedAt?: number;
  /** Recorded when the task is finished, for the shift summary. */
  minutes?: number;
}

export interface WorkRoom {
  id: string;
  type: string;
  floor: number;
  status: HkStatus;
  /** The ticket that put it out of order, where one did. */
  ticket?: string;
}

export interface WorkTicket {
  ref: string;
  room: string;
  category: FaultCategory;
  severity: Severity;
  /** The one line the reporter typed. Their words, so not a catalogue key. */
  line: string;
  status: TicketStatus;
  /** How many photographs led it. F-P05: the photo leads the ticket. */
  photos: number;
  /** Epoch ms it was filed, so the board can order and age it. */
  at: number;
}

/** A room another attendant marked done, waiting on a supervisor (frame W5). */
export interface InspectionRow {
  room: string;
  type: string;
  kind: TaskKind;
  /** The attendant who cleaned it. A counterparty, per decision D7. */
  by: string;
  doneAt: string;
  minutes: number;
}

/**
 * One local write held on the phone while there is no signal (F-P10 §6).
 *
 * `key` is the idempotency key F-P10 requires: the replay carries it, the
 * server dedupes on it, and it is what lets frame W2's reconnect card promise
 * that nothing double-posts. It is minted when the change is MADE rather than
 * when it is sent — a key generated at flush time would be a new key on every
 * retry, which is the exact bug the mechanism exists to prevent.
 */
export interface BufferedChange {
  key: string;
  room: string;
  /** What the change did, as the reconnect list prints it. */
  kind: 'clean' | 'started' | 'blocked' | 'status' | 'ticket';
  /** Epoch ms, so the flush can prove it replays in the order it was made. */
  at: number;
}

/* -------------------------------------------------------------------- seeds */

/** `SEED_TASKS`, transcribed. Frame W3's byline lands on 205, which it draws. */
export const SEED_TASKS: readonly WorkTask[] = [
  {
    id: '104',
    type: 'Std Twin',
    floor: 1,
    kind: 'checkout_clean',
    status: 'pending',
    arrival: '15:30',
    note: 'Guest left early — no linen change requested.',
    noteBy: 'Denise L. · Front desk · 14:12',
  },
  {
    id: '112',
    type: 'Garden Suite',
    floor: 1,
    kind: 'turndown',
    status: 'pending',
    at: '18:00',
    note: 'Turndown after dinner service, guest in house.',
    noteBy: 'Denise L. · Front desk · 13:40',
  },
  {
    id: '205',
    type: 'Std Twin',
    floor: 2,
    kind: 'checkout_clean',
    status: 'pending',
    arrival: '16:00',
    priority: 'high',
    note: 'Guest left early — no linen change requested. Balcony door sticks, worth a look.',
    noteBy: 'Denise L. · Front desk · 14:58',
  },
  {
    id: '303',
    type: 'Std Twin',
    floor: 3,
    kind: 'deep_clean',
    status: 'pending',
    note: 'Quarterly deep clean — allow extra time.',
    noteBy: 'Solange U. · Supervisor · 09:05',
  },
  {
    id: '307',
    type: 'Deluxe King',
    floor: 3,
    kind: 'stayover_clean',
    status: 'in_progress',
    note: 'Guest asked for the room after 11:00.',
    noteBy: 'Denise L. · Front desk · 10:02',
  },
  {
    id: '310',
    type: 'Deluxe King',
    floor: 3,
    kind: 'stayover_clean',
    status: 'pending',
    note: 'Two towels short yesterday — top up.',
    noteBy: 'Solange U. · Supervisor · 09:40',
  },
];

/**
 * The task the desk pushes a few seconds after the queue mounts, drawn as an
 * arrival rather than as a refresh (frame W1's note, and F-P04's own success
 * criterion: on the queue within one second of checkout).
 */
export const ARRIVAL_TASK: WorkTask = {
  id: '208',
  type: 'Deluxe King',
  floor: 2,
  kind: 'checkout_clean',
  status: 'pending',
  arrival: '16:30',
  isNew: true,
  note: 'Checked out at 10:24. Late checkout, guest arriving 16:30.',
  noteBy: 'Denise L. · Front desk · 10:24',
};

/** The twin's own delay before the desk's checkout lands. */
export const ARRIVAL_DELAY_MS = 6500;

/** `ROOM_TYPE`, transcribed. The board is floor 3, which frame W4 draws. */
const ROOM_TYPE: Record<string, string> = {
  '301': 'Std Twin',
  '302': 'Std Twin',
  '303': 'Std Twin',
  '304': 'Std Twin',
  '305': 'Std Twin',
  '306': 'Std Twin',
  '307': 'Deluxe King',
  '308': 'Deluxe King',
  '309': 'Deluxe King',
  '310': 'Deluxe King',
  '311': 'Family Room',
  '312': 'Garden Suite',
};

/** `SEED_ROOMS`, transcribed, in board order. */
const SEED_ROOM_STATUS: Record<string, HkStatus> = {
  '301': 'clean',
  '302': 'clean',
  '303': 'dirty',
  '304': 'clean',
  '305': 'clean',
  '306': 'clean',
  '307': 'in_progress',
  '308': 'clean',
  '309': 'clean',
  '310': 'clean',
  '311': 'clean',
  '312': 'inspected',
};

export const SEED_ROOMS: readonly WorkRoom[] = Object.keys(SEED_ROOM_STATUS).map((id) => ({
  id,
  type: ROOM_TYPE[id] ?? 'Std Twin',
  floor: Number(id[0]),
  status: SEED_ROOM_STATUS[id],
}));

/** The type of any room the surface knows, for a sheet header or a ticket card. */
export function roomTypeOf(id: string): string {
  return ROOM_TYPE[id] ?? SEED_TASKS.find((task) => task.id === id)?.type ?? 'Std Twin';
}

/**
 * The floor a room is on, read off its number — the same convention the
 * operator app uses in `apps/app/src/pms/screens/room-status.tsx`.
 */
export function floorOf(id: string): number {
  return Number(id[0]) || 0;
}

/** `tickets: []`. Frame W6 is what fills this, which is the point of the loop. */
export const SEED_TICKETS: readonly WorkTicket[] = [];

/** The first reference a filed ticket takes, per the twin's `'T-' + (118 + n)`. */
export const FIRST_TICKET_REF = 118;

/**
 * Frame W5's three rooms waiting on a supervisor. Every name here is a
 * counterparty: decision D7 puts one person in every seat, so the attendants
 * these rooms belong to are other people and the viewer is the supervisor.
 */
export const SEED_INSPECTIONS: readonly InspectionRow[] = [
  { room: '201', type: 'Std Twin', kind: 'checkout_clean', by: 'Beatha M.', doneAt: '15:04', minutes: 19 },
  { room: '203', type: 'Deluxe King', kind: 'stayover_clean', by: 'Claudine M.', doneAt: '14:48', minutes: 24 },
  { room: '206', type: 'Std Twin', kind: 'checkout_clean', by: 'Josiane U.', doneAt: '14:30', minutes: 21 },
];

/**
 * The persona's own seat on this property, and the flags the screens branch on.
 *
 * It lives here rather than in `src/data/personas.ts`, which Session 0 froze: a
 * seat-level attribute this one surface reads belongs beside the surface, and
 * Session 11 can lift it the day a second surface needs it.
 */
export const WORK_PROFILE = {
  /** Frame W5 is reachable from the Queue only when this is true. */
  supervisor: true,
  /** Who a "Request check" goes to (frame W3's toast). */
  signsOff: 'Solange U.',
  /** Frame W7's eyebrow. */
  shiftStart: '06:00',
  shiftEnd: '14:00',
  /** The clock every Work screen prints, so a screenshot is reproducible. */
  clock: '10:24',
  /** Frame W7's chip wrap: rooms finished before this session started. */
  roomsFinished: ['101', '102', '105', '108', '201', '203', '206', '211', '301', '303', '308'],
  /** The twin's `cleanedCount: 11 + done.length`. */
  cleanedBefore: 11,
  /** Frame W3: "your average is 22 min". */
  averageMinutes: 22,
} as const;

/** What a finished room is recorded as taking when no timer reading is held. */
export const DEFAULT_TASK_MINUTES = 22;
