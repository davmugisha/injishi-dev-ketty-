import {
  holdsIdNumber,
  RegistrationDraft,
  type RegistrationDraftRead,
  type RegistrationDraftSaved,
} from '@injishi/contracts';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Put,
  UnprocessableEntityException,
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
 * The registration wizard's answers → /api/v1/me/registration-draft (ADR-060),
 * saved as they are typed (ADR-075 S9, AC-9), so a person can close the tab,
 * come back on another day or another device, and reopen the step they left.
 *
 * The body is a `RegistrationDraft`, which refuses an ID number structurally
 * (its contract says how), so this route can never become a place where
 * National IDs pile up outside `identity_documents` and its access log. A body
 * holding one is a 422 before its shape is read; any other bad shape is the
 * validation pipe's 400.
 */
@Controller({ path: 'me/registration-draft', version: '1' })
@UseGuards(SessionGuard, UserThrottlerGuard)
export class RegistrationDraftController {
  constructor(private readonly drafts: RegistrationDraftService) {}

  /** The answers, the checks the server wrote beside them, and when the answers were saved; nulls when none. */
  @Get()
  @Throttle({ money: { limit: 60, ttl: 60_000 } })
  read(@CurrentUser() user: SessionUser): Promise<RegistrationDraftRead> {
    return this.drafts.read(user.id);
  }

  /**
   * Saved as the person types, debounced by the wizard: a burst of typing is
   * one save, so a minute of steady work stays far under the ceiling.
   */
  @Put()
  @HttpCode(200)
  @Throttle({ money: { limit: 120, ttl: 60_000 } })
  async save(@Body() body: unknown, @CurrentUser() user: SessionUser): Promise<RegistrationDraftSaved> {
    if (holdsIdNumber(body)) {
      throw new UnprocessableEntityException('A registration draft never holds an ID number.');
    }
    const draft = new ZodValidationPipe(RegistrationDraft).transform(body);
    return this.drafts.save(user.id, draft);
  }

  @Delete()
  @HttpCode(204)
  async remove(@CurrentUser() user: SessionUser): Promise<void> {
    await this.drafts.clear(user.id);
  }
}
