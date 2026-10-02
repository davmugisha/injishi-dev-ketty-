import Anthropic from '@anthropic-ai/sdk';

import {
  type AssistantModelPort,
  type ModelBlock,
  type ModelCallOptions,
  type ModelStopReason,
  type ModelTurn,
  type ModelTurnRequest,
  ModelUnavailableError,
} from '../domain/model-port';
import { DEFAULT_OUTPUT_TOKENS } from '../domain/retention';
import type { ModelUsage } from '../domain/usage';

/**
 * Claude through the Anthropic Messages API (ADR-061 D-a, `live` mode).
 *
 * - Effort `low`, the documented starting point for chat; thinking stays on
 *   its adaptive default. Tune both against the slice H evaluation.
 * - `fallbacks: "default"` under `server-side-fallback-2026-07-01`: a turn a
 *   safety classifier declines is rerun on the fallback model inside the same
 *   call rather than returned as a refusal. A refusal the whole chain declines
 *   still arrives as `stop_reason: "refusal"`.
 * - Top level `cache_control` caches the frozen tools and system prompt
 *   (D-w), and inside one turn the tool loop appends to the same request, so
 *   each later step of the turn reads the earlier steps from the cache.
 * - `strict: true` on every tool, so tool inputs always match their schema.
 * - Each call gets exactly what is left of the turn's deadline as its timeout,
 *   and one SDK retry (429, 5xx, network) only while more than 30 s remain,
 *   so a slow provider can never push a turn past the 60 s promise (D-p).
 *
 * The response content is returned as plain JSON, whole, so every block
 * (thinking and fallback included) goes back unchanged within the turn and is
 * stored. A later turn never replays it: it gets the short window (D-r).
 */
export class AnthropicAssistantModel implements AssistantModelPort {
  readonly kind = 'live' as const;
  private readonly client: Anthropic;

  constructor(
    apiKey: string,
    private readonly model: string,
    client?: Anthropic,
    /** One call's output ceiling, from `ASSISTANT_MAX_OUTPUT_TOKENS` (D-y). */
    private readonly maxOutputTokens: number = DEFAULT_OUTPUT_TOKENS,
  ) {
    this.client = client ?? new Anthropic({ apiKey, timeout: 20_000, maxRetries: 1 });
  }

  async createTurn(request: ModelTurnRequest, options: ModelCallOptions): Promise<ModelTurn> {
    const remaining = Math.max(1_000, options.deadline - Date.now());
    try {
      const response = await this.client.beta.messages.create(
        {
          model: this.model,
          max_tokens: this.maxOutputTokens,
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          output_config: { effort: 'low' },
          cache_control: { type: 'ephemeral' },
          system: request.system,
          tools: request.tools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            input_schema: tool.inputSchema as Anthropic.Beta.BetaTool.InputSchema,
            strict: true,
          })),
          ...(request.toolChoice === 'none' ? { tool_choice: { type: 'none' as const } } : {}),
          // Our blocks are the API's own JSON, stored and replayed unchanged.
          messages: request.messages as unknown as Anthropic.Beta.BetaMessageParam[],
        },
        { timeout: remaining, maxRetries: remaining > 30_000 ? 1 : 0 },
      );
      return {
        content: response.content as unknown as ModelBlock[],
        stopReason: stopReasonOf(response.stop_reason),
        model: response.model,
        usage: usageOf(response.usage),
      };
    } catch (error) {
      if (error instanceof Anthropic.APIError) {
        throw new ModelUnavailableError(`Anthropic API error ${error.status ?? 'unknown'}`, {
          cause: error,
        });
      }
      throw new ModelUnavailableError('Anthropic API unreachable', { cause: error });
    }
  }
}

/**
 * The provider's token counts as the ledger stores them (D-s). `input_tokens`
 * is already the uncached remainder; the two cache counts are reported beside
 * it and are absent on a call that touched no cache.
 */
function usageOf(usage: Anthropic.Beta.BetaUsage | null | undefined): ModelUsage | undefined {
  if (!usage) return undefined;
  return {
    inputTokens: usage.input_tokens ?? 0,
    outputTokens: usage.output_tokens ?? 0,
    cacheReadTokens: usage.cache_read_input_tokens ?? 0,
    cacheWriteTokens: usage.cache_creation_input_tokens ?? 0,
  };
}

function stopReasonOf(reason: string | null): ModelStopReason {
  switch (reason) {
    case 'end_turn':
    case 'tool_use':
    case 'pause_turn':
    case 'max_tokens':
    case 'refusal':
      return reason;
    default:
      return 'other';
  }
}
