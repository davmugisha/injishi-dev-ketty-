/**
 * Maintenance tickets — one store, two seats.
 *
 * Frame R20 is a tenant filing an issue; frame R4 is the landlord working the
 * queue it lands in. **Session 7's prompt says the ticket a tenant files "the
 * Landlord surface reads", so this cannot be a tenant-private store**, and
 * Session 8 must import this rather than build a second one. Two stores would
 * mean a tenant filing a ticket that never appears on the landlord's Repairs
 * tab, which is the one thing F-R11 exists to prevent ("maintenance requests
 * happen off-platform with no record").
 *
 * The seed is the "Seed repairs" table in `design/mobile-prototype/frames.md`
 * verbatim — T-204, T-201, T-198 — and the state map is that file's ticket row:
 * `open` danger, `assigned` brand, `resolved` success, which is exactly what
 * `StatusBadge` domain `ticket` already carries.
 *
 * The shape is F-R11's: an issue, a description, evidence, a priority and an
 * audit trail. `photos` holds local `file://` uris in this build — nothing is
 * uploaded, and the landlord seat draws them from the same store rather than
 * from storage, which is honest for a prototype and is exactly the seam
 * F-S09's object storage replaces.
 */
import { useFixture, type FixtureResult } from './use-fixture';
import {
  readFixture,
  useFixtureMutation,
  useFixtureValue,
  writeFixture,
  type FixtureMutation,
} from './use-fixture-mutation';
import { useOfflineSubmit } from './offline-submit';

export const TICKETS_KEY = 'residence.tickets';

export type TicketState = 'open' | 'assigned' | 'resolved';
/** Frame R20's segment, in its own order. */
export type TicketPriority = 'urgent' | 'normal' | 'low';

export interface TicketEvent {
  /** `YYYY-MM-DD`. */
  on: string;
  /** What happened, in the vocabulary the audit trail keeps. */
  what: 'filed' | 'assigned' | 'resolved';
  /** Who did it. A display name, not an id — this is a trail, not a join. */
  by: string;
}

export interface Ticket {
  /** `T-204`. Human-facing, and what both seats call it. */
  ref: string;
  title: string;
  detail: string;
  /** The unit, or `Common area`. Frame R4 draws both. */
  location: string;
  /** The lease this was filed against, where a tenant filed it. */
  leaseId?: string;
  /** Who reported it, as the landlord's queue names them. */
  reporter: string;
  priority: TicketPriority;
  state: TicketState;
  /** `YYYY-MM-DD`. */
  filedOn: string;
  /** Local `file://` uris. Empty is normal; a ticket does not need evidence. */
  photos: string[];
  /** Newest last, so the trail reads top to bottom. */
  events: TicketEvent[];
}

/**
 * Frames.md "Seed repairs", with the relative ages it prints resolved against
 * the fixtures' own today (2026-09-06): 2 days ago, 5 days ago, 12 days ago.
 */
export const TICKETS: Ticket[] = [
  {
    ref: 'T-204',
    title: 'Kitchen tap dripping',
    detail: 'The cold tap in the kitchen has dripped since the weekend and the washer looks gone.',
    location: 'Unit B1',
    reporter: 'Grace M.',
    priority: 'normal',
    state: 'open',
    filedOn: '2026-09-04',
    photos: [],
    events: [{ on: '2026-09-04', what: 'filed', by: 'Grace M.' }],
  },
  {
    ref: 'T-201',
    title: 'Corridor light out',
    detail: 'The light on the second-floor landing has been out for a week. The stairs are dark after six.',
    location: 'Common area',
    reporter: 'Yves R.',
    priority: 'normal',
    state: 'assigned',
    filedOn: '2026-09-01',
    photos: [],
    events: [
      { on: '2026-09-01', what: 'filed', by: 'Yves R.' },
      { on: '2026-09-02', what: 'assigned', by: 'Innocent M.' },
    ],
  },
  {
    ref: 'T-198',
    title: 'Gate motor jammed',
    detail: 'The main gate motor sticks halfway and has to be pushed the rest of the way.',
    location: 'Common area',
    reporter: 'Caretaker',
    priority: 'urgent',
    state: 'resolved',
    filedOn: '2026-08-25',
    photos: [],
    events: [
      { on: '2026-08-25', what: 'filed', by: 'Caretaker' },
      { on: '2026-08-26', what: 'assigned', by: 'Innocent M.' },
      { on: '2026-08-28', what: 'resolved', by: 'Innocent M.' },
    ],
  },
];

