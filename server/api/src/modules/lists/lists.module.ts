import { Module } from '@nestjs/common';

import { ListExportService } from './application/list-export.service';
import { SavedViewsService } from './application/saved-views.service';
import { SavedViewsRepository } from './infrastructure/saved-views.repository';

/**
 * The list framework's server side (ADR-058, 058-list-framework): saved views
 * and the export log. The query compiler, the CSV writer and the bulk runner are
 * plain functions in `shared/lists/`, used by each module's own list routes.
 */
@Module({
  providers: [SavedViewsRepository, SavedViewsService, ListExportService],
  exports: [SavedViewsService, ListExportService],
})
export class ListsModule {}
