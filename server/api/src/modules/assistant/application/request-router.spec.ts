import { describe, expect, it } from 'vitest';

import type { SendAssistantMessageInput } from '@injishi/contracts';

import type { AssistantModelPort, ModelTurn, ModelTurnRequest } from '../domain/model-port';
import { MockAssistantModel } from '../infrastructure/mock-model.adapter';
import { FakeConversations } from '../testing/fake-conversations';
import { defaultProposals, defaultRoomTypes } from '../testing/fake-actions';
import { GUEST_A, fakeReads } from '../testing/fake-listings';
import { OPS_WORKSPACE, scoped } from '../testing/fake-operator';
import { CANNOT_CHANGE, NEED_A_DAY, NO_TUTORIAL, SIGN_IN_FOR_TRIPS } from './answer-templates';
import { ToolSet } from './assistant-tools';
import { AssistantService, type ConversationHolder, type TurnContext } from './assistant.service';
import { FakeUsage } from '../testing/fake-usage';

/**
 * The request router (ADR-061 D-q): database first, rules second, knowledge
 * and tutorials third, the model last. The model here counts every call it
 * receives, so "answered without the model" is measured, not assumed.
 */
class CountingModel implements AssistantModelPort {
  readonly kind = 'mock' as const;
  calls: ModelTurnRequest[] = [];
  private readonly inner = new MockAssistantModel();
  createTurn(request: ModelTurnRequest): Promise<ModelTurn> {
    this.calls.push(request);
    return this.inner.createTurn(request);
  }
}

const NOW = new Date('2026-09-30T10:00:00Z'); // 12:00 in Kigali
const ANON: ConversationHolder = { kind: 'anon', tokenHash: null };
const GUEST: ConversationHolder = { kind: 'user', userId: GUEST_A };
const OWNER: ConversationHolder = { kind: 'user', userId: 'owner-1' };
const PUBLIC: TurnContext = {};
const OPERATOR: TurnContext = { workspace: scoped(['listing.manage', 'reservation.assign', 'stay.checkin']) };
const ask = (message: string, surface: SendAssistantMessageInput['surface'] = 'web'): SendAssistantMessageInput => ({ message, surface });

function build(): { model: CountingModel; repo: FakeConversations; service: AssistantService } {
  const model = new CountingModel();
  const repo = new FakeConversations();
  const service = new AssistantService(model, { mode: 'mock', model: 'claude-sonnet-5-5' }, repo.asRepository(), new ToolSet(fakeReads), defaultProposals, new FakeUsage());
  return { model, repo, service };
}

async function answer(
  service: AssistantService,
  holder: ConversationHolder,
  message: string,
  context: TurnContext = PUBLIC,
  surface: SendAssistantMessageInput['surface'] = 'web',
): Promise<{ text: string; route: string | null; sources: string[] }> {
  const result = await service.send(holder, ask(message, surface), NOW, context);
  const last = result.conversation.messages.at(-1)!;
  return { text: last.text, route: null, sources: last.sources.map((s) => s.id) };
}

