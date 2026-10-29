import { describe, expect, it } from 'vitest';

import type { AssistantSurface } from '@injishi/contracts';

import type { AssistantModelPort, ModelTurn, ModelTurnRequest } from '../domain/model-port';
import { budgetIn, guestsIn, vagueTopicIn, withoutFilters } from '../domain/intents';
import { MockAssistantModel } from '../infrastructure/mock-model.adapter';
import { defaultProposals } from '../testing/fake-actions';
import { FakeConversations } from '../testing/fake-conversations';
import { GUEST_A, fakeReads } from '../testing/fake-listings';
import { scoped } from '../testing/fake-operator';
import { FakeUsage } from '../testing/fake-usage';
import { THANKS_REPLY, VIDEO_ASK } from './answer-templates';
import { ToolSet } from './assistant-tools';
import { AssistantService, type ConversationHolder, type TurnContext } from './assistant.service';
import { allSuggestionEntries, offeredTo } from './suggestions';

/**
 * What the owner found testing the chat on 2026-10-03 (contract revision 4),
 * each pinned with the exact words they typed, and the opening suggestions.
 */
const NOW = new Date('2026-10-03T18:45:00Z');
const ANON: ConversationHolder = { kind: 'anon', tokenHash: null };
const GUEST: ConversationHolder = { kind: 'user', userId: GUEST_A };
const OWNER: ConversationHolder = { kind: 'user', userId: 'owner-1' };
const STAFF: ConversationHolder = { kind: 'user', userId: 'staff-1' };
const PUBLIC: TurnContext = {};
const OPERATOR: TurnContext = { workspace: scoped(['listing.manage', 'reservation.assign', 'stay.checkin']) };
const RECEPTION: TurnContext = { workspace: scoped(['stay.checkin']) };

class CountingModel implements AssistantModelPort {
  readonly kind = 'mock' as const;
  calls = 0;
  private readonly inner = new MockAssistantModel();
  createTurn(request: ModelTurnRequest): Promise<ModelTurn> {
    this.calls += 1;
    return this.inner.createTurn(request);
  }
}

function build(usage = new FakeUsage()): { model: CountingModel; repo: FakeConversations; usage: FakeUsage; service: AssistantService } {
  const model = new CountingModel();
  const repo = new FakeConversations();
  const service = new AssistantService(model, { mode: 'mock', model: 'claude-sonnet-5-5' }, repo.asRepository(), new ToolSet(fakeReads), defaultProposals, usage);
  return { model, repo, usage, service };
}

async function ask(
  message: string,
  holder: ConversationHolder = ANON,
  context: TurnContext = PUBLIC,
  surface: AssistantSurface = 'web',
): Promise<{ text: string; route: string | null; calls: number; sources: string[]; suggestions: string[] }> {
  const { model, repo, service } = build();
  const result = await service.send(holder, { message, surface }, NOW, context);
  const last = result.conversation.messages.at(-1)!;
  return {
    text: last.text,
    route: [...repo.messages.values()].flat().at(-1)?.route ?? null,
    calls: model.calls,
    sources: last.sources.map((s) => s.title),
    suggestions: result.conversation.suggestions.map((s) => s.label),
  };
}

