import type { AssistantSource } from '@injishi/contracts';

import {
  ANALYSIS_QUESTION,
  HOW_TO_QUESTION,
  HUMAN_QUESTION,
  PRICE_CHANGE,
  PUBLISH_QUESTION,
  ROOMS_QUESTION,
  STAY_QUESTION,
  STILL_STUCK,
  TRIP_QUESTION,
  GREETING,
  THANKS,
  VIDEO_QUESTION,
  budgetIn,
  dayIn,
  guestsIn,
  placeIn,
  priceChangeIn,
  vagueTopicIn,
  withoutFilters,
} from '../domain/intents';
import type { MessageRow, ToolCallRecord } from '../infrastructure/conversation.repository';
import {
  CANNOT_ANSWER_NOW,
  CANNOT_CHANGE,
  ESCALATION_OFFERED,
  FALLBACK_ARTICLE,
  NEED_A_DAY,
  NEED_A_PRICE,
  NO_OPERATOR,
  NO_TUTORIAL,
  SIGN_IN_FOR_TRIPS,
  THANKS_REPLY,
  VIDEO_ASK,
  type Abilities,
  clarifyText,
  errorSentence,
  greetingText,
  guideAnswer,
  knowledgeAnswer,
  listingsAnswer,
  proposalAnswer,
  publishBlockersAnswer,
  roomsAnswer,
  tripsAnswer,
  tutorialAnswer,
} from './answer-templates';
import { matchGuide } from './guide-tools';
import { searchKnowledge } from './knowledge-search';
import type { ToolCaller, ToolOutcome } from './tool-types';

/**
 * A help article answers directly only when it matched at least this well (a
 * title word counts 3, a tag 2, a body word 1) AND clearly better than the
 * runner up. Anything weaker is a question the model should read.
 */
export const KNOWLEDGE_MIN_SCORE = 5;
/** A task guide answers a "how do I" directly from a title word match up. */
export const GUIDE_MIN_SCORE = 3;
/**
 * Help articles are gathered for the model (D-q) when the best one matched at
 * least a title word's worth. A weaker match is not worth the tokens.
 */
export const GATHER_KNOWLEDGE_MIN_SCORE = 3;

/** What the router can call: the same permission checked registry the model uses. */
export interface RouterTools {
  offered(caller: ToolCaller): Array<{ name: string }>;
  run(name: string, input: unknown, caller: ToolCaller): Promise<ToolOutcome>;
}

/** Why a question that needs the model is answered without it (D-u). */
export type FallbackReason = 'budget' | 'daily_cap' | 'model_unavailable';

export type RouteDecision =
  | {
      kind: 'direct';
      route: `direct:${string}` | `fallback:${FallbackReason}`;
      text: string;
      /** What the answer may cite: the sources the tools it ran returned. */
      available: AssistantSource[];
      toolCalls: ToolCallRecord[];
    }
  | {
      kind: 'ai';
      route: `ai:${string}`;
      /**
       * What the router already ran for this question, for this caller,
       * through the permission checked registry (D-q): the model's one
       * message carries it (D-r), so it seldom needs a tool call of its own.
       */
      gathered: Gathered[];
    };

/** One tool result gathered before the model call. */
export interface Gathered {
  tool: string;
  outcome: ToolOutcome;
}

export interface RouteInput {
  /** The person's question, already redacted. */
  question: string;
  caller: ToolCaller;
  now: Date;
  /** The conversation so far, for the tutorial follow up. */
  history: MessageRow[];
}

/**
 * The request router (ADR-061 D-q): database first, rules second, knowledge
 * and tutorials third, the model last.
 *
 * It classifies a question with fixed rules and, when a rule matches with
 * confidence, runs that tool through the same registry the model uses (so
 * the same permission checks apply) and words the result from a fixed
 * template. Nothing here calls the model. Everything it does not answer with
 * confidence is handed on as `ai:*`, and the model then reaches data only
 * through the same tools.
 */
export class RequestRouter {
  constructor(private readonly tools: RouterTools) {}

  async route(input: RouteInput): Promise<RouteDecision> {
    const decision = await this.decide(input);
    if (decision.kind === 'direct') return decision;
    const already = new Set(decision.gathered.map((g) => g.tool));
    const more = (await this.gather(input)).filter((g) => !already.has(g.tool));
    return { ...decision, gathered: [...decision.gathered, ...more] };
  }

