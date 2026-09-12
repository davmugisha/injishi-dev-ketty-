/**
 * The Work surface's state — the interactive twin's class, ported.
 *
 * `design/mobile-prototype/interactive-state-machine.js` holds `advance()`,
 * `takeNext()`, `requestCheck()`, `toggleOnline()`, `goOnline()` and
 * `fileTicket()` as methods on one component. Ported here as **pure reducers
 * plus one actions hook**, for three reasons:
 *
 *   - A transition that only exists inside a screen cannot be tested, and the
 *     interesting half of this surface IS the transitions.
 *   - Five screens change the same three collections. Frame W6 flips a room out
 *     of order, blocks its task and opens the Tickets tab in one gesture; that
 *     cannot live in any one of the three screens it touches.
 *   - Decision D9: every local write goes through `useFixtureMutation`, so the
 *     swap to TanStack Query in Phase 3 is a change of hook and not of markup.
 *
 * **Two rules the whole surface turns on**, both from F-P04 rather than from
 * the drawing:
 *
 *   - **Housekeeping status is its own axis.** A task moving does not imply the
 *     room moved; both are written, explicitly, on every transition. `dirty` is
 *     not `pending` under another name.
 *   - **Offline is a state, not an error** (F-P10). A change made without
 *     signal commits LOCALLY AND IMMEDIATELY and is appended to the buffer with
 *     an idempotency key. Nothing blocks, nothing asks for a retry, and the
 *     attendant's tick is theirs the moment they make it.
 */
import { useCallback, useMemo } from 'react';
import { useNetworkState } from 'expo-network';
import {
  readFixture,
  useFixtureMutation,
  useFixtureValue,
} from '@/data/use-fixture-mutation';
import { useFixture, type FixtureStatus } from '@/data/use-fixture';
import {
  ARRIVAL_TASK,
  DEFAULT_TASK_MINUTES,
  SEED_INSPECTIONS,
  SEED_ROOMS,
  SEED_TASKS,
  SEED_TICKETS,
  floorOf,
  roomTypeOf,
  type BufferedChange,
  type FaultCategory,
  type HkStatus,
  type InspectionRow,
  type Severity,
  type TaskStatus,
  type WorkRoom,
  type WorkTask,
  type WorkTicket,
} from './work-fixtures';
import { ticketRef } from './work-format';

/* -------------------------------------------------------------------- keys */

export const TASKS_KEY = 'work.tasks';
export const ROOMS_KEY = 'work.rooms';
export const TICKETS_KEY = 'work.tickets';
export const INSPECTIONS_KEY = 'work.inspections';
export const CONNECTION_KEY = 'work.connection';
export const TIMERS_KEY = 'work.timers';

/* ------------------------------------------------------------------ shapes */

export interface Connection {
  /** The Account switch (frame W2). Independent of the real radio. */
  simulateOffline: boolean;
  buffer: BufferedChange[];
}

export const SEED_CONNECTION: Connection = { simulateOffline: false, buffer: [] };

/** Frame W3's timer, anchored to a timestamp so backgrounding costs nothing. */
export interface TaskTimer {
  /** Epoch ms the current run started, or null while paused. */
  startedAt: number | null;
  /** Seconds banked before the current run. */
  accrued: number;
}

export type TimerMap = Record<string, TaskTimer>;

/* ---------------------------------------------------------------- reducers */

export type TaskChange =
  | { op: 'set'; id: string; status: TaskStatus; blockedBy?: string; minutes?: number }
  | { op: 'arrive'; task: WorkTask }
  | { op: 'seen'; id: string };

/**
 * `setTask` and `armArrival` from the twin, as one reducer.
 *
 * `seen` clears the accent border the live arrival is drawn with: an arrival
 * stops being an arrival the moment it has been looked at, and a row that keeps
 * shouting after it has been read is a row people learn to ignore.
 */
export function applyTaskChange(tasks: readonly WorkTask[], change: TaskChange): WorkTask[] {
  if (change.op === 'arrive') {
    if (tasks.some((task) => task.id === change.task.id)) return [...tasks];
    return [change.task, ...tasks];
  }
  return tasks.map((task) => {
    if (task.id !== change.id) return task;
    if (change.op === 'seen') return { ...task, isNew: false };
    return {
      ...task,
      status: change.status,
      isNew: false,
      // `blockedBy` is set when a ticket blocks the task and cleared when it
      // leaves `blocked`; a stale reference on a running task is a lie the
      // detail screen would print.
      blockedBy: change.status === 'blocked' ? change.blockedBy : undefined,
      minutes: change.minutes ?? task.minutes,
    };
  });
}

