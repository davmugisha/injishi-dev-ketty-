/**
 * What a model call costs (ADR-061 D-s), as plain values.
 *
 * No imports and nothing but erasable types, on purpose: the API reads it,
 * and so do `scripts/assistant-usage.mjs` and the slice I oracle, under Node's
 * type stripping, so all three price a call the same way.
 */

/** Tokens one call used, as the provider reports them. */
export interface ModelUsage {
  /** Input tokens read at the full price (the uncached remainder). */
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

/** US dollars per million tokens. */
export interface ModelPrices {
  inputPerMTokUsd: number;
  outputPerMTokUsd: number;
  cacheReadPerMTokUsd: number;
  cacheWritePerMTokUsd: number;
}

/**
 * Claude Sonnet 5.5's published prices on 2026-10-01: input 2, output 10, a
 * cache read 0.1 times input and a five minute cache write 1.25 times input.
 * A different model or a price change is a configuration change.
 */
export const DEFAULT_PRICES: ModelPrices = {
  inputPerMTokUsd: 2,
  outputPerMTokUsd: 10,
  cacheReadPerMTokUsd: 0.2,
  cacheWritePerMTokUsd: 2.5,
};

/** The variables that override each default, in the same order. */
export const PRICE_VARIABLES: Record<keyof ModelPrices, string> = {
  inputPerMTokUsd: 'ASSISTANT_PRICE_INPUT_PER_MTOK_USD',
  outputPerMTokUsd: 'ASSISTANT_PRICE_OUTPUT_PER_MTOK_USD',
  cacheReadPerMTokUsd: 'ASSISTANT_PRICE_CACHE_READ_PER_MTOK_USD',
  cacheWritePerMTokUsd: 'ASSISTANT_PRICE_CACHE_WRITE_PER_MTOK_USD',
};

/** Above this a price is a typo, not a price: no Claude model costs it. */
const MAX_PRICE = 1000;

/**
 * The prices from the environment, each defaulting when unset or blank. A
 * value that is not a price stops the caller (the API refuses to boot) rather
 * than silently costing every call at zero.
 */
export function pricesFrom(env: Record<string, string | undefined>): ModelPrices {
  const prices = { ...DEFAULT_PRICES };
  for (const key of Object.keys(PRICE_VARIABLES) as (keyof ModelPrices)[]) {
    const name = PRICE_VARIABLES[key];
    const raw = env[name]?.trim();
    if (!raw) continue;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0 || value > MAX_PRICE) {
      throw new Error(`${name} must be a price in US dollars per million tokens, from 0 to ${MAX_PRICE}; got "${raw}".`);
    }
    prices[key] = value;
  }
  return prices;
}

/**
 * The estimated cost in micro US dollars. A price of P dollars per million
 * tokens is exactly P micro dollars per token, so this is a weighted sum with
 * no unit conversion, rounded once at the end.
 */
export function estimateCostMicroUsd(usage: ModelUsage, prices: ModelPrices): number {
  return Math.round(
    usage.inputTokens * prices.inputPerMTokUsd +
      usage.outputTokens * prices.outputPerMTokUsd +
      usage.cacheReadTokens * prices.cacheReadPerMTokUsd +
      usage.cacheWriteTokens * prices.cacheWritePerMTokUsd,
  );
}

/** Who asked, as the usage report groups it. A label only: it grants nothing. */
export type CallerRole = 'anonymous' | 'signed_in' | 'operator' | 'staff';
