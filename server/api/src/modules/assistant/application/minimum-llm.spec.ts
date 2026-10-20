import type { AssistantModelPort, ModelTurn, ModelTurnRequest } from '../domain/model-port';
import { MockAssistantModel } from '../infrastructure/mock-model.adapter';
import { defaultProposals } from '../testing/fake-actions';
import { FakeConversations } from '../testing/fake-conversations';
import { GUEST_A, fakeReads } from '../testing/fake-listings';
import { scoped } from '../testing/fake-operator';
import { FakeUsage } from '../testing/fake-usage';
import { UNCONFIRMED_FIGURE } from './answer-templates';
import { ToolSet } from './assistant-tools';
import { AssistantService, type ConversationHolder, type TurnContext } from './assistant.service';
import { GATHERED_HEADING } from './context-window';
import { type RouteDecision, RequestRouter } from './request-router';
import type { ToolCaller } from './tool-types';

/**
 * The owner's minimum LLM review (ADR-061 D-q, D-r, D-x): the resolution
 * order, data gathered before the model is called, one call as the norm, and
 * a last call that cannot ask for a tool.
 */
const NOW = new Date('2026-09-30T10:00:00Z');
const ANON_CALLER: ToolCaller = { userId: null };
const GUEST_CALLER: ToolCaller = { userId: GUEST_A };
const OPERATOR_CALLER: ToolCaller = { userId: 'owner-1', workspace: scoped(['listing.manage', 'reservation.assign', 'stay.checkin']) };
const ANON: ConversationHolder = { kind: 'anon', tokenHash: null };
const PUBLIC: TurnContext = {};

class CountingModel implements AssistantModelPort {
  readonly kind = 'mock' as const;
  requests: ModelTurnRequest[] = [];
  constructor(private readonly inner: AssistantModelPort = new MockAssistantModel()) {}
  createTurn(request: ModelTurnRequest, options: { deadline: number }): Promise<ModelTurn> {
    this.requests.push(structuredClone(request));
    return this.inner.createTurn(request, options);
  }
}

function service(model: AssistantModelPort): { repo: FakeConversations; usage: FakeUsage; service: AssistantService } {
  const repo = new FakeConversations();
  const usage = new FakeUsage();
  return {
    repo,
    usage,
    service: new AssistantService(model, { mode: 'mock', model: 'claude-sonnet-5-5' }, repo.asRepository(), new ToolSet(fakeReads), defaultProposals, usage),
  };
}

const route = (question: string, caller: ToolCaller): Promise<RouteDecision> =>
  new RequestRouter(new ToolSet(fakeReads)).route({ question, caller, now: NOW, history: [] });
const gatheredTools = async (question: string, caller: ToolCaller): Promise<string[]> => {
  const decision = await route(question, caller);
  if (decision.kind !== 'ai') throw new Error(`expected the model, got ${decision.route}`);
  return decision.gathered.map((g) => g.tool);
};

describe('the resolution order (ADR-061 D-q)', () => {
  it('answers from the knowledge base before task guides when an article completely answers', async () => {
    expect((await route('how do I reach Injishi support', ANON_CALLER)).route).toBe('direct:knowledge');
    expect((await route('what does Injishi charge a host', OPERATOR_CALLER)).route).toBe('direct:knowledge');
  });

  it('gives the guide steps for a "how do I" a guide covers, even when an article also matches', async () => {
    // "Why a property can't be published yet" matches too; it explains, the guide does it.
    expect((await route('how do I publish my property', ANON_CALLER)).route).toBe('direct:task_guide');
    expect((await route('how do I check a guest in', OPERATOR_CALLER)).route).toBe('direct:task_guide');
  });
});

describe('gathering before the model (ADR-061 D-q, D-r)', () => {
  it('gathers the matching help articles for an explanation question', async () => {
    // The article and the matching guide; no data tool, as none is offered signed out.
    expect(await gatheredTools('explain to me why my property might not be publishable yet', ANON_CALLER)).toEqual(['search_help', 'get_task_guide']);
  });

  it('gathers the data tool the question names, for a caller allowed to use it', async () => {
    expect(await gatheredTools('explain which rooms are free tomorrow and which I should sell first', OPERATOR_CALLER)).toContain('rooms_on_dates');
  });

  it('never gathers what the caller may not see: no operator rooms for a guest, no trips signed out', async () => {
    expect(await gatheredTools('explain which rooms are free tomorrow and which I should sell first', GUEST_CALLER)).not.toContain('rooms_on_dates');
    expect(await gatheredTools('explain my trips to me like I am new', ANON_CALLER)).not.toContain('my_trips');
    expect(await gatheredTools('explain my trips to me like I am new', GUEST_CALLER)).toContain('my_trips');
  });

  it('hands both live run questions to the model, so the paid run exercises it (R3)', async () => {
    const publish = await route('Explain to me, as someone new to this, why my property might not be publishable yet.', ANON_CALLER);
    expect(publish.kind === 'ai' && publish.gathered.map((g) => g.tool)).toContain('search_help');
    expect((await route('Explain how I would change the Double room price to 70,000 RWF.', ANON_CALLER)).route).toBe('ai:analysis');
  });

  it('gathers nothing for a question nothing matches, so nothing unrelated is sent', async () => {
    expect(await gatheredTools('could you sort this out for me somehow', ANON_CALLER)).toEqual([]);
  });
});

