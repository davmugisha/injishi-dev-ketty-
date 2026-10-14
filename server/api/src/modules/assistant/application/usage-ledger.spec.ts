import { Logger } from '@nestjs/common';

import {
  type AssistantModelPort,
  type ModelTurn,
  type ModelTurnRequest,
  ModelUnavailableError,
} from '../domain/model-port';
import { DEFAULT_PRICES } from '../domain/usage';
import { MockAssistantModel } from '../infrastructure/mock-model.adapter';
import { buildUsageReport, type TurnRow, type UsageRow } from '../infrastructure/usage-queries';
import { defaultProposals } from '../testing/fake-actions';
import { FakeConversations } from '../testing/fake-conversations';
import { GUEST_A, fakeReads } from '../testing/fake-listings';
import { scoped } from '../testing/fake-operator';
import { FakeUsage } from '../testing/fake-usage';
import { ToolSet } from './assistant-tools';
import { AssistantService, type ConversationHolder, type TurnContext } from './assistant.service';
import { CANNOT_ANSWER_NOW, FALLBACK_ARTICLE } from './answer-templates';
import { type TurnUsage, UsageLedger } from './usage-ledger';

/**
 * The usage ledger (ADR-061 D-s): every model call metered and priced, every
 * user turn logged with how it ended, and a month that adds up.
 */
const NOW = new Date('2026-10-01T09:00:00Z');
const ANON: ConversationHolder = { kind: 'anon', tokenHash: null };
const OWNER: ConversationHolder = { kind: 'user', userId: 'owner-1' };
const PUBLIC: TurnContext = { catalogueOpen: true };
const OPERATOR: TurnContext = { catalogueOpen: true, workspace: scoped(['listing.manage']) };

/** The mock, failing from a given call on, to stand in for a provider outage. */
class FailingFrom implements AssistantModelPort {
  readonly kind = 'mock' as const;
  private calls = 0;
  private readonly inner = new MockAssistantModel();
  constructor(private readonly failAt: number) {}
  createTurn(request: ModelTurnRequest): Promise<ModelTurn> {
    this.calls += 1;
    if (this.calls >= this.failAt) return Promise.reject(new ModelUnavailableError('down'));
    return this.inner.createTurn(request);
  }
}

function build(model: AssistantModelPort = new MockAssistantModel()): { repo: FakeConversations; usage: FakeUsage; service: AssistantService } {
  const repo = new FakeConversations();
  const usage = new FakeUsage();
  const service = new AssistantService(model, { mode: 'mock', model: 'claude-sonnet-5-5' }, repo.asRepository(), new ToolSet(fakeReads), defaultProposals, usage);
  return { repo, usage, service };
}

