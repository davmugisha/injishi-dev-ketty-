/**
 * The usage ledger's SQL and its monthly report (ADR-061 D-s), as plain text
 * and values.
 *
 * Nothing but erasable types and one type only import, on purpose, as
 * `retention-queries.ts`: the API runs this through its pool, while
 * `scripts/assistant-usage.mjs` and the slice I oracle import the SAME file
 * under Node's type stripping, the oracle against a fresh Postgres with every
 * migration replayed. A copy of the SQL for either would prove only the copy.
 *
 * A month is a UTC calendar month, as the provider bills.
 */
import type { ModelPrices } from '../domain/usage';

export interface UsageQuery {
  text: string;
  values: unknown[];
}

/** One model call, ready to store. */
export interface UsageRow {
  conversationId: string | null;
  messageId: string | null;
  userId: string | null;
  surface: string;
  callerRole: string;
  requestType: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  estimatedCostMicroUsd: number;
  createdAt: Date;
}

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** `YYYY-MM` as the instants it covers: from its first moment to the next month's. */
export function monthRange(month: string): { from: Date; to: Date } {
  const match = MONTH.exec(month);
  if (!match) throw new Error(`A month is written YYYY-MM; got "${month}".`);
  const year = Number(match[1]);
  const index = Number(match[2]) - 1;
  return { from: new Date(Date.UTC(year, index, 1)), to: new Date(Date.UTC(year, index + 1, 1)) };
}

/** The UTC month an instant falls in, as `YYYY-MM`. */
export function monthOf(now: Date): string {
  return now.toISOString().slice(0, 7);
}

const USAGE_COLUMNS = [
  'conversation_id',
  'message_id',
  'user_id',
  'surface',
  'caller_role',
  'request_type',
  'model',
  'input_tokens',
  'output_tokens',
  'cache_read_tokens',
  'cache_write_tokens',
  'estimated_cost_micro_usd',
  'created_at',
];

/** Every call of one turn, in one statement. */
export function insertUsage(rows: UsageRow[]): UsageQuery {
  const values: unknown[] = [];
  const tuples = rows.map((row) => {
    const start = values.length;
    values.push(
      row.conversationId,
      row.messageId,
      row.userId,
      row.surface,
      row.callerRole,
      row.requestType,
      row.model,
      row.inputTokens,
      row.outputTokens,
      row.cacheReadTokens,
      row.cacheWriteTokens,
      row.estimatedCostMicroUsd,
      row.createdAt,
    );
    return `(${USAGE_COLUMNS.map((_, i) => `$${start + i + 1}`).join(', ')})`;
  });
  return {
    text: `INSERT INTO assistant_model_usage (${USAGE_COLUMNS.join(', ')}) VALUES ${tuples.join(', ')}`,
    values,
  };
}

/** How a turn ended (D-s); `failed` means nothing was stored. */
export type TurnOutcome = 'answered' | 'fallback' | 'withheld' | 'truncated' | 'out_of_time' | 'step_limit' | 'refused' | 'failed';
export const TURN_OUTCOMES: readonly TurnOutcome[] = ['answered', 'fallback', 'withheld', 'truncated', 'out_of_time', 'step_limit', 'refused', 'failed'];

/** One user turn, ready to store (D-s). No person, no text. */
export interface TurnRow {
  conversationId: string | null;
  messageId: string | null;
  surface: string;
  callerRole: string;
  route: string;
  outcome: TurnOutcome;
  /** Model calls attempted, whether or not they reported usage. */
  modelCalls: number;
  /** Tool calls the model itself asked for (gathered and router tools excluded). */
  modelToolCalls: number;
  /** Every tool run in the turn, by name, in order. */
  tools: string[];
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  estimatedCostMicroUsd: number;
  durationMs: number;
  createdAt: Date;
}

/**
 * A text array as ONE Postgres array literal. Passed as a JavaScript array,
 * Drizzle's sql template expands it into a list of parameters, and the insert
 * fails (found in the 2026-10-01 walk); the literal is one bound value.
 */
export function textArray(values: string[]): string {
  return `{${values.map((v) => `"${v.replace(/["\\]/g, '\\$&')}"`).join(',')}}`;
}

/** One turn's row. */
export function insertTurn(row: TurnRow): UsageQuery {
  return {
    text: `INSERT INTO assistant_turns (conversation_id, message_id, surface, caller_role, route, outcome,
             model_calls, model_tool_calls, tools, input_tokens, output_tokens, cache_read_tokens,
             cache_write_tokens, estimated_cost_micro_usd, duration_ms, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::text[], $10, $11, $12, $13, $14, $15, $16)`,
    values: [
      row.conversationId,
      row.messageId,
      row.surface,
      row.callerRole,
      row.route,
      row.outcome,
      row.modelCalls,
      row.modelToolCalls,
      textArray(row.tools),
      row.inputTokens,
      row.outputTokens,
      row.cacheReadTokens,
      row.cacheWriteTokens,
      row.estimatedCostMicroUsd,
      row.durationMs,
      row.createdAt,
    ],
  };
}

