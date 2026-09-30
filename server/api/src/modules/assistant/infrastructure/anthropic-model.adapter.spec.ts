import type Anthropic from '@anthropic-ai/sdk';

import { ModelUnavailableError } from '../domain/model-port';
import { AnthropicAssistantModel } from './anthropic-model.adapter';

/** A client double that records the request and returns a canned response. */
function clientReturning(response: unknown, captured: unknown[], options: unknown[] = []): Anthropic {
  return {
    beta: {
      messages: {
        create: (params: unknown, requestOptions: unknown) => {
          captured.push(params);
          options.push(requestOptions);
          return response instanceof Error ? Promise.reject(response) : Promise.resolve(response);
        },
      },
    },
  } as unknown as Anthropic;
}

const request = {
  system: 'frozen',
  tools: [
    {
      name: 'search_help',
      description: 'd',
      inputSchema: { type: 'object', properties: {}, required: [], additionalProperties: false },
    },
  ],
  messages: [{ role: 'user' as const, content: [{ type: 'text', text: 'hi' }] }],
};

describe('AnthropicAssistantModel (ADR-061 D-a)', () => {
  it('sends the model, the fallback, low effort, caching and strict tools', async () => {
    const captured: Array<Record<string, unknown>> = [];
    const content = [
      { type: 'thinking', thinking: '', signature: 'sig' },
      { type: 'text', text: 'hello' },
    ];
    const model = new AnthropicAssistantModel(
      'key',
      'claude-sonnet-5-5',
      clientReturning({ content, stop_reason: 'end_turn', model: 'claude-sonnet-5-5' }, captured),
    );

    const turn = await model.createTurn(request, { deadline: Date.now() + 55_000 });

    expect(captured[0]).toMatchObject({
      model: 'claude-sonnet-5-5',
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low' },
      cache_control: { type: 'ephemeral' },
      system: 'frozen',
      messages: request.messages,
    });
    expect(captured[0].tools).toEqual([
      { name: 'search_help', description: 'd', input_schema: request.tools[0].inputSchema, strict: true },
    ]);
    expect(captured[0]).not.toHaveProperty('thinking');
    // Every block comes back whole, thinking included, for append only replay.
    expect(turn).toEqual({ content, stopReason: 'end_turn', model: 'claude-sonnet-5-5' });
  });

  it('spends only what is left of the turn: the remaining time as timeout, one retry only with over 30 s left', async () => {
    const options: Array<{ timeout: number; maxRetries: number }> = [];
    const model = new AnthropicAssistantModel(
      'key',
      'm',
      clientReturning({ content: [], stop_reason: 'end_turn', model: 'm' }, [], options),
    );
    await model.createTurn(request, { deadline: Date.now() + 50_000 });
    await model.createTurn(request, { deadline: Date.now() + 10_000 });
    await model.createTurn(request, { deadline: Date.now() - 5_000 });
    expect(options[0].maxRetries).toBe(1);
    expect(options[0].timeout).toBeGreaterThan(45_000);
    expect(options[0].timeout).toBeLessThanOrEqual(50_000);
    expect(options[1]).toEqual({ timeout: expect.any(Number), maxRetries: 0 });
    expect(options[1].timeout).toBeLessThanOrEqual(10_000);
    // A deadline already passed still gets a floor, never zero or negative.
    expect(options[2]).toEqual({ timeout: 1_000, maxRetries: 0 });
  });

  it('maps an unfamiliar stop reason to other', async () => {
    const model = new AnthropicAssistantModel(
      'key',
      'm',
      clientReturning({ content: [], stop_reason: 'model_context_window_exceeded', model: 'm' }, []),
    );
    expect((await model.createTurn(request, { deadline: Date.now() + 55_000 })).stopReason).toBe('other');
  });

  it('turns any client failure into ModelUnavailableError', async () => {
    const model = new AnthropicAssistantModel('key', 'm', clientReturning(new Error('socket hang up'), []));
    await expect(model.createTurn(request, { deadline: Date.now() + 55_000 })).rejects.toBeInstanceOf(ModelUnavailableError);
  });
});