describe('the owner’s test findings (contract revision 4)', () => {
  it('"hello" gets a greeting that says what the assistant can do, with no model call', async () => {
    const r = await ask('hello');
    expect(r.route).toBe('direct:greeting');
    expect(r.calls).toBe(0);
    expect(r.text).toMatch(/^Hello, I'm the Injishi assistant\. I can .*find a place to stay/);
    expect(r.text).not.toMatch(/your trips/); // signed out: not promised
    expect(r.suggestions.length).toBeGreaterThan(0);
    expect((await ask('Good morning!', GUEST)).text).toMatch(/look up your trips/);
    expect((await ask('thanks')).text).toBe(THANKS_REPLY);
  });

  it('"price" alone gets a clarifying question with choices, not an unrelated article', async () => {
    const r = await ask('price');
    expect(r.route).toBe('direct:clarify_price');
    expect(r.calls).toBe(0);
    expect(r.text).toMatch(/^Which price do you mean: the price of a place to stay .* or what Injishi charges a host\?$/);
    expect(r.text).not.toMatch(/published only when/);
    expect(r.suggestions).toEqual(expect.arrayContaining(['Stays under 100,000 RWF', 'What Injishi charges']));
    expect(r.suggestions).not.toContain('Change a room price');
    // An operator who may change prices is offered that too.
    expect((await ask('price', OWNER, OPERATOR, 'app')).text).toMatch(/changing one of your room types' prices/);
  });

  it('"what hotel has price under 150000" filters by the budget, cheapest first, and says so', async () => {
    const r = await ask('what hotel has price under 150000');
    expect(r.route).toBe('direct:listings');
    expect(r.text).toMatch(/^I found 3 places under 150,000 RWF a night, cheapest first: Twin Lakes Guesthouse, City Hill Hotel and Volcano View Lodge\./);
    const tight = await ask('hotels under 50000');
    expect(tight.text).toMatch(/^I found 1 place under 50,000 RWF a night, cheapest first: Twin Lakes Guesthouse\./);
    const none = await ask('places to stay in Musanze under 10,000 RWF');
    expect(none.text).toBe('I found no published place in Musanze under 10,000 RWF a night. Try a higher budget or another district.');
    expect((await ask('places to stay for 4 guests')).text).toMatch(/^I found 1 place for 4 guests: Volcano View Lodge\./);
  });

  it('carries card details on every listing it names', async () => {
    const { service } = build();
    const result = await service.send(ANON, { message: 'places to stay in Musanze', surface: 'web' }, NOW, PUBLIC);
    const cards = result.conversation.messages.at(-1)!.sources.filter((s) => s.kind === 'listing');
    expect(cards.map((c) => c.title)).toEqual(['Twin Lakes Guesthouse', 'Volcano View Lodge']);
    expect(cards[0].listing).toEqual({ district: 'Musanze', fromNightlyRateRwf: 45000, maxGuests: 2, roomTypes: 1, photoUrl: null });
    expect(result.conversation.messages.at(-1)!.text).toMatch(/in Musanze/);
  });

  it('"how to create account" and "create account" answer from the sign in article', async () => {
    for (const q of ['how to create account', 'create account']) {
      const r = await ask(q);
      expect(r.text).toMatch(/no passwords|sign in with your email/i);
      expect(r.text).not.toMatch(/don't have a verified answer/);
    }
  });

  it('"any video of how" asks which task first, never an unrelated article', async () => {
    const r = await ask('any video of how');
    expect(r.route).toBe('direct:video_ask');
    expect(r.calls).toBe(0);
    expect(r.text).toBe(VIDEO_ASK);
  });

  it('answers a question about bookings in general from the help articles, not with the asker’s trips', async () => {
    const r = await ask('Do hosts have to accept every booking?', GUEST);
    expect(r.route).toBe('direct:knowledge');
    expect((await ask('show my trips', GUEST)).route).toBe('direct:trips');
    expect((await ask('where is my reservation', GUEST)).route).toBe('direct:trips');
    expect((await ask('booking', GUEST)).route).toBe('direct:clarify_booking');
  });

  it('the help search no longer matches on filler words', async () => {
    const r = await ask('tell me about any of that');
    expect(r.text).not.toMatch(/Hosts set their own availability/);
  });

  it('reads budgets and guest counts as written, and nothing else as one', () => {
    expect(budgetIn('hotels under 150000')).toBe(150000);
    expect(budgetIn('below 150,000 RWF a night')).toBe(150000);
    expect(budgetIn('up to 80k')).toBe(80000);
    expect(budgetIn('places in Musanze')).toBeNull();
    expect(guestsIn('for 4 guests')).toBe(4);
    expect(guestsIn('3 people')).toBe(3);
    expect(guestsIn('room 204')).toBeNull();
    expect(withoutFilters('places in Musanze under 150,000 RWF a night for 2 guests')).toBe('places in Musanze');
    expect(vagueTopicIn('price')).toBe('price');
    expect(vagueTopicIn('what is the price of the Double room at Volcano View Lodge')).toBeNull();
  });
});

describe('opening suggestions (contract revision 4)', () => {
  it('greets each caller with only what they may ask', async () => {
    const { service } = build();
    const visitor = await service.opening(ANON, 'web', PUBLIC, NOW);
    expect(visitor.greeting).toMatch(/^Hello, I'm the Injishi assistant\./);
    expect(visitor.suggestions.length).toBe(4);
    expect(visitor.suggestions.map((s) => s.label)).not.toContain('My trips');
    expect(visitor.suggestions.map((s) => s.label)).not.toContain('Rooms free today');
    // A task done inside a business is not offered to a visitor (found in the browser).
    expect(visitor.suggestions.map((s) => s.label)).not.toContain('Check a guest in');

    const operator = await service.opening(OWNER, 'app', OPERATOR, NOW);
    expect(operator.suggestions[0].label).toBe('Rooms free today');
    expect(operator.greeting).toMatch(/check which rooms are free/);

    const staff = await service.opening(STAFF, 'admin', PUBLIC, NOW);
    // Staff are signed in people: trips yes, a business's rooms no.
    expect(staff.greeting).not.toMatch(/rooms/);
  });

  it('puts the kinds of question asked most first', async () => {
    const usage = new FakeUsage();
    usage.counts = new Map([['direct:escalation', 40], ['direct:knowledge', 10]]);
    const { service } = build(usage);
    const opening = await service.opening(ANON, 'web', PUBLIC, NOW);
    expect(opening.suggestions[0].label).toBe('Talk to a person');
    expect(opening.suggestions[1].label).toBe('What can I list?');
  });

  it('answers every suggestion, starter and follow up, without the model, for every caller allowed it', async () => {
    const callers: Array<[ConversationHolder, TurnContext, AssistantSurface]> = [
      [ANON, PUBLIC, 'web'],
      [GUEST, PUBLIC, 'web'],
      [OWNER, OPERATOR, 'app'],
      [OWNER, RECEPTION, 'app'],
      [STAFF, PUBLIC, 'admin'],
    ];
    let checked = 0;
    for (const [holder, context, surface] of callers) {
      const offered = new Set(new ToolSet(fakeReads).offered({ userId: holder.kind === 'user' ? holder.userId : null, workspace: context.workspace ?? null }).map((t) => t.name));
      for (const entry of allSuggestionEntries().filter((e) => offeredTo(e, offered))) {
        const r = await ask(entry.message, holder, context, surface);
        expect({ suggestion: entry.id, route: r.route, calls: r.calls }).toEqual({ suggestion: entry.id, route: entry.route, calls: 0 });
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(20);
  });

  it('offers follow ups after an answer, never the question just asked', async () => {
    const r = await ask('Places to stay under 100,000 RWF a night');
    expect(r.suggestions[0]).toBe('Cheaper: under 50,000 RWF');
    expect(r.suggestions).not.toContain('Stays under 100,000 RWF');
  });
});
