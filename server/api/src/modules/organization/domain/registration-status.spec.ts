import { describe, expect, it } from 'vitest';

import type { OrgRegistrationStatus } from '@injishi/contracts';

import {
  awaitsGovernment,
  awaitsRegistrationFee,
  canActivate,
  canTransition,
  nextStatus,
  pendingOversightRole,
  type RegistrationEvent,
} from './registration-status';

/**
 * The registration state machine (D20, D23).
 *
 * These tests exist because every illegal move here is a real-world failure
 * with a cost: activating without approval puts an unvetted business in front
 * of the public, and re-billing a rejected registrant charges twice for one
 * registration. A state machine that quietly allows a move is indistinguishable
 * from no state machine.
 */
describe('registration state machine', () => {
  const ALL: OrgRegistrationStatus[] = [
    'pending_payment',
    'submitted',
    'tin_verified',
    'field_verified',
    'approved',
    'active',
    'rejected',
    'suspended',
  ];

  const EVENTS: RegistrationEvent[] = [
    'fee_settled',
    'tin_verified',
    'field_verified',
    'approved',
    'reviewed',
    'activated',
    'rejected',
    'resubmitted',
    'suspended',
    'reinstated',
  ];

  it('walks the happy path end to end', () => {
    const path: [OrgRegistrationStatus, RegistrationEvent, OrgRegistrationStatus][] =
      [
        ['pending_payment', 'fee_settled', 'submitted'],
        ['submitted', 'tin_verified', 'tin_verified'],
        ['tin_verified', 'field_verified', 'field_verified'],
        ['field_verified', 'approved', 'approved'],
        ['approved', 'activated', 'active'],
      ];
    for (const [from, event, to] of path) {
      expect(nextStatus(from, event)).toBe(to);
    }
  });

  it('refuses every move it does not explicitly allow', () => {
    // The default has to be denial. Enumerating the whole grid is what catches
    // a new state or event being added without a rule to govern it.
    let allowed = 0;
    for (const from of ALL) {
      for (const event of EVENTS) {
        if (canTransition(from, event)) allowed += 1;
      }
    }
    // 9 single-source events + rejection's 3 reviewable sources.
    expect(allowed).toBe(12);
  });

  it('lets a PSF District Manager approve in one review, from the first gate only', () => {
    expect(nextStatus('tin_verified', 'reviewed')).toBe('approved');
    for (const from of ALL) {
      if (from === 'tin_verified') continue;
      expect(nextStatus(from, 'reviewed')).toBeNull();
    }
  });

  it('never activates an org that skipped a gate', () => {
    for (const from of ALL) {
      if (from === 'approved' || from === 'suspended') continue;
      expect(nextStatus(from, 'activated')).toBeNull();
      expect(nextStatus(from, 'reinstated')).toBeNull();
    }
  });

  it('cannot reject a registration nobody has reviewed yet', () => {
    // pending_payment has not been paid, so it has not entered a queue. Letting
    // it be rejected would mean an officer saw work they were never sent.
    expect(nextStatus('pending_payment', 'rejected')).toBeNull();
  });

  it('resubmits to `submitted`, never back to `pending_payment`', () => {
    // D23: the fee is once per org, ever, and non-refundable. Landing back on
    // pending_payment would present a second bill for one registration.
    expect(nextStatus('rejected', 'resubmitted')).toBe('submitted');
    expect(nextStatus('rejected', 'fee_settled')).toBeNull();
  });

  it('treats only `active` as operational', () => {
    for (const s of ALL) {
      expect(canActivate(s)).toBe(s === 'active');
    }
  });

  it('separates "we owe you nothing yet" from "you owe us"', () => {
    expect(awaitsRegistrationFee('pending_payment')).toBe(true);
    expect(awaitsGovernment('pending_payment')).toBe(false);
    for (const s of ['submitted', 'tin_verified', 'field_verified'] as const) {
      expect(awaitsGovernment(s)).toBe(true);
      expect(awaitsRegistrationFee(s)).toBe(false);
    }
  });

  it('routes each waiting stage to the officer who owns it', () => {
    expect(pendingOversightRole('tin_verified')).toBe(
      'business_field_verifier',
    );
    expect(pendingOversightRole('field_verified')).toBe('business_approver');
    // Nothing else is an officer's to act on, including `submitted`, which is
    // waiting on RRA rather than on a person.
    for (const s of ALL) {
      if (s === 'tin_verified' || s === 'field_verified') continue;
      expect(pendingOversightRole(s)).toBeNull();
    }
  });
});
