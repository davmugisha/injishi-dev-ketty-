import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';

import {
  SessionGuard,
  type SessionUser,
} from '../../../shared/auth/session.guard';

/**
 * Attribute a request to its signed-in person when there is one, and let it
 * through anonymously when there is not.
 *
 * The support form must work signed out — somebody who cannot sign in is
 * exactly who needs help — but a ticket from a signed-in guest should say who
 * sent it, so staff can open their bookings instead of asking.
 *
 * It EXTENDS `SessionGuard` rather than looking the session up itself, so there
 * is still one session resolver (shared/auth/README). Only the "no session"
 * refusal is swallowed; any other failure — Better Auth unable to reach its
 * store, say — still fails the request, because "we could not tell" is not the
 * same answer as "signed out".
 *
 * This grants nothing. It must never guard a route that changes what a person
 * can do: there, `SessionGuard` is the control and a missing session is a 401.
 */
@Injectable()
export class OptionalSessionGuard extends SessionGuard {
  override async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      return await super.canActivate(context);
    } catch (error) {
      if (error instanceof UnauthorizedException) return true;
      throw error;
    }
  }
}

/**
 * The signed-in person behind this request, or `null` for a visitor.
 * Pair with `OptionalSessionGuard`; `@CurrentUser()` would throw here.
 */
export const OptionalUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): SessionUser | null =>
    context.switchToHttp().getRequest<{ user?: SessionUser }>().user ?? null,
);
