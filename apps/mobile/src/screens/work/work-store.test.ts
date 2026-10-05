/**
 * The transitions, as pure functions.
 *
 * This is the file that says the ported state machine is the same machine.
 * `design/mobile-prototype/interactive-state-machine.js` holds these as methods
 * on a component; here they are reducers, and the assertions below are the
 * behaviours that file's `advance`, `setTask`, `armArrival`, `fileTicket`,
 * `toggleOnline` and `goOnline` actually have.
 *
 * Two properties are load bearing beyond "it sets the field", and both have a
 * test of their own because both are silent when wrong:
 *
 *   - `blockedBy` is CLEARED when a task leaves `blocked`, or the detail screen
 *     goes on printing a ticket reference for a room nobody is fixing.
 *   - The room axis and the task axis are written separately (F-P04 §6), so a
 *     reducer that moved one must not be assumed to have moved the other.
 */
import { act, renderHook, waitFor } from '@testing-library/react-native';
import {
  applyConnectionChange,
  applyRoomChange,
  applyTaskChange,
  applyTicketChange,
  applyTimerChange,
  combineOutcomes,
  readTasks,
  resetWorkSession,
  timerSeconds,
  useWorkActions,
  useWorkTasks,
  SEED_CONNECTION,
  ROOMS_KEY,
  TASKS_KEY,
  TICKETS_KEY,
  type Connection,
  type TimerMap,
} from './work-store';
import {
  MUTATION_LATENCY_MS,
  hasFixture,
  readFixture,
  resetFixtures,
  writeFixture,
  type MutationOutcome,
} from '@/data/use-fixture-mutation';
import {
  ARRIVAL_TASK,
  SEED_ROOMS,
  SEED_TASKS,
  SEED_TICKETS,
  type BufferedChange,
  type WorkTicket,
} from './work-fixtures';

beforeEach(() => {
  resetFixtures();
  resetWorkSession();
});

/** A write started by one test lands after the next has begun; let it land first. */
async function settleWrites(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, MUTATION_LATENCY_MS + 50));
  resetFixtures();
}

describe('applyTaskChange', () => {
  it('moves one task and leaves every other alone', () => {
    const next = applyTaskChange(SEED_TASKS, { op: 'set', id: '104', status: 'in_progress' });
    expect(next.find((task) => task.id === '104')?.status).toBe('in_progress');
    expect(next.filter((task) => task.status === 'pending')).toHaveLength(4);
    // Pure: the seed is not mutated, so a second render starts from the same
    // place a first one did.
    expect(SEED_TASKS.find((task) => task.id === '104')?.status).toBe('pending');
  });

  it('records the minutes a finished room took', () => {
    const next = applyTaskChange(SEED_TASKS, {
      op: 'set',
      id: '307',
      status: 'done',
      minutes: 19,
    });
    expect(next.find((task) => task.id === '307')).toMatchObject({ status: 'done', minutes: 19 });
  });

  it('holds the blocking ticket, and clears it on the way out of blocked', () => {
    const blocked = applyTaskChange(SEED_TASKS, {
      op: 'set',
      id: '205',
      status: 'blocked',
      blockedBy: 'T-118',
    });
    expect(blocked.find((task) => task.id === '205')?.blockedBy).toBe('T-118');

    const unblocked = applyTaskChange(blocked, { op: 'set', id: '205', status: 'pending' });
    expect(unblocked.find((task) => task.id === '205')?.blockedBy).toBeUndefined();
  });

  it('puts the desk’s checkout at the top of the queue', () => {
    const next = applyTaskChange(SEED_TASKS, { op: 'arrive', task: ARRIVAL_TASK });
    expect(next[0].id).toBe('208');
    expect(next[0].isNew).toBe(true);
    expect(next).toHaveLength(SEED_TASKS.length + 1);
  });

  it('never queues the same arrival twice', () => {
    const once = applyTaskChange(SEED_TASKS, { op: 'arrive', task: ARRIVAL_TASK });
    const twice = applyTaskChange(once, { op: 'arrive', task: ARRIVAL_TASK });
    expect(twice.filter((task) => task.id === '208')).toHaveLength(1);
  });

  it('stops an arrival shouting once it has been opened', () => {
    const arrived = applyTaskChange(SEED_TASKS, { op: 'arrive', task: ARRIVAL_TASK });
    const seen = applyTaskChange(arrived, { op: 'seen', id: '208' });
    expect(seen.find((task) => task.id === '208')?.isNew).toBe(false);
  });
});

