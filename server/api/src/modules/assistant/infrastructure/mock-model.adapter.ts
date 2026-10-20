import type {
  AssistantModelPort,
  ModelBlock,
  ModelMessage,
  ModelTurn,
  ModelTurnRequest,
} from '../domain/model-port';
import {
  HOW_TO_QUESTION,
  HUMAN_QUESTION,
  PRICE_CHANGE,
  PUBLISH_QUESTION,
  ROOMS_QUESTION,
  STAY_QUESTION,
  TRIP_QUESTION,
} from '../domain/intents';
import {
  CANNOT_CHANGE,
  ESCALATION_OFFERED,
  NO_ANSWER,
  NO_LISTINGS,
  NO_OPERATOR,
  NO_TRIPS,
  SIGN_IN_FOR_TRIPS,
  guideAnswer,
  knowledgeAnswer,
  listingsAnswer,
  proposalAnswer,
  publishBlockersAnswer,
  roomsAnswer,
  tripsAnswer,
} from '../application/answer-templates';
import { GATHERED_HEADING } from '../application/context-window';
import { listingSearchOf } from '../application/request-router';
import type { ModelUsage } from '../domain/usage';

// The fixed sentences, kept under their mock names for the tests that read them.
export const MOCK_NO_ANSWER = NO_ANSWER;
export const MOCK_NO_LISTINGS = NO_LISTINGS;
export const MOCK_SIGN_IN = SIGN_IN_FOR_TRIPS;
export const MOCK_NO_TRIPS = NO_TRIPS;
export const MOCK_NO_OPERATOR = NO_OPERATOR;
export const MOCK_CANNOT_CHANGE = CANNOT_CHANGE;
export const MOCK_ESCALATION_OFFERED = ESCALATION_OFFERED;

/**
 * The deterministic stand in for the model (ADR-061 D-b, `mock` mode).
 *
 * It does what the system prompt asks of the real model, mechanically. A
 * question about places to stay goes to `search_listings` when that tool is
 * offered; anything else goes to `search_help`. It then answers from the top
 * results with citations, or says it has nothing verified. Tests, CI and
 * laptops get the whole loop (tools, citations, storage, limits) with no key
 * and the same answer every time.
 *
 * Since the request router (ADR-061 D-q) it is reached only by questions the
 * router hands to the model. It reads the same intent rules and words results
 * with the same templates, so the two never disagree.
 *
 * It reports usage estimated at four characters a token, under the model name
 * `mock`, so the ledger, the report and the budget (D-s, D-t) run end to end on
 * a laptop. A real call's usage comes only from the provider.
 */
export class MockAssistantModel implements AssistantModelPort {
  readonly kind = 'mock' as const;

  async createTurn(request: ModelTurnRequest): Promise<ModelTurn> {
    const turn = await this.reply(request);
    return { ...turn, usage: estimatedUsage(request, turn) };
  }

  private reply(request: ModelTurnRequest): Promise<ModelTurn> {
    const last = request.messages.at(-1);
    const results = last ? toolResultsIn(last) : [];

    if (results.length === 0) {
      const message = last ? textIn(last) : '';
      // The rules read the current question only, never the gathered data or
      // the window around it, as a model reads the question it is asked.
      const question = currentQuestion(message);
      if (!question) return Promise.resolve(answer(MOCK_NO_ANSWER));
      const offers = (name: string): boolean => request.tools.some((t) => t.name === name);
      if (HUMAN_QUESTION.test(question) && offers('suggest_human_support') && request.toolChoice !== 'none') {
        return Promise.resolve(call(request, 'suggest_human_support', { topic: 'other' }));
      }
      // What the router gathered answers in this one call (D-x), as the
      // system prompt asks of the real model.
      const fromData = answerFromGathered(message, HOW_TO_QUESTION.test(question));
      if (fromData) return Promise.resolve(answer(fromData));
      // The last call may not ask for a tool (D-x).
      if (request.toolChoice === 'none') return Promise.resolve(answer(MOCK_NO_ANSWER));
      const priceChange = question.match(PRICE_CHANGE);
      if (priceChange) {
        if (!offers('propose_room_price')) return Promise.resolve(answer(MOCK_CANNOT_CHANGE));
        const amounts = [...question.matchAll(/\d[\d,]*/g)].map((m) => Number(m[0].replace(/,/g, '')));
        return Promise.resolve(
          call(request, 'propose_room_price', { roomTypeName: priceChange[1].trim(), newPriceRwf: amounts.at(-1) ?? 0 }),
        );
      }
      if (PUBLISH_QUESTION.test(question) && offers('publish_blockers')) {
        return Promise.resolve(call(request, 'publish_blockers', {}));
      }
      if (ROOMS_QUESTION.test(question)) {
        if (!offers('rooms_on_dates')) return Promise.resolve(answer(MOCK_NO_OPERATOR));
        return Promise.resolve(call(request, 'rooms_on_dates', { from: dateIn(question) }));
      }
      if (HOW_TO_QUESTION.test(question) && offers('get_task_guide')) {
        return Promise.resolve(call(request, 'get_task_guide', { query: question.slice(0, 200) }));
      }
      if (TRIP_QUESTION.test(question)) {
        if (!offers('my_trips')) return Promise.resolve(answer(MOCK_SIGN_IN));
        return Promise.resolve(call(request, 'my_trips', {}));
      }
      if (STAY_QUESTION.test(question)) {
        return Promise.resolve(call(request, 'search_listings', listingSearchOf(question).input));
      }
      if (!offers('search_help')) return Promise.resolve(answer(MOCK_NO_ANSWER));
      return Promise.resolve(call(request, 'search_help', { query: question.slice(0, 200) }));
    }

    const parsed = parse(results[0]);
    const called = calledTool(request);
    if (called === 'suggest_human_support' && parsed && 'offered' in parsed) {
      return Promise.resolve(answer(MOCK_ESCALATION_OFFERED));
    }
    const content = typeof results[0].content === 'string' ? results[0].content : '';
    if (called === 'propose_room_price' && parsed && 'proposalId' in parsed) {
      return Promise.resolve(answer(proposalAnswer(content) ?? MOCK_NO_ANSWER));
    }
    if (called === 'get_task_guide') {
      const guide = guideAnswer(content)?.text;
      if (guide) return Promise.resolve(answer(guide));
      // No guide for it: look in the help articles, as the system prompt asks
      // of the real model, rather than giving up.
      const asked = currentQuestion(textIn(request.messages[0]));
      if (request.toolChoice !== 'none' && request.tools.some((t) => t.name === 'search_help')) {
        return Promise.resolve(call(request, 'search_help', { query: asked.slice(0, 200) }));
      }
      return Promise.resolve(answer(MOCK_NO_ANSWER));
    }
    if (called === 'rooms_on_dates') {
      return Promise.resolve(answer(roomsAnswer(content) ?? MOCK_NO_ANSWER));
    }
    if (called === 'publish_blockers') {
      return Promise.resolve(answer(publishBlockersAnswer(content) ?? MOCK_NO_ANSWER));
    }
    if (results[0].is_error === true && typeof results[0].content === 'string') {
      const error = (JSON.parse(results[0].content) as { error?: string }).error;
      return Promise.resolve(answer(error ?? MOCK_NO_ANSWER));
    }
    if (called === 'my_trips') {
      return Promise.resolve(answer(tripsAnswer(content) ?? MOCK_NO_TRIPS));
    }
    if (calledTool(request) === 'search_listings') {
      return Promise.resolve(answer(listingsAnswer(content, listingSearchOf(currentQuestion(textIn(request.messages[0]))).place) ?? MOCK_NO_LISTINGS));
    }
    const top = (parsed?.results as Array<{ id?: unknown; summary?: unknown }> | undefined)?.[0];
    if (!top || typeof top.id !== 'string' || typeof top.summary !== 'string') {
      return Promise.resolve(answer(MOCK_NO_ANSWER));
    }
    return Promise.resolve(answer(`${top.summary} [source:${top.id}]`));
  }
}