export interface RoomChange {
  id: string;
  status: HkStatus;
  ticket?: string;
}

/**
 * A room the board does not hold is added rather than dropped. Frame W1's
 * queue spans three floors and the board draws one, so a task finished on floor
 * 1 has no tile — and silently discarding its status change would make the two
 * screens disagree about the same room.
 */
export function applyRoomChange(rooms: readonly WorkRoom[], change: RoomChange): WorkRoom[] {
  const known = rooms.some((room) => room.id === change.id);
  if (!known) {
    return [
      ...rooms,
      {
        id: change.id,
        type: roomTypeOf(change.id),
        floor: floorOf(change.id),
        status: change.status,
        ticket: change.ticket,
      },
    ];
  }
  return rooms.map((room) =>
    room.id === change.id
      ? { ...room, status: change.status, ticket: change.status === 'out_of_order' ? change.ticket : undefined }
      : room,
  );
}

export function applyTicketChange(
  tickets: readonly WorkTicket[],
  change: { op: 'file'; ticket: WorkTicket },
): WorkTicket[] {
  return [change.ticket, ...tickets];
}

export type ConnectionChange =
  | { op: 'simulate'; on: boolean }
  | { op: 'buffer'; change: BufferedChange }
  | { op: 'flush' };

/**
 * `toggleOnline` and `goOnline`, as a reducer. Coming back online empties the
 * buffer in one step because the replay is atomic from the phone's point of
 * view: every change goes, in order, or the phone is still offline.
 */
export function applyConnectionChange(
  current: Connection,
  change: ConnectionChange,
): Connection {
  switch (change.op) {
    case 'simulate':
      return { ...current, simulateOffline: change.on };
    case 'buffer':
      return { ...current, buffer: [...current.buffer, change.change] };
    case 'flush':
      return { ...current, simulateOffline: false, buffer: [] };
  }
}

export type TimerChange =
  | { op: 'start'; id: string; now: number }
  | { op: 'pause'; id: string; now: number }
  | { op: 'resume'; id: string; now: number }
  | { op: 'clear'; id: string };

export function applyTimerChange(timers: TimerMap, change: TimerChange): TimerMap {
  const next = { ...timers };
  const current = next[change.id];
  switch (change.op) {
    case 'start':
      next[change.id] = { startedAt: change.now, accrued: 0 };
      return next;
    case 'pause':
      if (!current || current.startedAt === null) return next;
      next[change.id] = {
        startedAt: null,
        accrued: current.accrued + Math.max(0, (change.now - current.startedAt) / 1000),
      };
      return next;
    case 'resume':
      next[change.id] = { startedAt: change.now, accrued: current?.accrued ?? 0 };
      return next;
    case 'clear':
      delete next[change.id];
      return next;
  }
}

/** Seconds a timer reads right now. Pure, so the arithmetic is testable. */
export function timerSeconds(timer: TaskTimer | undefined, now: number): number {
  if (!timer) return 0;
  return timer.startedAt === null
    ? timer.accrued
    : timer.accrued + Math.max(0, (now - timer.startedAt) / 1000);
}

/* -------------------------------------------------------------------- reads */

/**
 * The store is an untyped `Map<string, unknown>`, so a read that trusts its
 * shape is a read that renders `undefined.map` on a bad write. Each reader
 * narrows and throws a sentence a person could act on — which is also what
 * makes the ErrorState branch on every list reachable rather than decorative.
 */
function readList<T>(key: string, seed: readonly T[], label: string): T[] {
  const value = readFixture<T[]>(key, [...seed]);
  if (!Array.isArray(value)) throw new Error(`The ${label} came back in a shape we do not recognise.`);
  return value;
}

export const readTasks = (): WorkTask[] => readList(TASKS_KEY, SEED_TASKS, 'task queue');
export const readRooms = (): WorkRoom[] => readList(ROOMS_KEY, SEED_ROOMS, 'floor board');
export const readTickets = (): WorkTicket[] => readList(TICKETS_KEY, SEED_TICKETS, 'ticket list');
export const readInspections = (): InspectionRow[] =>
  readList(INSPECTIONS_KEY, SEED_INSPECTIONS, 'inspection list');

/**
 * A list read, in the shape every other screen's read has.
 *
 * Two hooks rather than one, and the split is the point. `useFixture` owns the
 * cold-read skeleton and the error branch; it caches per key, so its `data`
 * goes stale the moment anything is written. `useFixtureValue` owns the LIVE
 * value and re-renders on every write. Taking the status from one and the rows
 * from the other is what lets a queue skeleton on first paint and still update
 * the instant another screen changes a room.
 */
