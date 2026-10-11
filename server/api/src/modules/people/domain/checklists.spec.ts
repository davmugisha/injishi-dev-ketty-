import { addDays, anchorFor, overdueCount, tasksFor, type TemplateItem } from './checklists';

const COOK = '11111111-1111-4111-8111-111111111111';
const GUARD = '22222222-2222-4222-8222-222222222222';

const item = (over: Partial<TemplateItem>): TemplateItem => ({
  label: 'A task',
  sortOrder: 0,
  byEmployee: false,
  dueAfterDays: 0,
  jobPositionId: null,
  ...over,
});

describe('the day a checklist counts from', () => {
  it('is the first day for somebody joining, whenever it is started', () => {
    expect(anchorFor('onboarding', { hiredOn: '2026-10-01', offboardedOn: null }, '2026-10-11')).toBe('2026-10-01');
  });

  it('is the last day for somebody leaving', () => {
    expect(anchorFor('offboarding', { hiredOn: '2024-02-01', offboardedOn: '2026-10-31' }, '2026-10-11')).toBe('2026-10-31');
  });

  it('is today for somebody leaving with no last day on file yet', () => {
    expect(anchorFor('offboarding', { hiredOn: '2024-02-01', offboardedOn: null }, '2026-10-11')).toBe('2026-10-11');
  });
});

describe('the tasks a person is given', () => {
  it('are due so many days from the day the checklist counts from, before it too', () => {
    const tasks = tasksFor(
      [item({ label: 'Uniform', dueAfterDays: 0 }), item({ label: 'Review', sortOrder: 1, dueAfterDays: 30 }), item({ label: 'Keys', sortOrder: 2, dueAfterDays: -2 })],
      null,
      '2026-10-30',
    );
    expect(tasks.map((t) => [t.label, t.dueOn])).toEqual([
      ['Uniform', '2026-10-30'],
      ['Review', '2026-11-29'],
      ['Keys', '2026-10-28'],
    ]);
  });

  it('leave out another job\'s tasks and keep everybody\'s', () => {
    const tasks = tasksFor(
      [
        item({ label: 'Fire exits' }),
        item({ label: 'Knife safety', sortOrder: 1, jobPositionId: COOK }),
        item({ label: 'Night keys', sortOrder: 2, jobPositionId: GUARD }),
      ],
      COOK,
      '2026-10-01',
    );
    expect(tasks.map((t) => t.label)).toEqual(['Fire exits', 'Knife safety']);
  });

  it('give somebody with no position only what is everybody\'s', () => {
    const tasks = tasksFor([item({ label: 'Fire exits' }), item({ label: 'Knife safety', sortOrder: 1, jobPositionId: COOK })], null, '2026-10-01');
    expect(tasks.map((t) => t.label)).toEqual(['Fire exits']);
  });

  it('keep the template\'s order and number it from nought with no gaps', () => {
    const tasks = tasksFor(
      [item({ label: 'Third', sortOrder: 9 }), item({ label: 'First', sortOrder: 1 }), item({ label: 'Skipped', sortOrder: 4, jobPositionId: GUARD }), item({ label: 'Second', sortOrder: 5 })],
      COOK,
      '2026-10-01',
    );
    expect(tasks.map((t) => [t.label, t.sortOrder])).toEqual([
      ['First', 0],
      ['Second', 1],
      ['Third', 2],
    ]);
  });

  it('carry who does each', () => {
    const [mine, theirs] = tasksFor([item({ byEmployee: true }), item({ sortOrder: 1 })], null, '2026-10-01');
    expect([mine.byEmployee, theirs.byEmployee]).toEqual([true, false]);
  });
});

describe('late', () => {
  const tasks = [
    { dueOn: '2026-10-09', doneAt: null },
    { dueOn: '2026-10-09', doneAt: '2026-10-10T08:00:00.000Z' },
    { dueOn: '2026-10-11', doneAt: null },
    { dueOn: '2026-10-12', doneAt: null },
  ];

  it('is not done and past its day; due today is not late yet', () => {
    expect(overdueCount(tasks, '2026-10-11')).toBe(1);
    expect(overdueCount(tasks, '2026-10-12')).toBe(2);
  });

  it('crosses a month and a year end', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});
