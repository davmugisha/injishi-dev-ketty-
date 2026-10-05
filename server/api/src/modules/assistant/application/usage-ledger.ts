import { Inject, Injectable, Logger } from '@nestjs/common';

import {
  type CallerRole,
  type ModelPrices,
  type ModelUsage,
  estimateCostMicroUsd,
} from '../domain/usage';
import type { AssistantLimits } from '../infrastructure/assistant.config';
import { UsageRepository } from '../infrastructure/usage.repository';
import { buildUsageReport, kigaliDayStart, monthOf, type TurnOutcome, type UsageReport } from '../infrastructure/usage-queries';

/** The prices resolved at boot (D-s), bound in `assistant.module.ts`. */
export const ASSISTANT_PRICES = Symbol('ASSISTANT_PRICES');
/** The spending limits resolved at boot (D-t), bound in `assistant.module.ts`. */
export const ASSISTANT_LIMITS = Symbol('ASSISTANT_LIMITS');

/** Whether the model may be called for this turn (D-t), and if not, why. */
export type Allowance = { allowed: true } | { allowed: false; reason: 'budget' | 'daily_cap' };

export interface AllowanceInput {
  userId: string | null;
  conversationId: string | null;
  now: Date;
}

/** One model call and the tokens it reported. */
export interface MeteredCall {
  model: string;
  usage: ModelUsage;
}

/** Everything one user turn spent, how it ended, and what it stored. */
export interface TurnUsage {
  /** The calls that reported usage. */
  calls: MeteredCall[];
  /** The path that answered (D-q): the usage rows' request type. */
  route: string;
  /** How the turn ended (D-s); `failed` means nothing was stored. */
  outcome: TurnOutcome;
  /** Model calls attempted, metered or not (a failed call reports none). */
  modelCalls: number;
  /** Tool calls the model itself asked for. */
  modelToolCalls: number;
  /** Every tool run in the turn, by the router, the gathering or the model. */
  tools: string[];
  durationMs: number;
  conversationId: string | null;
  /** The stored answer, when there is one. */
  messageId: string | null;
  userId: string | null;
  surface: string;
  callerRole: CallerRole;
  now: Date;
}

/** What `AssistantService` needs from the ledger; tests pass a fake. */
export interface UsageSink {
  recordTurn(turn: TurnUsage): Promise<void>;
  allowance(input: AllowanceInput): Promise<Allowance>;
}

/**
 * The usage ledger (ADR-061 D-s): one row per model call with its tokens and
 * estimated cost, and one row per user turn: the path that answered, how it
 * ended, the calls and tools it used, its tokens, cost and duration.
 *
 * It also decides whether the model may be called (D-t): not once the month's
 * estimated cost reaches the budget, and not past the daily cap of model
 * answered turns. A warning tagged `ASSISTANT_BUDGET` is logged once per month
 * per process at 80% and at 100%.
 *
 * Recording never fails a turn. The person already has an answer, and a
 * ledger write that fails is logged at error level, so a gap in the month's
 * figures is visible in the logs rather than turned into a refused question.
 */
@Injectable()
export class UsageLedger implements UsageSink {
  private readonly logger = new Logger(UsageLedger.name);
  /** `YYYY-MM:80` and `YYYY-MM:100` once warned, so the log says it once. */
  private readonly warned = new Set<string>();

  constructor(
    @Inject(ASSISTANT_PRICES) private readonly prices: ModelPrices,
    @Inject(ASSISTANT_LIMITS) private readonly limits: AssistantLimits,
    @Inject(UsageRepository)
    private readonly repo: Pick<UsageRepository, 'insert' | 'insertTurn' | 'month' | 'monthCostMicroUsd' | 'aiTurnsSince'>,
  ) {}

  async allowance(input: AllowanceInput): Promise<Allowance> {
    if (this.limits.monthlyBudgetUsd !== null) {
      const budget = Math.round(this.limits.monthlyBudgetUsd * 1_000_000);
      const spent = await this.repo.monthCostMicroUsd(input.now);
      if (spent >= budget * 0.8) this.warnBudget(monthOf(input.now), spent, budget);
      if (spent >= budget) return { allowed: false, reason: 'budget' };
    }
    const turns = await this.repo.aiTurnsSince({
      userId: input.userId,
      conversationId: input.userId ? null : input.conversationId,
      since: kigaliDayStart(input.now),
    });
    if (turns >= this.limits.aiTurnsPerDay) return { allowed: false, reason: 'daily_cap' };
    return { allowed: true };
  }

  private warnBudget(month: string, spent: number, budget: number): void {
    const level = spent >= budget ? 100 : 80;
    const key = `${month}:${level}`;
    if (this.warned.has(key)) return;
    this.warned.add(key);
    if (level === 100) this.warned.add(`${month}:80`);
    const usd = (micro: number): string => (micro / 1_000_000).toFixed(2);
    this.logger.warn(
      `ASSISTANT_BUDGET ${level}% of the ${month} assistant budget used: an estimated US$${usd(spent)} of US$${usd(budget)}.` +
        (level === 100 ? ' The model is not called until the month turns; answers fall back (ADR-061 D-u).' : ''),
    );
  }

  async recordTurn(turn: TurnUsage): Promise<void> {
    try {
      const rows = turn.calls.map((call) => ({
        conversationId: turn.conversationId,
        messageId: turn.messageId,
        userId: turn.userId,
        surface: turn.surface,
        callerRole: turn.callerRole,
        requestType: turn.route,
        model: call.model,
        ...call.usage,
        estimatedCostMicroUsd: estimateCostMicroUsd(call.usage, this.prices),
        createdAt: turn.now,
      }));
      await this.repo.insert(rows);
      const sum = (pick: (row: (typeof rows)[number]) => number): number => rows.reduce((total, row) => total + pick(row), 0);
      await this.repo.insertTurn({
        conversationId: turn.conversationId,
        messageId: turn.messageId,
        surface: turn.surface,
        callerRole: turn.callerRole,
        route: turn.route,
        outcome: turn.outcome,
        modelCalls: turn.modelCalls,
        modelToolCalls: turn.modelToolCalls,
        tools: turn.tools,
        inputTokens: sum((r) => r.inputTokens),
        outputTokens: sum((r) => r.outputTokens),
        cacheReadTokens: sum((r) => r.cacheReadTokens),
        cacheWriteTokens: sum((r) => r.cacheWriteTokens),
        estimatedCostMicroUsd: sum((r) => r.estimatedCostMicroUsd),
        durationMs: Math.max(0, Math.round(turn.durationMs)),
        createdAt: turn.now,
      });
    } catch (error) {
      this.logger.error(
        `Assistant usage not recorded (${turn.calls.length} model calls, route ${turn.route}): ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /** The month's report, `YYYY-MM` in UTC. */
  async report(month: string): Promise<UsageReport> {
    const { usage, turns, tools } = await this.repo.month(month);
    return buildUsageReport({ month, prices: this.prices, usage, turns, tools });
  }
}
