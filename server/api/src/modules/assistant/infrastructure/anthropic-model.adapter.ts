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
import { MAX_OUTPUT_TOKENS } from '../domain/retention';

/**
 * Claude through the Anthropic Messages API (ADR-061 D-a, `live` mode).
 *
 * - Effort `low`, the documented starting point for chat; thinking stays on
 *   its adaptive default. Tune both against the slice H evaluation.
 * - `fallbacks: "default"` under `server-side-fallback-2026-07-01`: a turn a
 *   safety classifier declines is rerun on the fallback model inside the same
 *   call rather than returned as a refusal. A refusal the whole chain declines
 *   still arrives as `stop_reason: "refusal"`.
 * - Top level `cache_control` caches the frozen tools and system prompt and
 *   the append only history, so a long conversation pays for its prefix once.
 * - `strict: true` on every tool, so tool inputs always match their schema.
 * - Each call gets exactly what is left of the turn's deadline as its timeout,
 *   and one SDK retry (429, 5xx, network) only while more than 30 s remain,
 *   so a slow provider can never push a turn past the 60 s promise (D-p).
 *
 * The response content is returned as plain JSON, whole, so every block
 * (thinking and fallback included) is stored and replayed unchanged.
 */
export class AnthropicAssistantModel implements AssistantModelPort {
  readonly kind = 'live' as const;
  private readonly client: Anthropic;

  constructor(
    apiKey: string,
    private readonly model: string,
    client?: Anthropic,
  ) {
    this.client = client ?? new Anthropic({ apiKey, timeout: 20_000, maxRetries: 1 });
  }

  async createTurn(request: ModelTurnRequest, options: ModelCallOptions): Promise<ModelTurn> {
    const remaining = Math.max(1_000, options.deadline - Date.now());
    try {
      const response = await this.client.beta.messages.create(
        {
          model: this.model,
          max_tokens: MAX_OUTPUT_TOKENS,
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
          // Our blocks are the API's own JSON, stored and replayed unchanged.
          messages: request.messages as unknown as Anthropic.Beta.BetaMessageParam[],
        },
        { timeout: remaining, maxRetries: remaining > 30_000 ? 1 : 0 },
      );
      return {
        content: response.content as unknown as ModelBlock[],
        stopReason: stopReasonOf(response.stop_reason),
        model: response.model,
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
