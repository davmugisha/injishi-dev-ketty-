import { DEFAULT_PRICES, estimateCostMicroUsd } from '../domain/usage';
import { DEFAULT_AI_TURNS_PER_DAY, DEFAULT_ASSISTANT_MODEL, resolveAssistantConfig } from './assistant.config';

describe('resolveAssistantConfig (ADR-061 D-b)', () => {
  it('defaults to mock outside production, so a laptop works with no key', () => {
    expect(resolveAssistantConfig({ nodeEnv: 'development' })).toEqual({
      mode: 'mock',
      model: DEFAULT_ASSISTANT_MODEL,
      apiKey: null,
      prices: DEFAULT_PRICES,
      limits: { monthlyBudgetUsd: null, aiTurnsPerDay: DEFAULT_AI_TURNS_PER_DAY },
      maxOutputTokens: 1500,
    });
  });

  it('defaults to off in production, so nothing spends by accident', () => {
    expect(resolveAssistantConfig({ nodeEnv: 'production' }).mode).toBe('off');
  });

  it('uses claude-sonnet-5-5 unless told otherwise', () => {
    expect(DEFAULT_ASSISTANT_MODEL).toBe('claude-sonnet-5-5');
    expect(resolveAssistantConfig({ model: 'claude-opus-5-5' }).model).toBe('claude-opus-5-5');
  });

  it('refuses live without a key, and never quotes one', () => {
    expect(() => resolveAssistantConfig({ mode: 'live' })).toThrow(/ANTHROPIC_API_KEY/);
    const config = resolveAssistantConfig({ mode: 'LIVE', apiKey: ' sk-ant-secret ' });
    expect(config).toMatchObject({ mode: 'live', model: DEFAULT_ASSISTANT_MODEL, apiKey: 'sk-ant-secret', prices: DEFAULT_PRICES });
  });

  it('sets no monthly ceiling and 30 model answers a day unless configured (D-t)', () => {
    expect(DEFAULT_AI_TURNS_PER_DAY).toBe(30);
    expect(resolveAssistantConfig({}).limits).toEqual({ monthlyBudgetUsd: null, aiTurnsPerDay: 30 });
    expect(resolveAssistantConfig({ monthlyBudgetUsd: ' 25.5 ', aiTurnsPerDay: '12' }).limits).toEqual({
      monthlyBudgetUsd: 25.5,
      aiTurnsPerDay: 12,
    });
    expect(resolveAssistantConfig({ monthlyBudgetUsd: '', aiTurnsPerDay: '' }).limits).toEqual({ monthlyBudgetUsd: null, aiTurnsPerDay: 30 });
  });

  it('caps one call at 1,500 output tokens unless configured, and never above 8,000 (D-y)', () => {
    expect(resolveAssistantConfig({}).maxOutputTokens).toBe(1500);
    expect(resolveAssistantConfig({ maxOutputTokens: ' 800 ' }).maxOutputTokens).toBe(800);
    for (const raw of ['255', '8001', '1e3x', '900.5']) {
      expect(() => resolveAssistantConfig({ maxOutputTokens: raw })).toThrow(/ASSISTANT_MAX_OUTPUT_TOKENS must be a whole number from 256 to 8000/);
    }
  });

  it.each([
    [{ monthlyBudgetUsd: '0' }, /ASSISTANT_MONTHLY_BUDGET_USD/],
    [{ monthlyBudgetUsd: 'lots' }, /ASSISTANT_MONTHLY_BUDGET_USD/],
    [{ aiTurnsPerDay: '2.5' }, /ASSISTANT_AI_TURNS_PER_DAY/],
    [{ aiTurnsPerDay: '0' }, /ASSISTANT_AI_TURNS_PER_DAY/],
  ])('refuses a limit that is not one: %o', (env, message) => {
    expect(() => resolveAssistantConfig(env)).toThrow(message);
  });

  it('refuses an unknown mode rather than guessing', () => {
    expect(() => resolveAssistantConfig({ mode: 'on' })).toThrow(/off, mock, live/);
  });

  it('refuses a model value that is not a model id', () => {
    expect(() => resolveAssistantConfig({ model: 'claude sonnet; drop' })).toThrow(/model id/);
  });

  it('prices calls at the published Sonnet 5.5 prices unless configured (D-s)', () => {
    expect(DEFAULT_PRICES).toEqual({ inputPerMTokUsd: 2, outputPerMTokUsd: 10, cacheReadPerMTokUsd: 0.2, cacheWritePerMTokUsd: 2.5 });
    const prices = resolveAssistantConfig({
      prices: { ASSISTANT_PRICE_INPUT_PER_MTOK_USD: ' 3 ', ASSISTANT_PRICE_CACHE_READ_PER_MTOK_USD: '' },
    }).prices;
    expect(prices).toEqual({ ...DEFAULT_PRICES, inputPerMTokUsd: 3 });
  });

  it.each(['free', '-1', '1e9', 'NaN'])('refuses a price that is not one: "%s"', (raw) => {
    expect(() => resolveAssistantConfig({ prices: { ASSISTANT_PRICE_OUTPUT_PER_MTOK_USD: raw } })).toThrow(
      /ASSISTANT_PRICE_OUTPUT_PER_MTOK_USD must be a price/,
    );
  });

  it('estimates a cost in micro dollars as tokens times dollars per million', () => {
    // 1,000 x 2 + 500 x 10 + 4,000 x 0.2 + 2,000 x 2.5 = 12,800 micro dollars.
    const usage = { inputTokens: 1000, outputTokens: 500, cacheReadTokens: 4000, cacheWriteTokens: 2000 };
    expect(estimateCostMicroUsd(usage, DEFAULT_PRICES)).toBe(12_800);
    expect(estimateCostMicroUsd({ ...usage, inputTokens: 1 }, { ...DEFAULT_PRICES, inputPerMTokUsd: 0.3 })).toBe(10_800);
  });
});