function useWorkList<T>(key: string, read: () => T[], seed: readonly T[]): {
  status: FixtureStatus;
  error: Error | undefined;
  retry: () => void;
  rows: T[];
} {
  const gate = useFixture(key, read);
  const rows = useFixtureValue<T[]>(key, () => [...seed]);
  return { status: gate.status, error: gate.error, retry: gate.retry, rows };
}

export const useWorkTasks = () => useWorkList(TASKS_KEY, readTasks, SEED_TASKS);
export const useWorkRooms = () => useWorkList(ROOMS_KEY, readRooms, SEED_ROOMS);
export const useWorkTickets = () => useWorkList(TICKETS_KEY, readTickets, SEED_TICKETS);
export const useWorkInspections = () =>
  useWorkList(INSPECTIONS_KEY, readInspections, SEED_INSPECTIONS);

export const useTimers = () => useFixtureValue<TimerMap>(TIMERS_KEY, () => ({}));

/* --------------------------------------------------------------- connection */

export interface ConnectionState {
  /** The one flag every screen branches on. */
  online: boolean;
  /** The Account switch is on. */
  simulated: boolean;
  /** The radio says there is genuinely no route out. */
  realOffline: boolean;
  buffer: BufferedChange[];
  setSimulated: (on: boolean) => Promise<void>;
  /** Frame W2's Reconnect. Returns how many changes went, for the toast. */
  flush: () => Promise<number>;
}

/**
 * The connection, simulated and real at once.
 *
 * The session prompt asks for both, and they are genuinely the same state to
 * this surface: a corridor with no bars and a switch flipped on the Account
 * screen produce the same banner, the same buffer and the same reconnect card.
 * `expo-network` reports REACHABILITY rather than the radio, which is what
 * `OfflineBanner` already relies on — a phone on a captive-portal wifi is
 * connected and can reach nothing, and a surface that believed the radio would
 * lose an attendant's work.
 *
 * Both flags are `undefined` until the first read lands, so only an explicit
 * `false` counts as offline; treating the unresolved state as offline would
 * flash the amber banner on every cold start.
 */
export function useConnection(): ConnectionState {
  const network = useNetworkState();
  const stored = useFixtureValue<Connection>(CONNECTION_KEY, () => SEED_CONNECTION);
  const { mutate } = useFixtureMutation<Connection, ConnectionChange>(
    CONNECTION_KEY,
    applyConnectionChange,
    () => SEED_CONNECTION,
  );

  const realOffline = network.isConnected === false || network.isInternetReachable === false;
  const online = !stored.simulateOffline && !realOffline;

  const setSimulated = useCallback((on: boolean) => mutate({ op: 'simulate', on }), [mutate]);

  const flush = useCallback(async () => {
    const count = stored.buffer.length;
    await mutate({ op: 'flush' });
    return count;
  }, [mutate, stored.buffer.length]);

  return {
    online,
    simulated: stored.simulateOffline,
    realOffline,
    buffer: stored.buffer,
    setSimulated,
    flush,
  };
}

/* ------------------------------------------------------------------ actions */

/** A change made without signal, minted with its idempotency key (F-P10 §6). */
let bufferSeq = 0;
function bufferedChange(room: string, kind: BufferedChange['kind']): BufferedChange {
  bufferSeq += 1;
  return { key: `hk-${room}-${kind}-${bufferSeq}`, room, kind, at: Date.now() };
}

/** Frame W1's live arrival fires once per session. Reset by `resetWorkSession`. */
let arrivalFired = false;
export const arrivalHasFired = () => arrivalFired;

/** Clears the module state a test would otherwise inherit from the last one. */
export function resetWorkSession(): void {
  arrivalFired = false;
  bufferSeq = 0;
}

export interface FiledFault {
  room: string;
  category: FaultCategory;
  severity: Severity;
  line: string;
  photos: number;
}

