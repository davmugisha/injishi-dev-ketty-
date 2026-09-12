import { Injectable } from '@nestjs/common';
import {
  AdminAccessLogResponse,
  AdminAuditResponse,
  type AdminAuditQuery,
} from '@injishi/contracts';

import { AdminGovernanceRepository } from './admin-governance.repository';

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 25;

/**
 * The audit trail and the PII trail beside it -> INTERFACE.md §8.
 *
 * TWO TABLES AND TWO ROUTES, not one merged feed. `audit_events` records what
 * the platform DID; `record_access_logs` records what staff READ. Merging them
 * would produce a stream in which "approved this org" and "looked at this
 * person's national id" sort together and neither can be counted, and the
 * second is the one a data subject request has to be answered from.
 */
@Injectable()
export class AdminAuditService {
  constructor(private readonly repo: AdminGovernanceRepository) {}

  /** The event log, filtered and paged. */
  async listEvents(query: AdminAuditQuery): Promise<AdminAuditResponse> {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const offset = (page - 1) * pageSize;

    const [total, rows] = await Promise.all([
      this.repo.countAuditEvents(query),
      this.repo.listAuditEvents(query, pageSize, offset),
    ]);

    const items = rows.map((row) => ({
      id: row.id,
      actorUserId: row.actorUserId,
      actorName: row.actorName,
      // Carried apart from `actorUserId` on purpose: "staff X did this" and
      // "staff X did this AS user Y" are different facts, and collapsing them
      // loses the one the trail exists to record.
      impersonatedUserId: row.impersonatedUserId,
      subjectType: row.subjectType,
      subjectId: row.subjectId,
      eventType: row.eventType,
      reason: row.reason,
      districtId: row.districtId,
      occurredAt: row.occurredAt.toISOString(),
    }));

    return AdminAuditResponse.parse({
      items,
      meta: { total, page, pageSize },
    });
  }

  /**
   * Who read whose record, and why.
   *
   * NOT CALLER-PAGED: `@injishi/contracts` defines no `AdminAccessLogQuery`,
   * and this leaf may not invent a wire shape outside the package that owns
   * them. The newest page is returned and `meta.total` reports the TRUE row
   * count, so the console can state plainly that it is showing the most recent
   * slice of a larger trail rather than implying the trail is that short.
   */
  async listAccessLogs(): Promise<AdminAccessLogResponse> {
    const page = 1;
    const pageSize = DEFAULT_PAGE_SIZE;

    const [total, rows] = await Promise.all([
      this.repo.countAccessLogs(),
      this.repo.listAccessLogs(pageSize, 0),
    ]);

    const items = rows.map((row) => ({
      id: row.id,
      actorUserId: row.actorUserId,
      actorName: row.actorName,
      subjectUserId: row.subjectUserId,
      subjectRef: row.subjectRef,
      dataClass: row.dataClass,
      // NOT nullable, here or on the table. A read of another person's data
      // without a stated reason is what this trail exists to make impossible.
      reason: row.reason,
      occurredAt: row.occurredAt.toISOString(),
    }));

    return AdminAccessLogResponse.parse({
      items,
      meta: { total, page, pageSize },
    });
  }
}