describe('metering a turn (ADR-061 D-s)', () => {
  it('records no model call for an answer the router gave, and counts the answer', async () => {
    const { usage, service } = build();
    await service.send(ANON, { message: 'when do I get paid', surface: 'web' }, NOW, PUBLIC);
    expect(usage.turns).toHaveLength(1);
    expect(usage.turns[0]).toMatchObject({ calls: [], route: 'direct:knowledge', outcome: 'answered', modelCalls: 0, modelToolCalls: 0, tools: ['search_help'], callerRole: 'anonymous', surface: 'web', userId: null });
  });

  it('records every model call of a turn, tied to the stored answer', async () => {
    const { repo, usage, service } = build();
    await service.send(ANON, { message: 'could you sort this out for me somehow', surface: 'web' }, NOW, PUBLIC);
    const turn = usage.turns[0];
    // The mock searches, then answers: two calls, each with its own tokens.
    expect(turn.calls).toHaveLength(2);
    for (const call of turn.calls) {
      expect(call.model).toBe('mock');
      expect(call.usage.inputTokens).toBeGreaterThan(0);
      expect(call.usage.outputTokens).toBeGreaterThan(0);
    }
    const stored = [...repo.messages.values()].flat().find((m) => m.role === 'assistant');
    expect(turn).toMatchObject({ route: 'ai:open', outcome: 'answered', modelCalls: 2, modelToolCalls: 1, tools: ['search_help'], messageId: stored?.id });
    expect(turn.conversationId).toBe([...repo.messages.keys()][0]);
  });

  it('still records the calls of a turn whose provider failed, and answers it by fallback (D-u)', async () => {
    const { repo, usage, service } = build(new FailingFrom(2));
    const result = await service.send(ANON, { message: 'could you sort this out for me somehow', surface: 'web' }, NOW, PUBLIC);
    const text = result.conversation.messages.at(-1)?.text ?? '';
    expect(text.startsWith(FALLBACK_ARTICLE) || text.startsWith(CANNOT_ANSWER_NOW)).toBe(true);
    const stored = [...repo.messages.values()].flat().find((m) => m.role === 'assistant');
    expect(stored?.route).toBe('fallback:model_unavailable');
    expect(usage.turns).toHaveLength(1);
    // The first call was made and is paid for; the second never answered.
    // Two calls were attempted; only the first answered, so only it was metered.
    expect(usage.turns[0]).toMatchObject({ route: 'fallback:model_unavailable', outcome: 'fallback', modelCalls: 2, messageId: stored?.id });
    expect(usage.turns[0].calls).toHaveLength(1);
  });

  it.each(['budget', 'daily_cap'] as const)('calls no model past the %s, and answers by fallback (D-t, D-u)', async (reason) => {
    let calls = 0;
    const never: AssistantModelPort = {
      kind: 'mock',
      createTurn: () => {
        calls += 1;
        return Promise.reject(new Error('never'));
      },
    };
    const { repo, usage, service } = build(never);
    usage.allow = { allowed: false, reason };
    const result = await service.send(OWNER, { message: 'could you sort this out for me somehow', surface: 'web' }, NOW, PUBLIC);
    expect(calls).toBe(0);
    expect(result.conversation.messages.at(-1)?.text.length).toBeGreaterThan(10);
    expect([...repo.messages.values()].flat().find((m) => m.role === 'assistant')?.route).toBe(`fallback:${reason}`);
    expect(usage.asked).toEqual([{ userId: 'owner-1', conversationId: null, now: NOW }]);
    expect(usage.turns[0]).toMatchObject({ calls: [], outcome: 'fallback', modelCalls: 0, route: `fallback:${reason}` });
  });

  it('asks for no allowance when the router answers: a direct answer costs nothing', async () => {
    const { usage, service } = build();
    usage.allow = { allowed: false, reason: 'budget' };
    const result = await service.send(ANON, { message: 'when do I get paid', surface: 'web' }, NOW, PUBLIC);
    expect(usage.asked).toEqual([]);
    expect(result.conversation.messages.at(-1)?.sources.map((source) => source.id)).toEqual(['when-hosts-are-paid']);
  });

  it('labels who asked: operator, staff on the admin console, or signed in', async () => {
    const { usage, service } = build();
    await service.send(OWNER, { message: 'explain which rooms I should sell first', surface: 'app' }, NOW, OPERATOR);
    await service.send({ kind: 'user', userId: 'staff-1' }, { message: 'explain how listing approval works', surface: 'admin' }, NOW, PUBLIC);
    await service.send({ kind: 'user', userId: GUEST_A }, { message: 'explain how listing approval works', surface: 'web' }, NOW, PUBLIC);
    expect(usage.turns.map((t) => [t.callerRole, t.userId])).toEqual([
      ['operator', 'owner-1'],
      ['staff', 'staff-1'],
      ['signed_in', GUEST_A],
    ]);
  });
});