export interface WorkActions {
  /** True while any write is in flight, so a primary can disable itself. */
  busy: boolean;
  /**
   * True when a write did not land (gaps.md §5.3).
   *
   * Three P1s on this surface were one hole: `task/[taskId]`, `room-status` and
   * `report-fault` each wrote and then toasted and navigated **whether or not
   * the write succeeded**. On a surface used gloved and standing, an attendant
   * told a room is clean when the store never heard has to walk back to find
   * out, and the supervisor's board is wrong meanwhile.
   */
  failed: boolean;
  /** Clear a failure the person has now seen. */
  clearFailure: () => void;
  /** `pending → in_progress`. Starts the timer and dirties nothing. */
  start: (task: WorkTask) => Promise<void>;
  /** `in_progress → done`. Sets the room clean and buffers when offline. */
  finish: (task: WorkTask) => Promise<{ buffered: boolean; minutes: number }>;
  /** Frame W1's swipe-left, and frame W3's escape. */
  block: (task: WorkTask) => Promise<void>;
  /** Frame W3's "Request check": done, and explicitly waiting on a supervisor. */
  requestCheck: (task: WorkTask) => Promise<void>;
  /** The desk's checkout landing on the queue. */
  arrive: () => Promise<void>;
  /** Clears the arrival's accent border once it has been opened. */
  markSeen: (id: string) => Promise<void>;
  /** Frame W4's sheet. */
  setRoomStatus: (roomId: string, status: HkStatus) => Promise<void>;
  /** Frame W6. Files the ticket, flips the room, blocks its task. */
  fileFault: (fault: FiledFault) => Promise<string>;
  /** Frame W5's Pass: `done → inspected`, and the room with it. */
  passInspection: (row: InspectionRow) => Promise<void>;
  /** Frame W5's Fail: back to `pending`, room dirty, desk still blocked. */
  failInspection: (row: InspectionRow) => Promise<void>;
  /** Frame W3's pause control. */
  toggleTimer: (id: string) => Promise<void>;
}

/**
 * Every transition on the surface, in one hook.
 *
 * Each one writes BOTH axes where both move, and appends to the offline buffer
 * where the change is one the desk needs to hear about. Reading a single
 * transition end to end here is how a reviewer checks that the room and the
 * task did not drift apart.
 */
