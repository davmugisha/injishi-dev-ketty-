import { Injectable } from '@nestjs/common';
import { AdminCompliance } from '@injishi/contracts';

import { AdminGovernanceRepository } from './admin-governance.repository';

/**
 * How much of each list crosses the wire.
 *
 * `AdminCompliance` carries no `meta`, so this response is NOT paged — which
 * means the cap is the only thing standing between a staff session and an
 * unbounded select. The stats below are counted over the whole tables, so the
 * headline numbers stay true even when the lists are truncated.
 */
const LIST_LIMIT = 100;

/**
 * The NCSA posture and the data subject queue -> INTERFACE.md §7.
 *
 * ONE RESPONSE, THREE PARTS, because they answer one question together: are we
 * lawful, and is anybody waiting on us. Splitting the stats onto their own
 * route would let the console render a queue and a count that disagree, taken
 * a second apart.
 */
@Injectable()
export class AdminComplianceService {
  constructor(private readonly repo: AdminGovernanceRepository) {}

  async read(): Promise<AdminCompliance> {
    // One clock for the whole response. Reading `now` per query would let a
    // review tip from due to overdue between the count and the list, and the
    // screen would then show a number that no row on it explains.
    const now = new Date();

    const [artifacts, requests, stats] = await Promise.all([
      this.repo.listComplianceArtifacts(LIST_LIMIT),
      this.repo.listDataSubjectRequests(LIST_LIMIT),
      this.repo.complianceStats(now),
    ]);

    return AdminCompliance.parse({
      artifacts: artifacts.map((row) => ({
        id: row.id,
        artifactType: row.artifactType,
        processorName: row.processorName,
        reviewDueAt: row.reviewDueAt ? row.reviewDueAt.toISOString() : null,
        createdAt: row.createdAt.toISOString(),
      })),
      requests: requests.map((row) => ({
        id: row.id,
        subjectUserId: row.subjectUserId,
        requestType: row.requestType,
        state: row.state,
        // Both flags travel raw. `retentionExceptionApplied` records that
        // something was KEPT despite the request — a legal hold outranks a
        // deletion — and `dualAuthorized` says whether the second signature has
        // arrived. A queue that hid either would be worked in the wrong order.
        retentionExceptionApplied: row.retentionExceptionApplied,
        dualAuthorized: row.dualAuthorized,
        createdAt: row.createdAt.toISOString(),
      })),
      stats,
    });
  }
}
