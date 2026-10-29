import { describe, expect, it } from 'vitest';

import { Permission } from '@injishi/contracts';

import { TASK_GUIDES, TUTORIALS, TaskGuide, Tutorial } from '../content/tasks';
import { scoped } from '../testing/fake-operator';
import { fakeReads } from '../testing/fake-listings';
import { ToolSet } from './assistant-tools';
import type { ToolCaller } from './tool-types';

const tools = new ToolSet(fakeReads);
const USER = 'u0000000-0000-4000-8000-000000000001';

async function guideFor(query: string, caller: ToolCaller): Promise<Record<string, unknown> | null> {
  const outcome = await tools.run('get_task_guide', { query }, caller);
  return JSON.parse(outcome.content).guide;
}

describe('task guides and tutorials (ADR-061 slice D)', () => {
  it('parses every guide and tutorial, with real permissions and a last verified date', () => {
    for (const g of TASK_GUIDES) {
      expect(() => TaskGuide.parse(g)).not.toThrow();
      for (const p of g.permissions) expect(Permission.options).toContain(p);
    }
    for (const t of TUTORIALS) expect(() => Tutorial.parse(t)).not.toThrow();
  });

  it('gives the publish steps with the screen labels, then the fixes', async () => {
    const guide = await guideFor('how do I publish my property', { userId: USER });
    expect(guide).toMatchObject({ id: 'publish-a-property', where: 'the operator app', needsOneOf: ['listing.manage'] });
    expect((guide?.steps as string[]).join(' ')).toMatch(/Inventory.*Publish/);
  });

  it('says whether this person may do the task, filtered by permission in the workspace in view', async () => {
    const receptionist: ToolCaller = { userId: USER, workspace: scoped(['stay.checkin']) };
    expect(await guideFor('check a guest in', receptionist)).toMatchObject({ id: 'check-in-a-guest', youCanDoThis: true });
    expect(await guideFor('change the price of a room type', receptionist)).toMatchObject({ id: 'change-a-room-rate', youCanDoThis: false });
    expect(await guideFor('change the price of a room type', { userId: USER })).toMatchObject({ youCanDoThis: 'unknown' });
  });

  it('never offers a tutorial with no video, and says none is recorded', async () => {
    const guide = await guideFor('check a guest in', { userId: USER });
    expect(guide).toMatchObject({ tutorialRecorded: false });
    const outcome = await tools.run('find_tutorial', { guideId: 'check-in-a-guest' }, { userId: null });
    expect(JSON.parse(outcome.content)).toMatchObject({ tutorial: null, note: expect.stringMatching(/No tutorial is recorded/) });
    expect(outcome.sources).toEqual([]);
  });

  it('says there is no verified guide rather than inventing steps', async () => {
    const outcome = await tools.run('get_task_guide', { query: 'zxqv blorf' }, { userId: null });
    expect(JSON.parse(outcome.content)).toMatchObject({ guide: null, note: expect.stringMatching(/do not invent/) });
  });
});
