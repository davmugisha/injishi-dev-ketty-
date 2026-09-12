import { Injectable } from '@nestjs/common';
import { AdminModeration } from '@injishi/contracts';

import {
  AdminGovernanceRepository,
  type AdminReviewRow,
} from './admin-governance.repository';

/**
 * `AdminModeration` carries no `meta`, so this response is not paged and the
 * cap is the only bound on three append-only tables.
 */
const LIST_LIMIT = 100;

/**
 * The moderation desk -> INTERFACE.md §11.
 *
 * Reviews, tickets and escalations in one response because a moderator works
 * them as one queue: a review gets reported, a ticket is opened about it, and
 * an escalation is where it ends up. Three routes would make the console fetch
 * three times to render one screen.
 *
 * READ ONLY. Hiding a review or resolving an escalation is a mutation with its
 * own audit row and its own permission, and a bare `PATCH` that wrote
 * `moderation_state` would skip both. Recorded as owed rather than half built.
 */
@Injectable()
export class AdminModerationService {
  constructor(private readonly repo: AdminGovernanceRepository) {}

  async read(): Promise<AdminModeration> {
    const [reviews, tickets, escalations] = await Promise.all([
      this.repo.listModeratedReviews(LIST_LIMIT),
      this.repo.listSupportTickets(LIST_LIMIT),
      this.repo.listEscalations(LIST_LIMIT),
    ]);

    return AdminModeration.parse({
      reviews: reviews.map((row) => ({
        id: row.id,
        propertyName: row.propertyName,
        authorName: toAuthorName(row),
        // `overall_rating` is null on a host-to-guest review, which has no star
        // rating at all. Null, never 0: zero stars is a judgement nobody made.
        rating: row.rating,
        body: row.body,
        // A plain string, because `reviews.moderation_state` is a `text` column
        // defaulting to `visible` and not a `pgEnum`. The console must treat an
        // unfamiliar value as data rather than as a broken row.
        state: row.state,
        createdAt: row.createdAt.toISOString(),
      })),
      tickets: tickets.map((row) => ({
        id: row.id,
        requesterUserId: row.requesterUserId,
        category: row.category,
        state: row.state,
        domain: row.domain,
        districtId: row.districtId,
        // Both timestamps raw, so the console never has to agree with the
        // server about how a response time is measured.
        firstResponseAt: row.firstResponseAt
          ? row.firstResponseAt.toISOString()
          : null,
        resolvedAt: row.resolvedAt ? row.resolvedAt.toISOString() : null,
        // Null until the requester scores it, which is not the same as zero.
        csat: row.csat,
        createdAt: row.createdAt.toISOString(),
      })),
      escalations: escalations.map((row) => ({
        id: row.id,
        subjectType: row.subjectType,
        subjectId: row.subjectId,
        type: row.type,
        state: row.state,
        ownerUserId: row.ownerUserId,
        resolutionNote: row.resolutionNote,
        districtId: row.districtId,
        createdAt: row.createdAt.toISOString(),
      })),
    });
  }
}

/**
 * Who wrote the review.
 *
 * DERIVED, because `reviews` has no author column at all — the side of the stay
 * is what identifies the writer. A guest-to-host review was written by the
 * guest, so the account name is used and the walk-in name captured on the stay
 * is the fallback, in that order, because an account stays current when the
 * person renames themselves.
 *
 * A host-to-guest review returns NULL rather than the property's name. It was
 * written by the business, not by a named person, and putting an org name in a
 * field the console labels as an author would make a company look like an
 * individual on a screen where moderators act against individuals.
 */
function toAuthorName(row: AdminReviewRow): string | null {
  if (row.side !== 'guest_to_host') return null;
  return row.accountName ?? row.walkInName;
}
