import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';

import {
  CurrentSession,
  CurrentUser,
  SessionGuard,
  type SessionRecord,
  type SessionUser,
} from '../../../shared/auth/session.guard';
import {
  TwoFactorService,
  maskEmail,
  type TwoFactorStatus,
} from '../../../shared/auth/two-factor.service';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';

/**
 * The emailed step-up code, for the signed-in person (F-S02).
 *
 * Every route here needs only a SESSION, deliberately: this is the screen a
 * person is sent to when a guarded route refuses them, so it cannot itself sit
 * behind that refusal.
 *
 * There is no setup or disable route any more. An emailed code needs nothing
 * enrolled, which is the whole reason it replaced the authenticator app.
 */

const CodeInput = z.object({
  /** The six digits from the email. */
  code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code.'),
});
type CodeInput = z.infer<typeof CodeInput>;

@Controller('me/two-factor')
@UseGuards(SessionGuard)
export class TwoFactorController {
  constructor(private readonly twoFactor: TwoFactorService) {}

  /** Where a code would go, and whether this session still needs one. */
  @Get()
  async status(
    @CurrentUser() user: SessionUser,
    @CurrentSession() session: SessionRecord,
  ): Promise<TwoFactorStatus & { sentTo: string }> {
    const status = await this.twoFactor.statusFor(user.id, session.id);
    return { ...status, sentTo: maskEmail(user.email) };
  }

  /** Email a fresh code for this session. Replaces any code still pending. */
  @Post('send')
  send(
    @CurrentUser() user: SessionUser,
    @CurrentSession() session: SessionRecord,
  ): Promise<{ sentTo: string; expiresInSeconds: number }> {
    return this.twoFactor.sendCode(user.id, session.id);
  }

  /** A matching code marks THIS session stepped up. */
  @Post('verify')
  async verify(
    @CurrentUser() user: SessionUser,
    @CurrentSession() session: SessionRecord,
    @Body(new ZodValidationPipe(CodeInput)) body: CodeInput,
  ): Promise<{ verified: true }> {
    await this.twoFactor.verify(user.id, session.id, body.code);
    return { verified: true };
  }
}
