import type { MessageRow } from '../infrastructure/conversation.repository';
import { RECENT_EXCHANGES, SIDE_LIMIT, modelInputFor } from './context-window';

/**
 * Minimum context (ADR-061 D-r): the model gets one message with a summary
 * and a short window, so a long conversation costs about what a short one
 * does, and nothing from an earlier turn's tools or thinking is sent again.
 */
let seq = 0;
function user(sent: string, display = sent): MessageRow {
  return {
    id: `u${++seq}`,
    seq,
    role: 'user',
    displayText: display,
    modelContent: [{ role: 'user', content: [{ type: 'text', text: sent }] }],
    sources: [],
    toolCalls: [],
    route: null,
    createdAt: new Date(0),
  };
}
function assistant(text: string): MessageRow {
  return {
    id: `a${++seq}`,
    seq,
    role: 'assistant',
    displayText: text,
    // What a model turn stores: tool calls and results, never to be replayed.
    modelContent: [
      { role: 'assistant', content: [{ type: 'tool_use', id: 't', name: 'my_trips', input: {} }] },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't', content: '{"trips":[{"reference":"BK-SECRET"}]}' }] },
      { role: 'assistant', content: [{ type: 'thinking', thinking: 'private reasoning' }, { type: 'text', text }] },
    ],
    sources: [],
    toolCalls: [],
    route: 'ai:open',
    createdAt: new Date(0),
  };
}
function conversation(n: number): MessageRow[] {
  return Array.from({ length: n }, (_, i) => [user(`question ${i + 1}`), assistant(`answer ${i + 1}`)]).flat();
}
const textOf = (history: MessageRow[], q = 'now?'): string => String(modelInputFor(history, q).content[0].text);

describe('context window (ADR-061 D-r)', () => {
  it('sends the question alone on the first turn', () => {
    expect(modelInputFor([], 'hello')).toEqual({ role: 'user', content: [{ type: 'text', text: 'hello' }] });
  });

  it('keeps the last three exchanges, summarises the earlier questions, and drops earlier answers', () => {
    const text = textOf(conversation(6));
    for (let i = 4; i <= 6; i++) {
      expect(text).toContain(`Person: question ${i}`);
      expect(text).toContain(`Assistant: answer ${i}`);
    }
    expect(text).toContain('Earlier in this conversation (3 exchanges)');
    expect(text).toContain('"question 1"; "question 2"; "question 3"');
    expect(text).not.toContain('answer 1');
    expect(text).not.toContain('answer 3');
    expect(text.endsWith('Current question:\nnow?')).toBe(true);
    expect(RECENT_EXCHANGES).toBe(3);
  });

  it('never replays an earlier turn’s tool results or thinking', () => {
    const text = textOf(conversation(4));
    expect(text).not.toContain('BK-SECRET');
    expect(text).not.toContain('private reasoning');
    expect(text).not.toContain('tool_result');
  });

  it('stays small however long the conversation runs', () => {
    const long = 'x'.repeat(3000);
    const history = Array.from({ length: 39 }, () => [user(long), assistant(long)]).flat();
    const text = textOf(history);
    expect(text.length).toBeLessThan(4000);
    expect(text).toContain('and 28 more');
    expect(text).toContain(`${'x'.repeat(SIDE_LIMIT - 1)}…`);
  });

  it('reuses the redacted question that was sent, not the words kept for display', () => {
    const history = [user('reach me at [email]', 'reach me at a@b.rw'), assistant('call [phone] or 0788123456')];
    const text = textOf(history);
    expect(text).toContain('reach me at [email]');
    expect(text).not.toContain('a@b.rw');
    expect(text).not.toContain('0788123456');
  });
});