describe('UsageLedger (ADR-061 D-s)', () => {
  function ledger(fail = false): { ledger: UsageLedger; inserted: UsageRow[][]; logged: TurnRow[] } {
    const inserted: UsageRow[][] = [];
    const logged: TurnRow[] = [];
    const repo = {
      insert: (rows: UsageRow[]) => (fail ? Promise.reject(new Error('db down')) : (inserted.push(rows), Promise.resolve())),
      insertTurn: (row: TurnRow) => (logged.push(row), Promise.resolve()),
      month: () => Promise.resolve({ usage: [], turns: [], tools: [] }),
      monthCostMicroUsd: () => Promise.resolve(0),
      aiTurnsSince: () => Promise.resolve(0),
      popularRoutes: () => Promise.resolve(new Map<string, number>()),
    };
    return { ledger: new UsageLedger(DEFAULT_PRICES, { monthlyBudgetUsd: null, aiTurnsPerDay: 30 }, repo), inserted, logged };
  }
  const turn: TurnUsage = {
    calls: [
      { model: 'claude-sonnet-5-5', usage: { inputTokens: 1000, outputTokens: 500, cacheReadTokens: 4000, cacheWriteTokens: 2000 } },
      { model: 'claude-sonnet-5-5', usage: { inputTokens: 10, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 } },
    ],
    route: 'ai:analysis',
    outcome: 'answered',
    modelCalls: 2,
    modelToolCalls: 1,
    tools: ['search_help', 'rooms_on_dates'],
    durationMs: 1234.6,
    conversationId: 'c1',
    messageId: 'm1',
    userId: 'u1',
    surface: 'app',
    callerRole: 'operator',
    now: NOW,
  };

  it('stores one priced row per call and one turn row with its totals, path, calls and tools', async () => {
    const { ledger: l, inserted, logged } = ledger();
    await l.recordTurn(turn);
    expect(inserted[0].map((r) => r.estimatedCostMicroUsd)).toEqual([12_800, 20]);
    expect(inserted[0][0]).toMatchObject({ conversationId: 'c1', messageId: 'm1', userId: 'u1', requestType: 'ai:analysis', callerRole: 'operator', createdAt: NOW });
    expect(logged).toEqual([
      {
        conversationId: 'c1',
        messageId: 'm1',
        surface: 'app',
        callerRole: 'operator',
        route: 'ai:analysis',
        outcome: 'answered',
        modelCalls: 2,
        modelToolCalls: 1,
        tools: ['search_help', 'rooms_on_dates'],
        inputTokens: 1010,
        outputTokens: 500,
        cacheReadTokens: 4000,
        cacheWriteTokens: 2000,
        estimatedCostMicroUsd: 12_820,
        durationMs: 1235,
        createdAt: NOW,
      },
    ]);
    // The turn row names no person.
    expect(logged[0]).not.toHaveProperty('userId');
  });

  it('logs a turn that stored no answer as failed, with what it spent', async () => {
    const { ledger: l, logged } = ledger();
    await l.recordTurn({ ...turn, outcome: 'failed', messageId: null });
    expect(logged[0]).toMatchObject({ outcome: 'failed', messageId: null, modelCalls: 2, estimatedCostMicroUsd: 12_820 });
  });

  it('never fails the turn when the ledger cannot be written', async () => {
    const logged = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { ledger: l } = ledger(true);
    await expect(l.recordTurn(turn)).resolves.toBeUndefined();
    // The gap is visible in the logs, not silently lost.
    expect(logged).toHaveBeenCalledWith(expect.stringContaining('Assistant usage not recorded (2 model calls, route ai:analysis)'));
    logged.mockRestore();
  });
});

describe('the allowance (ADR-061 D-t)', () => {
  function ledgerWith(options: { budgetUsd?: number | null; spentMicro?: number; turns?: number }): {
    ledger: UsageLedger;
    turnQueries: unknown[];
  } {
    const turnQueries: unknown[] = [];
    const repo = {
      insert: () => Promise.resolve(),
      insertTurn: () => Promise.resolve(),
      month: () => Promise.resolve({ usage: [], turns: [], tools: [] }),
      monthCostMicroUsd: () => Promise.resolve(options.spentMicro ?? 0),
      aiTurnsSince: (input: unknown) => {
        turnQueries.push(input);
        return Promise.resolve(options.turns ?? 0);
      },
      popularRoutes: () => Promise.resolve(new Map<string, number>()),
    };
    const limits = { monthlyBudgetUsd: options.budgetUsd ?? null, aiTurnsPerDay: 30 };
    return { ledger: new UsageLedger(DEFAULT_PRICES, limits, repo), turnQueries };
  }
  const who = { userId: 'u1', conversationId: 'c1', now: new Date('2026-10-01T21:30:00Z') };

  it('allows the model with no ceiling set and the day under its cap', async () => {
    expect(await ledgerWith({ spentMicro: 9_999_999_999, turns: 29 }).ledger.allowance(who)).toEqual({ allowed: true });
  });

  it('refuses once the month reaches the budget, and warns at 80% and 100% once each', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    // A US$10 budget is 10,000,000 micro dollars.
    expect(await ledgerWith({ budgetUsd: 10, spentMicro: 7_900_000 }).ledger.allowance(who)).toEqual({ allowed: true });
    expect(warn).not.toHaveBeenCalled();
    const near = ledgerWith({ budgetUsd: 10, spentMicro: 8_000_000 }).ledger;
    expect(await near.allowance(who)).toEqual({ allowed: true });
    await near.allowance(who);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain('ASSISTANT_BUDGET 80% of the 2026-10 assistant budget used: an estimated US$8.00 of US$10.00');
    const full = ledgerWith({ budgetUsd: 10, spentMicro: 10_000_000 }).ledger;
    expect(await full.allowance(who)).toEqual({ allowed: false, reason: 'budget' });
    await full.allowance(who);
    expect(warn).toHaveBeenCalledTimes(2);
    expect(String(warn.mock.calls[1][0])).toMatch(/^ASSISTANT_BUDGET 100%.*answers fall back/);
    warn.mockRestore();
  });

  it('refuses past the daily cap, counted from the start of the Kigali day', async () => {
    const { ledger: l, turnQueries } = ledgerWith({ turns: 30 });
    expect(await l.allowance(who)).toEqual({ allowed: false, reason: 'daily_cap' });
    // 21:30 UTC on 1 October is 23:30 in Kigali, a day that began at 22:00 UTC on 30 September.
    expect(turnQueries).toEqual([{ userId: 'u1', conversationId: null, since: new Date('2026-09-30T22:00:00Z') }]);
  });

  it('counts a signed out person by their conversation', async () => {
    const { ledger: l, turnQueries } = ledgerWith({});
    await l.allowance({ ...who, userId: null, now: new Date('2026-10-01T22:30:00Z') });
    expect(turnQueries).toEqual([{ userId: null, conversationId: 'c1', since: new Date('2026-10-01T22:00:00Z') }]);
  });
});