describe('applyRoomChange', () => {
  it('sets a room on the board', () => {
    const next = applyRoomChange(SEED_ROOMS, { id: '303', status: 'clean' });
    expect(next.find((room) => room.id === '303')?.status).toBe('clean');
  });

  it('keeps the ticket that took a room out of order, and drops it when it comes back', () => {
    const out = applyRoomChange(SEED_ROOMS, {
      id: '305',
      status: 'out_of_order',
      ticket: 'T-118',
    });
    expect(out.find((room) => room.id === '305')?.ticket).toBe('T-118');

    const back = applyRoomChange(out, { id: '305', status: 'dirty' });
    expect(back.find((room) => room.id === '305')?.ticket).toBeUndefined();
  });

  it('adds a room the board does not draw rather than dropping the change', () => {
    // The queue spans three floors and the board draws one, so finishing 104
    // has to land somewhere or the two screens disagree about the same room.
    const next = applyRoomChange(SEED_ROOMS, { id: '104', status: 'clean' });
    expect(next).toHaveLength(SEED_ROOMS.length + 1);
    expect(next.find((room) => room.id === '104')).toMatchObject({
      status: 'clean',
      floor: 1,
      type: 'Std Twin',
    });
  });
});

describe('applyTicketChange', () => {
  it('puts a filed ticket at the top of the board', () => {
    const ticket: WorkTicket = {
      ref: 'T-118',
      room: '305',
      category: 'electrical',
      severity: 'high',
      line: 'Bedside lamp does not switch on',
      status: 'open',
      photos: 1,
      at: 1,
    };
    const next = applyTicketChange(SEED_TICKETS, { op: 'file', ticket });
    expect(next[0].ref).toBe('T-118');
    expect(SEED_TICKETS).toHaveLength(0);
  });
});

describe('applyConnectionChange', () => {
  const change = (room: string, at: number): BufferedChange => ({
    key: `k-${room}`,
    room,
    kind: 'clean',
    at,
  });

  it('flips the simulated switch without touching the buffer', () => {
    const held: Connection = { simulateOffline: false, buffer: [change('303', 1)] };
    const next = applyConnectionChange(held, { op: 'simulate', on: true });
    expect(next.simulateOffline).toBe(true);
    expect(next.buffer).toHaveLength(1);
  });

  it('appends in the order changes were made', () => {
    let state = SEED_CONNECTION;
    state = applyConnectionChange(state, { op: 'buffer', change: change('303', 10) });
    state = applyConnectionChange(state, { op: 'buffer', change: change('307', 20) });
    expect(state.buffer.map((x) => x.room)).toEqual(['303', '307']);
  });

  it('empties the buffer and comes back online in one step', () => {
    const held: Connection = {
      simulateOffline: true,
      buffer: [change('303', 10), change('307', 20)],
    };
    const next = applyConnectionChange(held, { op: 'flush' });
    expect(next).toEqual({ simulateOffline: false, buffer: [] });
  });
});

describe('the task timer', () => {
  it('banks the seconds on a pause rather than stopping a tick', () => {
    const start = 1_000_000;
    let timers: TimerMap = applyTimerChange({}, { op: 'start', id: '205', now: start });
    expect(timerSeconds(timers['205'], start + 60_000)).toBe(60);

    timers = applyTimerChange(timers, { op: 'pause', id: '205', now: start + 60_000 });
    expect(timers['205'].startedAt).toBeNull();
    // A paused clock does not move, however long the phone sits in a pocket.
    expect(timerSeconds(timers['205'], start + 600_000)).toBe(60);

    timers = applyTimerChange(timers, { op: 'resume', id: '205', now: start + 600_000 });
    expect(timerSeconds(timers['205'], start + 630_000)).toBe(90);
  });

  it('forgets a task’s clock when the task is finished', () => {
    const timers = applyTimerChange({ '205': { startedAt: 1, accrued: 0 } }, {
      op: 'clear',
      id: '205',
    });
    expect(timers['205']).toBeUndefined();
    expect(timerSeconds(undefined, 1)).toBe(0);
  });

  it('never reads negative from a clock that stepped backwards', () => {
    expect(timerSeconds({ startedAt: 2_000, accrued: 0 }, 1_000)).toBe(0);
  });

  /**
   * Mobile audit 2026-10-05, WK-13: task detail printed "Started 10:24" from a
   * fixture clock. The timer keeps when the task was started, through a pause
   * and a resume, so the screen can print the task's own time.
   */
  it('remembers when the task was started, through a pause and a resume', () => {
    const start = 1_000_000;
    let timers: TimerMap = applyTimerChange({}, { op: 'start', id: '205', now: start });
    timers = applyTimerChange(timers, { op: 'pause', id: '205', now: start + 60_000 });
    timers = applyTimerChange(timers, { op: 'resume', id: '205', now: start + 600_000 });
    expect(timers['205'].since).toBe(start);
    // The current RUN moved; the start did not.
    expect(timers['205'].startedAt).toBe(start + 600_000);
  });

  it('never invents a start time for a clock it only resumed', () => {
    // A room in progress before this phone saw it has no known start. A
    // resume time printed as one would be the fixture clock's lie again.
    const timers = applyTimerChange({}, { op: 'resume', id: '307', now: 5_000 });
    expect(timers['307'].since).toBeUndefined();
  });
});

