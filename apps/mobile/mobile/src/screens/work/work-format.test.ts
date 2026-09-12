/**
 * The Work surface's selectors, without a renderer.
 *
 * These are the questions the queue screen asks every render — which rows are
 * live, what the count on a floor tab is, why the list in front of the reader
 * is empty, what the buffer says. Asserting them here rather than through the
 * screen is what keeps the render tests about wiring.
 */
import {
  arrivalAge,
  bufferLabel,
  filterRooms,
  finishedTasks,
  floorTabs,
  floorsWithWork,
  flushPhrase,
  isCalm,
  liveTasks,
  nextPending,
  onFloor,
  queueEmptyReason,
  replayOrder,
  roomCounts,
  roomFilters,
  shiftSummary,
  syncLine,
  taskMeta,
  ticketAge,
  ticketRef,
} from './work-format';
import {
  SEED_ROOMS,
  SEED_TASKS,
  WORK_PROFILE,
  type BufferedChange,
  type WorkTask,
  type WorkTicket,
} from './work-fixtures';

const task = (over: Partial<WorkTask>): WorkTask => ({
  id: '101',
  type: 'Std Twin',
  floor: 1,
  kind: 'checkout_clean',
  status: 'pending',
  ...over,
});

describe('the queue selectors', () => {
  it('counts a task as live until it is done or signed off', () => {
    const rows = [
      task({ id: '1', status: 'pending' }),
      task({ id: '2', status: 'in_progress' }),
      task({ id: '3', status: 'blocked' }),
      task({ id: '4', status: 'done' }),
      task({ id: '5', status: 'inspected' }),
    ];
    // Blocked is LIVE: the room is still the attendant's problem, it is just
    // waiting on somebody else. Only done and inspected leave the queue.
    expect(liveTasks(rows).map((x) => x.id)).toEqual(['1', '2', '3']);
    expect(finishedTasks(rows).map((x) => x.id)).toEqual(['4', '5']);
  });

  it('takes the next PENDING task and never a blocked one', () => {
    const rows = [
      task({ id: '1', status: 'blocked' }),
      task({ id: '2', status: 'in_progress' }),
      task({ id: '3', status: 'pending' }),
    ];
    expect(nextPending(rows)?.id).toBe('3');
    expect(nextPending(rows.filter((x) => x.status !== 'pending'))).toBeUndefined();
  });

  it('offers a floor tab only while that floor has work left', () => {
    expect(floorsWithWork(SEED_TASKS)).toEqual([1, 2, 3]);
    const floorOneDone = SEED_TASKS.map((row) =>
      row.floor === 1 ? { ...row, status: 'done' as const } : row,
    );
    expect(floorsWithWork(floorOneDone)).toEqual([2, 3]);
  });

  it('counts All against the live rows, not against everything ever queued', () => {
    const rows = [...SEED_TASKS, task({ id: '999', status: 'done' })];
    const tabs = floorTabs(rows);
    expect(tabs[0].count).toBe(6);
    expect(tabs.map((tab) => tab.value)).toEqual(['all', '1', '2', '3']);
    expect(tabs.find((tab) => tab.value === '3')?.count).toBe(3);
  });

  it('filters to one floor', () => {
    expect(onFloor(SEED_TASKS, 1).map((x) => x.id)).toEqual(['104', '112']);
    expect(onFloor(SEED_TASKS, 'all')).toHaveLength(6);
  });

  it('gives a row the one meta line that matters most', () => {
    // Blocked outranks everything: the room is stopped, and why is the fact.
    expect(taskMeta(task({ status: 'blocked', blockedBy: 'T-118', arrival: '16:00' }))).toEqual({
      key: 'work.queue.metaBlocked',
      values: { ref: 'T-118' },
    });
    expect(taskMeta(task({ arrival: '15:30' }))).toEqual({
      key: 'work.queue.metaGuest',
      values: { time: '15:30' },
    });
    expect(taskMeta(task({ at: '18:00' }))).toEqual({
      key: 'work.queue.metaPending',
      values: { time: '18:00' },
    });
    expect(taskMeta(task({ priority: 'high' }))?.key).toBe('work.queue.metaHighPriority');
    expect(taskMeta(task({}))).toBeUndefined();
  });

  it('gives an empty list a different reason per filter', () => {
    expect(queueEmptyReason('all').key).toBe('work.queue.emptyAll');
    expect(queueEmptyReason(2)).toEqual({ key: 'work.queue.emptyFloor', values: { floor: 2 } });
  });

  it('counts the buffer rather than the clock once there is no signal', () => {
    expect(syncLine({ online: true, openCount: 6, bufferCount: 0 })).toEqual({
      key: 'work.queue.syncOnline',
      values: { count: 6, time: WORK_PROFILE.clock },
    });
    expect(syncLine({ online: false, openCount: 6, bufferCount: 3 })).toEqual({
      key: 'work.queue.syncOffline',
      values: { count: 3 },
    });
  });
});

