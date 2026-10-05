import type { AssistantModelPort, ModelTurn } from '../domain/model-port';
import { MockAssistantModel } from '../infrastructure/mock-model.adapter';
import { defaultProposals } from '../testing/fake-actions';
import { FakeConversations } from '../testing/fake-conversations';
import { fakeReads } from '../testing/fake-listings';
import { FakeUsage } from '../testing/fake-usage';
import { ToolSet } from './assistant-tools';
import { AssistantService, type ConversationHolder, type TurnContext } from './assistant.service';

/**
 * The per turn log (ADR-061 D-s): every turn says which path answered, how it
 * ended, the model calls it made, the tool calls the model asked for itself,
 * every tool run, and how long it took. These pin each outcome.
 */
const NOW = new Date('2026-09-30T10:00:00Z');
const ANON: ConversationHolder = { kind: 'anon', tokenHash: null };
const PUBLIC: TurnContext = { catalogueOpen: true };
const OPEN = 'could you sort this out for me somehow';

/** A model that plays a fixed list of turns, then repeats the last. */
function scripted(...turns: ModelTurn[]): AssistantModelPort {
  let i = 0;
  return { kind: 'mock', createTurn: () => Promise.resolve(structuredClone(turns[Math.min(i++, turns.length - 1)])) };
}
const say = (text: string, stopReason: ModelTurn['stopReason'] = 'end_turn'): ModelTurn => ({ content: [{ type: 'text', text }], stopReason, model: 'x' });
const toolUse: ModelTurn = { content: [{ type: 'tool_use', id: 't', name: 'search_help', input: { query: 'x' } }], stopReason: 'tool_use', model: 'x' };

function build(model: AssistantModelPort): { usage: FakeUsage; service: AssistantService } {
  const usage = new FakeUsage();
  const service = new AssistantService(model, { mode: 'mock', model: 'claude-sonnet-5-5' }, new FakeConversations().asRepository(), new ToolSet(fakeReads), defaultProposals, usage);
  return { usage, service };
}

describe('the per turn log (ADR-061 D-s)', () => {
  it('logs a router answer as answered with no model call and the tool the router ran', async () => {
    const { usage, service } = build(new MockAssistantModel());
    await service.send(ANON, { message: 'when do I get paid', surface: 'web' }, NOW, PUBLIC);
    expect(usage.turns[0]).toMatchObject({ route: 'direct:knowledge', outcome: 'answered', modelCalls: 0, modelToolCalls: 0, tools: ['search_help'] });
  });

  it('logs gathered tools beside the model answer, with no tool call of the model’s own', async () => {
    const { usage, service } = build(new MockAssistantModel());
    await service.send(ANON, { message: 'explain to me why my property might not be publishable yet', surface: 'web' }, NOW, PUBLIC);
    expect(usage.turns[0]).toMatchObject({ route: 'ai:analysis', outcome: 'answered', modelCalls: 1, modelToolCalls: 0, tools: ['search_help', 'get_task_guide'] });
  });

  it.each([
    ['truncated', [say('A long answer cut off at the ceil', 'max_tokens')]],
    ['refused', [{ content: [], stopReason: 'refusal', model: 'x' } as ModelTurn]],
    ['withheld', [say('It costs 77,777 RWF.')]],
    ['step_limit', [toolUse]],
  ] as const)('logs a %s turn', async (outcome, turns) => {
    const { usage, service } = build(scripted(...turns));
    await service.send(ANON, { message: OPEN, surface: 'web' }, NOW, PUBLIC);
    expect(usage.turns[0].outcome).toBe(outcome);
    if (outcome === 'step_limit') {
      // Six calls each asked for a tool; only five ran, as nothing runs after the last call.
      expect(usage.turns[0]).toMatchObject({ modelCalls: 6, modelToolCalls: 6 });
      expect(usage.turns[0].tools).toHaveLength(5);
    }
  });

  it('logs a turn out of time, and how long it took', async () => {
    const { usage, service } = build(scripted(toolUse));
    let now = 1_000_000;
    service.clock = () => now;
    const model = service as unknown as { model: AssistantModelPort };
    const inner = model.model;
    model.model = {
      kind: 'mock',
      createTurn: (request, options) => {
        now += 30_000;
        return inner.createTurn(request, options);
      },
    };
    await service.send(ANON, { message: OPEN, surface: 'web' }, NOW, PUBLIC);
    expect(usage.turns[0]).toMatchObject({ outcome: 'out_of_time', modelCalls: 2, durationMs: 60_000 });
  });

  it('logs a turn whose answer could not be stored as failed, with the calls it made', async () => {
    const repo = new FakeConversations();
    const usage = new FakeUsage();
    const store = repo.asRepository();
    store.appendTurn = () => Promise.reject(new Error('database down'));
    const failing = new AssistantService(new MockAssistantModel(), { mode: 'mock', model: 'claude-sonnet-5-5' }, store, new ToolSet(fakeReads), defaultProposals, usage);
    await expect(failing.send(ANON, { message: OPEN, surface: 'web' }, NOW, PUBLIC)).rejects.toThrow('database down');
    expect(usage.turns[0]).toMatchObject({ outcome: 'failed', messageId: null, modelCalls: 2 });
  });
});
