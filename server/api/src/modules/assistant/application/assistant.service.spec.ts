import {
  ASSISTANT_TURN_LIMIT,
  type SendAssistantMessageInput,
} from '@injishi/contracts';
import {
  ConflictException,
  ServiceUnavailableException,
} from '@nestjs/common';

import { hashAnonToken } from '../domain/anon-token';
import {
  type AssistantModelPort,
  type ModelCallOptions,
  type ModelTurn,
  type ModelTurnRequest,
  ModelUnavailableError,
} from '../domain/model-port';
import type { MessageRow } from '../infrastructure/conversation.repository';
import { MOCK_NO_ANSWER, MOCK_SIGN_IN, MockAssistantModel } from '../infrastructure/mock-model.adapter';
import { FakeConversations, fakeUuid as uuid } from '../testing/fake-conversations';
import { defaultProposals } from '../testing/fake-actions';
import { GUEST_A, fakeReads } from '../testing/fake-listings';
import { ToolSet } from './assistant-tools';
import type { AssistantSettings } from './assistant-settings';
import { CANNOT_ANSWER_NOW, FALLBACK_ARTICLE, UNCONFIRMED_FIGURE } from './answer-templates';
import { AssistantService, INCOMPLETE_REPLY, REFUSAL_REPLY, extractCitations } from './assistant.service';
import { FakeUsage } from '../testing/fake-usage';

/** A model that answers from a script and records every request it saw. */
class ScriptedModel implements AssistantModelPort {
  readonly kind = 'mock' as const;
  requests: ModelTurnRequest[] = [];
  deadlines: number[] = [];
  onCall: () => void = () => undefined;
  constructor(private readonly script: Array<ModelTurn | Error>) {}
  createTurn(request: ModelTurnRequest, options: ModelCallOptions): Promise<ModelTurn> {
    this.requests.push(structuredClone(request));
    this.deadlines.push(options.deadline);
    this.onCall();
    const next = this.script.shift() ?? { content: [{ type: 'text', text: 'done' }], stopReason: 'end_turn', model: 'x' };
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
  }
}

const NOW = new Date('2026-09-30T10:00:00Z');
const ask = (message: string, extra: Partial<SendAssistantMessageInput> = {}): SendAssistantMessageInput => ({ message, surface: 'web', ...extra });

function build(
  model: AssistantModelPort = new MockAssistantModel(),
  mode: AssistantSettings['mode'] = 'mock',
): { repo: FakeConversations; service: AssistantService } {
  const repo = new FakeConversations();
  const service = new AssistantService(model, { mode, model: 'claude-sonnet-5-5' }, repo.asRepository(), new ToolSet(fakeReads), defaultProposals, new FakeUsage());
  return { repo, service };
}

