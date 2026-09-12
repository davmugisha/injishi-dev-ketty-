/**
 * StatusBadge — single source of truth for the PRD §9.3 status-semantics table.
 * Maps (domain, state) -> tone + label so every Lease / Rent / Caution / Filing
 * state looks identical across the app. Port of the DS StatusBadge.
 *
 * Session 0 added three domains the prototype needs and the platform table did
 * not carry: `task`, `housekeeping` and `ticket`. Their tones and labels are
 * transcribed verbatim from `design/mobile-prototype/interactive-state-machine.js`
 * (`TASK_STATE`, `HK_STATE`, `TICKET_STATE`), which is the interactive twin's
 * own source of truth. The original six are untouched.
 *
 * Two of the new rows are worth reading twice, because they are the whole point
 * of frame W4:
 *
 *   - `housekeeping.clean` is not the same fact as sellable. A room can be
 *     spotless and out of order at the same time, which is why `out_of_order`
 *     is its own state on this axis rather than a flag on another one.
 *   - `task.done` and `task.inspected` are also different facts. Where a
 *     supervisor's inspection is required, `done` does not release the room;
 *     only `inspected` does (frame W5).
 *
 * `housekeeping.in_progress` and `task.in_progress` deliberately carry the same
 * word. They are two axes on the same room and a reader should not have to
 * learn two vocabularies for one idea.
 */
import { Badge, type Tone } from './badge';
import { useT, type MessageKey } from '@/i18n/i18n';

type Entry = [Tone, MessageKey];

const MAP: Record<string, Record<string, Entry>> = {
  booking: {
    pending_approval: ['warning', 'status.booking.pending_approval'],
    confirmed: ['brand', 'status.booking.confirmed'],
    arriving: ['brand', 'status.booking.arriving'],
    checked_in: ['success', 'status.booking.checked_in'],
    completed: ['neutral', 'status.booking.completed'],
    declined: ['danger', 'status.booking.declined'],
    cancelled: ['danger', 'status.booking.cancelled'],
    no_show: ['warning', 'status.booking.no_show'],
  },
  lease: {
    draft: ['neutral', 'status.lease.draft'],
    pending_signature: ['warning', 'status.lease.pending_signature'],
    active: ['success', 'status.lease.active'],
    ending: ['warning', 'status.lease.ending'],
    ended: ['neutral', 'status.lease.ended'],
    cancelled: ['danger', 'status.lease.cancelled'],
  },
  rent: {
    paid: ['success', 'status.rent.paid'],
    due: ['neutral', 'status.rent.due'],
    overdue: ['danger', 'status.rent.overdue'],
  },
  caution: {
    held: ['brand', 'status.caution.held'],
    refunded: ['success', 'status.caution.refunded'],
    forfeited: ['danger', 'status.caution.forfeited'],
  },
  identity: {
    verified: ['success', 'status.identity.verified'],
    unverified: ['neutral', 'status.identity.unverified'],
  },
  filing: {
    pending: ['warning', 'status.filing.pending'],
    filed: ['success', 'status.filing.filed'],
    failed: ['danger', 'status.filing.failed'],
  },
  /* Added by Session 0, from the prototype's interactive twin. */
  task: {
    pending: ['warning', 'status.task.pending'],
    in_progress: ['brand', 'status.task.in_progress'],
    done: ['success', 'status.task.done'],
    inspected: ['neutral', 'status.task.inspected'],
    blocked: ['danger', 'status.task.blocked'],
  },
  housekeeping: {
    clean: ['success', 'status.housekeeping.clean'],
    dirty: ['warning', 'status.housekeeping.dirty'],
    in_progress: ['brand', 'status.housekeeping.in_progress'],
    inspected: ['neutral', 'status.housekeeping.inspected'],
    out_of_order: ['danger', 'status.housekeeping.out_of_order'],
  },
  ticket: {
    open: ['danger', 'status.ticket.open'],
    assigned: ['brand', 'status.ticket.assigned'],
    resolved: ['success', 'status.ticket.resolved'],
  },
};

/**
 * The tone a (domain, state) pair resolves to, for a caller that needs the
 * tone without the badge — frame W4's room tiles take the tone as a FILL and a
 * heavier border rather than as a pill, and re-deriving that mapping in the
 * tile is how the two drift apart.
 */
export function statusTone(domain: string, state: string): Tone {
  return MAP[domain]?.[state]?.[0] ?? 'neutral';
}

export interface StatusBadgeProps {
  domain: keyof typeof MAP;
  state: string;
  label?: string;
  dot?: boolean;
  size?: 'md' | 'lg';
}

export function StatusBadge({ domain, state, label, dot = true, size = 'md' }: StatusBadgeProps) {
  const t = useT();
  const entry = MAP[domain]?.[state];
  // An unmapped state falls back to its own name rather than to nothing — a
  // blank badge hides the state, and hiding the state is the failure this
  // component exists to prevent.
  return (
    <Badge tone={entry?.[0] ?? 'neutral'} dot={dot} size={size}>
      {label ?? (entry ? t(entry[1]) : state)}
    </Badge>
  );
}
