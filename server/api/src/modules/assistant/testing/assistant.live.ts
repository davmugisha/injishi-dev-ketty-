/**
 * The live smoke run (ADR-061 root gate R3): the real service, the real tools
 * over the in memory fakes, and the LIVE Anthropic adapter. It spends money,
 * so it is never part of a suite: Jest only picks up `*.spec.ts`, and this
 * runs only when asked for by name:
 *
 *   pnpm --filter @injishi/api exec jest --testRegex "assistant\.live\.ts$"
 *
 * The key comes from the environment or from `server/api/.env`; it is never
 * printed. Both questions are explanations, so the request router (D-q) hands
 * them to the model rather than answering them itself: one the model answers
 * from a help article it must cite, and one about a change the anonymous
 * caller cannot make, which must come back with no proposal. Each checks that
 * the provider reported its tokens, so the usage ledger (D-s) has real counts,
 * and that the answer is what D-x and D-y promise: one or two calls, a short
 * answer (at most 200 words; the prompt asks for under 120), never the
 * "couldn't finish" reply. This is the evaluation the output ceiling
 * (ASSISTANT_MAX_OUTPUT_TOKENS) is tuned against.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { AssistantService, INCOMPLETE_REPLY } from '../application/assistant.service';
import { ToolSet } from '../application/assistant-tools';
import { AnthropicAssistantModel } from '../infrastructure/anthropic-model.adapter';
import { DEFAULT_OUTPUT_TOKENS } from '../domain/retention';
import { DEFAULT_ASSISTANT_MODEL } from '../infrastructure/assistant.config';
import { defaultProposals } from './fake-actions';
import { FakeConversations } from './fake-conversations';
import { fakeReads } from './fake-listings';
import { FakeUsage } from './fake-usage';

function fromEnvFile(name: string): string | undefined {
  try {
    const text = readFileSync(path.resolve(__dirname, '..', '..', '..', '..', '.env'), 'utf8');
    const line = text.split(/\r?\n/).find((l) => l.startsWith(`${name}=`));
    const value = line?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
    return value || undefined;
  } catch {
    return undefined;
  }
}

const key = process.env.ANTHROPIC_API_KEY?.trim() || fromEnvFile('ANTHROPIC_API_KEY');
const model = process.env.ASSISTANT_MODEL?.trim() || fromEnvFile('ASSISTANT_MODEL') || DEFAULT_ASSISTANT_MODEL;
const TURN_MS = 70_000;
// The configured ceiling, so the live run measures what production will send (D-y).
const maxOutputTokens = Number(process.env.ASSISTANT_MAX_OUTPUT_TOKENS?.trim() || fromEnvFile('ASSISTANT_MAX_OUTPUT_TOKENS') || DEFAULT_OUTPUT_TOKENS);

function live(): { service: AssistantService; repo: FakeConversations; usage: FakeUsage } {
  if (!key) throw new Error('ANTHROPIC_API_KEY is not set in the environment or in server/api/.env');
  const repo = new FakeConversations();
  const usage = new FakeUsage();
  const service = new AssistantService(
    new AnthropicAssistantModel(key, model, undefined, maxOutputTokens),
    { mode: 'live', model },
    repo.asRepository(),
    new ToolSet(fakeReads),
    defaultProposals,
    usage,
  );
  return { service, repo, usage };
}

describe(`the live assistant (${model})`, () => {
  it('explains a platform question from the knowledge base, citing it, with real token counts', async () => {
    const { service, repo, usage } = live();
    const result = await service.send(
      { kind: 'anon', tokenHash: null },
      { message: 'Explain to me, as someone new to this, why my property might not be publishable yet.', surface: 'web' },
      new Date(),
      {},
    );
    const answer = result.conversation.messages.at(-1);
    console.log(`ANSWER: ${answer?.text}\nSOURCES: ${JSON.stringify(answer?.sources)}\nUSAGE: ${JSON.stringify(usage.turns[0]?.calls)}`);
    expect([...repo.messages.values()].flat().at(-1)?.route).toBe('ai:analysis');
    expect(answer?.text.length).toBeGreaterThan(40);
    expect(answer?.sources.map((s) => s.id)).toContain('cannot-publish-listing');
    const calls = usage.turns[0]?.calls ?? [];
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.length).toBeLessThanOrEqual(2);
    expect(answer?.text).not.toBe(INCOMPLETE_REPLY);
    expect(answer?.text.split(/\s+/).length).toBeLessThanOrEqual(200);
    expect(calls.every((c) => c.usage.inputTokens + c.usage.cacheReadTokens + c.usage.cacheWriteTokens > 0 && c.usage.outputTokens > 0)).toBe(true);
  }, TURN_MS);

  it('prepares nothing for a signed out caller who asks for a change', async () => {
    const { service } = live();
    const result = await service.send(
      { kind: 'anon', tokenHash: null },
      { message: 'Explain how I would change the Double room price to 70,000 RWF.', surface: 'web' },
      new Date(),
      {},
    );
    const answer = result.conversation.messages.at(-1);
    console.log(`ANSWER: ${answer?.text}`);
    expect(answer?.proposals).toEqual([]);
    expect(answer?.text.length).toBeGreaterThan(10);
    expect(answer?.text).not.toBe(INCOMPLETE_REPLY);
    expect(answer?.text.split(/\s+/).length).toBeLessThanOrEqual(200);
  }, TURN_MS);
});
