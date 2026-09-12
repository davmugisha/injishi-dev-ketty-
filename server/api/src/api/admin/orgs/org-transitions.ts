import type { OrgRegistrationStatus } from '@injishi/contracts';

/**
 * The two lifecycle moves a staffer makes on a business from the console.
 *
 * WHY THESE EDGES ARE WRITTEN HERE AND NOT IMPORTED. The state machine that
 * owns them is `modules/organization/domain/registration-status.ts`, and this
 * area may not import a domain module's internals (`admin-api.module.ts`). The
 * organization module exports no suspend or reinstate use case to call
 * instead, so the admin write carries its own copy of the two edges it needs —
 * and `org-transitions.spec.ts` fails the build the moment they stop agreeing
 * with the domain table. A copy guarded by a test that names its owner is a
 * cache; an unguarded one would be a second rule.
 *
 * The legal source for each move is ONE state, which is what lets the write be
 * a single conditional UPDATE: the `from` in its WHERE clause is both the
 * legality check and the concurrency control, so two staffers suspending at
 * once cannot both succeed and the loser gets a 409 rather than a second audit
 * row describing a change that did not happen.
 */
export const ADMIN_ORG_TRANSITIONS = {
  suspended: {
    from: 'active',
    to: 'suspended',
    eventType: 'admin.org.suspended',
  },
  reinstated: {
    from: 'suspended',
    to: 'active',
    eventType: 'admin.org.reinstated',
  },
} as const satisfies Record<
  'suspended' | 'reinstated',
  {
    from: OrgRegistrationStatus;
    to: OrgRegistrationStatus;
    eventType: string;
  }
>;

export type AdminOrgMove = keyof typeof ADMIN_ORG_TRANSITIONS;
