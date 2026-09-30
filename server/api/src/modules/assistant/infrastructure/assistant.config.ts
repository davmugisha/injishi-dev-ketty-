import { isProduction } from '../../../shared/config/security.config';
import type {
  AssistantMode,
  AssistantSettings,
} from '../application/assistant-settings';

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
 *
 * No message here ever quotes the key.
 */
export const DEFAULT_ASSISTANT_MODEL = 'claude-sonnet-5-5';

export interface AssistantEnv {
  mode?: string;
  model?: string;
  apiKey?: string;
  nodeEnv?: string;
}

export interface ResolvedAssistantConfig extends AssistantSettings {
  apiKey: string | null;
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
  return { mode, model, apiKey };
}

function fail(message: string): never {
  throw new Error(message);
}
