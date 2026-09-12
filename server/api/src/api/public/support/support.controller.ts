import {
  CreateSupportTicketInput,
  type CreateSupportTicketResult,
} from '@injishi/contracts';
import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';

import type { SessionUser } from '../../../shared/auth/session.guard';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';
import { OptionalSessionGuard, OptionalUser } from './optional-session.guard';
import { SupportThrottlerGuard } from './support-throttler.guard';
import { SupportTicketService } from './support-ticket.service';

/**
 * The public support intake (web `/support` contact form).
 *
 * Anonymous by design, so it carries the controls a public write needs:
 *
 * - `SupportThrottlerGuard` runs FIRST — per client and per email, limits and
 *   reasons in that file — so a flood is refused before it costs a session
 *   lookup or a database write.
 * - `OptionalSessionGuard` then attributes the ticket to the signed-in person
 *   when there is one. The requester comes only from the session; the contract
 *   refuses any body key that would claim one.
 * - The body is parsed by the `@injishi/contracts` schema the form is typed
 *   against, which caps every string and closes the topic to four slugs.
 *
 * It answers 201 with the ticket id alone. The message is never echoed.
 */
@Controller({ path: 'support', version: '1' })
@UseGuards(SupportThrottlerGuard, OptionalSessionGuard)
export class SupportController {
  constructor(private readonly tickets: SupportTicketService) {}

  @Post('tickets')
  @HttpCode(201)
  open(
    @Body(new ZodValidationPipe(CreateSupportTicketInput))
    body: CreateSupportTicketInput,
    @OptionalUser() user: SessionUser | null,
  ): Promise<CreateSupportTicketResult> {
    return this.tickets.open(body, user?.id ?? null);
  }
}
