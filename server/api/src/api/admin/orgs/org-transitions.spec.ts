import { describe, expect, it } from 'vitest';

import { OrgRegistrationStatus } from '@injishi/contracts';

import {
  canTransition,
  nextStatus,
} from '../../../modules/organization/domain/registration-status';
import { ADMIN_ORG_TRANSITIONS } from './org-transitions';

/**
 * The admin area keeps a copy of two edges of the registration state machine,
 * because it may not import the domain at runtime. This is the test that keeps
 * the copy honest: it is allowed to import the domain, and it fails the moment
 * the admin write would permit a move the owner forbids, or forbid one it
 * permits.
 */
describe('ADMIN_ORG_TRANSITIONS', () => {
  for (const [event, edge] of Object.entries(ADMIN_ORG_TRANSITIONS)) {
    const move = event as keyof typeof ADMIN_ORG_TRANSITIONS;

    it(`${move}: lands where the domain says it lands`, () => {
      expect(nextStatus(edge.from, move)).toBe(edge.to);
    });

    it(`${move}: is legal from exactly one state, the one the admin write guards on`, () => {
      const legalFrom = OrgRegistrationStatus.options.filter((s) =>
        canTransition(s, move),
      );
      expect(legalFrom).toEqual([edge.from]);
    });
  }

  it('refuses the illegal moves the console must answer with 409', () => {
    // Reinstating a business that is not suspended, and suspending one that
    // is already suspended or not yet trading.
    expect(canTransition('active', 'reinstated')).toBe(false);
    expect(canTransition('submitted', 'reinstated')).toBe(false);
    expect(canTransition('suspended', 'suspended')).toBe(false);
    expect(canTransition('approved', 'suspended')).toBe(false);
  });
});
