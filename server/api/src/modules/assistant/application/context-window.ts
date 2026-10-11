import type { ModelMessage } from '../domain/model-port';
import { redact } from '../domain/redaction';
import type { MessageRow } from '../infrastructure/conversation.repository';
import type { Gathered } from './request-router';

/**
 * What the model is told about earlier turns (ADR-061 D-r): minimum context.
 *
 * Stored history is complete; model context is the minimum relevant. The
 * whole conversation stays in storage. The model gets ONE user message: the
 * verified data the router gathered for this question (D-q), a short summary
 * of the earlier questions, the last few exchanges as plain text, and the
 * current question. Earlier tool results, thinking and model
 * content are never replayed, so a long conversation costs about the same per
 * turn as a short one, and no thinking block is ever sent back.
 */

/** Exchanges given in full (each side cut to SIDE_LIMIT). */
export const RECENT_EXCHANGES = 3;
/** Characters kept from each side of a recent exchange. */
export const SIDE_LIMIT = 400;
/** Characters kept from each earlier question in the summary. */
export const EARLIER_QUESTION_LIMIT = 80;
/** Earlier questions named in the summary; older ones are only counted. */
export const EARLIER_QUESTIONS_NAMED = 8;

interface Exchange {
  question: string;
  answer: string;
}

/** Heads the gathered data in the model's message; the system prompt names it. */
export const GATHERED_HEADING = 'Verified Injishi data for this question (already limited to what this person may see):';

/**
 * The single user message for a model call. With nothing gathered and no
 * earlier turn it is the question alone.
 */
export function modelInputFor(history: MessageRow[], question: string, gathered: Gathered[] = []): ModelMessage {
  const exchanges = exchangesIn(history);
  if (exchanges.length === 0 && gathered.length === 0) return { role: 'user', content: [{ type: 'text', text: question }] };

  const recent = exchanges.slice(-RECENT_EXCHANGES);
  const earlier = exchanges.slice(0, -RECENT_EXCHANGES);
  const parts: string[] = [];
  if (gathered.length > 0) {
    // One line per tool: `[name] <its JSON result>`.
    parts.push(GATHERED_HEADING, ...gathered.map((g) => `[${g.tool}] ${g.outcome.content.replace(/\s*\n\s*/g, ' ')}`));
  }
  if (earlier.length > 0) {
    const named = earlier.slice(-EARLIER_QUESTIONS_NAMED).map((e) => `"${cut(e.question, EARLIER_QUESTION_LIMIT)}"`);
    const unnamed = earlier.length - named.length;
    parts.push(
      `Earlier in this conversation (${earlier.length} exchange${earlier.length === 1 ? '' : 's'}), the person asked: ${named.join('; ')}${unnamed > 0 ? `; and ${unnamed} more` : ''}.`,
    );
  }
  if (recent.length > 0) {
    parts.push(
      'Recent exchanges:',
      ...recent.flatMap((e) => [`Person: ${cut(e.question, SIDE_LIMIT)}`, `Assistant: ${cut(e.answer, SIDE_LIMIT)}`]),
    );
  }
  parts.push('', 'Current question:', question);
  return { role: 'user', content: [{ type: 'text', text: parts.join('\n') }] };
}

/**
 * Question and answer pairs from stored messages. The question is the
 * REDACTED text that was sent to the provider (the person's own words are
 * kept for display only); the answer is redacted again before it is reused.
 */
function exchangesIn(history: MessageRow[]): Exchange[] {
  const exchanges: Exchange[] = [];
  for (let i = 0; i < history.length; i++) {
    const m = history[i];
    if (m.role !== 'user') continue;
    const next = history[i + 1];
    const answer = next?.role === 'assistant' ? redact(next.displayText) : '';
    exchanges.push({ question: sentText(m), answer });
  }
  return exchanges;
}

function sentText(message: MessageRow): string {
  const block = message.modelContent[0]?.content.find((b) => b.type === 'text' && typeof b.text === 'string');
  return typeof block?.text === 'string' ? block.text : redact(message.displayText);
}

function cut(text: string, limit: number): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length <= limit ? flat : `${flat.slice(0, limit - 1).trimEnd()}…`;
}
