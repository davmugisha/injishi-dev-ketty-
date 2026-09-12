import { AdminClaimCode } from '@injishi/contracts';

import { mintClaimCode } from './user-actions.service';

/**
 * The reissued code is read aloud to a guest and typed into web's claim form,
 * which tests the printed shape. A code the form rejects is a reissue that
 * cannot be redeemed, so the shape is pinned here against the contract.
 */
describe('mintClaimCode', () => {
  const draws = Array.from({ length: 500 }, () => mintClaimCode());

  it('always produces the printed AAAA-9999 shape the contract accepts', () => {
    for (const code of draws) expect(AdminClaimCode.safeParse(code).success).toBe(true);
  });

  it('never uses I or O, which are heard as 1 and 0 over the phone', () => {
    for (const code of draws) expect(code.slice(0, 4)).not.toMatch(/[IO]/);
  });

  it('is not a constant', () => {
    expect(new Set(draws).size).toBeGreaterThan(1);
  });
});