const seed = (): Ticket[] => TICKETS;

/** Every ticket, newest first, with the four states a list owes its reader. */
export function useTickets(): FixtureResult<readonly Ticket[]> {
  const live = useFixtureValue<Ticket[]>(TICKETS_KEY, seed);
  const gate = useFixture(TICKETS_KEY, seed);
  return {
    status: gate.status,
    error: gate.error,
    retry: gate.retry,
    data: gate.status === 'ready' ? live : undefined,
  };
}

/**
 * The next reference. Sequential from the highest already issued, because a
 * reference is what a tenant reads back over the phone and a random one is a
 * reference nobody can repeat. Real numbering is the server's; this is the
 * shape of it.
 */
export function nextRef(all: readonly Ticket[]): string {
  const highest = all.reduce((max, t) => {
    const n = Number(t.ref.replace(/\D/g, ''));
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);
  return `T-${highest + 1}`;
}

export interface FileTicketInput {
  title: string;
  detail: string;
  location: string;
  leaseId: string;
  reporter: string;
  priority: TicketPriority;
  photos: string[];
  /** `YYYY-MM-DD`. */
  filedOn: string;
}

/**
 * F-R11: a ticket opens `open` with one audit row, and goes to the front of the
 * queue. The landlord's `Assign` is what moves it on (frame R4), and it is
 * Session 8's write, not this one's.
 */
export function applyFiling(all: Ticket[], input: FileTicketInput): Ticket[] {
  const ticket: Ticket = {
    ref: nextRef(all),
    title: input.title,
    detail: input.detail,
    location: input.location,
    leaseId: input.leaseId,
    reporter: input.reporter,
    priority: input.priority,
    state: 'open',
    filedOn: input.filedOn,
    photos: input.photos,
    events: [{ on: input.filedOn, what: 'filed', by: input.reporter }],
  };
  return [ticket, ...all];
}

export function useFileTicket(): FixtureMutation<FileTicketInput> {
  return useFixtureMutation<Ticket[], FileTicketInput>(TICKETS_KEY, applyFiling, seed);
}

/**
 * Filing a fault, offline (gaps.md B5).
 *
 * *"Often reported from a basement or a stairwell."* The submit used to fail
 * outright there — the mutation ran, the store wrote nothing anyone could send,
 * and the tenant was told their report was filed. This routes the same write
 * through the offline queue, which persists it and replays it on reconnect.
 *
 * The confirmation wording is the part `data-seam.md` §5 is strictest about:
 * a queued report is confirmed as *"submitted when you reconnect"*, **never**
 * as *"received"*. Nobody has seen it. A tenant told the landlord has their
 * report stops chasing it.
 */
export function useFileTicketOffline() {
  return useOfflineSubmit<FileTicketInput>({
    kind: 'fault',
    handler: (input) => {
      writeFixture<Ticket[]>(TICKETS_KEY, applyFiling(readFixture<Ticket[]>(TICKETS_KEY, seed()), input));
      // The fixture store cannot refuse and cannot be unreachable, so this
      // is always `ok`. The surface child that puts a real mutation here
      // (ADR-038 children 1 to 7) is where `refused` and `failed` start
      // being answered for real.
      return { status: 'ok' as const };
    },
    label: (input) => input.title,
  });
}

/** The tickets filed against one lease, newest first. Frame R15's row count. */
export function ticketsForLease(all: readonly Ticket[], leaseId: string): Ticket[] {
  return all.filter((t) => t.leaseId === leaseId);
}