/** The month's calls, grouped finely enough to build every total from. */
export function monthUsage(month: string): UsageQuery {
  const { from, to } = monthRange(month);
  return {
    text: `SELECT request_type, caller_role, model,
                  count(*)::int AS requests,
                  coalesce(sum(input_tokens), 0)::bigint AS input_tokens,
                  coalesce(sum(output_tokens), 0)::bigint AS output_tokens,
                  coalesce(sum(cache_read_tokens), 0)::bigint AS cache_read_tokens,
                  coalesce(sum(cache_write_tokens), 0)::bigint AS cache_write_tokens,
                  coalesce(sum(estimated_cost_micro_usd), 0)::bigint AS cost_micro_usd
             FROM assistant_model_usage
            WHERE created_at >= $1 AND created_at < $2
         GROUP BY request_type, caller_role, model`,
    values: [from, to],
  };
}

/**
 * The month's turns, grouped by what the report counts: the route, the
 * outcome, the model calls (three or more as one bucket) and whether the
 * model asked for no tool of its own.
 */
export function monthTurns(month: string): UsageQuery {
  const { from, to } = monthRange(month);
  return {
    text: `SELECT route, outcome, least(model_calls, 3)::int AS calls, (model_tool_calls = 0) AS no_own_tools,
                  count(*)::int AS turns
             FROM assistant_turns
            WHERE created_at >= $1 AND created_at < $2
         GROUP BY route, outcome, least(model_calls, 3), (model_tool_calls = 0)`,
    values: [from, to],
  };
}

/** How often each tool ran in the month's turns. */
export function monthTools(month: string): UsageQuery {
  const { from, to } = monthRange(month);
  return {
    text: `SELECT tool, count(*)::int AS runs
             FROM assistant_turns, unnest(tools) AS tool
            WHERE created_at >= $1 AND created_at < $2
         GROUP BY tool`,
    values: [from, to],
  };
}

/** The month to date's estimated cost, micro dollars, for the budget (D-t). */
export function monthCost(now: Date): UsageQuery {
  const { from, to } = monthRange(monthOf(now));
  return {
    text: `SELECT coalesce(sum(estimated_cost_micro_usd), 0)::bigint AS cost_micro_usd
             FROM assistant_model_usage
            WHERE created_at >= $1 AND created_at < $2`,
    values: [from, to],
  };
}

/** Kigali is UTC+2 all year; it keeps no daylight saving. */
const KIGALI_OFFSET_MS = 2 * 60 * 60_000;
const DAY_MS = 24 * 60 * 60_000;

/** The first instant of the Kigali day an instant falls in. */
export function kigaliDayStart(now: Date): Date {
  const local = now.getTime() + KIGALI_OFFSET_MS;
  return new Date(local - (((local % DAY_MS) + DAY_MS) % DAY_MS) - KIGALI_OFFSET_MS);
}

/**
 * Answers the model gave since an instant (D-t): to a signed in person across
 * every conversation they own, or within one conversation when signed out.
 * Router answers and fallbacks are not model turns and do not count.
 */
export function aiTurnsSince(input: { userId: string | null; conversationId: string | null; since: Date }): UsageQuery | null {
  if (input.userId) {
    return {
      text: `SELECT count(*)::int AS n
               FROM assistant_messages m
               JOIN assistant_conversations c ON c.id = m.conversation_id
              WHERE c.owner_user_id = $1 AND m.role = 'assistant'
                AND m.route LIKE 'ai:%' AND m.created_at >= $2`,
      values: [input.userId, input.since],
    };
  }
  if (input.conversationId) {
    return {
      text: `SELECT count(*)::int AS n
               FROM assistant_messages m
              WHERE m.conversation_id = $1 AND m.role = 'assistant'
                AND m.route LIKE 'ai:%' AND m.created_at >= $2`,
      values: [input.conversationId, input.since],
    };
  }
  // A signed out person with no conversation yet has had no turns.
  return null;
}

/** One row of `monthUsage`, as a driver returns it (bigint sums as text). */
export interface MonthUsageRow {
  request_type: string;
  caller_role: string;
  model: string;
  requests: number | string;
  input_tokens: number | string;
  output_tokens: number | string;
  cache_read_tokens: number | string;
  cache_write_tokens: number | string;
  cost_micro_usd: number | string;
}

/** One row of `monthTurns`. */
export interface MonthTurnRow {
  route: string;
  outcome: string;
  calls: number | string;
  no_own_tools: boolean;
  turns: number | string;
}

/** One row of `monthTools`. */
export interface MonthToolRow {
  tool: string;
  runs: number | string;
}

export interface UsageSlice {
  modelRequests: number;
  estimatedCostUsd: number;
}