describe('the floor board selectors', () => {
  it('counts every housekeeping state, including the ones at zero', () => {
    const counts = roomCounts(SEED_ROOMS);
    // The twin's seed: 303 dirty, 307 in progress, 312 inspected, nine clean,
    // and nothing out of order — filing a fault (frame W6) is what creates the
    // first one, which is the whole point of the demo loop.
    expect(counts).toEqual({
      clean: 9,
      dirty: 1,
      in_progress: 1,
      inspected: 1,
      out_of_order: 0,
    });
  });

  it('offers a filter only for a state that actually occurs', () => {
    const values = roomFilters(SEED_ROOMS).map((row) => row.value);
    expect(values).toEqual(['all', 'dirty', 'in_progress', 'inspected', 'clean']);
    expect(values).not.toContain('out_of_order');
  });

  it('filters the board', () => {
    expect(filterRooms(SEED_ROOMS, 'dirty').map((room) => room.id)).toEqual(['303']);
    expect(filterRooms(SEED_ROOMS, 'all')).toHaveLength(12);
  });

  it('treats clean and inspected as calm and every exception as loud', () => {
    expect(isCalm('clean')).toBe(true);
    expect(isCalm('inspected')).toBe(true);
    expect(isCalm('dirty')).toBe(false);
    expect(isCalm('in_progress')).toBe(false);
    expect(isCalm('out_of_order')).toBe(false);
  });
});

describe('tickets', () => {
  it('numbers a new reference from the twin’s T-118', () => {
    expect(ticketRef(0)).toBe('T-118');
    expect(ticketRef(2)).toBe('T-120');
  });

  it('ages a ticket in the granularity a shift needs', () => {
    const at = 1_000_000;
    const ticket = { at } as WorkTicket;
    expect(ticketAge(ticket, at + 5_000).key).toBe('work.tickets.justNow');
    expect(ticketAge(ticket, at + 5 * 60_000)).toEqual({
      key: 'work.tickets.minutesAgo',
      values: { minutes: 5 },
    });
    expect(ticketAge(ticket, at + 130 * 60_000)).toEqual({
      key: 'work.tickets.hoursAgo',
      values: { hours: 2 },
    });
  });
});

describe('the offline buffer', () => {
  const change = (room: string, at: number): BufferedChange => ({
    key: `k-${room}`,
    room,
    kind: 'clean',
    at,
  });

  it('tells apart connected, nothing yet, and n waiting', () => {
    expect(bufferLabel({ online: true, buffer: [] }).key).toBe('work.offline.connected');
    expect(bufferLabel({ online: false, buffer: [] }).key).toBe('work.offline.bannerNone');
    expect(bufferLabel({ online: false, buffer: [change('1', 1)] }).key).toBe(
      'work.offline.bannerCountOne',
    );
    expect(bufferLabel({ online: false, buffer: [change('1', 1), change('2', 2)] })).toEqual({
      key: 'work.offline.bannerCount',
      values: { count: 2 },
    });
  });

  it('replays oldest first, whatever order it was handed', () => {
    const out = replayOrder([change('c', 30), change('a', 10), change('b', 20)]);
    expect(out.map((x) => x.room)).toEqual(['a', 'b', 'c']);
  });

  it('says what the flush did, with its singular', () => {
    expect(flushPhrase(0).key).toBe('work.offline.backOnlineToast');
    expect(flushPhrase(1).key).toBe('work.offline.syncedToastOne');
    expect(flushPhrase(3)).toEqual({
      key: 'work.offline.syncedToast',
      values: { count: 3 },
    });
  });
});

describe('the shift summary', () => {
  it('adds this session’s finished rooms to the ones already behind it', () => {
    const before = shiftSummary(SEED_TASKS);
    expect(before.cleaned).toBe(WORK_PROFILE.cleanedBefore);
    expect(before.left).toBe(6);
    expect(before.rooms).toEqual([...WORK_PROFILE.roomsFinished]);

    const after = shiftSummary(
      SEED_TASKS.map((row) => (row.id === '104' ? { ...row, status: 'done' as const } : row)),
    );
    expect(after.cleaned).toBe(WORK_PROFILE.cleanedBefore + 1);
    expect(after.left).toBe(5);
    // Newest last, so the wrap reads as the shift went.
    expect(after.rooms[after.rooms.length - 1]).toBe('104');
  });
});

describe('the live arrival', () => {
  it('counts in seconds until it is a minute old', () => {
    const at = 5_000_000;
    expect(arrivalAge(at, at + 4_000)).toEqual({
      key: 'work.queue.arrivalAgoSeconds',
      values: { seconds: 4 },
    });
    expect(arrivalAge(at, at + 95_000)).toEqual({
      key: 'work.queue.arrivalAgoMinutes',
      values: { minutes: 1 },
    });
  });

  it('never prints a negative age from a clock that stepped backwards', () => {
    expect(arrivalAge(5_000_000, 4_000_000).values).toEqual({ seconds: 0 });
  });
});
