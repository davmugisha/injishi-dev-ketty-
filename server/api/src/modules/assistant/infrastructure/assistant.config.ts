import { isProduction } from '../../../shared/config/security.config';
import type {
  AssistantMode,
  AssistantSettings,
} from '../application/assistant-settings';
import { DEFAULT_OUTPUT_TOKENS, MAX_OUTPUT_TOKENS, MIN_OUTPUT_TOKENS } from '../domain/retention';
import { type ModelPrices, pricesFrom } from '../domain/usage';

/**
 * Read the assistant's environment once, at boot (ADR-061 D-b).
 *
 * - `ASSISTANT_ADAPTER_MODE`: `off`, `mock` or `live`. Unset means `off` under
 *   `NODE_ENV=production` and `mock` everywhere else, so a laptop works with no
 *   key and production never starts spending by accident.
 * - `ASSISTANT_MODEL`: the model for `live`, default `claude-sonnet-5-5`, the
 *   owner's choice (2026-09-30).
 * - `ANTHROPIC_API_KEY`: required for `live`; a live process without it
 *   refuses to boot rather than failing every question at runtime.
 * - `ASSISTANT_PRICE_*_PER_MTOK_USD`: what the usage ledger prices a call at
 *   (D-s), defaulting to Claude Sonnet 5.5's published prices. A value that is
 *   not a price refuses to boot, so no call is silently costed at zero.
 * - `ASSISTANT_MONTHLY_BUDGET_USD`: the ceiling on a UTC month's estimated
 *   cost (D-t). Unset means no ceiling, which a live process says at boot.
 * - `ASSISTANT_AI_TURNS_PER_DAY`: model answered turns per signed in person
 *   per Kigali day, and per conversation when signed out (D-t). Default 30.
 * - `ASSISTANT_MAX_OUTPUT_TOKENS`: one call's output ceiling (D-y), default
 *   1,500, accepted from 256 to 8,000.
 *
 * No message here ever quotes the key.
 */
export const DEFAULT_ASSISTANT_MODEL = 'claude-sonnet-5-5';

export interface AssistantEnv {
  mode?: string;
  model?: string;
  apiKey?: string;
  nodeEnv?: string;
  /** The four `ASSISTANT_PRICE_*` variables, by name. */
  prices?: Record<string, string | undefined>;
  monthlyBudgetUsd?: string;
  aiTurnsPerDay?: string;
  maxOutputTokens?: string;
}

/** The spending limits (D-t), bound in `assistant.module.ts`. */
export interface AssistantLimits {
  /** Null means no ceiling. */
  monthlyBudgetUsd: number | null;
  aiTurnsPerDay: number;
}

export const DEFAULT_AI_TURNS_PER_DAY = 30;
const MAX_BUDGET_USD = 1_000_000;
const MAX_TURNS_PER_DAY = 10_000;

export interface ResolvedAssistantConfig extends AssistantSettings {
  apiKey: string | null;
  prices: ModelPrices;
  limits: AssistantLimits;
  /** One call's output ceiling (D-y). */
  maxOutputTokens: number;
}

const MODES: readonly AssistantMode[] = ['off', 'mock', 'live'];
const MODEL_ID = /^[a-z0-9][a-z0-9.-]{2,63}$/;

export function resolveAssistantConfig(env: AssistantEnv): ResolvedAssistantConfig {
  const raw = env.mode?.trim().toLowerCase();
  const mode: AssistantMode = raw
    ? (MODES.find((m) => m === raw) ??
      fail(`ASSISTANT_ADAPTER_MODE must be one of ${MODES.join(', ')}; got "${env.mode}".`))
    : isProduction(env.nodeEnv)
      ? 'off'
      : 'mock';

  const model = env.model?.trim() || DEFAULT_ASSISTANT_MODEL;
  if (!MODEL_ID.test(model)) fail('ASSISTANT_MODEL is not a model id.');

  const apiKey = env.apiKey?.trim() || null;
  if (mode === 'live' && !apiKey) {
    fail(
      'ASSISTANT_ADAPTER_MODE=live requires ANTHROPIC_API_KEY. Set the key, ' +
        'or run the assistant in mock or off mode.',
    );
  }
  return { mode, model, apiKey, prices: pricesFrom(env.prices ?? {}), limits: limitsFrom(env), maxOutputTokens: outputTokensFrom(env) };
}

function outputTokensFrom(env: AssistantEnv): number {
  const raw = env.maxOutputTokens?.trim();
  if (!raw) return DEFAULT_OUTPUT_TOKENS;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < MIN_OUTPUT_TOKENS || value > MAX_OUTPUT_TOKENS) {
    fail(`ASSISTANT_MAX_OUTPUT_TOKENS must be a whole number from ${MIN_OUTPUT_TOKENS} to ${MAX_OUTPUT_TOKENS}; got "${raw}".`);
  }
  return value;
}

function limitsFrom(env: AssistantEnv): AssistantLimits {
  const budgetRaw = env.monthlyBudgetUsd?.trim();
  let monthlyBudgetUsd: number | null = null;
  if (budgetRaw) {
    monthlyBudgetUsd = Number(budgetRaw);
    if (!Number.isFinite(monthlyBudgetUsd) || monthlyBudgetUsd <= 0 || monthlyBudgetUsd > MAX_BUDGET_USD) {
      fail(`ASSISTANT_MONTHLY_BUDGET_USD must be an amount in US dollars above 0 and up to ${MAX_BUDGET_USD}; got "${budgetRaw}". Leave it unset for no ceiling.`);
    }
  }
  const turnsRaw = env.aiTurnsPerDay?.trim();
  const aiTurnsPerDay = turnsRaw ? Number(turnsRaw) : DEFAULT_AI_TURNS_PER_DAY;
  if (!Number.isInteger(aiTurnsPerDay) || aiTurnsPerDay < 1 || aiTurnsPerDay > MAX_TURNS_PER_DAY) {
    fail(`ASSISTANT_AI_TURNS_PER_DAY must be a whole number from 1 to ${MAX_TURNS_PER_DAY}; got "${turnsRaw}".`);
  }
  return { monthlyBudgetUsd, aiTurnsPerDay };
}

function fail(message: string): never {
  throw new Error(message);
}