describe('AssistantService (ADR-061)', () => {
  it('answers an anonymous question from the knowledge base, cites it, and mints a cookie', async () => {
    const { repo, service } = build();
    const result = await service.send({ kind: 'anon', tokenHash: null }, ask("I can't publish my property"), NOW);

    expect(result.newAnonToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(repo.rows[0].anonTokenHash).toBe(hashAnonToken(result.newAnonToken as string));
    expect(repo.rows[0].anonTokenHash).not.toBe(result.newAnonToken);

    const [question, answer] = result.conversation.messages;
    expect(question).toMatchObject({ role: 'user', text: "I can't publish my property" });
    expect(answer.role).toBe('assistant');
    expect(answer.text).not.toMatch(/\[source:/);
    expect(answer.sources).toEqual([expect.objectContaining({ kind: 'article', id: 'cannot-publish-listing' })]);
    expect(result.conversation).toMatchObject({ anonymous: true, turnsLeft: ASSISTANT_TURN_LIMIT - 1 });
  });

  it('expires an anonymous conversation 7 days after its last message', async () => {
    const { service } = build();
    const result = await service.send({ kind: 'anon', tokenHash: null }, ask('what is injishi'), NOW);
    expect(result.conversation.expiresAt).toBe('2026-10-07T10:00:00.000Z');
  });

  it('keeps an owned conversation 90 days, and mints no cookie for it', async () => {
    const { service } = build();
    const result = await service.send({ kind: 'user', userId: 'u1' }, ask('what is injishi'), NOW);
    expect(result.newAnonToken).toBeNull();
    expect(result.conversation).toMatchObject({ anonymous: false, expiresAt: '2026-12-29T10:00:00.000Z' });
  });

  it('continues the same anonymous conversation with the same cookie', async () => {
    const { service } = build();
    const first = await service.send({ kind: 'anon', tokenHash: null }, ask('what is injishi'), NOW);
    const hash = hashAnonToken(first.newAnonToken as string);
    const second = await service.send({ kind: 'anon', tokenHash: hash }, ask('when do I get paid'), NOW);
    expect(second.newAnonToken).toBeNull();
    expect(second.conversation.id).toBe(first.conversation.id);
    expect(second.conversation.messages).toHaveLength(4);
  });

  it('treats an expired conversation as absent and starts a new one with a fresh cookie', async () => {
    const { service } = build();
    const first = await service.send({ kind: 'anon', tokenHash: null }, ask('what is injishi'), NOW);
    const hash = hashAnonToken(first.newAnonToken as string);
    const later = new Date('2026-10-08T10:00:00Z');
    expect(await service.current({ kind: 'anon', tokenHash: hash }, 'web', later)).toBeNull();
    const next = await service.send({ kind: 'anon', tokenHash: hash }, ask('hello'), later);
    expect(next.conversation.id).not.toBe(first.conversation.id);
    expect(next.newAnonToken).not.toBe(first.newAnonToken);
  });

  it('says it has no verified answer rather than inventing one', async () => {
    const { service } = build();
    const result = await service.send({ kind: 'anon', tokenHash: null }, ask('zxqv blorf'), NOW);
    expect(result.conversation.messages[1]).toMatchObject({ text: MOCK_NO_ANSWER, sources: [] });
  });

  it('sends one message with a short window of earlier turns, never replaying them (D-r)', async () => {
    const model = new ScriptedModel([]);
    const { service } = build(model);
    const first = await service.send({ kind: 'user', userId: 'u1' }, ask('zorblat quixel one'), NOW);
    await service.send({ kind: 'user', userId: 'u1' }, ask('zorblat quixel two'), NOW);
    expect(model.requests[0].messages).toEqual([{ role: 'user', content: [{ type: 'text', text: 'zorblat quixel one' }] }]);
    const second = model.requests[1].messages;
    expect(second).toHaveLength(1);
    const text = String(second[0].content[0].text);
    expect(text).toContain('Person: zorblat quixel one');
    expect(text).toContain('Assistant: done');
    expect(text.endsWith('Current question:\nzorblat quixel two')).toBe(true);
    expect(first.conversation.messages[1].text).toBe('done');
  });

  it('redacts contact details before they reach the model, and shows the person their own words', async () => {
    const model = new ScriptedModel([]);
    const { service } = build(model);
    const result = await service.send({ kind: 'user', userId: 'u1' }, ask('reach me at a@b.rw or 0788123456'), NOW);
    expect(JSON.stringify(model.requests[0].messages)).not.toMatch(/a@b\.rw|0788123456/);
    expect(result.conversation.messages[0].text).toBe('reach me at a@b.rw or 0788123456');
  });

  it('drops a citation no tool returned in the same turn', () => {
    const available = new Map([['host-charges', { kind: 'article' as const, id: 'host-charges', title: 't', href: '/host' }]]);
    const { clean, cited } = extractCitations('Free [source:host-charges]. Also [source:made-up].', available);
    expect(clean).toBe('Free. Also.');
    expect(cited.map((c) => c.id)).toEqual(['host-charges']);
  });

  it('refuses a tool the caller was not offered, even when the model names it', async () => {
    const model = new ScriptedModel([
      { content: [{ type: 'tool_use', id: 't1', name: 'update_price', input: {} }], stopReason: 'tool_use', model: 'x' },
      { content: [{ type: 'text', text: 'I cannot do that.' }], stopReason: 'end_turn', model: 'x' },
    ]);
    const { service } = build(model);
    // A question no rule answers, so it reaches the model (D-q); a price
    // change request is now answered by the router without one.
    await service.send({ kind: 'anon', tokenHash: null }, ask('could you sort this out for me somehow'), NOW);
    const toolResult = model.requests[1].messages.at(-1)?.content[0];
    expect(toolResult).toMatchObject({ type: 'tool_result', tool_use_id: 't1', is_error: true });
  });

  it('answers a refusal with fixed copy', async () => {
    const { service } = build(new ScriptedModel([{ content: [], stopReason: 'refusal', model: 'x' }]));
    const result = await service.send({ kind: 'anon', tokenHash: null }, ask('zorblat quixel please'), NOW);
    expect(result.conversation.messages[1].text).toBe(REFUSAL_REPLY);
  });

  it('stops after six model calls and says it could not finish', async () => {
    const loop: ModelTurn = { content: [{ type: 'tool_use', id: 't', name: 'search_help', input: { query: 'x' } }], stopReason: 'tool_use', model: 'x' };
    const model = new ScriptedModel(Array.from({ length: 10 }, () => structuredClone(loop)));
    const { service } = build(model);
    const result = await service.send({ kind: 'anon', tokenHash: null }, ask('zorblat quixel please'), NOW);
    expect(model.requests).toHaveLength(6);
    expect(result.conversation.messages[1].text).toBe(INCOMPLETE_REPLY);
  });

  it('starts no model call once the 55 s turn budget is nearly spent', async () => {
    const loop: ModelTurn = { content: [{ type: 'tool_use', id: 't', name: 'search_help', input: { query: 'x' } }], stopReason: 'tool_use', model: 'x' };
    const model = new ScriptedModel(Array.from({ length: 10 }, () => structuredClone(loop)));
    const { service } = build(model);
    let now = 1_000_000;
    service.clock = () => now;
    model.onCall = () => {
      now += 30_000; // each call takes 30 s
    };
    const result = await service.send({ kind: 'anon', tokenHash: null }, ask('zorblat quixel please'), NOW);
    // Calls at 0 s and 30 s; at 60 s the budget is gone, so no third call.
    expect(model.requests).toHaveLength(2);
    expect(model.deadlines).toEqual([1_055_000, 1_055_000]);
    expect(result.conversation.messages[1].text).toBe(INCOMPLETE_REPLY);
  });

  it('accepts a citation written with spaces or capitals', () => {
    const available = new Map([['host-charges', { kind: 'article' as const, id: 'host-charges', title: 't', href: '/host' }]]);
    const { clean, cited } = extractCitations('Free [ source: Host-Charges ].', available);
    expect(clean).toBe('Free.');
    expect(cited.map((c) => c.id)).toEqual(['host-charges']);
  });

  it('answers by fallback when the model is unavailable, never with an error (D-u)', async () => {
    const { repo, service } = build(new ScriptedModel([new ModelUnavailableError('down')]));
    const result = await service.send({ kind: 'anon', tokenHash: null }, ask('could you sort this out for me somehow'), NOW);
    const text = result.conversation.messages.at(-1)?.text ?? '';
    expect(text.startsWith(FALLBACK_ARTICLE) || text.startsWith(CANNOT_ANSWER_NOW)).toBe(true);
    const stored = [...repo.messages.values()].flat();
    expect(stored.map((m) => m.role)).toEqual(['user', 'assistant']);
    expect(stored[1].route).toBe('fallback:model_unavailable');
  });

  it('withholds a model answer that states a figure this turn holds nowhere (D-v)', async () => {
    const say = (text: string): ModelTurn => ({ content: [{ type: 'text', text }], stopReason: 'end_turn', model: 'x' });
    for (const invented of ['Listing costs 99,000 RWF a month.', 'Your payout arrives on 2026-10-14.']) {
      const { service } = build(new ScriptedModel([say(invented)]));
      const result = await service.send({ kind: 'anon', tokenHash: null }, ask('could you sort this out for me somehow'), NOW);
      expect(result.conversation.messages.at(-1)?.text).toBe(UNCONFIRMED_FIGURE);
    }
    // The person's own figure, and a small count, are not invented data.
    const { service } = build(new ScriptedModel([say('At 45,000 RWF a night, 2 nights come to twice that.')]));
    const result = await service.send({ kind: 'anon', tokenHash: null }, ask('explain if 45,000 RWF a night suits me'), NOW);
    expect(result.conversation.messages.at(-1)?.text).toBe('At 45,000 RWF a night, 2 nights come to twice that.');
  });

  it('refuses a full conversation with 409 conversation_full', async () => {
    const { repo, service } = build();
    const first = await service.send({ kind: 'user', userId: 'u1' }, ask('hi'), NOW);
    const stored = repo.messages.get(first.conversation.id) as MessageRow[];
    while (stored.filter((m) => m.role === 'user').length < ASSISTANT_TURN_LIMIT) {
      stored.push({ ...stored[0], id: uuid(stored.length + 100), seq: stored.length + 1 });
    }
    await expect(service.send({ kind: 'user', userId: 'u1' }, ask('one more'), NOW)).rejects.toBeInstanceOf(ConflictException);
    const fresh = await service.send({ kind: 'user', userId: 'u1' }, ask('one more', { startNew: true }), NOW);
    expect(fresh.conversation.id).not.toBe(first.conversation.id);
  });

  it('answers a place to stay question with published properties only, each cited', async () => {
    const { service } = build();
    const result = await service.send({ kind: 'anon', tokenHash: null }, ask('places to stay in Musanze'), NOW);
    const reply = result.conversation.messages[1];
    expect(reply.text).toMatch(/Volcano View Lodge/);
    expect(reply.text).toMatch(/Twin Lakes Guesthouse/);
    expect(reply.text).not.toMatch(/City Hill Hotel|\[source:/);
    expect(reply.sources.map((s) => s.kind)).toEqual(['listing', 'listing']);
  });

  it('does not claim an expired anonymous conversation', async () => {
    const { service } = build();
    const first = await service.send({ kind: 'anon', tokenHash: null }, ask('what is injishi'), NOW);
    const hash = hashAnonToken(first.newAnonToken as string);
    const later = new Date('2026-10-08T10:00:00Z');
    expect(await service.claimable(hash, 'web', later)).toBe(false);
    expect(await service.claim('u1', hash, 'web', later)).toEqual({ claimed: false, conversation: null });
  });

  it('keeps earlier turns unchanged when a conversation is claimed, then answers trips from the account', async () => {
    const { service } = build();
    const first = await service.send({ kind: 'anon', tokenHash: null }, ask('when is my next trip'), NOW);
    expect(first.conversation.messages[1].text).toBe(MOCK_SIGN_IN);
    const hash = hashAnonToken(first.newAnonToken as string);
    const claimed = await service.claim(GUEST_A, hash, 'web', NOW);
    expect(claimed.claimed).toBe(true);
    expect(claimed.conversation?.messages.map((m) => m.text)).toEqual(first.conversation.messages.map((m) => m.text));
    const next = await service.send({ kind: 'user', userId: GUEST_A }, ask('when is my next trip'), NOW);
    expect(next.conversation.id).toBe(first.conversation.id);
    expect(next.conversation.messages.at(-1)?.text).toBe(
      'Your next stay is at Volcano View Lodge from 2026-10-10, reference BK-NEXT02.',
    );
  });

  it('answers 503 assistant_off when the assistant is off', async () => {
    const { service } = build(new MockAssistantModel(), 'off');
    expect(service.enabled).toBe(false);
    await expect(service.send({ kind: 'anon', tokenHash: null }, ask('x'), NOW)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
