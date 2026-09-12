import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Throttle by PERSON, not by address (review 2.2).
 *
 * The routes this guards are behind `SessionGuard`, so a user id is always
 * there. Keying on it means a hotel lobby's shared NAT does not throttle every
 * guest at once, and a single account cannot dodge the limit by changing
 * networks. The IP is only the fallback for a route that forgot the session
 * guard, which should not exist.
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(req: {
    user?: { id?: string };
    ip?: string;
  }): Promise<string> {
    return req.user?.id ?? req.ip ?? 'anonymous';
  }
}
