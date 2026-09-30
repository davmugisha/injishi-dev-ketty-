import type {
  AssistantModelPort,
  ModelBlock,
  ModelMessage,
  ModelTurn,
  ModelTurnRequest,
} from '../domain/model-port';

/**
 * The deterministic stand in for the model (ADR-061 D-b, `mock` mode).
 *
 * It does what the system prompt asks of the real model, mechanically. A
 * question about places to stay goes to `search_listings` when that tool is
 * offered; anything else goes to `search_help`. It then answers from the top
 * results with citations, or says it has nothing verified. Tests, CI and
 * laptops get the whole loop (tools, citations, storage, limits) with no key
 * and the same answer every time.
 */
export const MOCK_NO_ANSWER =
  "I don't have a verified answer for that. The support page at /support can help.";
export const MOCK_NO_LISTINGS = 'No published property matches that.';
export const MOCK_LISTINGS_CLOSED = 'Listings are not open yet.';
export const MOCK_SIGN_IN = 'Sign in and I can look up your trips.';
export const MOCK_NO_TRIPS = 'I found no trips on your account.';

export const MOCK_NO_OPERATOR = 'I can only check rooms from the operator app, in a business you work in.';
export const MOCK_CANNOT_CHANGE = 'Your account cannot change prices here.';
export const MOCK_ESCALATION_OFFERED =
  'I can pass this to a person at Injishi support. Press "Send to Injishi support" and they will reply by email.';

const HUMAN_QUESTION = /\b(a (human|person)|real person|someone at injishi|talk to (someone|support)|escalate)\b/i;

// "change the Double room price to 70,000" -> "Double room".
const PRICE_CHANGE = /\b(?:change|set)\s+(?:the\s+)?(.+?)\s+price\b/i;

const PUBLISH_QUESTION = /\bpublish/i;
const ROOMS_QUESTION = /\brooms?\b.*\b(free|taken|available|held|tonight|tomorrow|\d{4}-\d{2}-\d{2})\b/i;
const HOW_TO_QUESTION = /\bhow (do|can|to)\b/i;

// Checked before places to stay: "my stay" is a trip question.
const TRIP_QUESTION = /\b(trips?|bookings?|reservations?|my stay)\b/i;
const STAY_QUESTION = /\b(stay|stays|hotels?|lodges?|places?|guest ?houses?|apartments?|villas?|motels?|camps?)\b/i;

export class MockAssistantModel implements AssistantModelPort {
  readonly kind = 'mock' as const;

  createTurn(request: ModelTurnRequest): Promise<ModelTurn> {
    const last = request.messages.at(-1);
    const results = last ? toolResultsIn(last) : [];

    if (results.length === 0) {
      const question = last ? textIn(last) : '';
      if (!question) return Promise.resolve(answer(MOCK_NO_ANSWER));
      const offers = (name: string): boolean => request.tools.some((t) => t.name === name);
      if (HUMAN_QUESTION.test(question) && offers('suggest_human_support')) {
        return Promise.resolve(call(request, 'suggest_human_support', { topic: 'other' }));
      }
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
        if (!offers('search_listings')) return Promise.resolve(answer(MOCK_LISTINGS_CLOSED));
        return Promise.resolve(call(request, 'search_listings', { query: placeIn(question) }));
      }
      if (!offers('search_help')) return Promise.resolve(answer(MOCK_NO_ANSWER));
      return Promise.resolve(call(request, 'search_help', { query: question.slice(0, 200) }));
    }

    const parsed = parse(results[0]);
    const called = calledTool(request);
    if (called === 'suggest_human_support' && parsed && 'offered' in parsed) {
      return Promise.resolve(answer(MOCK_ESCALATION_OFFERED));
    }
    if (called === 'propose_room_price' && parsed && 'proposalId' in parsed) {
      const p = parsed as { roomType?: string; current?: string; proposed?: string };
      return Promise.resolve(
        answer(`Ready to change ${p.roomType} from ${p.current} to ${p.proposed}. Nothing has changed yet: press Approve on the card to make it, or Reject.`),
      );
    }
    if (called === 'get_task_guide') {
      const guide = (parsed as { guide?: { title?: string; steps?: string[] } | null } | null)?.guide;
      if (!guide) return Promise.resolve(answer(MOCK_NO_ANSWER));
      return Promise.resolve(answer(`${guide.title}: ${(guide.steps ?? []).map((s, i) => `${i + 1}. ${s}`).join(' ')}`));
    }
    if (called === 'rooms_on_dates') {
      const rooms = ((parsed as { rooms?: Array<{ room?: string; heldForDates?: boolean }> } | null)?.rooms ?? []);
      const taken = rooms.filter((r) => r.heldForDates).map((r) => r.room);
      const free = rooms.filter((r) => !r.heldForDates).map((r) => r.room);
      return Promise.resolve(answer(`Held: ${taken.join(', ') || 'none'}. Free: ${free.join(', ') || 'none'}.`));
    }
    if (called === 'publish_blockers') {
      const props = ((parsed as { properties?: Array<{ property?: string; blockers?: Array<{ fix?: string }> }> } | null)?.properties ?? []);
      return Promise.resolve(
        answer(props.map((p) => `${p.property}: ${(p.blockers ?? []).map((b) => b.fix).join(' ') || 'ready to publish.'}`).join(' ')),
      );
    }
    if (results[0].is_error === true && typeof results[0].content === 'string') {
      const error = (JSON.parse(results[0].content) as { error?: string }).error;
      return Promise.resolve(answer(error ?? MOCK_NO_ANSWER));
    }
    if (called === 'my_trips') {
      const trips = ((parsed as { trips?: unknown[] } | null)?.trips ?? []) as Array<{ property?: string; checkIn?: string; reference?: string }>;
      if (trips.length === 0) return Promise.resolve(answer(MOCK_NO_TRIPS));
      const first = trips[0];
      return Promise.resolve(answer(`Your next stay is at ${first.property} from ${first.checkIn}, reference ${first.reference}.`));
    }
    if (calledTool(request) === 'search_listings') {
      const found = (parsed?.results ?? []) as Array<{ propertyId?: string; name?: string }>;
      if (found.length === 0) return Promise.resolve(answer(MOCK_NO_LISTINGS));
      const names = found.map((r) => `${r.name} [source:${r.propertyId}]`).join(', ');
      return Promise.resolve(answer(`Published places that match: ${names}.`));
    }
    const top = (parsed?.results as Array<{ id?: unknown; summary?: unknown }> | undefined)?.[0];
    if (!top || typeof top.id !== 'string' || typeof top.summary !== 'string') {
      return Promise.resolve(answer(MOCK_NO_ANSWER));
    }
    return Promise.resolve(answer(`${top.summary} [source:${top.id}]`));
  }
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

/** "places to stay in Musanze" -> "Musanze"; otherwise the whole question. */
function placeIn(question: string): string {
  const match = question.match(/\b(?:in|near|around)\s+([^?.!,]+)/i);
  return (match ? match[1] : question).trim().slice(0, 120);
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