/** The text after the last "Current question:" line, or the whole message. */
function currentQuestion(message: string): string {
  const marker = '\nCurrent question:\n';
  const at = message.lastIndexOf(marker);
  return (at >= 0 ? message.slice(at + marker.length) : message).trim();
}

/**
 * An answer worded from the data gathered before the call, when it holds
 * enough: a data tool's result first, then the task guide and the top help
 * article (the guide first for a "how do I"), each with the same template the router and the tool path use.
 */
function answerFromGathered(message: string, howTo: boolean): string | null {
  if (!message.startsWith(GATHERED_HEADING)) return null;
  const results = new Map<string, string>();
  for (const line of message.split('\n')) {
    const match = /^\[([a-z_]+)\] (.*)$/.exec(line);
    if (match) results.set(match[1], match[2]);
  }
  const wording: Array<[string, (content: string) => string | null]> = [
    ['rooms_on_dates', roomsAnswer],
    ['my_trips', tripsAnswer],
    ['search_listings', listingsAnswer],
    ['publish_blockers', publishBlockersAnswer],
    // A "how do I" is answered by the guide's steps, anything else by the article.
    ...((howTo
      ? [['get_task_guide', (content: string) => guideAnswer(content)?.text ?? null], ['search_help', knowledgeAnswer]]
      : [['search_help', knowledgeAnswer], ['get_task_guide', (content: string) => guideAnswer(content)?.text ?? null]]) as Array<[string, (content: string) => string | null]>),
  ];
  for (const [tool, word] of wording) {
    const content = results.get(tool);
    const text = content === undefined ? null : word(content);
    if (text) return text;
  }
  return null;
}

/** About four characters a token, the usual rule of thumb for English text. */
function estimatedUsage(request: ModelTurnRequest, turn: ModelTurn): ModelUsage {
  const tokens = (value: unknown): number => Math.ceil(JSON.stringify(value).length / 4);
  return {
    inputTokens: tokens([request.system, request.tools, request.messages]),
    outputTokens: tokens(turn.content),
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  };
}

function call(request: ModelTurnRequest, name: string, input: Record<string, unknown>): ModelTurn {
  return {
    content: [{ type: 'tool_use', id: `toolu_mock_${request.messages.length}`, name, input }],
    stopReason: 'tool_use',
    model: 'mock',
  };
}

function answer(text: string): ModelTurn {
  return { content: [{ type: 'text', text }], stopReason: 'end_turn', model: 'mock' };
}

/** The first yyyy-mm-dd in the question, or 2026-10-10 as the mock's "today". */
function dateIn(question: string): string {
  return question.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? '2026-10-10';
}

function textIn(message: ModelMessage): string {
  return message.content
    .filter((b) => b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text as string)
    .join(' ')
    .trim();
}

function toolResultsIn(message: ModelMessage): ModelBlock[] {
  return message.role === 'user' ? message.content.filter((b) => b.type === 'tool_result') : [];
}

/** The tool the previous assistant message called. */
function calledTool(request: ModelTurnRequest): string | null {
  const previous = request.messages.at(-2);
  const use = previous?.content.find((b) => b.type === 'tool_use');
  return typeof use?.name === 'string' ? use.name : null;
}

function parse(result: ModelBlock): { results?: unknown[] } | null {
  if (result.is_error || typeof result.content !== 'string') return null;
  try {
    return JSON.parse(result.content) as { results?: unknown[] };
  } catch {
    return null;
  }
}
