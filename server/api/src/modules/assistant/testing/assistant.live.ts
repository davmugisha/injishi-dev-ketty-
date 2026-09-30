/**
 * The live smoke run (ADR-061 root gate R3): the real service, the real tools
 * over the in memory fakes, and the LIVE Anthropic adapter. It spends money,
 * so it is never part of a suite: Jest only picks up `*.spec.ts`, and this
 * runs only when asked for by name:
 *
 *   pnpm --filter @injishi/api exec jest --testRegex "assistant\.live\.ts$"
 *
 * The key comes from the environment or from `server/api/.env`; it is never
 * printed. Two questions: one the knowledge base answers with a citation, and
 * one asking for a change the anonymous caller cannot make, which must come
 * back with no proposal.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { AssistantService } from '../application/assistant.service';
import { ToolSet } from '../application/assistant-tools';
import { AnthropicAssistantModel } from '../infrastructure/anthropic-model.adapter';
import { DEFAULT_ASSISTANT_MODEL } from '../infrastructure/assistant.config';
import { defaultProposals } from './fake-actions';
import { FakeConversations } from './fake-conversations';
import { fakeReads } from './fake-listings';

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

function live(): { service: AssistantService; repo: FakeConversations } {
  if (!key) throw new Error('ANTHROPIC_API_KEY is not set in the environment or in server/api/.env');
  const repo = new FakeConversations();
  const service = new AssistantService(
    new AnthropicAssistantModel(key, model),
    { mode: 'live', model },
    repo.asRepository(),
    new ToolSet(fakeReads),
    defaultProposals,
  );
  return { service, repo };
}

describe(`the live assistant (${model})`, () => {
  it('answers a platform question from the knowledge base, citing it', async () => {
    const { service } = live();
    const result = await service.send(
      { kind: 'anon', tokenHash: null },
      { message: "I can't publish my property. What do I need to do?", surface: 'web' },
    );
    const answer = result.conversation.messages.at(-1);
    console.log(`ANSWER: ${answer?.text}\nSOURCES: ${JSON.stringify(answer?.sources)}`);
    expect(answer?.role).toBe('assistant');
    expect(answer?.text.length).toBeGreaterThan(40);
    expect(answer?.sources.map((s) => s.id)).toContain('cannot-publish-listing');
  }, TURN_MS);

  it('prepares nothing for a signed out caller who asks for a change', async () => {
    const { service } = live();
    const result = await service.send(
      { kind: 'anon', tokenHash: null },
      { message: 'Change the Double room price to 70,000 RWF.', surface: 'web' },
    );
    const answer = result.conversation.messages.at(-1);
    console.log(`ANSWER: ${answer?.text}`);
    expect(answer?.proposals).toEqual([]);
    expect(answer?.text.length).toBeGreaterThan(10);
  }, TURN_MS);
});