export function useWorkActions(): WorkActions {
  const timers = useTimers();
  const connection = useConnection();
  const tickets = useWorkTickets();

  const taskMutation = useFixtureMutation<WorkTask[], TaskChange>(
    TASKS_KEY,
    applyTaskChange,
    () => [...SEED_TASKS],
  );
  const roomMutation = useFixtureMutation<WorkRoom[], RoomChange>(
    ROOMS_KEY,
    applyRoomChange,
    () => [...SEED_ROOMS],
  );
  const ticketMutation = useFixtureMutation<WorkTicket[], { op: 'file'; ticket: WorkTicket }>(
    TICKETS_KEY,
    applyTicketChange,
    () => [...SEED_TICKETS],
  );
  const inspectionMutation = useFixtureMutation<InspectionRow[], { op: 'resolve'; room: string }>(
    INSPECTIONS_KEY,
    (rows, change) => rows.filter((row) => row.room !== change.room),
    () => [...SEED_INSPECTIONS],
  );
  const timerMutation = useFixtureMutation<TimerMap, TimerChange>(
    TIMERS_KEY,
    applyTimerChange,
    () => ({}),
  );
  const connectionMutation = useFixtureMutation<Connection, ConnectionChange>(
    CONNECTION_KEY,
    applyConnectionChange,
    () => SEED_CONNECTION,
  );

  const busy =
    taskMutation.status === 'saving' ||
    roomMutation.status === 'saving' ||
    ticketMutation.status === 'saving' ||
    inspectionMutation.status === 'saving';

  const failed =
    taskMutation.status === 'error' ||
    roomMutation.status === 'error' ||
    ticketMutation.status === 'error' ||
    inspectionMutation.status === 'error';

  const clearFailure = useCallback(() => {
    taskMutation.reset();
    roomMutation.reset();
    ticketMutation.reset();
    inspectionMutation.reset();
  }, [taskMutation, roomMutation, ticketMutation, inspectionMutation]);

  const { online } = connection;
  const ticketCount = tickets.rows.length;

  return useMemo<WorkActions>(() => {
    const buffer = (room: string, kind: BufferedChange['kind']) =>
      connectionMutation.mutate({ op: 'buffer', change: bufferedChange(room, kind) });

    return {
      busy,
      failed,
      clearFailure,

      async start(task) {
        // One transition, one wait. F-P04 §6 has checkout set the room and
        // insert the task in the SAME transaction, and these are distinct store
        // keys, so nothing here races anything else here. Awaiting them in turn
        // would make one tap cost three round trips, which on this surface is a
        // second of standing at a door.
        await Promise.all([
          taskMutation.mutate({ op: 'set', id: task.id, status: 'in_progress' }),
          roomMutation.mutate({ id: task.id, status: 'in_progress' }),
          timerMutation.mutate({ op: 'start', id: task.id, now: Date.now() }),
          online ? Promise.resolve() : buffer(task.id, 'started'),
        ]);
      },

      async finish(task) {
        const seconds = timerSeconds(timers[task.id], Date.now());
        // A room finished without ever starting a timer still has to record
        // something honest; the shift average is the least wrong number there.
        const minutes = seconds > 0 ? Math.max(1, Math.round(seconds / 60)) : DEFAULT_TASK_MINUTES;
        await Promise.all([
          taskMutation.mutate({ op: 'set', id: task.id, status: 'done', minutes }),
          roomMutation.mutate({ id: task.id, status: 'clean' }),
          timerMutation.mutate({ op: 'clear', id: task.id }),
          online ? Promise.resolve() : buffer(task.id, 'clean'),
        ]);
        return { buffered: !online, minutes };
      },

      async block(task) {
        await Promise.all([
          taskMutation.mutate({
            op: 'set',
            id: task.id,
            status: 'blocked',
            blockedBy: task.blockedBy,
          }),
          timerMutation.mutate({ op: 'pause', id: task.id, now: Date.now() }),
          online ? Promise.resolve() : buffer(task.id, 'blocked'),
        ]);
      },

      async requestCheck(task) {
        const seconds = timerSeconds(timers[task.id], Date.now());
        const minutes = seconds > 0 ? Math.max(1, Math.round(seconds / 60)) : DEFAULT_TASK_MINUTES;
        // The room stays where it is on purpose: frame W3's own toast says the
        // desk stays blocked until the check passes, and setting it clean here
        // would release it behind the supervisor's back.
        await Promise.all([
          taskMutation.mutate({ op: 'set', id: task.id, status: 'done', minutes }),
          timerMutation.mutate({ op: 'clear', id: task.id }),
          online ? Promise.resolve() : buffer(task.id, 'clean'),
        ]);
      },

      async arrive() {
        arrivalFired = true;
        await Promise.all([
          taskMutation.mutate({
            op: 'arrive',
            task: { ...ARRIVAL_TASK, arrivedAt: Date.now() },
          }),
          roomMutation.mutate({ id: ARRIVAL_TASK.id, status: 'dirty' }),
        ]);
      },

      async markSeen(id) {
        await taskMutation.mutate({ op: 'seen', id });
      },

      async setRoomStatus(roomId, status) {
        await Promise.all([
          roomMutation.mutate({ id: roomId, status }),
          online ? Promise.resolve() : buffer(roomId, 'status'),
        ]);
      },

      async fileFault(fault) {
        const ref = ticketRef(ticketCount);
        await ticketMutation.mutate({
          op: 'file',
          ticket: {
            ref,
            room: fault.room,
            category: fault.category,
            severity: fault.severity,
            line: fault.line,
            status: 'open',
            photos: fault.photos,
            at: Date.now(),
          },
        });
        // The three writes frame W6's consequence line promises, in the order
        // it prints them: the ticket exists, the room is out of order, the task
        // is blocked on that ticket.
        await Promise.all([
          roomMutation.mutate({ id: fault.room, status: 'out_of_order', ticket: ref }),
          taskMutation.mutate({ op: 'set', id: fault.room, status: 'blocked', blockedBy: ref }),
          timerMutation.mutate({ op: 'pause', id: fault.room, now: Date.now() }),
          online ? Promise.resolve() : buffer(fault.room, 'ticket'),
        ]);
        return ref;
      },

      async passInspection(row) {
        await Promise.all([
          inspectionMutation.mutate({ op: 'resolve', room: row.room }),
          roomMutation.mutate({ id: row.room, status: 'inspected' }),
          taskMutation.mutate({ op: 'set', id: row.room, status: 'inspected' }),
          online ? Promise.resolve() : buffer(row.room, 'status'),
        ]);
      },

      async failInspection(row) {
        // Back to the start of the cycle: the attendant gets the room again and
        // the desk stays blocked, which is F-P04 §8's `any → blocked → pending`
        // arm read from the inspection side.
        await Promise.all([
          inspectionMutation.mutate({ op: 'resolve', room: row.room }),
          roomMutation.mutate({ id: row.room, status: 'dirty' }),
          taskMutation.mutate({ op: 'set', id: row.room, status: 'pending' }),
          online ? Promise.resolve() : buffer(row.room, 'status'),
        ]);
      },

      async toggleTimer(id) {
        const running = timers[id]?.startedAt !== null && timers[id] !== undefined;
        await timerMutation.mutate({
          op: running ? 'pause' : 'resume',
          id,
          now: Date.now(),
        });
      },
    };
  }, [
    busy,
    online,
    timers,
    ticketCount,
    taskMutation,
    roomMutation,
    ticketMutation,
    inspectionMutation,
    timerMutation,
    connectionMutation,
    failed,
    clearFailure,
  ]);
}