describe('combineOutcomes', () => {
  it('lands only when every write landed, and says failure before cancellation', () => {
    expect(combineOutcomes(['done', 'done'])).toBe('done');
    expect(combineOutcomes(['done', 'cancelled'])).toBe('cancelled');
    expect(combineOutcomes(['cancelled', 'error', 'done'])).toBe('error');
  });
});

describe('a list read (mobile audit 2026-10-05, WK-24 and WK-13)', () => {
  /**
   * The first read of this key in this file, so it is cold. The rows used to
   * come from the seed whatever the read was doing, so every header counted
   * rows nobody had loaded.
   */
  it('holds no rows and no time until the read lands, then the live rows and when', async () => {
    const before = Date.now();
    const { result } = renderHook(() => useWorkTasks());

    expect(result.current.status).toBe('loading');
    expect(result.current.ready).toBe(false);
    expect(result.current.rows).toEqual([]);
    expect(result.current.readAt).toBeUndefined();

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.rows).toHaveLength(SEED_TASKS.length);
    await waitFor(() => expect(result.current.readAt).toBeDefined());
    expect(result.current.readAt as number).toBeGreaterThanOrEqual(before);
  });
});

describe('the actions report how they ended (mobile audit 2026-10-05, WK-04)', () => {
  const task = SEED_TASKS.find((row) => row.id === '104')!;

  afterEach(settleWrites);

  it('resolves done when a start lands', async () => {
    const { result } = renderHook(() => useWorkActions());
    let outcome: MutationOutcome | undefined;
    await act(async () => {
      outcome = await result.current.start(task);
    });
    expect(outcome).toBe('done');
    expect(readTasks().find((row) => row.id === '104')?.status).toBe('in_progress');
  });

  it('resolves error when a write does not land', async () => {
    // A store the reducer cannot read: the task write throws, the room write
    // lands, and the transition as a whole did not happen.
    writeFixture(TASKS_KEY, null);
    const { result } = renderHook(() => useWorkActions());
    let outcome: MutationOutcome | undefined;
    await act(async () => {
      outcome = await result.current.start(task);
    });
    expect(outcome).toBe('error');
  });

  it('takes no room out of order when the ticket itself was not filed', async () => {
    writeFixture(TICKETS_KEY, null);
    const { result } = renderHook(() => useWorkActions());
    let filed: { outcome: MutationOutcome; ref: string } | undefined;
    await act(async () => {
      filed = await result.current.fileFault({
        room: '305',
        category: 'electrical',
        severity: 'high',
        line: '',
        photos: 0,
      });
    });
    expect(filed?.outcome).toBe('error');
    // A room nobody is coming to fix is worse than a ticket that failed loudly.
    expect(hasFixture(ROOMS_KEY)).toBe(false);
  });

  it('mints the next reference from the store at the moment of filing', async () => {
    const { result } = renderHook(() => useWorkActions());
    let first: { outcome: MutationOutcome; ref: string } | undefined;
    let second: { outcome: MutationOutcome; ref: string } | undefined;
    const fault = { category: 'plumbing' as const, severity: 'low' as const, line: '', photos: 0 };
    await act(async () => {
      first = await result.current.fileFault({ ...fault, room: '305' });
    });
    await act(async () => {
      second = await result.current.fileFault({ ...fault, room: '306' });
    });
    expect(first?.ref).toBe('T-118');
    expect(second?.ref).toBe('T-119');
    expect(readFixture<unknown[]>(TICKETS_KEY, [])).toHaveLength(2);
  });

  it('records no minutes for a room finished without a timer', async () => {
    // It used to record a 22 minute "average" that was itself invented (WK-02).
    const { result } = renderHook(() => useWorkActions());
    await act(async () => {
      await result.current.finish({ ...task, status: 'in_progress' });
    });
    expect(readTasks().find((row) => row.id === '104')?.minutes).toBeUndefined();
  });
});

describe('the guarded reads', () => {
  it('falls through to the seed when nothing has been written', () => {
    expect(readTasks()).toHaveLength(SEED_TASKS.length);
  });

  it('throws a sentence a person could act on when the store holds nonsense', () => {
    // The store is an untyped Map, so this is the branch that keeps every
    // list's ErrorState reachable rather than decorative.
    writeFixture(TASKS_KEY, null);
    expect(() => readTasks()).toThrow(/task queue/);
  });
});
