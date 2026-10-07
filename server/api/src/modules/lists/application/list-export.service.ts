import { MAX_EXPORT_ROWS, type ListQuery } from '@injishi/contracts';
import { Injectable, PayloadTooLargeException } from '@nestjs/common';

import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { SavedViewsRepository } from '../infrastructure/saved-views.repository';

/**
 * The export rules every list shares (058-list-framework AC-LF7): at most
 * `MAX_EXPORT_ROWS` rows, and one `report_runs` row per export naming who
 * exported which list with which filters.
 */
@Injectable()
export class ListExportService {
  constructor(private readonly views: SavedViewsRepository) {}

  /** 413 before any rows are read when the filtered list is too long to export. */
  assertExportable(total: number): void {
    if (total > MAX_EXPORT_ROWS) {
      throw new PayloadTooLargeException(
        `This view has ${total} rows, and an export holds at most ${MAX_EXPORT_ROWS}. Narrow the filters first.`,
      );
    }
  }

  async log(ws: ScopedWorkspace, userId: string, listKey: string, query: ListQuery, rowCount: number): Promise<void> {
    if (!ws.orgId) return;
    await this.views.logRun({
      orgId: ws.orgId,
      userId,
      kind: 'export',
      subject: listKey,
      filters: { q: query.q ?? null, filters: query.filters, sort: query.sort, groupBy: query.groupBy ?? null },
      rowCount,
    });
  }
}
