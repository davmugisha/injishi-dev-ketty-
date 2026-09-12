import { RraTinAdapter } from './rra-tin.adapter';

/**
 * The mock must verify EVERY well-formed and malformed TIN alike while RRA API
 * access is pending, and the mock/live stamp must survive that. The stamp is
 * the whole safeguard: it is what stops a demo verdict being read as an RRA one.
 */
describe('RraTinAdapter', () => {
  const original = process.env.RRA_TIN_ADAPTER_MODE;
  let adapter: RraTinAdapter;

  beforeEach(() => {
    adapter = new RraTinAdapter();
  });

  afterEach(() => {
    if (original === undefined) delete process.env.RRA_TIN_ADAPTER_MODE;
    else process.env.RRA_TIN_ADAPTER_MODE = original;
  });

  describe('mock mode (RRA API access pending)', () => {
    beforeEach(() => {
      process.env.RRA_TIN_ADAPTER_MODE = 'mock';
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

    it('is selected when the mode is unset', async () => {
      delete process.env.RRA_TIN_ADAPTER_MODE;
      const outcome = await adapter.verify('123456780');
      expect(outcome.result).toBe('verified');
      expect(outcome.adapterMode).toBe('mock');
    });
  });

  describe('live mode', () => {
    beforeEach(() => {
      process.env.RRA_TIN_ADAPTER_MODE = 'live';
    });

    it('holds at pending rather than fabricating a verdict', async () => {
      const outcome = await adapter.verify('123456789');
      // `pending` holds the org at `submitted` for a retry. It must never
      // borrow the mock's answer, or an unverified business enters the
      // pipeline wearing a verified badge.
      expect(outcome.result).toBe('pending');
      expect(outcome.adapterMode).toBe('live');
    });
  });
});
