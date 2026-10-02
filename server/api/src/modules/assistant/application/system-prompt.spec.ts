import { fakeReads } from '../testing/fake-listings';
import { ToolSet } from './assistant-tools';
import { GATHERED_HEADING } from './context-window';
import { ASSISTANT_SYSTEM_PROMPT } from './system-prompt';

/**
 * The mock model routes by keyword and never reads the system prompt, so a
 * prompt that forbids what a tool is for passes every mock test and silently
 * breaks the live model. This happened once: the prompt kept "You cannot make
 * changes to anything on Injishi" after propose_room_price existed, so a live
 * model would never have prepared a change.
 */
describe('system prompt (ADR-061 D-a)', () => {
  const names = new ToolSet(fakeReads).tools.map((t) => t.spec.name);

  it('names every tool the assistant can be offered, with a rule for using it', () => {
    for (const name of names) expect(ASSISTANT_SYSTEM_PROMPT).toContain(name);
  });

  it('forbids nothing a tool exists to do', () => {
    expect(ASSISTANT_SYSTEM_PROMPT).not.toMatch(/cannot make changes to anything on Injishi\.\s/);
    expect(ASSISTANT_SYSTEM_PROMPT).toMatch(/only PREPARES the change/);
  });

  it('holds no per request text, so the prompt cache prefix stays stable', () => {
    expect(ASSISTANT_SYSTEM_PROMPT).not.toMatch(/\d{4}-\d{2}-\d{2}|\$\{/);
  });

  it('names the gathered data heading, and asks for a tool only for what it lacks (D-q, D-x)', () => {
    expect(GATHERED_HEADING.startsWith('Verified Injishi data for this question')).toBe(true);
    expect(ASSISTANT_SYSTEM_PROMPT).toContain('"Verified Injishi data for this question"');
    expect(ASSISTANT_SYSTEM_PROMPT).toContain('Call a tool only for data those lines do not hold');
  });

  it('asks for short, actionable answers (D-y)', () => {
    expect(ASSISTANT_SYSTEM_PROMPT).toContain('normally under 120 words');
  });
});