export interface UsageReport {
  month: string;
  from: string;
  to: string;
  prices: ModelPrices;
  modelRequests: number;
  tokens: { input: number; output: number; cacheRead: number; cacheWrite: number };
  estimatedCostUsd: number;
  answers: { direct: number; ai: number; fallback: number; total: number };
  turns: {
    total: number;
    byOutcome: Record<TurnOutcome, number>;
    /** Turns the model answered, by how many calls they took (D-x). */
    modelCallsPerModelTurn: { one: number; two: number; threeOrMore: number };
    /**
     * Model answered turns where the model asked for no tool of its own: the
     * gathered data was enough. The candidates for a new router rule.
     */
    modelTurnsWithoutOwnToolCalls: number;
    tools: { tool: string; runs: number }[];
  };
  byRequestType: (UsageSlice & { requestType: string })[];
  byCallerRole: (UsageSlice & { callerRole: string })[];
  byModel: (UsageSlice & { model: string })[];
}

/**
 * The monthly report from the three queries' rows. Costs are summed in micro
 * dollars, which are integers, and turned into dollars once per figure, so no
 * rounding error accumulates across rows.
 */
export function buildUsageReport(input: {
  month: string;
  prices: ModelPrices;
  usage: MonthUsageRow[];
  turns: MonthTurnRow[];
  tools: MonthToolRow[];
}): UsageReport {
  const { from, to } = monthRange(input.month);
  const tokens = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  let requests = 0;
  let micro = 0;
  const groups = { requestType: new Map<string, [number, number]>(), callerRole: new Map<string, [number, number]>(), model: new Map<string, [number, number]>() };
  const add = (map: Map<string, [number, number]>, key: string, n: number, cost: number): void => {
    const [r, c] = map.get(key) ?? [0, 0];
    map.set(key, [r + n, c + cost]);
  };
  for (const row of input.usage) {
    const n = Number(row.requests);
    const cost = Number(row.cost_micro_usd);
    requests += n;
    micro += cost;
    tokens.input += Number(row.input_tokens);
    tokens.output += Number(row.output_tokens);
    tokens.cacheRead += Number(row.cache_read_tokens);
    tokens.cacheWrite += Number(row.cache_write_tokens);
    add(groups.requestType, row.request_type, n, cost);
    add(groups.callerRole, row.caller_role, n, cost);
    add(groups.model, row.model, n, cost);
  }
  const answers = { direct: 0, ai: 0, fallback: 0, total: 0 };
  const byOutcome = Object.fromEntries(TURN_OUTCOMES.map((o) => [o, 0])) as Record<TurnOutcome, number>;
  const perModelTurn = { one: 0, two: 0, threeOrMore: 0 };
  let totalTurns = 0;
  let withoutOwnTools = 0;
  for (const row of input.turns) {
    const n = Number(row.turns);
    const calls = Number(row.calls);
    totalTurns += n;
    if (row.outcome in byOutcome) byOutcome[row.outcome as TurnOutcome] += n;
    // A failed turn stored no answer, so it is no answer of any kind.
    if (row.outcome !== 'failed') {
      answers.total += n;
      if (row.route.startsWith('direct:')) answers.direct += n;
      else if (row.route.startsWith('ai:')) answers.ai += n;
      else if (row.route.startsWith('fallback:')) answers.fallback += n;
    }
    if (row.route.startsWith('ai:') && calls >= 1) {
      if (calls === 1) perModelTurn.one += n;
      else if (calls === 2) perModelTurn.two += n;
      else perModelTurn.threeOrMore += n;
      if (row.no_own_tools && row.outcome === 'answered') withoutOwnTools += n;
    }
  }
  const tools = input.tools
    .map((row) => ({ tool: row.tool, runs: Number(row.runs) }))
    .sort((a, b) => b.runs - a.runs || a.tool.localeCompare(b.tool));
  const slices = (map: Map<string, [number, number]>): [string, UsageSlice][] =>
    [...map.entries()]
      .sort((a, b) => b[1][1] - a[1][1] || b[1][0] - a[1][0] || a[0].localeCompare(b[0]))
      .map(([key, [n, cost]]) => [key, { modelRequests: n, estimatedCostUsd: usd(cost) }]);
  return {
    month: input.month,
    from: from.toISOString(),
    to: to.toISOString(),
    prices: input.prices,
    modelRequests: requests,
    tokens,
    estimatedCostUsd: usd(micro),
    answers,
    turns: { total: totalTurns, byOutcome, modelCallsPerModelTurn: perModelTurn, modelTurnsWithoutOwnToolCalls: withoutOwnTools, tools },
    byRequestType: slices(groups.requestType).map(([requestType, s]) => ({ requestType, ...s })),
    byCallerRole: slices(groups.callerRole).map(([callerRole, s]) => ({ callerRole, ...s })),
    byModel: slices(groups.model).map(([model, s]) => ({ model, ...s })),
  };
}

function usd(micro: number): number {
  return micro / 1_000_000;
}
