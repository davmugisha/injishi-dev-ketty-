import { RegistrationDraft } from '@injishi/contracts';
import { Injectable } from '@nestjs/common';

import { RegistrationDraftRepository } from '../infrastructure/registration-draft.repository';

/**
 * The registration wizard's answers between steps (ADR-060), one per person.
 *
 * A stored draft that no longer parses — the contract moved on since it was
 * saved — reads as no draft at all: it is a convenience, and a convenience
 * that breaks the wizard is worse than none. Creating the registration clears
 * it (`RegistrationService.create`), so a finished registration never offers
 * to resume.
 */
@Injectable()
export class RegistrationDraftService {
  constructor(private readonly drafts: RegistrationDraftRepository) {}

  async read(userId: string): Promise<{ draft: RegistrationDraft; savedAt: string } | null> {
    const row = await this.drafts.find(userId);
    if (!row) return null;
    const parsed = RegistrationDraft.safeParse(row.payload);
    return parsed.success ? { draft: parsed.data, savedAt: row.updatedAt.toISOString() } : null;
  }

  save(userId: string, draft: RegistrationDraft): Promise<void> {
    return this.drafts.save(userId, draft);
  }

  clear(userId: string): Promise<void> {
    return this.drafts.remove(userId);
  }
}