describe('request router (ADR-061 D-q)', () => {
  it.each([
    ['a help article', ANON, "I can't publish my property as a host", PUBLIC, 'web'],
    ['a help article', ANON, 'when do I get paid', PUBLIC, 'web'],
    ['published places', ANON, 'places to stay in Musanze', PUBLIC, 'web'],
    ['the guest’s own trips', GUEST, 'show my trips', PUBLIC, 'web'],
    ['a task guide', OWNER, 'how do I check a guest in', OPERATOR, 'app'],
    ['rooms on a day', OWNER, 'which rooms are free on 2026-10-10', OPERATOR, 'app'],
    ['publish blockers', OWNER, 'why can’t I publish my property', OPERATOR, 'app'],
    ['a price change card', OWNER, 'change the Double room price to 70,000', OPERATOR, 'app'],
    ['the escalation offer', ANON, 'I want to talk to a person', PUBLIC, 'web'],
  ] as const)('answers %s without any model call: "%s"', async (_what, holder, message, context, surface) => {
    defaultRoomTypes.price = 60000;
    const { model, service } = build();
    const result = await service.send(holder, ask(message, surface), NOW, context);
    expect(model.calls).toHaveLength(0);
    expect(result.conversation.messages.at(-1)?.text.length).toBeGreaterThan(5);
  });

  it('records how every answer was produced', async () => {
    const { repo, service } = build();
    await service.send(ANON, ask('when do I get paid'), NOW, PUBLIC);
    await service.send(ANON, ask('could you sort this out for me somehow'), NOW, PUBLIC);
    const routes = [...repo.messages.values()].flat().filter((m) => m.role === 'assistant').map((m) => m.route);
    expect(routes).toEqual(['direct:knowledge', 'ai:open']);
  });

  it('hands explanation and analysis to the model, even when a data word matches', async () => {
    const { model, service } = build();
    await service.send(GUEST, ask('explain my booking to me like I am new to this'), NOW, PUBLIC);
    expect(model.calls.length).toBeGreaterThan(0);
  });

  it('hands a question no rule answers with confidence to the model', async () => {
    const { model, service } = build();
    await service.send(ANON, ask('could you sort this out for me somehow'), NOW, PUBLIC);
    expect(model.calls.length).toBeGreaterThan(0);
  });

  it('enforces the grant before any data: no operator rooms for a guest, no price card without listing.manage', async () => {
    const { model, service } = build();
    const rooms = await answer(service, GUEST, 'which rooms are free tomorrow');
    expect(rooms.text).toBe('I can only check rooms from the operator app, in a business you work in.');
    const price = await answer(service, OWNER, 'change the Double room price to 70,000', { workspace: scoped(['stay.checkin']) }, 'app');
    expect(price.text).toBe(CANNOT_CHANGE);
    expect(model.calls).toHaveLength(0);
  });

  it('asks for a day instead of guessing one', async () => {
    const { service } = build();
    expect((await answer(service, OWNER, 'which rooms are free', OPERATOR, 'app')).text).toBe(NEED_A_DAY);
  });

  it('reads "tomorrow" as the next Kigali day', async () => {
    const seen: unknown[] = [];
    const reads = {
      ...fakeReads,
      assignments: (...args: Parameters<typeof fakeReads.assignments>) => {
        seen.push(args.slice(1));
        return fakeReads.assignments(...args);
      },
    };
    const repo = new FakeConversations();
    const service = new AssistantService(new CountingModel(), { mode: 'mock', model: 'claude-sonnet-5-5' }, repo.asRepository(), new ToolSet(reads), defaultProposals, new FakeUsage());
    await service.send(OWNER, ask('which rooms are free tomorrow', 'app'), NOW, OPERATOR);
    expect(JSON.stringify(seen)).toContain('2026-10-01');
  });

  it('offers a tutorial only after the steps, and says plainly when none is recorded', async () => {
    const { model, service } = build();
    // Before any guide: a request for a video is not a tutorial follow up.
    const early = await answer(service, OWNER, 'show me a video', OPERATOR, 'app');
    expect(early.text).not.toBe(NO_TUTORIAL);
    const callsBefore = model.calls.length;

    await answer(service, OWNER, 'how do I check a guest in', OPERATOR, 'app');
    const stuck = await answer(service, OWNER, 'I am still stuck, is there a video?', OPERATOR, 'app');
    expect(stuck.text).toBe(NO_TUTORIAL);
    expect(model.calls.length).toBe(callsBefore);
  });

  it('answers a signed out trips question with the sign in sentence and no model call', async () => {
    const { model, service } = build();
    expect((await answer(service, ANON, 'show my trips')).text).toBe(SIGN_IN_FOR_TRIPS);
    expect(model.calls).toHaveLength(0);
  });

  it('cites the article it answered from, checked like a model citation', async () => {
    const { service } = build();
    const result = await answer(service, ANON, 'when do I get paid');
    expect(result.sources).toEqual(['when-hosts-are-paid']);
  });

  it('hands advice about a price to the model instead of preparing a card', async () => {
    const { model, repo, service } = build();
    await service.send(OWNER, ask('should I change the Double room price to 80,000?', 'app'), NOW, OPERATOR);
    // The router did not prepare a card; it handed the question on. What the
    // model then does is the model's call, still under the approval rule.
    const answer = [...repo.messages.values()].flat().find((m) => m.role === 'assistant');
    expect(answer?.route).toBe('ai:analysis');
    expect(model.calls.length).toBeGreaterThan(0);
  });

  it('never shows a room type id when a name matches more than one room type', async () => {
    const base = defaultRoomTypes.list(OPERATOR.workspace!)[0];
    const twin = { ...base, id: '0e0e0e0e-0000-4000-8000-000000000099', propertyId: '90000000-0000-4000-8000-00000000000b' };
    const reads = { ...fakeReads, roomTypes: () => Promise.resolve([base, twin]) };
    const repo = new FakeConversations();
    const model = new CountingModel();
    const service = new AssistantService(model, { mode: 'mock', model: 'claude-sonnet-5-5' }, repo.asRepository(), new ToolSet(reads), defaultProposals, new FakeUsage());
    const result = await service.send(OWNER, ask('change the Double room price to 75,000', 'app'), NOW, OPERATOR);
    const text = result.conversation.messages.at(-1)?.text ?? '';
    expect(text).toContain('More than one room type');
    expect(text).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/i);
    expect(model.calls).toHaveLength(0);
  });

  it('words an out of range price for a person, not with a field name', async () => {
    const { service } = build();
    const result = await service.send(OWNER, ask('change the Double room price to 999,999,999', 'app'), NOW, OPERATOR);
    const text = result.conversation.messages.at(-1)?.text ?? '';
    expect(text).toContain('new price per night');
    expect(text).not.toContain('newPriceRwf');
  });

  it('keeps the operator workspace id out of every answer', async () => {
    const { service } = build();
    const result = await answer(service, OWNER, 'which rooms are free on 2026-10-10', OPERATOR, 'app');
    expect(result.text).not.toContain(OPS_WORKSPACE);
  });
});
