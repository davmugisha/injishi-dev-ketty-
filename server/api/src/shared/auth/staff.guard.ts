import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  createParamDecorator,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  STAFF_PERMISSION_LABEL,
  staffAllows,
  staffRequiresStepUp,
  type StaffAccess,
  type StaffPermission,
} from '@injishi/contracts';

import { REQUIRE_STAFF_PERMISSION } from './require-staff-permission.decorator';
import { TwoFactorService, type TwoFactorRefusal } from './two-factor.service';
import { WorkspaceService } from './workspace.service';
import type { SessionRecord, SessionUser } from './session.guard';

interface RequestWithStaff {
  user?: SessionUser;
  session?: SessionRecord;
  staff?: StaffAccess;
}

/**
 * The step-up refusal, field for field the body `TwoFactorService.assertSatisfied`
 * throws.
 *
 * It has to exist here because the staff rule is not one that service knows
 * (see the guard's header), so for a staffer who holds nothing else there is no
 * service call that would throw it. The clients route on `code` alone — the
 * admin console's `refusalFor` turns it into `step_up` — so the one field that
 * must never drift is typed against the service's own `TwoFactorRefusal`:
 * renaming the code there fails the typecheck here, instead of silently turning
 * a staffer's step-up into "not allowed".
 */
const STAFF_STEP_UP_REFUSAL: {
  statusCode: 403;
  error: 'Forbidden';
  message: string;
  code: TwoFactorRefusal;
} = {
  statusCode: 403,
  error: 'Forbidden',
  message: 'Enter the code we emailed you to continue.',
  code: 'two_factor_required',
};

/**
 * The admin console's server-side boundary.
 *
 * Until this existed, the console had a door and nothing behind it: middleware
 * refused a request with no session cookie, and `staff-boundary.tsx` asked
 * `GET /api/v1/me/staff` and rendered a refusal for a non-staffer. Both run in
 * the browser. Neither stops a `curl` at `/api/v1/admin/finance/ledger` from a
 * hotelier's own cookie. This guard is the control; the two client checks are
 * affordances that keep a non-staffer from being shown a sidebar listing
 * Finance and Compliance, which is itself a disclosure.
 *
 * Composes as `@UseGuards(SessionGuard, StaffGuard)`, in that order, exactly as
 * `WorkspaceGuard` does — the pattern is copied on purpose, so an admin route
 * and an operator route fail the same way for the same wiring mistake.
 *
 * It answers THREE questions, in this order, and no others:
 *   1. Is this caller live platform staff?
 *   2. Has THIS session presented the emailed step-up code (F-S02)?
 *   3. Does the permission set that follows from their roles contain the
 *      permission the route declares?
 *
 * The order is the point. Staff comes before the step-up so a non-staffer is
 * told the console is not theirs, rather than asked for a code that would open
 * nothing. The step-up comes before the permission so a super_admin who has not
 * typed their code yet is sent to the code screen, not told their role "cannot"
 * do something it can.
 *
 * It deliberately does NOT answer "may they see this particular org's row".
 * Row-level scope is a property of a TARGET, and a list route resolves scope as
 * a `WHERE` clause rather than as a predicate — the same reasoning that keeps
 * region scope out of `OversightGuard`.
 *
 * THE STEP-UP, AND WHY IT IS TWO CALLS. Staff, of all people, must not be the
 * population exempt from F-S02, and until now they were: this header recorded
 * the check as owed, because each area module would have had to provide
 * `TwoFactorService` itself and the one that forgot would fail at boot.
 * `AdminSharedModule` now provides it once for all four, so every admin route
 * acquired the check at the same moment.
 *
 * `assertSatisfied` is called first, in the position `WorkspaceGuard` and
 * `OversightGuard` call it, so a staffer who ALSO holds an operator workspace
 * or an oversight assignment is refused through the one shared path. But that
 * path decides who is required with `TwoFactorService.requiredFor`, which
 * counts workspaces and assignments and never staff. For a staffer who holds
 * neither, it returns without asking whether this session stepped up, so relying
 * on it alone would have looked enforced and waved every such staffer through.
 * The second call closes that gap: `staffRequiresStepUp` (the rule `/me/staff`
 * reports too) says a staffer is required, and `stateFor` answers the only
 * question left. When `requiredFor` learns to count staff, the second call is
 * redundant and should be deleted, which leaves this guard shaped exactly like
 * its two siblings. `requiredFor` belongs to the step-up's own work, not to the
 * admin console, which is why the staff rule is carried here until then rather
 * than bolted onto it.
 *
 * There is no enrolment to check first. The emailed code needs nothing set up;
 * `admin_users.two_factor_enrolled` is a leftover of the TOTP scheme it replaced
 * and plays no part in the decision.
 */
