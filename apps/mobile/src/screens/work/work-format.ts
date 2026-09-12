/**
 * The Work surface's selectors and formatters — everything the screens ask
 * that has one right answer and no React in it.
 *
 * They live apart from the components for the reason `src/data/search.ts`'s
 * predicate does: the interesting half of a queue screen is which rows are
 * live, which are finished, what the count on a floor tab is and what an empty
 * list should say, and none of that should need a renderer to assert. This file
 * is what `work-format.test.ts` covers.
 *
 * Every function that produces copy returns a `MessageKey` plus its parameters
 * rather than a sentence. A formatter that returned English would be the one
 * place on the surface that could not be read in Kinyarwanda.
 */
import type { MessageKey } from '@/i18n/i18n';
import {
  WORK_PROFILE,
  type BufferedChange,
  type FaultCategory,
  type HkStatus,
  type Severity,
  type TaskKind,
  type WorkRoom,
  type WorkTask,
  type WorkTicket,
} from './work-fixtures';

/** A key and the values it interpolates, so a caller does `t(...spread)`. */
export interface Phrase {
  key: MessageKey;
  values?: Record<string, string | number>;
}

/* ------------------------------------------------------------ vocabularies */

export const TASK_KIND_KEY: Record<TaskKind, MessageKey> = {
  checkout_clean: 'work.kind.checkoutClean',
  stayover_clean: 'work.kind.stayoverClean',
  turndown: 'work.kind.turndown',
  deep_clean: 'work.kind.deepClean',
};

export const FAULT_KEY: Record<FaultCategory, MessageKey> = {
  electrical: 'work.fault.electrical',
  plumbing: 'work.fault.plumbing',
  furniture: 'work.fault.furniture',
  other: 'work.fault.other',
};

export const SEVERITY_KEY: Record<Severity, MessageKey> = {
  low: 'work.severity.low',
  normal: 'work.severity.normal',
  high: 'work.severity.high',
  urgent: 'work.severity.urgent',
};

/** The order frame W6 draws them in. */
export const FAULTS: readonly FaultCategory[] = ['electrical', 'plumbing', 'furniture', 'other'];
export const SEVERITIES: readonly Severity[] = ['low', 'normal', 'high', 'urgent'];

/** Frame W4's sheet offers these four, in this order. */
export const HK_OPTIONS: readonly HkStatus[] = ['dirty', 'in_progress', 'clean', 'inspected'];

/* ------------------------------------------------------------------ queue */

/** A task still on the queue: not finished, not signed off. */
export function isLive(task: WorkTask): boolean {
  return task.status !== 'done' && task.status !== 'inspected';
}

export function liveTasks(tasks: readonly WorkTask[]): WorkTask[] {
  return tasks.filter(isLive);
}

/** Frame W1's "Finished this shift" / W2's "Done — waiting to sync". */
export function finishedTasks(tasks: readonly WorkTask[]): WorkTask[] {
  return tasks.filter((task) => !isLive(task));
}

/** What "Take next task" would take, or nothing. Blocked rooms are skipped. */
export function nextPending(tasks: readonly WorkTask[]): WorkTask | undefined {
  return tasks.find((task) => task.status === 'pending');
}

/** `'all'` or a floor number. Kept as a union so a typo is a compile error. */
export type FloorFilter = 'all' | number;

export function onFloor(tasks: readonly WorkTask[], filter: FloorFilter): WorkTask[] {
  return filter === 'all' ? [...tasks] : tasks.filter((task) => task.floor === filter);
}

/**
 * The floors the tab row offers: All plus every floor that currently HAS a live
 * task, in order. Derived rather than fixed, because a tab that is always empty
 * is a tab whose count is always zero and whose empty state is a dead end.
 */
export function floorsWithWork(tasks: readonly WorkTask[]): number[] {
  const floors = new Set(liveTasks(tasks).map((task) => task.floor));
  return [...floors].sort((a, b) => a - b);
}

export interface FloorTab {
  value: string;
  filter: FloorFilter;
  label: Phrase;
  count: number;
}

export function floorTabs(tasks: readonly WorkTask[]): FloorTab[] {
  const live = liveTasks(tasks);
  return [
    { value: 'all', filter: 'all' as FloorFilter, label: { key: 'work.queue.tabAll' as MessageKey }, count: live.length },
    ...floorsWithWork(tasks).map((floor) => ({
      value: String(floor),
      filter: floor as FloorFilter,
      label: { key: 'work.queue.tabFloor' as MessageKey, values: { floor } },
      count: live.filter((task) => task.floor === floor).length,
    })),
  ];
}

/**
 * The right-hand meta line on a queue row. Frame W1 draws four of them and they
 * are not interchangeable: a blocked room says what is holding it, a high
 * priority one says so, a checkout clean races an arrival, a turndown is booked.
 */
export function taskMeta(task: WorkTask): Phrase | undefined {
  if (task.status === 'blocked') {
    return { key: 'work.queue.metaBlocked', values: { ref: task.blockedBy ?? '—' } };
  }
  if (task.arrival) return { key: 'work.queue.metaGuest', values: { time: task.arrival } };
  if (task.at) return { key: 'work.queue.metaPending', values: { time: task.at } };
  if (task.priority === 'high') return { key: 'work.queue.metaHighPriority' };
  return undefined;
}

/**
 * Why the list in front of the reader is empty. The twin's own two reasons,
 * plus the one it never reaches because its filter set is fixed.
 */
export function queueEmptyReason(filter: FloorFilter): Phrase {
  return filter === 'all'
    ? { key: 'work.queue.emptyAll' }
    : { key: 'work.queue.emptyFloor', values: { floor: filter } };
}