  /**
   * The resolution order (D-q): rules, then authorized service tools, then
   * the knowledge base, then task guides, then tutorials; the model only when
   * none of them answers completely. Explanation and advice are recognised
   * early because no template answers them completely.
   */
  private async decide(input: RouteInput): Promise<RouteDecision> {
    const { question, caller } = input;
    const offered = new Set(this.tools.offered(caller).map((t) => t.name));

    // Tiers 1 and 2: application rules, and the authorized service tools.
    if (GREETING.test(question)) return direct('direct:greeting', greetingText(abilitiesOf(offered)));
    if (THANKS.test(question)) return direct('direct:thanks', THANKS_REPLY);

    if (HUMAN_QUESTION.test(question) && offered.has('suggest_human_support')) {
      return this.answerFrom('direct:escalation', 'suggest_human_support', { topic: 'other' }, caller, (o) =>
        o.escalation ? ESCALATION_OFFERED : null,
      );
    }

    // "Why can't I publish?" is answered by the live blockers; "how do I
    // publish my property?" asks for the steps, which the guide gives (tier 4).
    const howToPublish = HOW_TO_QUESTION.test(question) && !/\b(why|can'?t|cannot|won'?t|not)\b/i.test(question);
    if (PUBLISH_QUESTION.test(question) && offered.has('publish_blockers') && !howToPublish) {
      return this.answerFrom('direct:publish_blockers', 'publish_blockers', {}, caller, (o) =>
        publishBlockersAnswer(o.content),
      );
    }

    // Explanation, comparison and advice are the model's job, even when a
    // word in them would match a data rule below: "should I change the Double
    // room price to 80,000?" asks for advice, not a card to approve. Publish
    // blockers come first because they ARE the answer to "why can't I publish".
    if (ANALYSIS_QUESTION.test(question)) return { kind: 'ai', route: 'ai:analysis', gathered: [] };

    // "How do I change a room type's price?" asks for the steps (tier 4), not
    // a change: only a price change with an amount is prepared as a card.
    const howToNoAmount = HOW_TO_QUESTION.test(question) && priceChangeIn(question) === null;
    if (PRICE_CHANGE.test(question) && !howToNoAmount) {
      if (!offered.has('propose_room_price')) return direct('direct:price_change', CANNOT_CHANGE);
      const intent = priceChangeIn(question);
      if (!intent) return direct('direct:price_change', NEED_A_PRICE);
      return this.answerFrom('direct:price_change', 'propose_room_price', intent, caller, (o) => proposalAnswer(o.content));
    }

    if (ROOMS_QUESTION.test(question)) {
      if (!offered.has('rooms_on_dates')) return direct('direct:rooms', NO_OPERATOR);
      const day = dayIn(question, input.now);
      if (!day) return direct('direct:rooms', NEED_A_DAY);
      return this.answerFrom('direct:rooms', 'rooms_on_dates', { from: day }, caller, (o) => roomsAnswer(o.content));
    }

    if (TRIP_QUESTION.test(question)) {
      if (!offered.has('my_trips')) return direct('direct:trips', SIGN_IN_FOR_TRIPS);
      return this.answerFrom('direct:trips', 'my_trips', {}, caller, (o) => tripsAnswer(o.content));
    }

    if (STAY_QUESTION.test(question)) {
      const search = listingSearchOf(question);
      return this.answerFrom('direct:listings', 'search_listings', search.input, caller, (o) =>
        listingsAnswer(o.content, search.place),
      );
    }

    // One ambiguous topic word ("booking", "price") would make the help
    // search guess which article was meant: ask instead (tier 1).
    // A single bare word only: "how do I publish my property?" says enough.
    const topic = /^\W*[a-z]+\W*$/i.test(question) ? vagueTopicIn(question) : null;
    if (topic && topic !== 'general') return direct(`direct:clarify_${topic}`, clarifyText(topic, abilitiesOf(offered)));

    // Tier 3, the knowledge base. For a "how do I" a task guide covers, the
    // guide's steps are the complete answer and an article is only
    // background, so the article does not answer it (D-q, "completely").
    const guideCovers = HOW_TO_QUESTION.test(question) && offered.has('get_task_guide') && (matchGuide(question)?.score ?? 0) >= GUIDE_MIN_SCORE;
    const hits = searchKnowledge(question, 2);
    const [top, second] = hits;
    if (!guideCovers && top && top.score >= KNOWLEDGE_MIN_SCORE && (!second || top.score > second.score) && offered.has('search_help')) {
      return this.answerFrom('direct:knowledge', 'search_help', { query: question.slice(0, 200) }, caller, (o) =>
        knowledgeAnswer(o.content),
      );
    }

    // Tier 4, task guides.
    if (HOW_TO_QUESTION.test(question) && offered.has('get_task_guide')) {
      const match = matchGuide(question);
      if (match && match.score >= GUIDE_MIN_SCORE) {
        const outcome = await this.tools.run('get_task_guide', { query: question.slice(0, 200) }, caller);
        const answer = outcome.isError ? null : guideAnswer(outcome.content);
        if (answer) {
          return {
            kind: 'direct',
            route: 'direct:task_guide',
            text: answer.text,
            available: outcome.sources,
            toolCalls: [{ name: 'get_task_guide', ok: true, guideId: answer.guideId }],
          };
        }
      }
    }

    // Tier 5, tutorials: only after a guide's steps, only with a recorded video.
    const guideGiven = lastGuideId(input.history);
    if (guideGiven && (STILL_STUCK.test(question) || VIDEO_QUESTION.test(question))) {
      return this.answerFrom('direct:tutorial', 'find_tutorial', { guideId: guideGiven }, caller, (o) =>
        tutorialAnswer(o.content) ?? NO_TUTORIAL,
      );
    }
    // Steps always come first: a video asked for before any task's steps
    // asks which task, rather than offering a video for nothing.
    if (VIDEO_QUESTION.test(question)) return direct('direct:video_ask', VIDEO_ASK);

    // Too short to answer well ("price"): ask, rather than guess or spend a
    // model call on a guess (tier 1, asked last so every rule had its chance).
    const vague = vagueTopicIn(question);
    if (vague) return direct(`direct:clarify_${vague}`, clarifyText(vague, abilitiesOf(offered)));

    // Tier 6, the model.
    return { kind: 'ai', route: 'ai:open', gathered: [] };
  }

