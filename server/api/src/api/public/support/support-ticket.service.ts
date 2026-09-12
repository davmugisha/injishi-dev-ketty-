import type {
  CreateSupportTicketInput,
  CreateSupportTicketResult,
} from '@injishi/contracts';
import { Inject, Injectable } from '@nestjs/common';

import { supportTickets } from '../../../database/drizzle/governance';
import {
  DRIZZLE,
  type Database,
} from '../../../shared/database/database.module';

/**
 * Opens a support ticket from the public intake.
 *
 * This refused with 501 until migration 0029. `support_tickets` had no column
 * for the three things the form exists to deliver — the message, an address to
 * reply to, and the sender's name — so a row written then would have reached
 * the moderation queue as a category and a clock, with no words and, for a
 * signed-out visitor, no way to answer them. Returning 201 over that would have
 * told a person their message was received while throwing it away, so it
 * refused instead. The columns exist now, and this stores all of it.
 *
 * WHAT IS STORED, AND HOW IT IS SHOWN. The message is kept as plain text,
 * exactly as validated by the contract (trimmed, at most 4,000 characters). It
 * is never interpreted as markup: the admin screen renders row fields as React
 * text children, which escape it. The topic becomes `category` and is one of a
 * fixed list, never free text, because it is the ticket's subject line in the
 * console.
 *
 * WHAT IS NOT DONE HERE. Throttling, validation and the optional session all
 * happen in front of this, in the controller and its guards; by the time a
 * call arrives the input is one the contract accepts from a caller within
 * both rate limits. Nothing is echoed back but the new id: a response that
 * repeats a stranger's text is a reflection surface, and the sender already
 * has what they wrote.
 */
@Injectable()
export class SupportTicketService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async open(
    input: CreateSupportTicketInput,
    requesterUserId: string | null,
  ): Promise<CreateSupportTicketResult> {
    const [row] = await this.db
      .insert(supportTickets)
      .values({
        requesterUserId,
        category: input.topic,
        state: 'open',
        message: input.message,
        // Required by the contract even for a signed-in sender: an account's
        // address can be stale or shared, and the person writing in has just
        // told us where they want the answer.
        contactEmail: input.email,
        contactName: input.name ?? null,
        contactPhone: input.phone ?? null,
      })
      .returning({ id: supportTickets.id });

    return { id: row.id };
  }
}
