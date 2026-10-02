import type { ModelUsage } from './usage';

/**
 * The assistant's model seam (ADR-061 D-b). Bound once, in
 * `assistant.module.ts`, to the mock or the Anthropic adapter.
 *
 * Blocks are kept as plain JSON objects rather than SDK classes. What the model
 * returns goes back UNCHANGED within the same turn (D-a), including block types
 * this code never reads, such as thinking and fallback blocks, and is stored
 * whole. A narrower type here would drop them and the tool loop would fail. A
 * later turn never replays them; it gets the short window (D-r).
 */
export const ASSISTANT_MODEL_PORT = Symbol('ASSISTANT_MODEL_PORT');

/** One content block, exactly as the Messages API shapes it. */
export type ModelBlock = { type: string } & Record<string, unknown>;

export interface ModelMessage {
  role: 'user' | 'assistant';
  content: ModelBlock[];
}

/** A tool as offered to the model: a JSON Schema, never a Zod object. */
export interface ModelToolSpec {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface ModelTurnRequest {
  system: string;
  tools: ModelToolSpec[];
  messages: ModelMessage[];
  /**
   * `none` on the last call a turn may make (D-x): the model must answer in
   * words and cannot ask for another tool. Unset means the model chooses.
   */
  toolChoice?: 'none';
}

export type ModelStopReason =
  | 'end_turn'
  | 'tool_use'
  | 'pause_turn'
  | 'max_tokens'
  | 'refusal'
  | 'other';

export interface ModelTurn {
  content: ModelBlock[];
  stopReason: ModelStopReason;
  /** The model that answered; differs from the requested one after a fallback. */
  model: string;
  /** Tokens the call used, when the provider reports them (D-s). */
  usage?: ModelUsage;
}

/**
 * The wall clock instant (ms since epoch) by which the whole user turn must be
 * answered (ADR-061 D-p). An adapter spends at most what is left of it on one
 * call, retries included, so six calls can never add up past the promise.
 */
export interface ModelCallOptions {
  deadline: number;
}

export interface AssistantModelPort {
  readonly kind: 'mock' | 'live';
  createTurn(request: ModelTurnRequest, options: ModelCallOptions): Promise<ModelTurn>;
}

/** The model could not be reached or answered with an error. Maps to 502. */
export class ModelUnavailableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'ModelUnavailableError';
  }
}

export interface ToolUseBlock extends ModelBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: unknown;
}

export function isToolUse(block: ModelBlock): block is ToolUseBlock {
  return (
    block.type === 'tool_use' &&
    typeof block.id === 'string' &&
    typeof block.name === 'string'
  );
}

/** The text a person reads: every text block of a response, in order. */
export function textOf(content: ModelBlock[]): string {
  return content
    .filter((b) => b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text as string)
    .join('\n\n')
    .trim();
}
