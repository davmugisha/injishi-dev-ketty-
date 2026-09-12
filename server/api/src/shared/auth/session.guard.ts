import type { AuthInstance } from '@injishi/auth';
import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';

import { AUTH_INSTANCE } from '../../modules/auth/auth.module';

/** The authenticated principal a guarded route sees (F-S01). */
export interface SessionUser {
  id: string;
  email: string;
  name?: string | null;
}

/**
 * The session row itself. Carried alongside the user because the active
 * workspace is persisted ON the session (`sessions.active_workspace_id`), so a
 * route that switches workspace needs to know WHICH session to write.
 */
export interface SessionRecord {
  id: string;
}

/** Minimal structural view of the request we touch (Fastify, see auth-http.ts). */
interface RequestWithUser {
  headers: Record<string, string | string[] | undefined>;
  user?: SessionUser;
  session?: SessionRecord;
}

/** Better Auth's server-side session lookup, narrowed from `api: Record<string, unknown>`. */
type GetSession = (args: {
  headers: Headers;
}) => Promise<{ user?: SessionUser; session?: SessionRecord } | null>;

function toHeaders(raw: RequestWithUser['headers']): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(raw)) {
    if (Array.isArray(value)) value.forEach((v) => headers.append(key, v));
    else if (value != null) headers.append(key, String(value));
  }
  return headers;
}

/**
 * Resolves the Better Auth session from the request cookies and attaches the
 * user to the request. The sign-in gate fires just before a commitment
 * (booking confirm/pay, lease signing) — never on a browse route (FL03).
 *
 * Never hand-roll auth checks that bypass this guard (shared/auth/README).
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(@Inject(AUTH_INSTANCE) private readonly auth: AuthInstance) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const getSession = this.auth.api.getSession as unknown as GetSession;

    const session = await getSession({ headers: toHeaders(request.headers) });
    if (!session?.user?.id) {
      throw new UnauthorizedException('Sign in to continue.');
    }

    request.user = session.user;
    request.session = session.session;
    return true;
  }
}

/** Injects the guarded route's session row. Use with `@UseGuards(SessionGuard)`. */
export const CurrentSession = createParamDecorator(
  (_data: unknown, context: ExecutionContext): SessionRecord => {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    if (!request.session) {
      // Programming error: the route forgot @UseGuards(SessionGuard).
      throw new UnauthorizedException('No session on request.');
    }
    return request.session;
  },
);

/** Injects the guarded route's authenticated user. Use with `@UseGuards(SessionGuard)`. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): SessionUser => {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    if (!request.user) {
      // Programming error: the route forgot @UseGuards(SessionGuard).
      throw new UnauthorizedException('No session on request.');
    }
    return request.user;
  },
);