@Injectable()
export class StaffGuard implements CanActivate {
  constructor(
    private readonly workspaces: WorkspaceService,
    private readonly twoFactor: TwoFactorService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithStaff>();

    if (!request.user?.id) {
      // Programming error: the route forgot SessionGuard, or ordered it after
      // this one. Fail loudly rather than treating it as anonymous.
      //
      // A 403 here would look like a working control from the outside and read
      // as "that staffer lost their access" in a log, so nobody would ever go
      // looking for the missing decorator. A 500 is noisy and gets fixed.
      throw new InternalServerErrorException(
        'StaffGuard ran without a session. Add SessionGuard before it.',
      );
    }

    // ONE reader of `admin_users`, and it is the one `/api/v1/me/staff`
    // already calls. Writing a second query here is the drift this codebase
    // keeps deleting: two copies of "which row counts as staff" means the
    // console can be told one thing while the API enforces another, and the
    // `revoked_at` predicate is exactly the clause a second copy forgets.
    //
    // `staffAccessForUser` filters `isNull(adminUsers.revokedAt)` in the same
    // `WHERE` as the user id, so a withdrawn grant produces no row and falls
    // through to `NO_STAFF_ACCESS` — `isStaff: false`, no roles, no
    // permissions. Revocation is therefore enforced by the absence of a row
    // rather than by a caller remembering to check a timestamp.
    const access = await this.workspaces.staffAccessForUser(request.user.id);

    if (!access.isStaff) {
      // Same answer for "never was staff" and "was staff until yesterday". A
      // probe learns nothing from the wording, and there is nothing useful to
      // tell a person who is not staff except that this is not for them.
      throw new ForbiddenException('This console is for platform staff.');
    }

    // The step-up (F-S02). The code is proved on a SESSION — the challenge and
    // `twoFactorVerifiedAt` are both keyed by session, not by person — so with
    // no session record there is nothing to check. `WorkspaceGuard` and
    // `OversightGuard` skip the check in that case; this guard refuses instead,
    // because skipping turns "could not check" into "passed", and on the one
    // console that reads every account on the platform that is the wrong way to
    // fail. `SessionGuard` always attaches the session beside the user, so
    // reaching this branch is a wiring mistake, and a 500 gets it fixed.
    const sessionId = request.session?.id;
    if (!sessionId) {
      throw new InternalServerErrorException(
        'StaffGuard ran without a session record. Add SessionGuard before it.',
      );
    }

    // The shared rule, through the same call and in the same position as the
    // two sibling guards: a staffer who is also an operator or an officer is
    // refused with exactly the body those guards send.
    await this.twoFactor.assertSatisfied(request.user.id, sessionId);

    // The staff rule, which `requiredFor` does not know (see the header). The
    // test is true for everyone who got this far; it is spelled out rather than
    // assumed so this guard and `/me/staff` read the same named rule, and a
    // change to who owes the code changes both at once.
    if (staffRequiresStepUp(access)) {
      const { verified } = await this.twoFactor.stateFor(
        request.user.id,
        sessionId,
      );
      if (!verified) throw new ForbiddenException(STAFF_STEP_UP_REFUSAL);
    }

    const required = this.reflector.getAllAndOverride<
      StaffPermission | undefined
    >(REQUIRE_STAFF_PERMISSION, [context.getHandler(), context.getClass()]);

    // `staffAllows` rather than a bare `.includes` — the one predicate both the
    // API and the console call, so a refusal here and a hidden control there
    // can never disagree about what holding a permission means.
    if (required && !staffAllows(access.permissions, required)) {
      // Name the missing capability in plain words. A staffer refused a route
      // needs to know which power to ask for, and `STAFF_PERMISSION_LABEL` is
      // the wording the console shows for the same power — one phrasing, so a
      // support conversation is about the same thing on both ends.
      throw new ForbiddenException(
        `Your staff role cannot ${STAFF_PERMISSION_LABEL[required]}.`,
      );
    }

    request.staff = access;
    return true;
  }
}

/**
 * Injects the resolved staff access. Throws when the route forgot the guard,
 * mirroring `@CurrentUser()` and `@CurrentWorkspace()` so the same class of
 * mistake fails the same way everywhere.
 *
 * Handing back `NO_STAFF_ACCESS` instead would be worse than throwing: a
 * handler reading `staff.permissions` would quietly see an empty array, decide
 * the caller may do nothing, and return an empty page on an UNGUARDED route —
 * a security hole wearing the costume of a working feature.
 */
export const CurrentStaff = createParamDecorator(
  (_data: unknown, context: ExecutionContext): StaffAccess => {
    const request = context.switchToHttp().getRequest<RequestWithStaff>();
    if (!request.staff) {
      throw new InternalServerErrorException(
        'No staff access on request. Add @UseGuards(SessionGuard, StaffGuard).',
      );
    }
    return request.staff;
  },
);