  /**
   * What the model will need, gathered before it is called (D-q): the help
   * articles when one matches at least a title word, the task guide whose
   * title matches, and the one data tool the question's words name. Each runs
   * for this caller through the permission checked registry, so a tool the
   * caller is not offered never runs and only what they may see is gathered.
   * A result that is an error is left out.
   */
  private async gather(input: RouteInput): Promise<Gathered[]> {
    const { question, caller } = input;
    const offered = new Set(this.tools.offered(caller).map((t) => t.name));
    const wanted: Array<{ tool: string; input: unknown }> = [];
    const query = question.slice(0, 200);
    if (offered.has('search_help') && (searchKnowledge(question, 1)[0]?.score ?? 0) >= GATHER_KNOWLEDGE_MIN_SCORE) {
      wanted.push({ tool: 'search_help', input: { query } });
    }
    if (offered.has('get_task_guide') && (matchGuide(question)?.score ?? 0) >= GUIDE_MIN_SCORE) {
      wanted.push({ tool: 'get_task_guide', input: { query } });
    }
    const day = dayIn(question, input.now);
    if (PUBLISH_QUESTION.test(question) && offered.has('publish_blockers')) wanted.push({ tool: 'publish_blockers', input: {} });
    else if (ROOMS_QUESTION.test(question) && day && offered.has('rooms_on_dates')) wanted.push({ tool: 'rooms_on_dates', input: { from: day } });
    else if (TRIP_QUESTION.test(question) && offered.has('my_trips')) wanted.push({ tool: 'my_trips', input: {} });
    else if (STAY_QUESTION.test(question) && offered.has('search_listings')) wanted.push({ tool: 'search_listings', input: listingSearchOf(question).input });

    const gathered: Gathered[] = [];
    for (const want of wanted) {
      const outcome = await this.tools.run(want.tool, want.input, caller);
      if (!outcome.isError) gathered.push({ tool: want.tool, outcome });
    }
    return gathered;
  }