describe('the monthly report (ADR-061 D-s)', () => {
  it('adds the month up, in micro dollars, and splits answers and turns by how they were produced and ended', () => {
    const report = buildUsageReport({
      month: '2026-10',
      prices: DEFAULT_PRICES,
      usage: [
        { request_type: 'ai:open', caller_role: 'anonymous', model: 'claude-sonnet-5-5', requests: 3, input_tokens: '300', output_tokens: '90', cache_read_tokens: '0', cache_write_tokens: '0', cost_micro_usd: '1500' },
        { request_type: 'ai:analysis', caller_role: 'operator', model: 'claude-sonnet-5-5', requests: '2', input_tokens: '100', output_tokens: '10', cache_read_tokens: '4000', cache_write_tokens: '2000', cost_micro_usd: '6000100' },
      ],
      turns: [
        { route: 'direct:knowledge', outcome: 'answered', calls: 0, no_own_tools: true, turns: 7 },
        { route: 'direct:trips', outcome: 'answered', calls: '0', no_own_tools: true, turns: '2' },
        { route: 'ai:open', outcome: 'answered', calls: 1, no_own_tools: true, turns: 2 },
        { route: 'ai:open', outcome: 'truncated', calls: 2, no_own_tools: false, turns: 1 },
        { route: 'ai:analysis', outcome: 'step_limit', calls: 3, no_own_tools: false, turns: 1 },
        { route: 'fallback:budget', outcome: 'fallback', calls: 0, no_own_tools: true, turns: 1 },
        { route: 'ai:open', outcome: 'failed', calls: 1, no_own_tools: true, turns: 1 },
      ],
      tools: [
        { tool: 'search_help', runs: 9 },
        { tool: 'my_trips', runs: '2' },
      ],
    });
    expect(report).toMatchObject({
      month: '2026-10',
      from: '2026-10-01T00:00:00.000Z',
      to: '2026-11-01T00:00:00.000Z',
      modelRequests: 5,
      tokens: { input: 400, output: 100, cacheRead: 4000, cacheWrite: 2000 },
      estimatedCostUsd: 6.0016,
      answers: { direct: 9, ai: 4, fallback: 1, total: 14 },
      turns: {
        total: 15,
        byOutcome: { answered: 11, fallback: 1, withheld: 0, truncated: 1, out_of_time: 0, step_limit: 1, refused: 0, failed: 1 },
        // The failed turn made a call too: it counts here, not in the answers.
        modelCallsPerModelTurn: { one: 3, two: 1, threeOrMore: 1 },
        modelTurnsWithoutOwnToolCalls: 2,
        tools: [
          { tool: 'search_help', runs: 9 },
          { tool: 'my_trips', runs: 2 },
        ],
      },
    });
    // Largest cost first.
    expect(report.byRequestType.map((s) => s.requestType)).toEqual(['ai:analysis', 'ai:open']);
    expect(report.byCallerRole).toEqual([
      { callerRole: 'operator', modelRequests: 2, estimatedCostUsd: 6.0001 },
      { callerRole: 'anonymous', modelRequests: 3, estimatedCostUsd: 0.0015 },
    ]);
  });

  it('refuses a month that is not YYYY-MM', () => {
    expect(() => buildUsageReport({ month: '2026-13', prices: DEFAULT_PRICES, usage: [], turns: [], tools: [] })).toThrow(/YYYY-MM/);
  });
});
