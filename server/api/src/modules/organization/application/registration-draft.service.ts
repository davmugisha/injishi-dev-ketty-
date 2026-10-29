import {
  RegistrationDraft,
  RegistrationDraftChecks,
  type RegistrantCapacity,
  type RegistrationDraftRead,
  type TinCheckResult,
} from '@injishi/contracts';
import { Injectable } from '@nestjs/common';

import { RegistrationDraftRepository } from '../infrastructure/registration-draft.repository';

/**
 * The registration wizard's answers, saved as they are typed (ADR-060, ADR-075
 * S9), one per person, and the checks the server writes beside them (D-m).
 *
 * A stored draft that no longer parses — the contract moved on since it was
 * saved — reads as no draft at all: it is a convenience, and a convenience
 * that breaks the wizard is worse than none. So does a check, part by part.
 *
 * The draft outlives the registration it becomes: the first Pay press marks it
 * with that registration (AC-14), and it goes when the registration's fee
 * settles (`OrganizationRepository.settleRegistrationFee`, D-m), so a helper's
 * next business starts clean.
 */
@Injectable()
export class RegistrationDraftService {
  constructor(private readonly drafts: RegistrationDraftRepository) {}

  async read(userId: string): Promise<RegistrationDraftRead> {
    const row = await this.drafts.find(userId);
    if (!row) return { draft: null, checks: {}, savedAt: null };
    const parsed = row.payload === null ? null : RegistrationDraft.safeParse(row.payload);
    const draft = parsed?.success ? parsed.data : null;
    return {
      draft,
      checks: checksOf(row.checks),
      savedAt: draft ? row.updatedAt.toISOString() : null,
    };
  }

  async save(userId: string, draft: RegistrationDraft): Promise<{ savedAt: string }> {
    return { savedAt: (await this.drafts.save(userId, draft)).toISOString() };
  }

  clear(userId: string): Promise<void> {
    return this.drafts.remove(userId);
  }

  /** What RRA answered, against the TIN and the capacity it was asked for. */
  recordTinCheck(
    userId: string,
    check: { tin: string; capacity: RegistrantCapacity | null; answer: TinCheckResult },
  ): Promise<void> {
    return this.drafts.recordTinCheck(userId, check);
  }

  /** The registration the caller's draft became, which its settled fee clears it by. */
  markRegistered(userId: string, orgId: string): Promise<void> {
    return this.drafts.markRegistered(userId, orgId);
  }
}

/** Each check that still reads, and none that does not. */
function checksOf(raw: unknown): RegistrationDraftRead['checks'] {
  const source = raw !== null && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const shape = RegistrationDraftChecks.shape;
  const tin = shape.tin.safeParse(source.tin);
  const scan = shape.scan.safeParse(source.scan);
  const registrationId = shape.registrationId.safeParse(source.registrationId);
  return {
    ...(tin.success && tin.data ? { tin: tin.data } : {}),
    ...(scan.success && scan.data ? { scan: scan.data } : {}),
    ...(registrationId.success && registrationId.data ? { registrationId: registrationId.data } : {}),
  };
}
