import { RegistrationDraft } from '@injishi/contracts';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Put,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { RegistrationDraftService } from '../../../modules/organization/application/registration-draft.service';
import {
  CurrentUser,
  SessionGuard,
  type SessionUser,
} from '../../../shared/auth/session.guard';
import { UserThrottlerGuard } from '../../../shared/http/user-throttler.guard';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';

/**
 * The registration wizard's answers between steps → /api/v1/me/registration-draft
 * (ADR-060). Saved after each step, so a person can close the tab, come back
 * on another day or another device, and carry on where they were.
 *
 * The body is a `RegistrationDraft`, which refuses an ID number structurally
 * (its contract says how), so this route can never become a place where
 * National IDs pile up outside `identity_documents` and its access log.
 */
@Controller({ path: 'me/registration-draft', version: '1' })
@UseGuards(SessionGuard, UserThrottlerGuard)
export class RegistrationDraftController {
  constructor(private readonly drafts: RegistrationDraftService) {}

  @Get()
  @Throttle({ money: { limit: 60, ttl: 60_000 } })
  async read(@CurrentUser() user: SessionUser): Promise<{ draft: RegistrationDraft; savedAt: string }> {
    const found = await this.drafts.read(user.id);
    if (!found) throw new NotFoundException('No registration draft.');
    return found;
  }

  @Put()
  @HttpCode(204)
  @Throttle({ money: { limit: 60, ttl: 60_000 } })
  async save(
    @Body(new ZodValidationPipe(RegistrationDraft)) body: RegistrationDraft,
    @CurrentUser() user: SessionUser,
  ): Promise<void> {
    await this.drafts.save(user.id, body);
  }

  @Delete()
  @HttpCode(204)
  async remove(@CurrentUser() user: SessionUser): Promise<void> {
    await this.drafts.clear(user.id);
  }
}
