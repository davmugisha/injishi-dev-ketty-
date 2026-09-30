import { DEFAULT_ASSISTANT_MODEL, resolveAssistantConfig } from './assistant.config';

describe('resolveAssistantConfig (ADR-061 D-b)', () => {
  it('defaults to mock outside production, so a laptop works with no key', () => {
    expect(resolveAssistantConfig({ nodeEnv: 'development' })).toEqual({
      mode: 'mock',
      model: DEFAULT_ASSISTANT_MODEL,
      apiKey: null,
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
    expect(config).toEqual({ mode: 'live', model: DEFAULT_ASSISTANT_MODEL, apiKey: 'sk-ant-secret' });
  });

  it('refuses an unknown mode rather than guessing', () => {
    expect(() => resolveAssistantConfig({ mode: 'on' })).toThrow(/off, mock, live/);
  });

  it('refuses a model value that is not a model id', () => {
    expect(() => resolveAssistantConfig({ model: 'claude sonnet; drop' })).toThrow(/model id/);
  });
});