describe('one model call is the norm (ADR-061 D-x)', () => {
  it('answers an explanation in ONE call from the gathered data, cited, with the data in the one message', async () => {
    const model = new CountingModel();
    const { repo, usage, service: svc } = service(model);
    const result = await svc.send(ANON, { message: 'explain to me why my property might not be publishable yet', surface: 'web' }, NOW, PUBLIC);
    expect(model.requests).toHaveLength(1);
    const sent = String(model.requests[0].messages[0].content[0].text);
    expect(model.requests[0].messages).toHaveLength(1);
    expect(sent.startsWith(GATHERED_HEADING)).toBe(true);
    expect(sent).toContain('[search_help] ');
    expect(sent.endsWith('Current question:\nexplain to me why my property might not be publishable yet')).toBe(true);
    const answer = result.conversation.messages.at(-1);
    expect(answer?.sources.map((s) => s.id)).toContain('cannot-publish-listing');
    expect([...repo.messages.values()].flat().at(-1)?.route).toBe('ai:analysis');
    expect(usage.turns[0].calls).toHaveLength(1);
  });

  it('keeps the stored history complete while the model gets only the window (D-r)', async () => {
    const model = new CountingModel();
    const { repo, service: svc } = service(model);
    let token: string | null = null;
    for (let i = 0; i < 6; i++) {
      const sent = await svc.send(token ? { kind: 'anon', tokenHash: token } : ANON, { message: `could you sort this out for me somehow, part ${i}`, surface: 'web' }, NOW, PUBLIC);
      token = token ?? (sent.newAnonToken ? (await import('../domain/anon-token')).hashAnonToken(sent.newAnonToken) : null);
    }
    const stored = [...repo.messages.values()].flat();
    expect(stored.filter((m) => m.role === 'user')).toHaveLength(6);
    const lastSent = String(model.requests.at(-1)?.messages[0].content[0].text);
    expect(lastSent).toContain('part 0');
    expect(lastSent).not.toContain('Person: could you sort this out for me somehow, part 0');
    expect(lastSent).toContain('Person: could you sort this out for me somehow, part 4');
  });

  it('sends the last call a turn may make with tool_choice none, and never before it', async () => {
    const toolUse: ModelTurn = { content: [{ type: 'tool_use', id: 't', name: 'search_help', input: { query: 'x' } }], stopReason: 'tool_use', model: 'x' };
    const scripted: AssistantModelPort = { kind: 'mock', createTurn: () => Promise.resolve(structuredClone(toolUse)) };
    const model = new CountingModel(scripted);
    const { service: svc } = service(model);
    await svc.send(ANON, { message: 'could you sort this out for me somehow', surface: 'web' }, NOW, PUBLIC);
    expect(model.requests).toHaveLength(6);
    expect(model.requests.map((r) => r.toolChoice ?? 'auto')).toEqual(['auto', 'auto', 'auto', 'auto', 'auto', 'none']);
  });

  it('the mock answers in words when told it may not call a tool', async () => {
    const turn = await new MockAssistantModel().createTurn({
      system: 's',
      tools: new ToolSet(fakeReads).offered(ANON_CALLER),
      messages: [{ role: 'user', content: [{ type: 'text', text: 'could you sort this out for me somehow' }] }],
      toolChoice: 'none',
    });
    expect(turn.stopReason).toBe('end_turn');
    expect(turn.content.some((b) => b.type === 'tool_use')).toBe(false);
  });

  it('counts gathered data as this turn’s evidence for the figure check (D-v)', async () => {
    const say = (text: string): AssistantModelPort => ({
      kind: 'mock',
      createTurn: () => Promise.resolve({ content: [{ type: 'text', text }], stopReason: 'end_turn', model: 'x' }),
    });
    // The guesthouse's 45,000 RWF came from the gathered search_listings result.
    const ok = await service(say('Twin Lakes Guesthouse is the cheaper one, from 45,000 RWF a night.')).service.send(
      ANON,
      { message: 'compare the places to stay in Musanze for me', surface: 'web' },
      NOW,
      PUBLIC,
    );
    expect(ok.conversation.messages.at(-1)?.text).toContain('45,000 RWF');
    const invented = await service(say('Twin Lakes Guesthouse is from 39,000 RWF a night.')).service.send(
      ANON,
      { message: 'compare the places to stay in Musanze for me', surface: 'web' },
      NOW,
      PUBLIC,
    );
    expect(invented.conversation.messages.at(-1)?.text).toBe(UNCONFIRMED_FIGURE);
  });

  it('says what to do next when a figure cannot be verified (D-v)', () => {
    expect(UNCONFIRMED_FIGURE).toMatch(/couldn't confirm .*\. .*(screen|support)/);
  });
});
