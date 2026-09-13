import { RraTinAdapter } from './rra-tin.adapter';
import { resolveTinMode, tinAdapterProvider } from './tin-adapter.provider';

/**
 * The mock must verify EVERY well-formed and malformed TIN alike while RRA API
 * access is pending, and the mock/live stamp must survive that. The stamp is
 * the whole safeguard: it is what stops a demo verdict being read as an RRA one.
 */
describe('RraTinAdapter (the mock)', () => {
  let adapter: RraTinAdapter;

  beforeEach(() => {
    adapter = new RraTinAdapter();
  });

  it.each([
    ['a well-formed TIN', '123456789'],
    // The old mock rejected these two. Both must now verify.
    ['a TIN ending in 0', '123456780'],
    ['a malformed TIN', 'not-a-tin'],
    ['an empty TIN', ''],
  ])('verifies %s', async (_label, tin) => {
    const outcome = await adapter.verify(tin);
    expect(outcome.result).toBe('verified');
    expect(outcome.adapterMode).toBe('mock');
  });
});

/**
 * Which adapter is bound, decided once, at boot (ADR-053, AC-R4).
 *
 * This used to test a `live` branch inside the adapter that answered `pending`
 * without calling anything. That branch is gone: it made `live` a silent no op,
 * so a deployment could switch it on and hold every registration at `submitted`
 * with nobody told. `live` with no live adapter now refuses to boot, as
 * `PAYMENT_ADAPTER_MODE` does (ADR-020).
 */
describe('tinAdapterProvider', () => {
  it('binds the mock when the mode is unset', () => {
    expect(resolveTinMode({})).toBe('mock');
    expect(tinAdapterProvider({})).toEqual({
      provide: RraTinAdapter,
      useClass: RraTinAdapter,
    });
  });

  it('reads the mode case and whitespace insensitively', () => {
    expect(resolveTinMode({ RRA_TIN_ADAPTER_MODE: ' Mock ' })).toBe('mock');
    expect(resolveTinMode({ RRA_TIN_ADAPTER_MODE: 'LIVE' })).toBe('live');
  });

  it('refuses to boot on live with no live adapter, naming the variable', () => {
    expect(() => tinAdapterProvider({ RRA_TIN_ADAPTER_MODE: 'live' })).toThrow(
      /RRA_TIN_ADAPTER_MODE=live but no live RRA TIN adapter is registered/,
    );
  });

  it('refuses an unreadable mode rather than defaulting to mock', () => {
    expect(() => resolveTinMode({ RRA_TIN_ADAPTER_MODE: 'yes' })).toThrow(
      /RRA_TIN_ADAPTER_MODE must be "mock" or "live"/,
    );
  });
});