/** The sync line under the title. Offline it counts the buffer, not the clock. */
export function syncLine(args: {
  online: boolean;
  openCount: number;
  bufferCount: number;
}): Phrase {
  if (!args.online) {
    return { key: 'work.queue.syncOffline', values: { count: args.bufferCount } };
  }
  return {
    key: 'work.queue.syncOnline',
    values: { count: args.openCount, time: WORK_PROFILE.clock },
  };
}

/* ------------------------------------------------------------------ rooms */

export function roomCounts(rooms: readonly WorkRoom[]): Record<HkStatus, number> {
  const counts: Record<HkStatus, number> = {
    clean: 0,
    dirty: 0,
    in_progress: 0,
    inspected: 0,
    out_of_order: 0,
  };
  for (const room of rooms) counts[room.status] += 1;
  return counts;
}

export type RoomFilter = 'all' | HkStatus;

/**
 * The board's filter row: All, then only the states that actually occur. Frame
 * W4 draws "Floor 3 · 3 Dirty · 2 In progress" — a count row, not a state
 * dictionary, so a state with nothing in it is not offered.
 */
export function roomFilters(rooms: readonly WorkRoom[]): { value: RoomFilter; count: number }[] {
  const counts = roomCounts(rooms);
  const present = (['dirty', 'in_progress', 'out_of_order', 'inspected', 'clean'] as HkStatus[])
    .filter((status) => counts[status] > 0)
    .map((status) => ({ value: status as RoomFilter, count: counts[status] }));
  return [{ value: 'all' as RoomFilter, count: rooms.length }, ...present];
}

export function filterRooms(rooms: readonly WorkRoom[], filter: RoomFilter): WorkRoom[] {
  return filter === 'all' ? [...rooms] : rooms.filter((room) => room.status === filter);
}

/**
 * Frame W4's calm-versus-exception rule, as one predicate. Clean and inspected
 * keep the surface fill and a hairline; dirty, in progress and out of order
 * take the tone fill and a heavier border. Colour is never the only signal —
 * every tile carries the state word as well.
 */
export function isCalm(status: HkStatus): boolean {
  return status === 'clean' || status === 'inspected';
}

/* ---------------------------------------------------------------- tickets */

/** `'T-118'`, `'T-119'`… as the twin numbers them. */
export function ticketRef(existing: number): string {
  return `T-${118 + existing}`;
}

/** How old a ticket is, in the two granularities a shift needs. */
export function ticketAge(ticket: WorkTicket, now: number): Phrase {
  const minutes = Math.floor(Math.max(0, now - ticket.at) / 60000);
  if (minutes < 1) return { key: 'work.tickets.justNow' };
  if (minutes < 60) return { key: 'work.tickets.minutesAgo', values: { minutes } };
  return { key: 'work.tickets.hoursAgo', values: { hours: Math.floor(minutes / 60) } };
}

/* ---------------------------------------------------------------- offline */

/**
 * The banner's second line. Three states, and the difference matters: nothing
 * buffered yet is not the same fact as three changes waiting, and neither is
 * the same as being connected.
 */
export function bufferLabel(args: { online: boolean; buffer: readonly BufferedChange[] }): Phrase {
  const count = args.buffer.length;
  if (count === 0) {
    return args.online ? { key: 'work.offline.connected' } : { key: 'work.offline.bannerNone' };
  }
  return count === 1
    ? { key: 'work.offline.bannerCountOne' }
    : { key: 'work.offline.bannerCount', values: { count } };
}

const CHANGE_KEY: Record<BufferedChange['kind'], MessageKey> = {
  clean: 'work.offline.changeClean',
  started: 'work.offline.changeStarted',
  blocked: 'work.offline.changeBlocked',
  status: 'work.offline.changeStatus',
  ticket: 'work.offline.changeTicket',
};

export function changeLabel(change: BufferedChange): MessageKey {
  return CHANGE_KEY[change.kind];
}

/**
 * The buffer in the order it will replay. The store appends, so this is already
 * chronological — sorting it explicitly is the assertion that frame W2's
 * "replay in order" is a property of the data rather than of how it happened to
 * be pushed.
 */
export function replayOrder(buffer: readonly BufferedChange[]): BufferedChange[] {
  return [...buffer].sort((a, b) => a.at - b.at);
}

/** What the flush toast says. The twin's copy, with its singular. */
export function flushPhrase(count: number): Phrase {
  if (count === 0) return { key: 'work.offline.backOnlineToast' };
  return count === 1
    ? { key: 'work.offline.syncedToastOne' }
    : { key: 'work.offline.syncedToast', values: { count } };
}

/* ------------------------------------------------------------------ shift */

/** Frame W7's three numbers, and the twin's own arithmetic for them. */
export function shiftSummary(tasks: readonly WorkTask[]): {
  cleaned: number;
  averageMinutes: number;
  left: number;
  rooms: string[];
} {
  const finished = finishedTasks(tasks);
  return {
    cleaned: WORK_PROFILE.cleanedBefore + finished.length,
    averageMinutes: WORK_PROFILE.averageMinutes,
    left: liveTasks(tasks).length,
    // Newest last, so the wrap reads as the shift went.
    rooms: [...WORK_PROFILE.roomsFinished, ...finished.map((task) => task.id)],
  };
}

/* ----------------------------------------------------------------- arrival */

/** Frame W1's "4s ago", and what it becomes once it is no longer seconds. */
export function arrivalAge(arrivedAt: number, now: number): Phrase {
  const seconds = Math.max(0, Math.round((now - arrivedAt) / 1000));
  return seconds < 60
    ? { key: 'work.queue.arrivalAgoSeconds', values: { seconds } }
    : { key: 'work.queue.arrivalAgoMinutes', values: { minutes: Math.floor(seconds / 60) } };
}
