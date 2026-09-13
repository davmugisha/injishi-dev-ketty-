import {
  WaitlistSignupInput,
  type WaitlistSignupResult,
  type WaitlistUnsubscribeResult,
} from '@injishi/contracts';
import {
  Body,
  Controller,
  HttpCode,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';

import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';
import { WaitlistThrottlerGuard } from './waitlist-throttler.guard';
import { WaitlistService } from './waitlist.service';

/**
 * The minimum of a Fastify reply this controller touches.
 *
 * Structural, the way `auth-http.ts` does it, so nothing here depends on the
 * adapter's types for one status code.
 */
interface RawReply {
  status(code: number): RawReply;
}

/**
 * The public waitlist intake (ADR-048).
 *
 * Anonymous by design on a domain that is not launched, so it carries the
 * controls a public write needs, in this order:
 *
 * - `WaitlistThrottlerGuard` runs FIRST, so a flood is refused before it costs
 *   a database write. Its two buckets and the reason the client one reads the
 *   forwarded header are in that file.
 * - The body is then parsed by the `@injishi/contracts` schema the form is
 *   typed against, which caps every string, closes all three enums, and makes
 *   an owner's five extra fields required as a matter of type rather than of
 *   hope.
 *
 * There is no session guard, and that is deliberate: the person joining a
 * waitlist for an unlaunched product has no account by definition.
 */
@Controller({ path: 'waitlist', version: '1' })
export class WaitlistController {
  constructor(private readonly waitlist: WaitlistService) {}

  /**
   * 201 for a new row, 200 when the address was already stored.
   *
   * The status is set on the reply rather than fixed with `@HttpCode`, because
   * which of the two happened is only known after the insert. The body is the
   * row id and a boolean: nothing the caller sent is echoed back (AC-9).
   */
  @Post('signups')
  @UseGuards(WaitlistThrottlerGuard)
  async join(
    @Body(new ZodValidationPipe(WaitlistSignupInput))
    body: WaitlistSignupInput,
    @Res({ passthrough: true }) reply: RawReply,
  ): Promise<WaitlistSignupResult> {
    const result = await this.waitlist.join(body);
    reply.status(result.alreadyJoined ? 200 : 201);
    return result;
  }

  /**
   * Leave the list. POST rather than GET on purpose: a mail client that
   * prefetches links would otherwise unsubscribe people who never clicked.
   *
   * Unthrottled, and it should stay that way. There is nothing to flood (the
   * write is idempotent and sets one timestamp), and a throttle here would
   * answer differently for a repeated token, which is exactly the distinction
   * AC-12 exists to erase.
   */
  @Post('unsubscribe/:token')
  @HttpCode(200)
  leave(@Param('token') token: string): Promise<WaitlistUnsubscribeResult> {
    return this.waitlist.unsubscribe(token);
  }
}
