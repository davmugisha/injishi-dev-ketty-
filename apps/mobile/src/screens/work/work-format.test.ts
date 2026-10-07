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
  clockOf,
  filterRooms,
  finishedTasks,
  floorTabs,
  floorsWithWork,
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
  tabCountPhrase,
  taskMeta,
  ticketAge,
  ticketRef,
} from './work-format';
import {
  SEED_ROOMS,
  SEED_TASKS,
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
    // Offline the line is about the phone, so it does not wait for the read.
    expect(syncLine({ online: false, ready: false, openCount: 6, bufferCount: 3 })).toEqual({
      key: 'work.queue.syncOffline',
      values: { count: 3 },
    });
  });

  /**
   * Mobile audit 2026-10-05, WK-13: the rig read "Synced · 6 tasks · 10:24" at
   * 14:03. The time was a fixture constant and nothing synced. The line now
   * carries the time the list was actually read, or no time at all.
   */
  it('prints the time the list was last read, never a fixed clock', () => {
    const readAt = new Date(2026, 9, 5, 14, 3).getTime();
    expect(syncLine({ online: true, ready: true, openCount: 6, bufferCount: 0, readAt })).toEqual({
      key: 'work.queue.syncOnline',
      values: { count: 6, time: '14:03' },
    });
    expect(syncLine({ online: true, ready: true, openCount: 6, bufferCount: 0 })).toEqual({
      key: 'work.queue.syncOnlineNoTime',
      values: { count: 6 },
    });
  });

  it('says nothing online until the read has landed (WK-24)', () => {
    // A count from the seed is a number nobody loaded.
    expect(syncLine({ online: true, ready: false, openCount: 6, bufferCount: 0 })).toBeUndefined();
  });

  it('reads a clock the way the rest of the surface does', () => {
    expect(clockOf(new Date(2026, 9, 5, 9, 4).getTime())).toBe('09:04');
    expect(clockOf(new Date(2026, 9, 5, 23, 59).getTime())).toBe('23:59');
  });

  /**
   * WK-12: a floor tab read "Floor 1 2", two numbers side by side. The count
   * is a pill now, and a screen reader hears it with its noun.
   */
  it('gives a tab count its noun, singular and plural', () => {
    expect(tabCountPhrase('Floor 1', 2, 'rooms')).toEqual({
      key: 'work.tabs.rooms',
      values: { label: 'Floor 1', count: 2 },
    });
    expect(tabCountPhrase('Floor 2', 1, 'rooms').key).toBe('work.tabs.roomsOne');
    expect(tabCountPhrase('Open', 3, 'tickets').key).toBe('work.tabs.tickets');
    expect(tabCountPhrase('Open', 1, 'tickets').key).toBe('work.tabs.ticketsOne');
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
});

describe('the shift summary', () => {
  /**
   * Mobile audit 2026-10-05, WK-02: this used to start from eleven rooms
   * nobody cleaned, a fixed 22 minute average and eleven fixture room numbers.
   * It says only what the queue itself knows now.
   */
  it('counts what is left and what was finished, and invents nothing', () => {
    const before = shiftSummary(SEED_TASKS);
    expect(before).toEqual({ left: 6, rooms: [] });

    const after = shiftSummary(
      SEED_TASKS.map((row) => (row.id === '104' ? { ...row, status: 'done' as const } : row)),
    );
    expect(after).toEqual({ left: 5, rooms: ['104'] });
    // No "rooms cleaned" and no average: there is nothing honest to fill them.
    expect(Object.keys(after).sort()).toEqual(['left', 'rooms']);
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