  /**
   * The answer when a question needs the model and the model cannot be used
   * (D-u): the budget or the daily cap is reached, or the provider failed. The
   * closest help article with its source, else the offer of a person, else
   * the support page. Never an error: the person always gets an answer.
   */
  async fallback(question: string, caller: ToolCaller, reason: FallbackReason): Promise<RouteDecision & { kind: 'direct' }> {
    const route = `fallback:${reason}` as const;
    const offered = new Set(this.tools.offered(caller).map((t) => t.name));
    if (offered.has('search_help')) {
      const outcome = await this.tools.run('search_help', { query: question.slice(0, 200) }, caller);
      const article = outcome.isError ? null : knowledgeAnswer(outcome.content);
      if (article) {
        return { kind: 'direct', route, text: `${FALLBACK_ARTICLE} ${article}`, available: outcome.sources, toolCalls: [recordOf('search_help', outcome)] };
      }
    }
    if (offered.has('suggest_human_support')) {
      const outcome = await this.tools.run('suggest_human_support', { topic: 'other' }, caller);
      if (outcome.escalation) {
        return { kind: 'direct', route, text: `${CANNOT_ANSWER_NOW} ${ESCALATION_OFFERED}`, available: [], toolCalls: [recordOf('suggest_human_support', outcome)] };
      }
    }
    return { kind: 'direct', route, text: `${CANNOT_ANSWER_NOW} The support page at /support can help.`, available: [], toolCalls: [] };
  }

  /**
   * Run one tool and word its result. A refusal or error is shown in the
   * tool's own sentence; a result the template cannot word goes to the model.
   */
  private async answerFrom(
    route: `direct:${string}`,
    tool: string,
    toolInput: unknown,
    caller: ToolCaller,
    word: (outcome: ToolOutcome) => string | null,
  ): Promise<RouteDecision> {
    const outcome = await this.tools.run(tool, toolInput, caller);
    const record = recordOf(tool, outcome);
    const text = outcome.isError ? errorSentence(outcome.content) : word(outcome);
    if (!text) return { kind: 'ai', route: 'ai:unworded', gathered: outcome.isError ? [] : [{ tool, outcome }] };
    return { kind: 'direct', route, text, available: outcome.sources, toolCalls: [record] };
  }
}

/** What this caller can get, from the tools they are offered (D-f), never a role name. */
export function abilitiesOf(offered: Set<string>): Abilities {
  return {
    listings: offered.has('search_listings'),
    trips: offered.has('my_trips'),
    operator: offered.has('rooms_on_dates') || offered.has('publish_blockers'),
    priceChange: offered.has('propose_room_price'),
    guides: offered.has('get_task_guide'),
  };
}

/**
 * A stay question as a listing search: the place it names, its budget and
 * its guest count. Only figures the person gave are filters, and the place is
 * searched without them ("hotels under 150000" searches no place called
 * "150000").
 */
export function listingSearchOf(question: string): { input: { query?: string; guests?: number; maxNightlyRwf?: number }; place: string | null } {
  const rest = withoutFilters(question);
  const place = /\b(?:in|near|around)\s+[^?.!,]+/i.test(rest) ? placeIn(rest) : null;
  const query = place ?? rest;
  const guests = guestsIn(question);
  const maxNightlyRwf = budgetIn(question);
  return {
    input: { ...(query ? { query } : {}), ...(guests ? { guests } : {}), ...(maxNightlyRwf ? { maxNightlyRwf } : {}) },
    place,
  };
}

/** How a tool the router ran is recorded on the stored answer. */
function recordOf(tool: string, outcome: ToolOutcome): ToolCallRecord {
  return {
    name: tool,
    ok: !outcome.isError,
    ...(outcome.proposalIds?.length ? { proposalIds: outcome.proposalIds } : {}),
    ...(outcome.escalation ? { escalationTopic: outcome.escalation.topic } : {}),
  };
}

function direct(route: `direct:${string}`, text: string): RouteDecision {
  return { kind: 'direct', route, text, available: [], toolCalls: [] };
}

/** The guide given by the latest assistant answer that gave one. */
function lastGuideId(history: MessageRow[]): string | null {
  for (let i = history.length - 1; i >= 0; i--) {
    const m = history[i];
    if (m.role !== 'assistant') continue;
    const call = m.toolCalls.find((t) => t.name === 'get_task_guide' && t.guideId);
    if (call?.guideId) return call.guideId;
  }
  return null;
}
